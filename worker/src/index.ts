/**
 * consent-kit Protokollierungs-Worker (Cloudflare Worker + D1)
 *
 *   POST /log                → speichert eine Entscheidung (nur von erlaubten Domains)
 *   GET  /consent/<uuid>     → alle Einträge zu einer Consent-ID (nur mit Admin-Token)
 *   GET  /                   → "ok" (Funktionstest)
 *
 * Datenschutz: Es werden KEINE IP-Adressen und KEINE User-Agents gespeichert.
 * Die IP-Adresse wird nur flüchtig (im Arbeitsspeicher) für das Rate-Limiting genutzt.
 */

// Minimale Typen, damit keine zusätzlichen Abhängigkeiten nötig sind.
export interface D1Result<T = Record<string, unknown>> {
  results?: T[];
  success: boolean;
}
export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<D1Result>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}
export interface D1Database {
  prepare(query: string): D1PreparedStatement;
}
export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  DB: D1Database;
  /** Kommagetrennte Liste erlaubter Origins, z. B. "https://meine-seite.de,https://www.meine-seite.de". */
  ALLOWED_ORIGINS: string;
  /** Geheimes Token für die Abfrage (per `wrangler secret put ADMIN_TOKEN`). */
  ADMIN_TOKEN?: string;
  /** Aufbewahrungsdauer in Tagen. Standard: 1095 (3 Jahre). */
  RETENTION_DAYS?: string;
  /** Optional: Cloudflare Rate Limiting Binding. */
  RATE_LIMITER?: RateLimiter;
  /** Fallback-Limit pro Minute und IP, wenn kein RATE_LIMITER-Binding vorhanden ist. Standard: 30. */
  RATE_LIMIT_PER_MINUTE?: string;
}

const MAX_BODY_BYTES = 4096;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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
}

// ------------------------------------------------------------ Rate-Limiting (Fallback)

const memoryLimits = new Map<string, { count: number; reset: number }>();

async function allowRequest(request: Request, env: Env): Promise<boolean> {
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

// ------------------------------------------------------------ Hilfen

function allowedOrigins(env: Env): string[] {
  return (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);
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

function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

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
  return {
    consentId: e.consentId.toLowerCase(),
    timestamp: e.timestamp,
    configVersion: e.configVersion,
    action: e.action,
    categories: e.categories,
    services,
    gpc: e.gpc === true,
    domain: e.domain.toLowerCase(),
  };
}

/** Vergleich in konstanter Zeit (gegen Timing-Angriffe auf das Token). */
async function safeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const x = new Uint8Array(ha);
  const y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i]! ^ y[i]!;
  return diff === 0;
}

// ------------------------------------------------------------ Handler

async function handleLog(request: Request, env: Env): Promise<Response> {
  const origin = (request.headers.get('Origin') ?? '').replace(/\/$/, '');
  const allowed = allowedOrigins(env);
  if (!origin || !allowed.includes(origin)) return json({ error: 'origin not allowed' }, 403);
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

  await env.DB.prepare(
    'INSERT INTO consent_log (consent_id, received_at, client_timestamp, config_version, action, categories, services, gpc, domain) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
    )
    .run();

  return new Response(null, { status: 204, headers: cors });
}

async function handleQuery(request: Request, env: Env, consentId: string): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'method not allowed' }, 405);
  const auth = request.headers.get('Authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!env.ADMIN_TOKEN || env.ADMIN_TOKEN.length < 20) return json({ error: 'ADMIN_TOKEN not configured' }, 503);
  if (!token || !(await safeEqual(token, env.ADMIN_TOKEN))) return json({ error: 'unauthorized' }, 401);
  if (!UUID.test(consentId)) return json({ error: 'invalid consent id' }, 400);

  const { results = [] } = await env.DB.prepare(
    'SELECT received_at, client_timestamp, config_version, action, categories, services, gpc, domain FROM consent_log WHERE consent_id = ? ORDER BY received_at ASC',
  )
    .bind(consentId.toLowerCase())
    .all<Record<string, unknown>>();

  return json({
    consentId: consentId.toLowerCase(),
    count: results.length,
    entries: results.map((r) => ({
      receivedAt: r.received_at,
      clientTimestamp: r.client_timestamp,
      configVersion: r.config_version,
      action: r.action,
      categories: JSON.parse(String(r.categories)),
      services: JSON.parse(String(r.services)),
      gpc: r.gpc === 1,
      domain: r.domain,
    })),
  });
}

/** Löscht Einträge, die älter als RETENTION_DAYS sind (per Cron, einmal täglich). */
export async function cleanup(env: Env, now = Date.now()): Promise<void> {
  const days = Number(env.RETENTION_DAYS ?? 1095);
  const cutoff = new Date(now - days * 24 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare('DELETE FROM consent_log WHERE received_at < ?').bind(cutoff).run();
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/log') return await handleLog(request, env);
      const match = /^\/consent\/([^/]+)$/.exec(url.pathname);
      if (match) return await handleQuery(request, env, decodeURIComponent(match[1]!));
      if (url.pathname === '/' && request.method === 'GET') return new Response('ok', { headers: { 'Content-Type': 'text/plain' } });
      return json({ error: 'not found' }, 404);
    } catch (error) {
      console.error('consent-log error', error instanceof Error ? error.message : error);
      return json({ error: 'internal error' }, 500);
    }
  },
  async scheduled(_event: unknown, env: Env): Promise<void> {
    await cleanup(env);
  },
};
