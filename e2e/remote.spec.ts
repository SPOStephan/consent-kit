import { banner, expect, navigate, settle, test } from './fixtures';

/** Die Demo lädt ihre Einstellungen aus einem (simulierten) consent-kit Backend. */
const BACKEND = 'https://consent-backend.test';

const REMOTE = {
  schema: 1,
  siteId: 'demo',
  version: 7,
  language: 'de',
  owner: 'Remote GmbH',
  links: { imprint: '/impressum', privacy: '/datenschutz' },
  respectGpc: false,
  services: [
    { type: 'google-tag-manager', id: 'GTM-REMOTE1', analytics: true, ads: true },
    { type: 'tiktok-pixel', id: 'CREMOTE0000000000000', loadVia: 'kit' },
  ],
  texts: { de: { bannerTitle: 'Einstellungen aus dem Backend' } },
  ui: { position: 'bottom', colorScheme: 'auto' },
};

test.describe('Einstellungen aus dem Backend', () => {
  test.skip(({ browserName }) => browserName !== 'chromium');

  test('Banner und Dienste kommen aus dem Backend – vor der Einwilligung kein Tracker-Request', async ({ page, tracker }) => {
    let configRequests = 0;
    await page.route(`${BACKEND}/config/demo`, (route) => {
      configRequests++;
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(REMOTE) });
    });
    await page.addInitScript((endpoint) => {
      (window as unknown as { __DEMO_REMOTE__: unknown }).__DEMO_REMOTE__ = { endpoint, siteId: 'demo' };
    }, BACKEND);

    await page.goto('/');
    await expect(banner(page)).toContainText('Einstellungen aus dem Backend');
    await settle(page);
    await navigate(page, 'Produkte');
    expect(configRequests).toBe(1);
    expect(tracker.requests).toEqual([]);

    // Dialog zeigt die Dienste aus dem Backend
    await banner(page).getByRole('button', { name: 'Einstellungen' }).click();
    const dialog = page.getByRole('dialog', { name: 'Cookie-Einstellungen' });
    await expect(dialog).toContainText('TikTok Pixel');
    await expect(dialog).not.toContainText('Meta Pixel');
    await dialog.getByRole('button', { name: 'Alle akzeptieren' }).click();
    await settle(page);
    expect(tracker.matching('googletagmanager.com/gtm.js?id=GTM-REMOTE1')).toHaveLength(1);
    expect(tracker.matching('sdkid=CREMOTE0000000000000')).toHaveLength(1);
    expect(tracker.matching('facebook')).toEqual([]);

    // Datenschutz-Seite nutzt die Einstellungen aus dem Backend
    await page.getByRole('contentinfo').getByRole('link', { name: 'Datenschutz' }).click();
    await expect(page.locator('table.services')).toContainText('Remote GmbH');
  });

  test('Backend nicht erreichbar: Rückfallebene wird genutzt', async ({ page, tracker }) => {
    await page.route(`${BACKEND}/config/demo`, (route) => route.abort('failed'));
    await page.addInitScript(
      ({ endpoint, fallback }) => {
        (window as unknown as { __DEMO_REMOTE__: unknown }).__DEMO_REMOTE__ = { endpoint, siteId: 'demo', fallback };
      },
      { endpoint: BACKEND, fallback: { ...REMOTE, texts: { de: { bannerTitle: 'Aus der Rückfallebene' } } } },
    );
    await page.goto('/');
    await expect(banner(page)).toContainText('Aus der Rückfallebene');
    await settle(page);
    expect(tracker.requests).toEqual([]);
  });

  test('Backend nicht erreichbar und keine Rückfallebene: kein Banner, kein Tracker', async ({ page, tracker }) => {
    await page.route(`${BACKEND}/config/demo`, (route) => route.abort('failed'));
    await page.addInitScript((endpoint) => {
      (window as unknown as { __DEMO_REMOTE__: unknown }).__DEMO_REMOTE__ = { endpoint, siteId: 'demo' };
    }, BACKEND);
    await page.goto('/');
    await settle(page, 800);
    await expect(banner(page)).toHaveCount(0);
    expect(tracker.requests).toEqual([]);
  });

  test('höhere Version im Backend: Banner erscheint erneut', async ({ page }) => {
    let version = 7;
    await page.route(`${BACKEND}/config/demo`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ ...REMOTE, version }) }),
    );
    await page.addInitScript((endpoint) => {
      (window as unknown as { __DEMO_REMOTE__: unknown }).__DEMO_REMOTE__ = { endpoint, siteId: 'demo' };
    }, BACKEND);
    await page.goto('/');
    await banner(page).getByRole('button', { name: 'Alle ablehnen' }).click();
    await page.reload();
    await settle(page);
    await expect(banner(page)).toHaveCount(0);
    version = 8;
    await page.reload();
    await expect(banner(page)).toBeVisible();
  });
});
