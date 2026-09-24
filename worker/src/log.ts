/**
 * Protokollierung der Einwilligungen (Nachweis).
 * Es werden KEINE IP-Adressen und KEINE User-Agents gespeichert.
 */
import { json, type D1Database, type Env } from './db';
import { originsBySite } from './sites';

const MAX_BODY_BYTES = 4096;
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIONS = new Set(['accept-all', 'reject-all', 'custom', 'service']);
const KEY = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

export interface LogEntry {
  consentId: string;
  timestamp: string;
  configVersion: string;
  action: string;
  categories: Record<string, boolean>;
  services: Record<string, boolean>;
  gpc: boolean;
  domain: string;
  siteId: string | null;
}

// ------------------------------------------------------------ Rate-Limiting

const memoryLimits = new Map<string, { count: number; reset: number }>();

async function allowRequest(request: Request, env: Env): Promise<boolean> {
  // Die IP-Adresse wird nur flüchtig für die Begrenzung verwendet – nie gespeichert.
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  if (env.RATE_LIMITER) {
    const { success } = await env.RATE_LIMITER.limit({ key: ip });
    return success;
  }
  const limit = Number(env.RATE_LIMIT_PER_MINUTE ?? 30);
  const now = Date.now();
  const entry = memoryLimits.get(ip);
  if (!entry || entry.reset < now) {
    if (memoryLimits.size > 10_000) memoryLimits.clear();
    memoryLimits.set(ip, { count: 1, reset: now + 60_000 });
    return true;
  }
  entry.count++;
  return entry.count <= limit;
}

/** Nur für Tests. */
export function resetRateLimits(): void {
  memoryLimits.clear();
}

// ------------------------------------------------------------ Prüfung

function isBoolMap(value: unknown, max: number): value is Record<string, boolean> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const entries = Object.entries(value);
  return entries.length <= max && entries.every(([k, v]) => KEY.test(k) && typeof v === 'boolean');
}

/** Prüft den Inhalt streng – alles Unbekannte wird verworfen. */
export function parseEntry(raw: unknown): LogEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as Record<string, unknown>;
  if (typeof e.consentId !== 'string' || !UUID.test(e.consentId)) return null;
  if (typeof e.timestamp !== 'string' || e.timestamp.length > 40 || Number.isNaN(Date.parse(e.timestamp))) return null;
  if (typeof e.configVersion !== 'string' || e.configVersion.length === 0 || e.configVersion.length > 50) return null;
  if (typeof e.action !== 'string' || !ACTIONS.has(e.action)) return null;
  if (!isBoolMap(e.categories, 20)) return null;
  const services = e.services === undefined ? {} : e.services;
  if (!isBoolMap(services, 50)) return null;
  if (typeof e.domain !== 'string' || !/^[a-z0-9.-]{1,253}$/i.test(e.domain)) return null;
  if (e.siteId !== undefined && (typeof e.siteId !== 'string' || !/^[a-z0-9-]{3,40}$/.test(e.siteId))) return null;
  return {
    consentId: e.consentId.toLowerCase(),
    timestamp: e.timestamp,
    configVersion: e.configVersion,
    action: e.action,
    categories: e.categories,
    services,
    gpc: e.gpc === true,
    domain: e.domain.toLowerCase(),
    siteId: typeof e.siteId === 'string' ? e.siteId : null,
  };
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

/** Zu welcher Website gehört diese Herkunft? (null = nicht erlaubt) */
async function siteForOrigin(env: Env, origin: string, siteId?: string | null): Promise<{ allowed: boolean; siteId: string | null }> {
  const extra = (env.ALLOWED_ORIGINS ?? '').split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean);
  const sites = await originsBySite(env.DB);
  if (siteId) {
    const domains = sites.get(siteId);
    if (domains) return { allowed: domains.includes(origin), siteId };
  }
  for (const [id, domains] of sites) if (domains.includes(origin)) return { allowed: true, siteId: id };
  return { allowed: extra.includes(origin), siteId: null };
}

// ------------------------------------------------------------ Handler

