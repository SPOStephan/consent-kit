import { test as base, expect, type Page, type Request } from '@playwright/test';
import { matchTracker } from '../src/cli/trackers';
import { GA_COLLECT, GTM_STUB, META_STUB, TIKTOK_STUB } from './stubs';

export interface TrackedRequest {
  url: string;
  host: string;
  tracker: string;
  resourceType: string;
}

export interface Tracker {
  /** Alle bisher protokollierten Drittanbieter-Requests. */
  readonly requests: TrackedRequest[];
  /** Protokoll leeren. */
  clear(): void;
  /** Requests, deren URL den Text enthält. */
  matching(part: string | RegExp): TrackedRequest[];
}

/**
 * Fängt ALLE Requests an bekannte Tracking-Domains ab (siehe src/cli/trackers.ts),
 * protokolliert sie und antwortet mit Attrappen – es geht nie ein echter Request raus.
 */
export const test = base.extend<{ tracker: Tracker }>({
  tracker: async ({ context }, use) => {
    const requests: TrackedRequest[] = [];
    await context.route('**/*', async (route) => {
      const request: Request = route.request();
      const url = request.url();
      const match = matchTracker(url);
      if (!match) return route.continue();
      requests.push({ url, host: new URL(url).hostname, tracker: match.name, resourceType: request.resourceType() });
      if (url.includes('googletagmanager.com/gtm.js')) {
        return route.fulfill({ status: 200, contentType: 'text/javascript', body: GTM_STUB });
      }
      if (url.includes('connect.facebook.net/') && url.includes('fbevents.js')) {
        return route.fulfill({ status: 200, contentType: 'text/javascript', body: META_STUB });
      }
      if (url.includes('analytics.tiktok.com/i18n/pixel/events.js')) {
        return route.fulfill({ status: 200, contentType: 'text/javascript', body: TIKTOK_STUB });
      }
      if (request.resourceType() === 'document') {
        return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Embed</title><p>Embed-Attrappe</p>' });
      }
      return route.fulfill({ status: 204, body: '' });
    });
    await use({
      requests,
      clear: () => {
        requests.length = 0;
      },
      matching: (part) => requests.filter((r) => (typeof part === 'string' ? r.url.includes(part) : part.test(r.url))),
    });
  },
});

export { expect, GA_COLLECT };

/** Wartet, bis das Netzwerk zur Ruhe kommt, plus kurze Reserve für verzögerte Pings. */
export async function settle(page: Page, ms = 400): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(ms);
}

/** Klickt auf einen Link in der Hauptnavigation (clientseitiger Routenwechsel). */
export async function navigate(page: Page, name: string): Promise<void> {
  await page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('link', { name, exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await settle(page, 200);
}

/** Alle Cookies im Browser-Kontext, deren Name auf einen Tracking-Dienst hinweist. */
export async function trackingCookies(page: Page): Promise<string[]> {
  const cookies = await page.context().cookies();
  return cookies.map((c) => c.name).filter((n) => /^(_ga|_gid|_gat|_gcl_|_fbp|_fbc|_ttp|_tt_|ttcsid)/.test(n));
}

/** Liest die Consent-Mode-Aufrufe aus dem dataLayer. */
export async function consentCommands(page: Page): Promise<Array<[string, string, Record<string, unknown>]>> {
  return page.evaluate(() => {
    const dl = (window as unknown as { dataLayer?: unknown[] }).dataLayer ?? [];
    return dl
      .filter((e) => Object.prototype.toString.call(e) === '[object Arguments]')
      .map((e) => Array.from(e as ArrayLike<unknown>))
      .filter((a) => a[0] === 'consent') as Array<[string, string, Record<string, unknown>]>;
  });
}

export const banner = (page: Page) => page.getByTestId('consent-banner');
