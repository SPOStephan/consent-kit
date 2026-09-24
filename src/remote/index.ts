/**
 * consent-kit/remote – Einstellungen zentral aus dem consent-kit Backend laden.
 *
 * Das Backend liefert eine reine Daten-Beschreibung (JSON) der Website. Diese wird
 * hier in eine normale ConsentConfig mit den eingebauten Plugins übersetzt.
 * Unbekannte oder ungültige Einträge werden ignoriert (lieber ein Dienst zu wenig
 * als ein falsch konfigurierter).
 */
import {
  googleMaps,
  googleTagManager,
  metaPixel,
  tiktokPixel,
  youtube,
  type ConsentConfig,
  type ConsentPlugin,
  type DeepPartial,
  type Language,
  type Texts,
  type ThemeVariables,
} from 'consent-kit';

/** Dienst-Beschreibung im Remote-Format. */
export type RemoteService =
  | { type: 'google-tag-manager'; id: string; analytics?: boolean; ads?: boolean }
  | { type: 'meta-pixel'; id?: string; loadVia?: 'kit' | 'gtm' }
  | { type: 'tiktok-pixel'; id?: string; loadVia?: 'kit' | 'gtm' }
  | { type: 'youtube' }
  | { type: 'google-maps' };

/** Einstellungen einer Website, wie sie das Backend unter /config/<siteId> ausliefert. */
export interface RemoteSiteConfig {
  schema: 1;
  siteId: string;
  version: number;
  language?: Language | 'auto';
  owner?: string;
  links: { imprint: string; privacy: string };
  cookieDomain?: string;
  respectGpc?: boolean;
  services: RemoteService[];
  texts?: Partial<Record<Language, DeepPartial<Texts>>>;
  ui?: {
    position?: 'bottom' | 'center';
    colorScheme?: 'auto' | 'light' | 'dark';
    theme?: ThemeVariables;
    darkTheme?: ThemeVariables;
  };
  logging?: { endpoint: string };
}

export interface RemoteOptions {
  /** Adresse des Backends, z. B. "https://consent.meine-firma.de". */
  endpoint: string;
  /** Kennung der Website im Backend, z. B. "meine-seite". */
  siteId: string;
  /**
   * Rückfallebene, falls das Backend nicht erreichbar ist (vom Backend als
   * „Einbau-Code“ mitgeliefert). Ohne Rückfallebene lädt dann gar nichts.
   */
  fallback?: RemoteSiteConfig;
  /** Zusätzliche eigene Dienste (Plugins), z. B. linkedinInsight('123'). */
  services?: ConsentPlugin[];
  /** Zeitlimit in ms. Standard: 4000. */
  timeout?: number;
  /** Konsolenausgaben. */
  debug?: boolean;
}

const str = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

function toPlugin(s: RemoteService): ConsentPlugin | null {
  switch (s.type) {
    case 'google-tag-manager':
      if (!str(s.id) || !/^GTM-[A-Z0-9]+$/i.test(s.id)) return null;
      return googleTagManager({ id: s.id as `GTM-${string}`, analytics: s.analytics !== false, ads: s.ads !== false });
    case 'meta-pixel':
      if (s.loadVia === 'gtm') return metaPixel({ loadVia: 'gtm' });
      return str(s.id) && /^\d+$/.test(s.id) ? metaPixel({ id: s.id }) : null;
    case 'tiktok-pixel':
      if (s.loadVia === 'gtm') return tiktokPixel({ loadVia: 'gtm' });
      return str(s.id) && /^[A-Z0-9]+$/i.test(s.id) ? tiktokPixel({ id: s.id }) : null;
    case 'youtube':
      return youtube();
    case 'google-maps':
      return googleMaps();
    default:
      return null;
  }
}

/** Übersetzt die Remote-Beschreibung in eine ConsentConfig. */
export function fromRemoteConfig(remote: RemoteSiteConfig, extraServices: ConsentPlugin[] = []): ConsentConfig {
  if (!remote || remote.schema !== 1 || !remote.links || !Array.isArray(remote.services)) {
    throw new Error('consent-kit: ungültige Remote-Konfiguration');
  }
  const services = remote.services.map(toPlugin).filter((p): p is ConsentPlugin => p !== null);
  for (const extra of extraServices) if (!services.some((p) => p.id === extra.id)) services.push(extra);
  return {
    // Eigene Plugins fließen in die Version ein – kommt eins dazu, wird neu gefragt.
    version: extraServices.length ? `${remote.version}+${extraServices.map((p) => p.id).join(',')}` : remote.version,
    language: remote.language ?? 'de',
    owner: remote.owner,
    links: remote.links,
    cookie: remote.cookieDomain ? { domain: remote.cookieDomain } : undefined,
    respectGpc: remote.respectGpc === true,
    services,
    texts: remote.texts,
    ui: remote.ui,
    logging: remote.logging?.endpoint ? { endpoint: remote.logging.endpoint, siteId: remote.siteId } : undefined,
  };
}

/** Lädt die Einstellungen vom Backend (mit Zeitlimit) und fällt ggf. auf `fallback` zurück. */
export async function loadRemoteConfig(options: RemoteOptions): Promise<ConsentConfig> {
  const url = `${options.endpoint.replace(/\/$/, '')}/config/${encodeURIComponent(options.siteId)}`;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
  const timer = setTimeout(() => controller?.abort(), options.timeout ?? 4000);
  try {
    const response = await fetch(url, { signal: controller?.signal, credentials: 'omit', headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const remote = (await response.json()) as RemoteSiteConfig;
    if (remote.siteId !== options.siteId) throw new Error('falsche Website-Kennung');
    return fromRemoteConfig(remote, options.services);
  } catch (error) {
    if (options.fallback) {
      if (typeof console !== 'undefined') {
        console.warn(`consent-kit: Einstellungen konnten nicht geladen werden (${(error as Error).message}) – Rückfallebene wird verwendet.`);
      }
      return fromRemoteConfig(options.fallback, options.services);
    }
    throw new Error(`consent-kit: Einstellungen konnten nicht geladen werden (${(error as Error).message}).`);
  } finally {
    clearTimeout(timer);
  }
}
