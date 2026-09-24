// @vitest-environment node
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import worker, { cleanup, parseEntry, resetRateLimits, type D1Database, type Env } from '../src/index';

/** D1-Nachbau auf Basis von SQLite (D1 ist ebenfalls SQLite). */
function fakeD1(): D1Database & { raw: DatabaseSync } {
  const raw = new DatabaseSync(':memory:');
  raw.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  return {
    raw,
    prepare(query: string) {
      let values: unknown[] = [];
      const stmt = {
        bind(...v: unknown[]) {
          values = v;
          return stmt;
        },
        async run() {
          raw.prepare(query).run(...(values as never[]));
          return { success: true };
        },
        async all<T>() {
          return { success: true, results: raw.prepare(query).all(...(values as never[])) as T[] };
        },
      };
      return stmt;
    },
  };
}

const ORIGIN = 'https://www.meine-seite.de';
const TOKEN = 'ein-sehr-geheimes-token-1234567890';
const ID = '3f2b8c1e-4a5d-4e6f-8a9b-0c1d2e3f4a5b';

let env: Env & { DB: ReturnType<typeof fakeD1> };

function entry(overrides: Record<string, unknown> = {}) {
  return {
    consentId: ID,
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

function post(body: unknown, headers: Record<string, string> = {}) {
  return worker.fetch(
    new Request('https://log.example.workers.dev/log', {
      method: 'POST',
      headers: { Origin: ORIGIN, 'Content-Type': 'text/plain;charset=UTF-8', 'CF-Connecting-IP': '203.0.113.7', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    env,
  );
}

function query(id = ID, token = TOKEN) {
  return worker.fetch(new Request(`https://log.example.workers.dev/consent/${id}`, { headers: { Authorization: `Bearer ${token}` } }), env);
}

beforeEach(() => {
  resetRateLimits();
  env = { DB: fakeD1(), ALLOWED_ORIGINS: 'https://meine-seite.de, https://www.meine-seite.de/', ADMIN_TOKEN: TOKEN };
});

describe('POST /log', () => {
  it('speichert eine Entscheidung – ohne IP-Adresse und User-Agent', async () => {
    const res = await post(entry(), { 'User-Agent': 'Mozilla/5.0 Testbrowser' });
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    const rows = env.DB.raw.prepare('SELECT * FROM consent_log').all() as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]!).sort()).toEqual(
      ['action', 'categories', 'client_timestamp', 'config_version', 'consent_id', 'domain', 'gpc', 'id', 'received_at', 'services'].sort(),
    );
    const stored = JSON.stringify(rows);
    expect(stored).not.toContain('203.0.113.7');
    expect(stored).not.toContain('Mozilla');
  });

  it('beantwortet den CORS-Preflight nur für erlaubte Domains', async () => {
    const ok = await worker.fetch(new Request('https://x/log', { method: 'OPTIONS', headers: { Origin: 'https://meine-seite.de' } }), env);
    expect(ok.status).toBe(204);
    expect(ok.headers.get('Access-Control-Allow-Origin')).toBe('https://meine-seite.de');
    const bad = await worker.fetch(new Request('https://x/log', { method: 'OPTIONS', headers: { Origin: 'https://boese.example' } }), env);
    expect(bad.status).toBe(403);
    expect(bad.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('lehnt fremde Domains, fehlenden Origin und abweichende Domain ab', async () => {
    expect((await post(entry(), { Origin: 'https://boese.example' })).status).toBe(403);
    const noOrigin = await worker.fetch(new Request('https://x/log', { method: 'POST', body: JSON.stringify(entry()) }), env);
    expect(noOrigin.status).toBe(403);
    expect((await post(entry({ domain: 'andere-seite.de' }))).status).toBe(400);
    expect(env.DB.raw.prepare('SELECT COUNT(*) AS n FROM consent_log').get()).toMatchObject({ n: 0 });
  });

  it('prüft den Inhalt streng', async () => {
    for (const bad of [
      'kein json',
      entry({ consentId: 'keine-uuid' }),
      entry({ action: 'hack' }),
      entry({ categories: { statistics: 'ja' } }),
      entry({ categories: { '<script>': true } }),
      entry({ configVersion: 'x'.repeat(51) }),
      entry({ timestamp: 'gestern' }),
    ]) {
      expect((await post(bad)).status).toBe(400);
    }
    expect((await post('x'.repeat(5000))).status).toBe(413);
  });

  it('verwirft unbekannte Felder (z. B. eine mitgeschickte IP)', () => {
    const parsed = parseEntry({ ...entry(), ip: '1.2.3.4', userAgent: 'Mozilla' });
    expect(parsed).not.toHaveProperty('ip');
    expect(parsed).not.toHaveProperty('userAgent');
  });

  it('begrenzt die Anzahl der Anfragen pro IP (Rate-Limiting)', async () => {
    env.RATE_LIMIT_PER_MINUTE = '3';
    const statuses = [];
    for (let i = 0; i < 5; i++) statuses.push((await post(entry())).status);
    expect(statuses).toEqual([204, 204, 204, 429, 429]);
    // andere IP ist nicht betroffen
    expect((await post(entry(), { 'CF-Connecting-IP': '198.51.100.1' })).status).toBe(204);
  });

  it('nutzt das Cloudflare-Rate-Limiting-Binding, wenn vorhanden', async () => {
    const keys: string[] = [];
    env.RATE_LIMITER = { limit: async ({ key }) => (keys.push(key), { success: false }) };
    expect((await post(entry())).status).toBe(429);
    expect(keys).toEqual(['203.0.113.7']);
  });
});

describe('GET /consent/:id (Nachweis)', () => {
  it('liefert alle Einträge zu einer Consent-ID mit gültigem Token', async () => {
    await post(entry({ action: 'accept-all', categories: { necessary: true, statistics: true, marketing: true } }));
    await post(entry({ action: 'reject-all', categories: { necessary: true, statistics: false, marketing: false } }));
    await post(entry({ consentId: '11111111-2222-4333-8444-555555555555' }));
    const res = await query();
    expect(res.status).toBe(200);
    const data = (await res.json()) as { count: number; entries: Array<{ action: string; categories: Record<string, boolean> }> };
    expect(data.count).toBe(2);
    expect(data.entries.map((e) => e.action)).toEqual(['accept-all', 'reject-all']);
    expect(data.entries[1]!.categories.marketing).toBe(false);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('ist ohne oder mit falschem Token gesperrt', async () => {
    expect((await query(ID, 'falsch')).status).toBe(401);
    expect((await worker.fetch(new Request(`https://x/consent/${ID}`), env)).status).toBe(401);
    env.ADMIN_TOKEN = undefined;
    expect((await query()).status).toBe(503);
    env.ADMIN_TOKEN = 'zu-kurz';
    expect((await query(ID, 'zu-kurz')).status).toBe(503);
  });

  it('lehnt ungültige IDs ab', async () => {
    expect((await query("x' OR 1=1 --")).status).toBe(400);
  });
});

describe('Aufbewahrung', () => {
  it('löscht Einträge, die älter als RETENTION_DAYS sind', async () => {
    const insert = env.DB.raw.prepare(
      "INSERT INTO consent_log (consent_id, received_at, client_timestamp, config_version, action, categories, services, gpc, domain) VALUES (?, ?, 'x', '1', 'custom', '{}', '{}', 0, 'd')",
    );
    insert.run(ID, '2020-01-01T00:00:00.000Z');
    insert.run(ID, '2026-09-01T00:00:00.000Z');
    await cleanup({ ...env, RETENTION_DAYS: '365' }, Date.parse('2026-09-24T00:00:00Z'));
    expect(env.DB.raw.prepare('SELECT received_at FROM consent_log').all()).toEqual([
      expect.objectContaining({ received_at: '2026-09-01T00:00:00.000Z' }),
    ]);
  });
});

describe('Sonstiges', () => {
  it('GET / antwortet mit ok, unbekannte Pfade mit 404', async () => {
    expect(await (await worker.fetch(new Request('https://x/'), env)).text()).toBe('ok');
    expect((await worker.fetch(new Request('https://x/abc'), env)).status).toBe(404);
  });
});
