// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAccessKeyCache, normalizeTeamDomain, verifyAccessJwt } from '../src/access';
import worker, { cleanup, parseEntry, resetRateLimits, type Env } from '../src/index';
import { clearOriginCache } from '../src/sites';
import { fakeD1 } from './fake-d1';

const BASE = 'https://consent.muster.de';
const ORIGIN = 'https://www.meine-seite.de';
const TOKEN = 'ein-sehr-geheimes-token-1234567890';
const CID = '3f2b8c1e-4a5d-4e6f-8a9b-0c1d2e3f4a5b';

let env: Env & { DB: ReturnType<typeof fakeD1> };

const SETTINGS = {
  name: 'Meine Seite',
  domains: ['https://meine-seite.de', 'https://www.meine-seite.de/'],
  owner: 'Muster GmbH',
  language: 'de',
  links: { imprint: '/impressum', privacy: 'https://www.meine-seite.de/datenschutz' },
  services: [
    { type: 'google-tag-manager', id: 'gtm-abc1234', analytics: true, ads: false },
    { type: 'meta-pixel', id: '123456789', loadVia: 'kit' },
    { type: 'youtube' },
  ],
  ui: { position: 'bottom', colorScheme: 'auto', accent: '#0A7C55' },
  texts: { de: { bannerTitle: 'Datenschutz bei Muster' } },
  logging: true,
};

function call(method: string, path: string, options: { body?: unknown; headers?: Record<string, string>; auth?: boolean } = {}) {
  const headers: Record<string, string> = { ...(options.headers ?? {}) };
  if (options.auth !== false) headers.Authorization = `Bearer ${TOKEN}`;
  if (method !== 'GET' && !('X-Consent-Kit-Admin' in headers)) headers['X-Consent-Kit-Admin'] = '1';
  return worker.fetch(
    new Request(`${BASE}${path}`, { method, headers, body: options.body === undefined ? undefined : JSON.stringify(options.body) }),
    env,
  );
}

async function createSite(id = 'meine-seite', settings: unknown = SETTINGS) {
  return call('POST', '/admin/api/sites', { body: { id, settings } });
}

function logEntry(overrides: Record<string, unknown> = {}) {
  return {
    consentId: CID,
    timestamp: '2026-09-24T10:00:00.000Z',
    configVersion: '1',
    action: 'custom',
    categories: { necessary: true, statistics: true, marketing: false },
    services: { youtube: true },
    gpc: false,
    domain: 'www.meine-seite.de',
    ...overrides,
  };
}

