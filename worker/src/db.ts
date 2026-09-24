// Minimale Typen für Cloudflare D1 und Bindings – so sind keine zusätzlichen Pakete nötig.
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
  /** Cloudflare Access: Team-Domain, z. B. "meinteam" oder "meinteam.cloudflareaccess.com". */
  ACCESS_TEAM_DOMAIN?: string;
  /** Cloudflare Access: "Application Audience (AUD) Tag" der Admin-Anwendung. */
  ACCESS_AUD?: string;
  /** Notfall-Zugang und API-Zugriff: geheimes Token (per `wrangler secret put ADMIN_TOKEN`). */
  ADMIN_TOKEN?: string;
  /** Öffentliche Adresse des Backends, z. B. "https://consent.meine-firma.de" (Standard: Adresse des Aufrufs). */
  PUBLIC_URL?: string;
  /** Zusätzliche erlaubte Origins für /log (kommagetrennt), neben den Domains aus der Admin-Oberfläche. */
  ALLOWED_ORIGINS?: string;
  /** Aufbewahrungsdauer des Protokolls in Tagen. Standard: 1095 (3 Jahre). */
  RETENTION_DAYS?: string;
  RATE_LIMITER?: RateLimiter;
  /** Fallback-Limit pro Minute und IP, wenn kein RATE_LIMITER-Binding vorhanden ist. Standard: 30. */
  RATE_LIMIT_PER_MINUTE?: string;
  /** NUR für lokale Entwicklung: "1" erlaubt die Admin-Oberfläche auf localhost ohne Anmeldung. */
  DEV_INSECURE_ADMIN?: string;
}

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

/** Vergleich in konstanter Zeit (gegen Timing-Angriffe auf Tokens). */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(a)), crypto.subtle.digest('SHA-256', enc.encode(b))]);
  const x = new Uint8Array(ha);
  const y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i]! ^ y[i]!;
  return diff === 0;
}

export function publicOrigin(request: Request, env: Env): string {
  return (env.PUBLIC_URL || new URL(request.url).origin).replace(/\/+$/, '');
}
