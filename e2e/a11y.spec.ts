import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { banner, expect, test } from './fixtures';

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).include('#consent-kit-root').include('.ck-gate').analyze();
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.map((n) => n.target.join(' ')) }));
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`7. Barrierefreiheit (${colorScheme})`, () => {
    test.use({ colorScheme });

    test('Banner ohne schwerwiegende Verstöße', async ({ page }) => {
      await page.goto('/');
      await expect(banner(page)).toBeVisible();
      expect(await seriousViolations(page)).toEqual([]);
    });

    test('Einstellungsdialog (mit aufgeklappten Details) ohne schwerwiegende Verstöße', async ({ page }) => {
      await page.goto('/');
      await banner(page).getByRole('button', { name: 'Einstellungen' }).click();
      const dialog = page.getByRole('dialog', { name: 'Cookie-Einstellungen' });
      const toggles = dialog.getByRole('button', { name: /Details anzeigen/ });
      while ((await toggles.count()) > 0) await toggles.first().click();
      await expect(dialog.getByRole('button', { name: /Details ausblenden/ })).toHaveCount(3);
      expect(await seriousViolations(page)).toEqual([]);
    });

    test('ConsentGate-Platzhalter ohne schwerwiegende Verstöße', async ({ page }) => {
      await page.goto('/video');
      await expect(page.getByRole('button', { name: 'Inhalt laden' })).toBeVisible();
      expect(await seriousViolations(page)).toEqual([]);
    });
  });
}

test.describe('Tastaturbedienung', () => {
  test('Banner und Dialog sind komplett per Tastatur bedienbar', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium');
    await page.goto('/');
    await expect(banner(page)).toBeVisible();
    // Das Banner steht am Anfang der Seite – erster Tab landet im Banner.
    await page.keyboard.press('Tab');
    await expect(banner(page).locator(':focus')).toHaveCount(1);
    // "Einstellungen" per Tastatur öffnen
    await banner(page).getByRole('button', { name: 'Einstellungen' }).focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Cookie-Einstellungen' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Schließen' })).toBeFocused();
    // Fokus bleibt im Dialog
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    }
    // Statistik per Leertaste einschalten und speichern
    await dialog.getByRole('switch', { name: 'Statistik' }).focus();
    await page.keyboard.press('Space');
    await expect(dialog.getByRole('switch', { name: 'Statistik' })).toBeChecked();
    await dialog.getByRole('button', { name: 'Auswahl speichern' }).focus();
    await page.keyboard.press('Enter');
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId('status-categories')).toHaveText('necessary, statistics');
  });

  test('Escape schließt den Dialog, danach ist das Banner wieder da', async ({ page }) => {
    await page.goto('/');
    await banner(page).getByRole('button', { name: 'Einstellungen' }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Cookie-Einstellungen' })).toBeHidden();
    await expect(banner(page)).toBeVisible();
  });
});

test.describe('Mobil und Layout', () => {
  test('kein Layout-Springen durch das Banner (CLS = 0)', async ({ page }) => {
    await page.goto('/');
    await expect(banner(page)).toBeVisible();
    await page.waitForTimeout(500);
    const cls = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          let value = 0;
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries() as Array<PerformanceEntry & { value: number; hadRecentInput: boolean }>) {
              if (!entry.hadRecentInput) value += entry.value;
            }
          }).observe({ type: 'layout-shift', buffered: true });
          setTimeout(() => resolve(value), 300);
        }),
    );
    expect(cls).toBe(0);
  });

  test('Banner passt in den Bildschirm, kein horizontales Scrollen', async ({ page }) => {
    await page.goto('/');
    const box = await banner(page).boundingBox();
    const viewport = page.viewportSize()!;
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
  });
});
