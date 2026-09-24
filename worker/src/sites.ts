/**
 * Websites: Datenmodell, Eingabeprüfung, Speicherung und Auslieferung als
 * Remote-Konfiguration für consent-kit.
 */
import type { RemoteService, RemoteSiteConfig } from '../../src/remote/index';
import type { D1Database } from './db';

export interface SiteTexts {
  bannerTitle?: string;
  bannerDescription?: string;
}

export interface SiteSettings {
  name: string;
  /** Origins, z. B. "https://www.meine-seite.de". */
  domains: string[];
  owner: string;
  language: 'de' | 'en' | 'auto';
  links: { imprint: string; privacy: string };
  cookieDomain: string;
  respectGpc: boolean;
  logging: boolean;
  services: RemoteService[];
  texts: { de?: SiteTexts; en?: SiteTexts };
  ui: {
    position: 'bottom' | 'center';
    colorScheme: 'auto' | 'light' | 'dark';
    accent?: string;
    buttonBackground?: string;
    buttonText?: string;
    radius?: string;
  };
}

export interface Site {
  id: string;
  settings: SiteSettings;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export const SITE_ID = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
const ORIGIN = /^https?:\/\/[a-z0-9.-]+(?::\d{1,5})?$/i;
const COLOR = /^#[0-9a-f]{6}$/i;
const RADIUS = /^\d{1,2}px$/;
const COOKIE_DOMAIN = /^\.?[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

export type ValidationResult = { ok: true; value: SiteSettings } | { ok: false; errors: string[] };

function text(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function link(v: unknown): string | null {
  const s = text(v, 300);
  if (!s) return null;
  if (s.startsWith('/') && !s.startsWith('//')) return s;
  try {
    const url = new URL(s);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

/** Prüft die Eingaben aus der Admin-Oberfläche. Fehlermeldungen auf Deutsch. */
export function validateSettings(input: unknown): ValidationResult {
  const errors: string[] = [];
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;

  const name = text(raw.name, 100);
  if (!name) errors.push('Bitte einen Namen angeben.');

  const domainList = Array.isArray(raw.domains) ? raw.domains : typeof raw.domains === 'string' ? raw.domains.split(/[\s,]+/) : [];
  const domains = [...new Set(domainList.map((d) => text(d, 200).replace(/\/+$/, '').toLowerCase()).filter(Boolean))];
  if (domains.length === 0) errors.push('Bitte mindestens eine Domain angeben, z. B. https://www.meine-seite.de');
  for (const d of domains) {
    if (!ORIGIN.test(d)) errors.push(`„${d}“ ist keine gültige Adresse. Beispiel: https://www.meine-seite.de (ohne Pfad).`);
  }
  if (domains.length > 20) errors.push('Maximal 20 Domains pro Website.');

  const links = (raw.links ?? {}) as Record<string, unknown>;
  const imprint = link(links.imprint);
  const privacy = link(links.privacy);
  if (!imprint) errors.push('Bitte den Link zum Impressum angeben (z. B. /impressum).');
  if (!privacy) errors.push('Bitte den Link zur Datenschutzerklärung angeben (z. B. /datenschutz).');

  const language = raw.language === 'en' || raw.language === 'auto' ? raw.language : 'de';
  const cookieDomain = text(raw.cookieDomain, 100).toLowerCase();
  if (cookieDomain && !COOKIE_DOMAIN.test(cookieDomain)) errors.push('Cookie-Domain ungültig, Beispiel: .meine-seite.de');

  const services: RemoteService[] = [];
  const rawServices = Array.isArray(raw.services) ? raw.services : [];
  const seen = new Set<string>();
  for (const s of rawServices as Array<Record<string, unknown>>) {
    const type = s?.type;
    if (typeof type !== 'string' || seen.has(type)) continue;
    seen.add(type);
    if (type === 'google-tag-manager') {
      const id = text(s.id, 30).toUpperCase();
      if (!/^GTM-[A-Z0-9]{4,12}$/.test(id)) errors.push('Google Tag Manager: Die Container-ID hat das Format GTM-XXXXXXX.');
      const analytics = s.analytics !== false;
      const ads = s.ads !== false;
      if (!analytics && !ads) errors.push('Google Tag Manager: Mindestens Analytics oder Ads auswählen.');
      services.push({ type, id, analytics, ads });
    } else if (type === 'meta-pixel' || type === 'tiktok-pixel') {
      if (s.loadVia === 'gtm') {
        services.push({ type, loadVia: 'gtm' });
      } else {
        const id = text(s.id, 40);
        const valid = type === 'meta-pixel' ? /^\d{5,20}$/.test(id) : /^[A-Z0-9]{10,30}$/i.test(id);
        if (!valid) errors.push(type === 'meta-pixel' ? 'Meta Pixel: Die Pixel-ID besteht nur aus Ziffern.' : 'TikTok Pixel: Die Pixel-ID besteht aus Buchstaben und Ziffern (z. B. C1ABCD…).');
        services.push({ type, id, loadVia: 'kit' });
      }
    } else if (type === 'youtube' || type === 'google-maps') {
      services.push({ type });
    }
  }
  const viaGtm = services.some((s) => (s.type === 'meta-pixel' || s.type === 'tiktok-pixel') && s.loadVia === 'gtm');
  if (viaGtm && !services.some((s) => s.type === 'google-tag-manager')) {
    errors.push('Meta/TikTok „über GTM“ funktioniert nur, wenn auch der Google Tag Manager aktiviert ist.');
  }

  const rawTexts = (raw.texts ?? {}) as Record<string, Record<string, unknown> | undefined>;
  const texts: SiteSettings['texts'] = {};
  for (const lang of ['de', 'en'] as const) {
    const t = rawTexts[lang] ?? {};
    const bannerTitle = text(t.bannerTitle, 120);
    const bannerDescription = text(t.bannerDescription, 1500);
    if (bannerTitle || bannerDescription) {
      texts[lang] = { ...(bannerTitle ? { bannerTitle } : {}), ...(bannerDescription ? { bannerDescription } : {}) };
    }
  }

  const rawUi = (raw.ui ?? {}) as Record<string, unknown>;
  const ui: SiteSettings['ui'] = {
    position: rawUi.position === 'center' ? 'center' : 'bottom',
    colorScheme: rawUi.colorScheme === 'light' || rawUi.colorScheme === 'dark' ? rawUi.colorScheme : 'auto',
  };
  for (const key of ['accent', 'buttonBackground', 'buttonText'] as const) {
    const v = text(rawUi[key], 7);
    if (!v) continue;
    if (!COLOR.test(v)) errors.push(`Farbe „${v}“ ungültig – bitte im Format #1a2b3c.`);
    else ui[key] = v.toLowerCase();
  }
  const radius = text(rawUi.radius, 5);
  if (radius) {
    if (!RADIUS.test(radius)) errors.push('Eckenradius bitte als Zahl mit px, z. B. 8px.');
    else ui.radius = radius;
  }

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name,
      domains,
      owner: text(raw.owner, 200),
      language,
      links: { imprint: imprint!, privacy: privacy! },
      cookieDomain,
      respectGpc: raw.respectGpc === true,
      logging: raw.logging !== false,
      services,
      texts,
      ui,
    },
  };
}

/** Änderungen an diesen Angaben erfordern eine neue Einwilligung (Version wird erhöht). */
export function consentKey(settings: SiteSettings): string {
  return JSON.stringify([...settings.services].sort((a, b) => a.type.localeCompare(b.type)));
}

/** Remote-Konfiguration, wie sie die Websites unter /config/<id> abrufen. */
export function toRemoteConfig(site: Site, publicOrigin: string): RemoteSiteConfig {
  const s = site.settings;
  const theme: Record<string, string> = {};
  if (s.ui.accent) theme.accent = s.ui.accent;
  if (s.ui.buttonBackground) theme.buttonBackground = s.ui.buttonBackground;
  if (s.ui.buttonText) theme.buttonText = s.ui.buttonText;
  if (s.ui.radius) theme.radius = s.ui.radius;
  return {
    schema: 1,
    siteId: site.id,
    version: site.version,
    language: s.language,
    ...(s.owner ? { owner: s.owner } : {}),
    links: s.links,
    ...(s.cookieDomain ? { cookieDomain: s.cookieDomain } : {}),
    respectGpc: s.respectGpc,
    services: s.services,
    ...(Object.keys(s.texts).length ? { texts: s.texts } : {}),
    ui: { position: s.ui.position, colorScheme: s.ui.colorScheme, ...(Object.keys(theme).length ? { theme } : {}) },
    ...(s.logging ? { logging: { endpoint: `${publicOrigin}/log` } } : {}),
  };
}

// ------------------------------------------------------------ Datenbank

interface SiteRow {
  id: string;
  settings: string;
  version: number;
  consent_key: string;
  created_at: string;
  updated_at: string;
}

function fromRow(row: SiteRow): Site {
  return { id: row.id, settings: JSON.parse(row.settings) as SiteSettings, version: row.version, createdAt: row.created_at, updatedAt: row.updated_at };
}

export async function listSites(db: D1Database): Promise<Site[]> {
  const { results = [] } = await db.prepare('SELECT * FROM sites ORDER BY id').all<SiteRow>();
  return results.map(fromRow);
}

export async function getSite(db: D1Database, id: string): Promise<Site | null> {
  if (!SITE_ID.test(id)) return null;
  const { results = [] } = await db.prepare('SELECT * FROM sites WHERE id = ?').bind(id).all<SiteRow>();
  return results[0] ? fromRow(results[0]) : null;
}

export async function createSite(db: D1Database, id: string, settings: SiteSettings): Promise<Site> {
  const now = new Date().toISOString();
  await db
    .prepare('INSERT INTO sites (id, settings, version, consent_key, created_at, updated_at) VALUES (?, ?, 1, ?, ?, ?)')
    .bind(id, JSON.stringify(settings), consentKey(settings), now, now)
    .run();
  return (await getSite(db, id))!;
}

/** Speichert Änderungen. Ändern sich die Dienste, wird die Version erhöht (neue Abfrage). */
export async function updateSite(db: D1Database, site: Site, settings: SiteSettings, forceBump = false): Promise<{ site: Site; bumped: boolean }> {
  const key = consentKey(settings);
  const { results = [] } = await db.prepare('SELECT consent_key FROM sites WHERE id = ?').bind(site.id).all<{ consent_key: string }>();
  const bumped = forceBump || results[0]?.consent_key !== key;
  await db
    .prepare('UPDATE sites SET settings = ?, consent_key = ?, version = version + ?, updated_at = ? WHERE id = ?')
    .bind(JSON.stringify(settings), key, bumped ? 1 : 0, new Date().toISOString(), site.id)
    .run();
  return { site: (await getSite(db, site.id))!, bumped };
}

export async function deleteSite(db: D1Database, id: string): Promise<void> {
  await db.prepare('DELETE FROM sites WHERE id = ?').bind(id).run();
}

/** Alle freigegebenen Origins (für die Protokollierung), 60 s zwischengespeichert. */
let originCache: { expires: number; map: Map<string, string[]> } | null = null;

export async function originsBySite(db: D1Database): Promise<Map<string, string[]>> {
  if (originCache && originCache.expires > Date.now()) return originCache.map;
  const sites = await listSites(db);
  const map = new Map(sites.map((s) => [s.id, s.settings.domains]));
  originCache = { expires: Date.now() + 60_000, map };
  return map;
}

export function clearOriginCache(): void {
  originCache = null;
}
