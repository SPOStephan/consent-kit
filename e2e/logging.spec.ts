import { banner, expect, test } from './fixtures';

const ENDPOINT = 'https://consent-log.test.workers.dev/log';

test('Protokollierung: jede Entscheidung wird gesendet – ohne IP und User-Agent im Inhalt', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium');
  const bodies: Array<{ body: Record<string, unknown>; headers: Record<string, string> }> = [];
  await page.route(ENDPOINT, async (route) => {
    const req = route.request();
    if (req.method() === 'POST') bodies.push({ body: JSON.parse(req.postData() ?? '{}'), headers: req.headers() });
    await route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': 'http://localhost:4173' } });
  });
  await page.addInitScript((url) => {
    (window as unknown as { __DEMO_LOG_ENDPOINT__: string }).__DEMO_LOG_ENDPOINT__ = url;
  }, ENDPOINT);

  await page.goto('/');
  await banner(page).getByRole('button', { name: 'Alle ablehnen' }).click();
  await expect.poll(() => bodies.length).toBe(1);

  const { body, headers } = bodies[0]!;
  expect(Object.keys(body).sort()).toEqual(['action', 'categories', 'configVersion', 'consentId', 'domain', 'gpc', 'services', 'timestamp']);
  expect(body).toMatchObject({
    action: 'reject-all',
    configVersion: '1',
    domain: 'localhost',
    categories: { necessary: true, statistics: false, marketing: false },
  });
  expect(String(body.consentId)).toMatch(/^[0-9a-f-]{36}$/);
  // "Einfacher" Request ohne Cookies → kein CORS-Preflight nötig
  expect(headers['content-type']).toContain('text/plain');
  expect(headers.cookie).toBeUndefined();

  // Widerruf wird ebenfalls protokolliert (vor dem Neuladen)
  await page.getByRole('button', { name: 'Cookie-Einstellungen' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Alle akzeptieren' }).click();
  await expect.poll(() => bodies.length).toBe(2);
  expect(bodies[1]!.body).toMatchObject({ action: 'accept-all', consentId: body.consentId });
});
