/**
 * Admin-API (nur für angemeldete Nutzer):
 *
 *   GET    /admin/api/me
 *   GET    /admin/api/sites
 *   POST   /admin/api/sites                 { id, settings }
 *   GET    /admin/api/sites/<id>
 *   PUT    /admin/api/sites/<id>            { settings, bump? }
 *   DELETE /admin/api/sites/<id>
 *   POST   /admin/api/sites/<id>/bump       → alle Besucher erneut fragen
 *   GET    /admin/api/sites/<id>/embed      → Einbau-Code, Prompt, Tabelle
 *   GET    /admin/api/sites/<id>/stats
 *   GET    /admin/api/consent/<consentId>   → Nachweis
 */
import { accessTokenFrom, verifyAccessJwt } from './access';
import { json, publicOrigin, safeEqual, type Env } from './db';
import { generateEmbed } from './generate';
import { lookupConsent, siteStats, UUID } from './log';
import {
  clearOriginCache,
  createSite,
  deleteSite,
  getSite,
  listSites,
  SITE_ID,
  toRemoteConfig,
  updateSite,
  validateSettings,
} from './sites';

export type AuthResult = { user: string; method: 'access' | 'token' | 'dev' } | null;

/** Anmeldung prüfen: Cloudflare Access (bevorzugt), Admin-Token oder – nur lokal – Entwicklungsmodus. */
export async function authenticate(request: Request, env: Env): Promise<AuthResult> {
  if (env.ACCESS_TEAM_DOMAIN && env.ACCESS_AUD) {
    const token = accessTokenFrom(request);
    if (token) {
      try {
        const user = await verifyAccessJwt(token, env.ACCESS_TEAM_DOMAIN, env.ACCESS_AUD);
        if (user) return { user, method: 'access' };
      } catch (error) {
        console.error('Access-Prüfung fehlgeschlagen', error instanceof Error ? error.message : error);
      }
    }
  }
  const auth = request.headers.get('Authorization') ?? '';
  if (auth.startsWith('Bearer ') && env.ADMIN_TOKEN && env.ADMIN_TOKEN.length >= 20) {
    if (await safeEqual(auth.slice(7), env.ADMIN_TOKEN)) return { user: 'Admin-Token', method: 'token' };
  }
  const host = new URL(request.url).hostname;
  if (env.DEV_INSECURE_ADMIN === '1' && (host === 'localhost' || host === '127.0.0.1')) {
    return { user: 'Entwicklung (localhost)', method: 'dev' };
  }
  return null;
}

/**
 * Schutz gegen Aufrufe von fremden Seiten (CSRF): Ändernde Anfragen müssen einen
 * eigenen Header tragen (den fremde Seiten ohne CORS-Freigabe nicht setzen können)
 * und – falls vorhanden – vom selben Origin kommen.
 */
function sameOriginRequest(request: Request): boolean {
  if (request.method === 'GET' || request.method === 'HEAD') return true;
  if (request.headers.get('X-Consent-Kit-Admin') !== '1') return false;
  const origin = request.headers.get('Origin');
  return !origin || origin === new URL(request.url).origin;
}

async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.length > 50_000) throw new Error('zu groß');
  return JSON.parse(text);
}

export async function handleAdminApi(request: Request, env: Env, path: string): Promise<Response> {
  const auth = await authenticate(request, env);
  if (!auth) return json({ error: 'Nicht angemeldet.', accessConfigured: Boolean(env.ACCESS_TEAM_DOMAIN && env.ACCESS_AUD) }, 401);
  if (!sameOriginRequest(request)) return json({ error: 'Anfrage abgelehnt (fremde Herkunft).' }, 403);

  const segments = path.split('/').filter(Boolean); // z. B. ['sites', 'meine-seite', 'embed']
  const method = request.method;
  const endpoint = publicOrigin(request, env);

  try {
    if (segments[0] === 'me' && method === 'GET') {
      return json({ user: auth.user, method: auth.method, endpoint });
    }

    if (segments[0] === 'consent' && segments[1] && method === 'GET') {
      const id = decodeURIComponent(segments[1]).trim();
      if (!UUID.test(id)) return json({ error: 'Das ist keine gültige Einwilligungs-ID.' }, 400);
      return json(await lookupConsent(env.DB, id));
    }

    if (segments[0] !== 'sites') return json({ error: 'Nicht gefunden.' }, 404);

    if (segments.length === 1) {
      if (method === 'GET') {
        const sites = await listSites(env.DB);
        return json(sites.map((s) => ({ id: s.id, name: s.settings.name, domains: s.settings.domains, version: s.version, updatedAt: s.updatedAt })));
      }
      if (method === 'POST') {
        const body = (await readJson(request)) as { id?: unknown; settings?: unknown };
        const id = typeof body.id === 'string' ? body.id.trim().toLowerCase() : '';
        const errors: string[] = [];
        if (!SITE_ID.test(id)) errors.push('Kennung: 3–40 Zeichen, nur Kleinbuchstaben, Ziffern und Bindestrich (z. B. meine-seite).');
        const result = validateSettings(body.settings);
        if (!result.ok) errors.push(...result.errors);
        if (errors.length || !result.ok) return json({ errors }, 400);
        if (await getSite(env.DB, id)) return json({ errors: [`Die Kennung „${id}“ ist bereits vergeben.`] }, 409);
        const site = await createSite(env.DB, id, result.value);
        clearOriginCache();
        return json(site, 201);
      }
      return json({ error: 'Methode nicht erlaubt.' }, 405);
    }

    const site = await getSite(env.DB, decodeURIComponent(segments[1]!));
    if (!site) return json({ error: 'Website nicht gefunden.' }, 404);
    const action = segments[2];

    if (!action) {
      if (method === 'GET') return json({ ...site, remote: toRemoteConfig(site, endpoint) });
      if (method === 'PUT') {
        const body = (await readJson(request)) as { settings?: unknown; bump?: unknown };
        const result = validateSettings(body.settings);
        if (!result.ok) return json({ errors: result.errors }, 400);
        const updated = await updateSite(env.DB, site, result.value, body.bump === true);
        clearOriginCache();
        return json({ ...updated.site, bumped: updated.bumped });
      }
      if (method === 'DELETE') {
        await deleteSite(env.DB, site.id);
        clearOriginCache();
        return json({ deleted: site.id });
      }
      return json({ error: 'Methode nicht erlaubt.' }, 405);
    }

    if (action === 'bump' && method === 'POST') {
      const updated = await updateSite(env.DB, site, site.settings, true);
      return json({ ...updated.site, bumped: true });
    }
    if (action === 'embed' && method === 'GET') return json(generateEmbed(site, endpoint));
    if (action === 'stats' && method === 'GET') return json(await siteStats(env.DB, site.id));
    return json({ error: 'Nicht gefunden.' }, 404);
  } catch (error) {
    if (error instanceof SyntaxError || (error as Error).message === 'zu groß') return json({ error: 'Ungültige Anfrage.' }, 400);
    throw error;
  }
}