function postLog(body: unknown, headers: Record<string, string> = {}) {
  return worker.fetch(
    new Request(`${BASE}/log`, {
      method: 'POST',
      headers: { Origin: ORIGIN, 'Content-Type': 'text/plain;charset=UTF-8', 'CF-Connecting-IP': '203.0.113.7', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    env,
  );
}

beforeEach(() => {
  resetRateLimits();
  clearOriginCache();
  clearAccessKeyCache();
  vi.unstubAllGlobals();
  env = { DB: fakeD1(), ADMIN_TOKEN: TOKEN };
});

// ------------------------------------------------------------ Anmeldung

describe('Anmeldung zur Admin-Oberfläche', () => {
  it('ohne Anmeldung: 401', async () => {
    const res = await call('GET', '/admin/api/sites', { auth: false });
    expect(res.status).toBe(401);
  });

  it('mit falschem oder zu kurzem Token: 401', async () => {
    expect((await call('GET', '/admin/api/me', { auth: false, headers: { Authorization: 'Bearer falsch' } })).status).toBe(401);
    env.ADMIN_TOKEN = 'kurz';
    expect((await call('GET', '/admin/api/me', { auth: false, headers: { Authorization: 'Bearer kurz' } })).status).toBe(401);
  });

  it('mit Admin-Token: angemeldet', async () => {
    const res = await call('GET', '/admin/api/me');
    expect(await res.json()).toMatchObject({ user: 'Admin-Token', method: 'token', endpoint: BASE });
  });

  it('Entwicklungsmodus gilt nur auf localhost', async () => {
    env.DEV_INSECURE_ADMIN = '1';
    const remote = await worker.fetch(new Request(`${BASE}/admin/api/me`), env);
    expect(remote.status).toBe(401);
    const local = await worker.fetch(new Request('http://localhost:8787/admin/api/me'), env);
    expect(local.status).toBe(200);
  });

  it('ändernde Anfragen ohne Admin-Header oder von fremder Herkunft werden abgelehnt (CSRF)', async () => {
    expect((await call('POST', '/admin/api/sites', { body: { id: 'x' }, headers: { 'X-Consent-Kit-Admin': '' } })).status).toBe(403);
    expect((await call('POST', '/admin/api/sites', { body: { id: 'x' }, headers: { Origin: 'https://boese.example' } })).status).toBe(403);
  });
});

describe('Cloudflare Access (JWT)', () => {
  const TEAM = 'meinteam';
  const ISS = 'https://meinteam.cloudflareaccess.com';
  const AUD = 'aud-1234567890';
  let privateKey: CryptoKey;
  let certs: { keys: JsonWebKey[] };

  const b64 = (data: string | ArrayBuffer) =>
    Buffer.from(typeof data === 'string' ? data : new Uint8Array(data)).toString('base64url');

  async function sign(payload: Record<string, unknown>, kid = 'key-1', key = privateKey) {
    const head = b64(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' }));
    const body = b64(JSON.stringify(payload));
    const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${head}.${body}`));
    return `${head}.${body}.${b64(sig)}`;
  }

  const valid = () => ({ aud: [AUD], iss: ISS, email: 'chef@muster.de', exp: Math.floor(Date.now() / 1000) + 600 });

  beforeEach(async () => {
    const pair = (await crypto.subtle.generateKey(
      { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true,
      ['sign', 'verify'],
    )) as CryptoKeyPair;
    privateKey = pair.privateKey;
    certs = { keys: [{ ...(await crypto.subtle.exportKey('jwk', pair.publicKey)), kid: 'key-1' } as JsonWebKey] };
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      expect(url).toBe(`${ISS}/cdn-cgi/access/certs`);
      return new Response(JSON.stringify(certs));
    }));
    env.ACCESS_TEAM_DOMAIN = TEAM;
    env.ACCESS_AUD = AUD;
  });

  it('akzeptiert ein gültiges Token aus Header oder Cookie', async () => {
    const token = await sign(valid());
    const header = await call('GET', '/admin/api/me', { auth: false, headers: { 'Cf-Access-Jwt-Assertion': token } });
    expect(await header.json()).toMatchObject({ user: 'chef@muster.de', method: 'access' });
    const cookie = await call('GET', '/admin/api/me', { auth: false, headers: { Cookie: `foo=1; CF_Authorization=${token}` } });
    expect(cookie.status).toBe(200);
  });

  it('lehnt falsche Zielgruppe, falschen Aussteller, abgelaufene und manipulierte Tokens ab', async () => {
    const other = (await crypto.subtle.generateKey(
      { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true,
      ['sign', 'verify'],
    )) as CryptoKeyPair;
    const bad = [
      await sign({ ...valid(), aud: ['andere-app'] }),
      await sign({ ...valid(), iss: 'https://boese.cloudflareaccess.com' }),
      await sign({ ...valid(), exp: Math.floor(Date.now() / 1000) - 10 }),
      await sign(valid(), 'key-1', other.privateKey),
      await sign(valid(), 'unbekannter-key'),
      (await sign(valid())).replace(/\.[^.]+\./, `.${b64(JSON.stringify({ ...valid(), email: 'hacker@x' }))}.`),
      'kein.jwt',
    ];
    for (const token of bad) {
      const res = await call('GET', '/admin/api/me', { auth: false, headers: { 'Cf-Access-Jwt-Assertion': token } });
      expect(res.status).toBe(401);
    }
  });

  it('ohne Access-Konfiguration zählt ein Access-Token nicht', async () => {
    env.ACCESS_AUD = undefined;
    const res = await call('GET', '/admin/api/me', { auth: false, headers: { 'Cf-Access-Jwt-Assertion': await sign(valid()) } });
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ accessConfigured: false });
  });

  it('normalisiert die Team-Domain', async () => {
    expect(normalizeTeamDomain('meinteam')).toBe(ISS);
    expect(normalizeTeamDomain('https://meinteam.cloudflareaccess.com/')).toBe(ISS);
    expect(await verifyAccessJwt(await sign(valid()), 'meinteam.cloudflareaccess.com', AUD, async () => new Response(JSON.stringify(certs)))).toBe('chef@muster.de');
  });
});

// ------------------------------------------------------------ Websites

describe('Websites verwalten', () => {
  it('legt eine Website an und normalisiert Eingaben', async () => {
    const res = await createSite();
    expect(res.status).toBe(201);
    const site = (await res.json()) as { id: string; version: number; settings: typeof SETTINGS };
    expect(site.version).toBe(1);
    expect(site.settings.domains).toEqual(['https://meine-seite.de', 'https://www.meine-seite.de']);
    expect(site.settings.services[0]).toEqual({ type: 'google-tag-manager', id: 'GTM-ABC1234', analytics: true, ads: false });
    expect(site.settings.ui.accent).toBe('#0a7c55');
    const list = (await (await call('GET', '/admin/api/sites')).json()) as Array<{ id: string }>;
    expect(list.map((s) => s.id)).toEqual(['meine-seite']);
  });

  it('meldet Eingabefehler verständlich auf Deutsch', async () => {
    const res = await createSite('Meine Seite!', {
      name: '',
      domains: ['meine-seite.de/pfad'],
      links: {},
      services: [
        { type: 'google-tag-manager', id: 'UA-123' },
        { type: 'meta-pixel', id: 'abc', loadVia: 'kit' },
        { type: 'tiktok-pixel', loadVia: 'gtm' },
      ],
      ui: { accent: 'rot', radius: 'groß' },
    });
    expect(res.status).toBe(400);
    const { errors } = (await res.json()) as { errors: string[] };
    expect(errors.join('\n')).toMatch(/Kennung/);
    expect(errors.join('\n')).toMatch(/Namen/);
    expect(errors.join('\n')).toMatch(/keine gültige Adresse/);
    expect(errors.join('\n')).toMatch(/Impressum/);
    expect(errors.join('\n')).toMatch(/GTM-XXXXXXX/);
    expect(errors.join('\n')).toMatch(/Meta Pixel/);
    expect(errors.join('\n')).toMatch(/Farbe/);
    expect(errors.join('\n')).toMatch(/Eckenradius/);
  });

  it('„über GTM“ ohne GTM ist ein Fehler', async () => {
    const res = await createSite('ohne-gtm', { ...SETTINGS, services: [{ type: 'meta-pixel', loadVia: 'gtm' }] });
    expect(((await res.json()) as { errors: string[] }).errors.join()).toMatch(/nur, wenn auch der Google Tag Manager/);
  });

  it('verhindert doppelte Kennungen', async () => {
    await createSite();
    expect((await createSite()).status).toBe(409);
  });

  it('erhöht die Version nur, wenn sich die Dienste ändern', async () => {
    await createSite();
    const same = await call('PUT', '/admin/api/sites/meine-seite', { body: { settings: { ...SETTINGS, name: 'Neuer Name', texts: {} } } });
    expect(await same.json()).toMatchObject({ version: 1, bumped: false });
    const changed = await call('PUT', '/admin/api/sites/meine-seite', {
      body: { settings: { ...SETTINGS, services: [...SETTINGS.services, { type: 'google-maps' }] } },
    });
    expect(await changed.json()).toMatchObject({ version: 2, bumped: true });
    const bump = await call('POST', '/admin/api/sites/meine-seite/bump');
    expect(await bump.json()).toMatchObject({ version: 3 });
  });

  it('löscht eine Website', async () => {
    await createSite();
    expect((await call('DELETE', '/admin/api/sites/meine-seite')).status).toBe(200);
    expect((await call('GET', '/admin/api/sites/meine-seite')).status).toBe(404);
  });
});

// ------------------------------------------------------------ Öffentliche Einstellungen

describe('GET /config/<siteId>', () => {
  it('liefert die Einstellungen öffentlich, mit Cache und ohne Anmeldung', async () => {
    await createSite();
    const res = await worker.fetch(new Request(`${BASE}/config/meine-seite`, { headers: { Origin: ORIGIN } }), env);
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('Cache-Control')).toContain('max-age=60');
    const config = await res.json();
    expect(config).toEqual({
      schema: 1,
      siteId: 'meine-seite',
      version: 1,
      language: 'de',
      owner: 'Muster GmbH',
      links: { imprint: '/impressum', privacy: 'https://www.meine-seite.de/datenschutz' },
      respectGpc: false,
      services: [
        { type: 'google-tag-manager', id: 'GTM-ABC1234', analytics: true, ads: false },
        { type: 'meta-pixel', id: '123456789', loadVia: 'kit' },
        { type: 'youtube' },
      ],
      texts: { de: { bannerTitle: 'Datenschutz bei Muster' } },
      ui: { position: 'bottom', colorScheme: 'auto', theme: { accent: '#0a7c55' } },
      logging: { endpoint: `${BASE}/log` },
    });
  });

  it('nutzt PUBLIC_URL, lässt logging weg wenn ausgeschaltet, 404 bei unbekannter Website', async () => {
    await createSite('ohne-log', { ...SETTINGS, logging: false });
    env.PUBLIC_URL = 'https://consent.andere.de/';
    const config = (await (await worker.fetch(new Request(`${BASE}/config/ohne-log`), env)).json()) as Record<string, unknown>;
    expect(config.logging).toBeUndefined();
    await createSite();
    const withLog = (await (await worker.fetch(new Request(`${BASE}/config/meine-seite`), env)).json()) as { logging: { endpoint: string } };
    expect(withLog.logging.endpoint).toBe('https://consent.andere.de/log');
    expect((await worker.fetch(new Request(`${BASE}/config/gibts-nicht`), env)).status).toBe(404);
    expect((await worker.fetch(new Request(`${BASE}/config/..%2F..%2Fetc`), env)).status).toBe(404);
  });
});

// ------------------------------------------------------------ Einbau

describe('Einbau-Code', () => {
  it('erzeugt Prompt, consent.remote.ts mit Rückfallebene und Datenschutz-Tabelle', async () => {
    await createSite();
    const res = await call('GET', '/admin/api/sites/meine-seite/embed');
    const e = (await res.json()) as import("../src/generate").EmbedCode;
    expect(e.install).toMatch(/^npm install github:SPOStephan\/consent-kit#v\d+\.\d+\.\d+$/);
    expect(e.remoteFile).toContain(`endpoint: "${BASE}"`);
    expect(e.remoteFile).toContain('siteId: "meine-seite"');
    // Rückfallebene ist gültiges JSON der aktuellen Einstellungen
    const fallback = JSON.parse(e.remoteFile.slice(e.remoteFile.indexOf('fallback: ') + 10, e.remoteFile.lastIndexOf('},') + 1));
    expect(fallback).toMatchObject({ siteId: 'meine-seite', version: 1 });
    expect(e.prompt).toContain('Website-Kennung im Backend: meine-seite');
    expect(e.prompt).toContain('Google Tag Manager GTM-ABC1234 (GA4)');
    expect(e.prompt).toContain('du musst mich NICHT nach IDs fragen');
    expect(e.prompt).toContain('npx consent-kit check https://meine-seite.de --reject');
    expect(e.tableMarkdown).toContain('Meta Pixel');
    expect(e.tableMarkdown).toContain('Muster GmbH');
    expect(e.tableHtml).toContain('<table class="consent-kit-services">');
  });
});

// ------------------------------------------------------------ Protokollierung

describe('POST /log', () => {
  it('nimmt nur Domains an, die bei einer Website hinterlegt sind – ohne IP und User-Agent', async () => {
    expect((await postLog(logEntry())).status).toBe(403); // noch keine Website
    await createSite();
    const res = await postLog({ ...logEntry(), siteId: 'meine-seite' }, { 'User-Agent': 'Mozilla/5.0 Testbrowser' });
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    const rows = env.DB.raw.prepare('SELECT * FROM consent_log').all() as Array<Record<string, unknown>>;
    expect(rows[0]).toMatchObject({ site_id: 'meine-seite', consent_id: CID, action: 'custom' });
    const stored = JSON.stringify(rows);
    expect(stored).not.toContain('203.0.113.7');
    expect(stored).not.toContain('Mozilla');
  });

  it('ordnet Einträge ohne siteId anhand der Domain zu', async () => {
    await createSite();
    await postLog(logEntry());
    expect(env.DB.raw.prepare('SELECT site_id FROM consent_log').get()).toMatchObject({ site_id: 'meine-seite' });
  });

  it('lehnt eine siteId ab, zu der die Domain nicht gehört', async () => {
    await createSite();
    await createSite('andere-seite', { ...SETTINGS, domains: ['https://andere-seite.de'] });
    expect((await postLog({ ...logEntry(), siteId: 'andere-seite' })).status).toBe(403);
  });

  it('ALLOWED_ORIGINS gilt zusätzlich', async () => {
    env.ALLOWED_ORIGINS = 'https://www.meine-seite.de';
    expect((await postLog(logEntry())).status).toBe(204);
  });

  it('CORS-Preflight nur für freigegebene Domains', async () => {
    await createSite();
    const ok = await worker.fetch(new Request(`${BASE}/log`, { method: 'OPTIONS', headers: { Origin: 'https://meine-seite.de' } }), env);
    expect(ok.status).toBe(204);
    const bad = await worker.fetch(new Request(`${BASE}/log`, { method: 'OPTIONS', headers: { Origin: 'https://boese.example' } }), env);
    expect(bad.status).toBe(403);
  });

  it('prüft den Inhalt streng', async () => {
    await createSite();
    for (const bad of [
      'kein json',
      logEntry({ consentId: 'keine-uuid' }),
      logEntry({ action: 'hack' }),
      logEntry({ categories: { statistics: 'ja' } }),
      logEntry({ categories: { '<script>': true } }),
      logEntry({ configVersion: 'x'.repeat(51) }),
      logEntry({ timestamp: 'gestern' }),
      logEntry({ domain: 'andere-seite.de' }),
      logEntry({ siteId: 'BÖSE ID' }),
    ]) {
      expect((await postLog(bad)).status).toBe(400);
    }
    expect((await postLog('x'.repeat(5000))).status).toBe(413);
    expect(parseEntry({ ...logEntry(), ip: '1.2.3.4' })).not.toHaveProperty('ip');
  });

  it('Rate-Limiting pro IP (Fallback und Cloudflare-Binding)', async () => {
    await createSite();
    env.RATE_LIMIT_PER_MINUTE = '3';
    const statuses = [];
    for (let i = 0; i < 5; i++) statuses.push((await postLog(logEntry())).status);
    expect(statuses).toEqual([204, 204, 204, 429, 429]);
    expect((await postLog(logEntry(), { 'CF-Connecting-IP': '198.51.100.1' })).status).toBe(204);
    env.RATE_LIMITER = { limit: async () => ({ success: false }) };
    expect((await postLog(logEntry(), { 'CF-Connecting-IP': '198.51.100.2' })).status).toBe(429);
  });
});

describe('Nachweis und Statistik', () => {
  it('findet alle Einträge zu einer Consent-ID (Admin-API und /consent)', async () => {
    await createSite();
    await postLog(logEntry({ action: 'accept-all', categories: { necessary: true, statistics: true, marketing: true } }));
    await postLog(logEntry({ action: 'reject-all', categories: { necessary: true, statistics: false, marketing: false } }));
    const res = await call('GET', `/admin/api/consent/${CID}`);
    const data = (await res.json()) as { count: number; entries: Array<{ action: string; siteId: string }> };
    expect(data.count).toBe(2);
    expect(data.entries.map((e) => e.action)).toEqual(['accept-all', 'reject-all']);
    expect(data.entries[0]!.siteId).toBe('meine-seite');
    expect((await call('GET', `/consent/${CID}`)).status).toBe(200);
    expect((await call('GET', `/consent/${CID}`, { auth: false })).status).toBe(401);
    expect((await call('GET', "/admin/api/consent/x' OR 1=1 --")).status).toBe(400);
  });

  it('berechnet Kennzahlen der letzten 30 Tage', async () => {
    await createSite();
    env.DB.raw
      .prepare(
        "INSERT INTO consent_log (consent_id, received_at, client_timestamp, config_version, action, categories, services, gpc, domain, site_id) VALUES (?, ?, 'x', '1', ?, ?, '{}', 0, 'd', 'meine-seite')",
      )
      .run(CID, new Date().toISOString(), 'accept-all', '{"necessary":true,"statistics":true,"marketing":true}');
    env.DB.raw
      .prepare(
        "INSERT INTO consent_log (consent_id, received_at, client_timestamp, config_version, action, categories, services, gpc, domain, site_id) VALUES (?, ?, 'x', '1', ?, ?, '{}', 0, 'd', 'meine-seite')",
      )
      .run(CID, new Date().toISOString(), 'reject-all', '{"necessary":true,"statistics":false,"marketing":false}');
    const stats = await (await call('GET', '/admin/api/sites/meine-seite/stats')).json();
    expect(stats).toMatchObject({ total: 2, byAction: { 'accept-all': 1, 'reject-all': 1 }, statisticsRate: 50, marketingRate: 50 });
  });

  it('löscht Einträge nach der Aufbewahrungsdauer', async () => {
    const insert = env.DB.raw.prepare(
      "INSERT INTO consent_log (consent_id, received_at, client_timestamp, config_version, action, categories, services, gpc, domain) VALUES (?, ?, 'x', '1', 'custom', '{}', '{}', 0, 'd')",
    );
    insert.run(CID, '2020-01-01T00:00:00.000Z');
    insert.run(CID, '2026-09-01T00:00:00.000Z');
    await cleanup({ ...env, RETENTION_DAYS: '365' }, Date.parse('2026-09-24T00:00:00Z'));
    expect(env.DB.raw.prepare('SELECT COUNT(*) AS n FROM consent_log').get()).toMatchObject({ n: 1 });
  });
});

describe('Version', () => {
  it('Einbau-Code nutzt die Version aus package.json', async () => {
    const { readFileSync } = await import('node:fs');
    const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string };
    const { PACKAGE_VERSION } = await import('../src/version');
    expect(PACKAGE_VERSION).toBe(`v${pkg.version}`);
  });
});

describe('Admin-Seite', () => {
  it('wird mit strenger Content-Security-Policy ausgeliefert', async () => {
    const res = await worker.fetch(new Request(`${BASE}/admin`), env);
    expect(res.status).toBe(200);
    const csp = res.headers.get('Content-Security-Policy') ?? '';
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    const nonce = /'nonce-([^']+)'/.exec(csp)![1]!;
    const html = await res.text();
    expect(html).toContain(`<script nonce="${nonce}">`);
    expect(html).not.toMatch(/ style="/);
    expect(html).not.toMatch(/(src|href)="https?:/); // keine externen Ressourcen
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
  });

  it('GET / antwortet mit ok, unbekannte Pfade mit 404', async () => {
    expect(await (await worker.fetch(new Request(`${BASE}/`), env)).text()).toBe('ok');
    expect((await worker.fetch(new Request(`${BASE}/abc`), env)).status).toBe(404);
  });
});
