/**
 * consent-kit Backend (Cloudflare Worker + D1)
 *
 * Öffentlich (von Ihren Websites aufgerufen):
 *   GET  /config/<siteId>   → Einstellungen der Website (Remote-Konfiguration)
 *   POST /log               → Protokollierung einer Entscheidung (nur von freigegebenen Domains)
 *   GET  /                  → "ok" (Funktionstest)
 *
 * Geschützt (Cloudflare Access oder Admin-Token):
 *   GET  /admin             → Admin-Oberfläche
 *   *    /admin/api/…       → Admin-API (siehe admin-api.ts)
 *   GET  /consent/<uuid>    → Nachweis zu einer Consent-ID (z. B. per curl)
 *
 * Datenschutz: Es werden KEINE IP-Adressen und KEINE User-Agents gespeichert.
 */
import { authenticate, handleAdminApi } from './admin-api';
import { adminPage } from './admin-page';
import { json, publicOrigin, type Env } from './db';
import { cleanup, handleLog, lookupConsent, UUID } from './log';
import { getSite, toRemoteConfig } from './sites';

export type { Env, D1Database } from './db';
export { cleanup, parseEntry, resetRateLimits } from './log';

const PUBLIC_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

async function handleConfig(request: Request, env: Env, siteId: string): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: PUBLIC_CORS });
  if (request.method !== 'GET') return json({ error: 'method not allowed' }, 405, PUBLIC_CORS);
  const site = await getSite(env.DB, siteId);
  if (!site) return json({ error: 'site not found' }, 404, PUBLIC_CORS);
  return json(toRemoteConfig(site, publicOrigin(request, env)), 200, {
    ...PUBLIC_CORS,
    // Änderungen im Admin sind nach spätestens ~1 Minute auf allen Websites aktiv.
    'Cache-Control': 'public, max-age=60, stale-while-revalidate=600',
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (path === '/log') return await handleLog(request, env);

      const config = /^\/config\/([^/]+)$/.exec(path);
      if (config) return await handleConfig(request, env, decodeURIComponent(config[1]!));

      if (path === '/admin' || path === '/admin/') {
        if (request.method !== 'GET') return json({ error: 'method not allowed' }, 405);
        return adminPage();
      }
      if (path.startsWith('/admin/api/')) return await handleAdminApi(request, env, path.slice('/admin/api/'.length));

      const consent = /^\/consent\/([^/]+)$/.exec(path);
      if (consent && request.method === 'GET') {
        if (!(await authenticate(request, env))) return json({ error: 'unauthorized' }, 401);
        const id = decodeURIComponent(consent[1]!);
        if (!UUID.test(id)) return json({ error: 'invalid consent id' }, 400);
        return json(await lookupConsent(env.DB, id));
      }

      if (path === '/' && request.method === 'GET') return new Response('ok', { headers: { 'Content-Type': 'text/plain' } });
      return json({ error: 'not found' }, 404);
    } catch (error) {
      console.error('consent-kit backend error', error instanceof Error ? error.message : error);
      return json({ error: 'internal error' }, 500);
    }
  },
  async scheduled(_event: unknown, env: Env): Promise<void> {
    await cleanup(env);
  },
};
