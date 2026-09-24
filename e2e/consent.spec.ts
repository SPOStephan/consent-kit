import { banner, consentCommands, expect, GA_COLLECT, navigate, settle, test, trackingCookies } from './fixtures';

const GTM_SCRIPT = 'googletagmanager.com/gtm.js';
const META_SCRIPT = 'connect.facebook.net/en_US/fbevents.js';
const TIKTOK_SCRIPT = 'analytics.tiktok.com/i18n/pixel/events.js';
const META_PAGEVIEW = /facebook\.com\/tr\/.*ev=PageView/;
const TIKTOK_PAGEVIEW = /analytics\.tiktok\.com\/api\/v2\/pixel\?event=Pageview/;

test.describe('1. Vor jeder Entscheidung', () => {
  test('null Requests an Tracking-Domains – auch nach Routenwechseln', async ({ page, tracker }) => {
    await page.goto('/');
    await expect(banner(page)).toBeVisible();
    await settle(page);
    await navigate(page, 'Produkte');
    await navigate(page, 'Video');
    await navigate(page, 'Kontakt');
    expect(tracker.requests).toEqual([]);
    expect(await trackingCookies(page)).toEqual([]);
    // Consent-Mode-Defaults sind trotzdem sofort gesetzt (lokal, ohne Request)
    const commands = await consentCommands(page);
    expect(commands[0]).toEqual([
      'consent',
      'default',
      expect.objectContaining({
        ad_storage: 'denied',
        analytics_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        security_storage: 'granted',
      }),
    ]);
    // Keine Skripte von Drittanbietern im DOM
    await expect(page.getByTestId('status-scripts')).toHaveText('keine');
  });

  test('Embeds laden erst nach Klick auf "Inhalt laden"', async ({ page, tracker }) => {
    await page.goto('/video');
    await settle(page);
    expect(tracker.requests).toEqual([]);
    await page.getByRole('button', { name: 'Inhalt laden' }).click();
    await expect(page.frameLocator('iframe[title="Beispielvideo"]').getByText('Embed-Attrappe')).toBeVisible();
    await settle(page);
    expect(tracker.requests.every((r) => r.host.endsWith('youtube-nocookie.com'))).toBe(true);
    expect(tracker.requests.length).toBeGreaterThan(0);
    // Die übrigen Dienste bleiben aus, das Banner bleibt sichtbar
    await expect(banner(page)).toBeVisible();
  });
});