export async function handleLog(request: Request, env: Env): Promise<Response> {
  const origin = (request.headers.get('Origin') ?? '').replace(/\/$/, '');
  if (!origin || !(await siteForOrigin(env, origin)).allowed) return json({ error: 'origin not allowed' }, 403);
  const cors = corsHeaders(origin);

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405, cors);

  if (!(await allowRequest(request, env))) return json({ error: 'too many requests' }, 429, { ...cors, 'Retry-After': '60' });

  const length = Number(request.headers.get('Content-Length') ?? 0);
  if (length > MAX_BODY_BYTES) return json({ error: 'payload too large' }, 413, cors);
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return json({ error: 'payload too large' }, 413, cors);

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: 'invalid json' }, 400, cors);
  }
  const entry = parseEntry(body);
  if (!entry) return json({ error: 'invalid entry' }, 400, cors);
  // Die gemeldete Domain muss zur Herkunft passen.
  if (new URL(origin).hostname !== entry.domain) return json({ error: 'domain mismatch' }, 400, cors);
  const site = await siteForOrigin(env, origin, entry.siteId);
  if (!site.allowed) return json({ error: 'origin not allowed for site' }, 403, cors);

  await env.DB.prepare(
    'INSERT INTO consent_log (consent_id, received_at, client_timestamp, config_version, action, categories, services, gpc, domain, site_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(
      entry.consentId,
      new Date().toISOString(),
      entry.timestamp,
      entry.configVersion,
      entry.action,
      JSON.stringify(entry.categories),
      JSON.stringify(entry.services),
      entry.gpc ? 1 : 0,
      entry.domain,
      site.siteId,
    )
    .run();

  return new Response(null, { status: 204, headers: cors });
}

/** Alle Einträge zu einer Consent-ID (für Admin-Oberfläche und API). */
export async function lookupConsent(db: D1Database, consentId: string) {
  const { results = [] } = await db
    .prepare(
      'SELECT received_at, client_timestamp, config_version, action, categories, services, gpc, domain, site_id FROM consent_log WHERE consent_id = ? ORDER BY received_at ASC',
    )
    .bind(consentId.toLowerCase())
    .all<Record<string, unknown>>();
  return {
    consentId: consentId.toLowerCase(),
    count: results.length,
    entries: results.map((r) => ({
      receivedAt: r.received_at,
      clientTimestamp: r.client_timestamp,
      configVersion: r.config_version,
      action: r.action,
      categories: JSON.parse(String(r.categories)) as Record<string, boolean>,
      services: JSON.parse(String(r.services)) as Record<string, boolean>,
      gpc: r.gpc === 1,
      domain: r.domain,
      siteId: r.site_id ?? null,
    })),
  };
}

/** Kennzahlen einer Website für die letzten `days` Tage. */
export async function siteStats(db: D1Database, siteId: string, days = 30, now = Date.now()) {
  const since = new Date(now - days * 24 * 60 * 60 * 1000).toISOString();
  const { results = [] } = await db
    .prepare('SELECT action, categories FROM consent_log WHERE site_id = ? AND received_at >= ?')
    .bind(siteId, since)
    .all<{ action: string; categories: string }>();
  const byAction: Record<string, number> = { 'accept-all': 0, 'reject-all': 0, custom: 0, service: 0 };
  let statistics = 0;
  let marketing = 0;
  let decisions = 0;
  for (const r of results) {
    byAction[r.action] = (byAction[r.action] ?? 0) + 1;
    if (r.action === 'service') continue;
    decisions++;
    const c = JSON.parse(r.categories) as Record<string, boolean>;
    if (c.statistics) statistics++;
    if (c.marketing) marketing++;
  }
  const pct = (n: number) => (decisions ? Math.round((n / decisions) * 100) : 0);
  return { days, total: results.length, byAction, statisticsRate: pct(statistics), marketingRate: pct(marketing) };
}

/** Löscht Einträge, die älter als RETENTION_DAYS sind (per Cron, einmal täglich). */
export async function cleanup(env: Env, now = Date.now()): Promise<void> {
  const days = Number(env.RETENTION_DAYS ?? 1095);
  const cutoff = new Date(now - days * 24 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare('DELETE FROM consent_log WHERE received_at < ?').bind(cutoff).run();
}
