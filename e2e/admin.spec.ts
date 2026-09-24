import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import worker, { type Env } from '../worker/src/index';
import { fakeD1 } from '../worker/test/fake-d1';

/**
 * Die Admin-Oberfläche im echten Browser: Das Backend läuft lokal (Node statt
 * Cloudflare, SQLite statt D1), Anmeldung über den Entwicklungsmodus.
 */
let server: Server;
let base: string;
let env: Env;

test.beforeAll(async () => {
  env = { DB: fakeD1(), DEV_INSECURE_ADMIN: '1', ADMIN_TOKEN: 'test-token-abcdefghijklmnopqrstuvwxyz' };
  server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const request = new Request(`http://localhost:${(server.address() as AddressInfo).port}${req.url}`, {
      method: req.method,
      headers: req.headers as Record<string, string>,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
    });
    const response = await worker.fetch(request, env);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  });
  await new Promise<void>((resolve) => server.listen(0, 'localhost', resolve));
  base = `http://localhost:${(server.address() as AddressInfo).port}`;
});

test.afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

test.describe.configure({ mode: 'serial' });
test.skip(({ browserName }) => browserName !== 'chromium');

test('Website anlegen, Fehler sehen, speichern, Einbau-Code abrufen', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(`${base}/admin`);
  await expect(page.getByText('Angemeldet: Entwicklung (localhost)')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Willkommen!' })).toBeVisible();

  await page.getByRole('button', { name: '+ Neue Website' }).first().click();
  // Absichtlich fehlerhaft
  await page.getByLabel('Kennung *').fill('Meine Seite');
  await page.getByLabel('Google Tag Manager verwenden').check();
  await page.getByLabel('Container-ID').fill('UA-123');
  await page.getByRole('button', { name: 'Website anlegen' }).click();
  const errors = page.getByRole('alert');
  await expect(errors).toContainText('Kennung');
  await expect(errors).toContainText('Bitte einen Namen angeben.');
  await expect(errors).toContainText('GTM-XXXXXXX');

  // Korrigieren
  await page.getByLabel('Kennung *').fill('meine-seite');
  await page.getByLabel('Name *').fill('Meine Seite');
  await page.getByLabel('Domains *').fill('https://meine-seite.de\nhttps://www.meine-seite.de');
  await page.getByLabel('Betreiber').fill('Muster GmbH');
  await page.getByLabel('Container-ID').fill('GTM-ABC1234');
  await page.getByLabel('Google Ads über GTM (Kategorie Marketing)').uncheck();
  await page.getByLabel('Meta (Facebook) Pixel').selectOption('kit');
  await page.getByLabel('Pixel-ID').first().fill('123456789012');
  await page.getByLabel('YouTube-Videos sind eingebettet').check();
  await page.getByLabel('Akzentfarbe (Schalter, Links)').fill('#0a7c55');
  await page.getByRole('button', { name: 'Website anlegen' }).click();
  await expect(page.getByRole('heading', { name: /Meine Seite\s+Version 1/ })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Websites' }).getByRole('button', { name: /Meine Seite/ })).toBeVisible();

  // Öffentliche Einstellungen
  const config = await (await fetch(`${base}/config/meine-seite`)).json();
  expect(config).toMatchObject({
    siteId: 'meine-seite',
    version: 1,
    owner: 'Muster GmbH',
    services: [
      { type: 'google-tag-manager', id: 'GTM-ABC1234', analytics: true, ads: false },
      { type: 'meta-pixel', id: '123456789012', loadVia: 'kit' },
      { type: 'youtube' },
    ],
    ui: { theme: { accent: '#0a7c55' } },
    logging: { endpoint: `${base}/log` },
  });

  // Dienste ändern → Version 2
  await page.getByLabel('Google Maps ist eingebettet').check();
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'alle Besucher werden erneut gefragt' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Version 2/ })).toBeVisible();

  // Einbau-Code
  await page.getByRole('tab', { name: 'Einbau' }).click();
  await expect(page.getByRole('heading', { name: '1. KI-Prompt (empfohlen)' })).toBeVisible();
  await expect(page.locator('pre').first()).toContainText('Website-Kennung im Backend: meine-seite');
  await page.locator('.snippet').filter({ hasText: '3. Datei src/consent.remote.ts' }).getByRole('button', { name: 'Kopieren' }).click();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toContain(`endpoint: "${base}"`);
  expect(clip).toContain('siteId: "meine-seite"');

  // Datenschutz-Tabelle
  await page.getByRole('tab', { name: 'Datenschutz-Tabelle' }).click();
  await expect(page.locator('pre').first()).toContainText('Meta Pixel');

  // Barrierefreiheit der Admin-Oberfläche
  await page.getByRole('tab', { name: 'Einstellungen' }).click();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([]);
});

test('Protokoll-Eintrag von der Website finden (Nachweis)', async ({ page }) => {
  const consentId = '46afb41e-031b-4f3a-b233-cca02495494d';
  const res = await fetch(`${base}/log`, {
    method: 'POST',
    headers: { Origin: 'https://www.meine-seite.de', 'Content-Type': 'text/plain' },
    body: JSON.stringify({
      consentId,
      timestamp: new Date().toISOString(),
      configVersion: '2',
      action: 'custom',
      categories: { necessary: true, statistics: true, marketing: false },
      services: {},
      domain: 'www.meine-seite.de',
      siteId: 'meine-seite',
    }),
  });
  expect(res.status).toBe(204);

  await page.goto(`${base}/admin`);
  await page.getByLabel('Einwilligungs-ID').fill(consentId);
  await page.getByRole('button', { name: 'Suchen' }).click();
  const table = page.getByRole('table');
  await expect(table).toContainText('meine-seite (www.meine-seite.de)');
  await expect(table).toContainText('necessary, statistics');

  await page.getByRole('navigation', { name: 'Websites' }).getByRole('button', { name: /Meine Seite/ }).click();
  await page.getByRole('tab', { name: 'Statistik' }).click();
  await expect(page.locator('.stat').filter({ hasText: 'Statistik erlaubt' })).toContainText('100 %');
});

test('ohne Anmeldung: nur Notfall-Login, keine Daten', async ({ page }) => {
  env.DEV_INSECURE_ADMIN = undefined;
  try {
    await page.goto(`${base}/admin`);
    await expect(page.getByRole('heading', { name: 'Anmeldung' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Websites' })).toBeHidden();
    await page.getByLabel('Admin-Token').fill('test-token-abcdefghijklmnopqrstuvwxyz');
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page.getByText('Angemeldet: Admin-Token')).toBeVisible();
  } finally {
    env.DEV_INSECURE_ADMIN = '1';
  }
});