test.describe('2. Nach "Alle ablehnen"', () => {
  test('weiterhin null Requests – auch nach Routenwechsel und Neuladen', async ({ page, tracker }) => {
    await page.goto('/');
    await banner(page).getByRole('button', { name: 'Alle ablehnen' }).click();
    await expect(banner(page)).toBeHidden();
    await settle(page);
    await navigate(page, 'Produkte');
    await page.reload();
    await settle(page);
    await expect(banner(page)).toBeHidden(); // nicht erneut fragen
    await navigate(page, 'Kontakt');
    await navigate(page, 'Start');
    expect(tracker.requests).toEqual([]);
    expect(await trackingCookies(page)).toEqual([]);
    const commands = await consentCommands(page);
    expect(commands.at(-1)).toEqual([
      'consent',
      'update',
      { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' },
    ]);
  });
});

test.describe('3. Nach "Nur Statistik"', () => {
  test('nur Google-Analytics-bezogene Requests, keine Meta/TikTok/Ads', async ({ page, tracker }) => {
    await page.goto('/');
    await banner(page).getByRole('button', { name: 'Einstellungen' }).click();
    const dialog = page.getByRole('dialog', { name: 'Cookie-Einstellungen' });
    await dialog.getByRole('switch', { name: 'Statistik' }).check();
    await dialog.getByRole('button', { name: 'Auswahl speichern' }).click();
    await expect(dialog).toBeHidden();
    await settle(page);
    await navigate(page, 'Produkte');

    const hosts = new Set(tracker.requests.map((r) => r.host));
    expect([...hosts].sort()).toEqual(['www.google-analytics.com', 'www.googletagmanager.com']);
    expect(tracker.matching(GTM_SCRIPT)).toHaveLength(1);
    expect(tracker.matching(GA_COLLECT)).toHaveLength(2); // Start + Produkte
    expect(tracker.matching(/facebook|tiktok|doubleclick|googleadservices/)).toEqual([]);

    const commands = await consentCommands(page);
    expect(commands.at(-1)).toEqual([
      'consent',
      'update',
      { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' },
    ]);
    const cookies = await trackingCookies(page);
    expect(cookies).toContain('_ga');
    expect(cookies.filter((c) => !c.startsWith('_ga'))).toEqual([]);
  });
});

test.describe('4. Nach "Alle akzeptieren"', () => {
  test('jeder Dienst lädt genau einmal, genau ein PageView pro Dienst und Routenwechsel', async ({ page, tracker }) => {
    await page.goto('/');
    await banner(page).getByRole('button', { name: 'Alle akzeptieren' }).click();
    await settle(page);

    const count = () => ({
      ga: tracker.matching(GA_COLLECT).length,
      meta: tracker.matching(META_PAGEVIEW).length,
      tiktok: tracker.matching(TIKTOK_PAGEVIEW).length,
    });

    // Erster Seitenaufruf: genau ein PageView je Dienst
    expect(count()).toEqual({ ga: 1, meta: 1, tiktok: 1 });

    await navigate(page, 'Produkte');
    expect(count()).toEqual({ ga: 2, meta: 2, tiktok: 2 });

    await navigate(page, 'Video');
    expect(count()).toEqual({ ga: 3, meta: 3, tiktok: 3 });

    // Zurück-Button (popstate)
    await page.goBack();
    await settle(page);
    expect(count()).toEqual({ ga: 4, meta: 4, tiktok: 4 });

    // Jedes Skript genau einmal geladen
    expect(tracker.matching(GTM_SCRIPT)).toHaveLength(1);
    expect(tracker.matching(META_SCRIPT)).toHaveLength(1);
    expect(tracker.matching(TIKTOK_SCRIPT)).toHaveLength(1);
    expect(await page.locator('script[data-consent-kit]').count()).toBe(3);

    const commands = await consentCommands(page);
    expect(commands.at(-1)).toEqual([
      'consent',
      'update',
      { analytics_storage: 'granted', ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted' },
    ]);
    const events = await page.evaluate(() =>
      ((window as unknown as { dataLayer: Array<Record<string, unknown>> }).dataLayer)
        .filter((e) => e && typeof e === 'object' && 'event' in e)
        .map((e) => e.event),
    );
    expect(events.filter((e) => e === 'consent_update')).toHaveLength(1);
    expect(events.filter((e) => e === 'gtm.js')).toHaveLength(1);
    expect(events.filter((e) => e === 'virtual_pageview')).toHaveLength(3);
  });

  test('nach Neuladen: Dienste laden sofort genau einmal, kein Banner', async ({ page, tracker }) => {
    await page.goto('/');
    await banner(page).getByRole('button', { name: 'Alle akzeptieren' }).click();
    await settle(page);
    tracker.clear();
    await page.reload();
    await settle(page);
    await expect(banner(page)).toBeHidden();
    expect(tracker.matching(GTM_SCRIPT)).toHaveLength(1);
    expect(tracker.matching(META_SCRIPT)).toHaveLength(1);
    expect(tracker.matching(TIKTOK_SCRIPT)).toHaveLength(1);
    expect(tracker.matching(GA_COLLECT)).toHaveLength(1);
    expect(tracker.matching(META_PAGEVIEW)).toHaveLength(1);
    expect(tracker.matching(TIKTOK_PAGEVIEW)).toHaveLength(1);
  });
});

test.describe('5. Widerruf', () => {
  test('Cookies der Dienste werden gelöscht, nach Reload keine Requests', async ({ page, tracker }) => {
    await page.goto('/');
    await banner(page).getByRole('button', { name: 'Alle akzeptieren' }).click();
    await settle(page);
    expect((await trackingCookies(page)).sort()).toEqual(['_fbp', '_ga', '_gcl_au', '_ttp']);

    await page.getByRole('button', { name: 'Cookie-Einstellungen' }).click();
    const dialog = page.getByRole('dialog', { name: 'Cookie-Einstellungen' });
    await expect(dialog.getByRole('switch', { name: 'Marketing' })).toBeChecked();
    const reloaded = page.waitForEvent('load');
    await dialog.getByRole('button', { name: 'Alle ablehnen' }).click();
    await reloaded; // Seite lädt neu, weil geladene Skripte nicht entladen werden können
    tracker.clear();
    await settle(page);

    expect(await trackingCookies(page)).toEqual([]);
    await expect(banner(page)).toBeHidden();
    await navigate(page, 'Produkte');
    await page.reload();
    await settle(page);
    expect(tracker.requests).toEqual([]);
    await expect(page.getByTestId('status-categories')).toHaveText('necessary');
  });

  test('Teil-Widerruf (nur Marketing) löscht nur Marketing-Cookies', async ({ page, tracker }) => {
    await page.goto('/');
    await banner(page).getByRole('button', { name: 'Alle akzeptieren' }).click();
    await settle(page);
    await page.getByRole('button', { name: 'Cookie-Einstellungen' }).click();
    const dialog = page.getByRole('dialog', { name: 'Cookie-Einstellungen' });
    await dialog.getByRole('switch', { name: 'Marketing' }).uncheck();
    const reloaded = page.waitForEvent('load');
    await dialog.getByRole('button', { name: 'Auswahl speichern' }).click();
    await reloaded;
    tracker.clear();
    await settle(page);
    expect(await trackingCookies(page)).toEqual(['_ga']);
    expect(tracker.matching(/facebook|tiktok|doubleclick/)).toEqual([]);
    expect(tracker.matching(GA_COLLECT)).toHaveLength(1);
  });
});

test.describe('6. Erhöhte Konfig-Version', () => {
  test('Banner erscheint erneut, alte Dienste laden nicht', async ({ page, tracker }) => {
    await page.goto('/');
    await banner(page).getByRole('button', { name: 'Alle akzeptieren' }).click();
    await settle(page);
    await expect(banner(page)).toBeHidden();

    await page.addInitScript(() => {
      (window as unknown as { __DEMO_CONFIG_VERSION__: number }).__DEMO_CONFIG_VERSION__ = 2;
    });
    tracker.clear();
    await page.reload();
    await expect(banner(page)).toBeVisible();
    await settle(page);
    expect(tracker.requests).toEqual([]);
  });
});

test.describe('Impressum und Datenschutz', () => {
  test('sind trotz Banner erreichbar und nutzbar (auch im mittigen Modus)', async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __DEMO_POSITION__: string }).__DEMO_POSITION__ = 'center';
    });
    await page.goto('/');
    await expect(banner(page)).toHaveClass(/ck-banner--center/);
    await banner(page).getByRole('link', { name: 'Datenschutzerklärung' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Datenschutzerklärung' })).toBeVisible();
    await expect(banner(page)).toHaveClass(/ck-banner--bottom/);
    await expect(page.locator('.ck-backdrop')).toHaveCount(0);
    // Inhalt der Seite ist bedienbar (Footer-Link zum Impressum)
    await page.getByRole('contentinfo').getByRole('link', { name: 'Impressum' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Impressum' })).toBeVisible();
  });

  test('Buttons "Alle ablehnen" und "Alle akzeptieren" sind gleich groß und gleich gestaltet', async ({ page }) => {
    await page.goto('/');
    const reject = banner(page).getByRole('button', { name: 'Alle ablehnen' });
    const accept = banner(page).getByRole('button', { name: 'Alle akzeptieren' });
    const style = (el: typeof reject) =>
      el.evaluate((node) => {
        const s = getComputedStyle(node);
        const r = node.getBoundingClientRect();
        return { bg: s.backgroundColor, color: s.color, font: s.fontSize + s.fontWeight, border: s.border, w: Math.round(r.width), h: Math.round(r.height) };
      });
    expect(await style(reject)).toEqual(await style(accept));
  });
});
