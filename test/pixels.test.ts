import { beforeEach, describe, expect, it } from 'vitest';
import { googleTagManager } from '../src/plugins/google';
import { metaPixel } from '../src/plugins/meta';
import { tiktokPixel } from '../src/plugins/tiktok';
import { googleMaps, youtube } from '../src/plugins/embeds';
import { baseConfig, newManager, resetDom } from './helpers';

type W = Window & { fbq?: { queue: unknown[][]; disablePushState?: boolean }; ttq?: unknown[] };
const w = () => window as W;
const scripts = (part: string) => document.querySelectorAll(`script[src*="${part}"]`);

beforeEach(() => resetDom());

describe('Meta Pixel', () => {
  it('lädt erst nach Marketing-Einwilligung: consent grant, init, PageView', () => {
    const m = newManager();
    m.init(baseConfig([metaPixel({ id: '1234567890' })]));
    expect(w().fbq).toBeUndefined();
    m.setCategories({ statistics: true });
    expect(w().fbq).toBeUndefined();
    expect(scripts('connect.facebook.net').length).toBe(0);
    m.setCategories({ statistics: true, marketing: true });
    expect(scripts('connect.facebook.net/en_US/fbevents.js').length).toBe(1);
    expect(w().fbq?.queue).toEqual([
      ['consent', 'grant'],
      ['init', '1234567890'],
      ['track', 'PageView'],
    ]);
    expect(w().fbq?.disablePushState).toBe(true);
  });

  it('sendet bei Routenwechsel genau einen PageView, beim ersten Laden keinen zusätzlichen', () => {
    const m = newManager();
    m.init(baseConfig([metaPixel({ id: '1' })]));
    m.acceptAll();
    m.notifyRouteChange('/');
    m.notifyRouteChange('/shop');
    m.notifyRouteChange('/shop');
    const pageViews = w().fbq?.queue.filter((c) => c[1] === 'PageView');
    expect(pageViews?.length).toBe(2); // 1x initial + 1x /shop
  });

  it('sendet beim Widerruf fbq consent revoke', () => {
    const m = newManager();
    m.init(baseConfig([metaPixel({ id: '1' })]));
    m.acceptAll();
    m.rejectAll();
    expect(w().fbq?.queue.at(-1)).toEqual(['consent', 'revoke']);
  });

  it('loadVia gtm: lädt kein Skript, sendet keine PageViews', () => {
    const m = newManager();
    m.init(baseConfig([metaPixel({ loadVia: 'gtm' })]));
    m.acceptAll();
    m.notifyRouteChange('/x');
    expect(scripts('facebook').length).toBe(0);
    expect(w().fbq).toBeUndefined();
  });
});

describe('TikTok Pixel', () => {
  it('lädt erst nach Marketing-Einwilligung und nutzt grantConsent', () => {
    const m = newManager();
    m.init(baseConfig([tiktokPixel({ id: 'CTEST123' })]));
    m.setCategories({ statistics: true });
    expect(w().ttq).toBeUndefined();
    m.acceptAll();
    expect(scripts('analytics.tiktok.com/i18n/pixel/events.js?sdkid=CTEST123&lib=ttq').length).toBe(1);
    const calls = (w().ttq as unknown[]).filter(Array.isArray);
    expect(calls).toEqual([['grantConsent'], ['page']]);
  });

  it('Routenwechsel: genau ein page() pro Wechsel; Widerruf: revokeConsent', () => {
    const m = newManager();
    m.init(baseConfig([tiktokPixel({ id: 'CTEST123' })]));
    m.acceptAll();
    m.notifyRouteChange('/a');
    m.notifyRouteChange('/a');
    m.rejectAll();
    const calls = (w().ttq as unknown[]).filter(Array.isArray);
    expect(calls).toEqual([['grantConsent'], ['page'], ['page'], ['revokeConsent']]);
  });

  it('loadVia gtm: lädt kein Skript', () => {
    const m = newManager();
    m.init(baseConfig([tiktokPixel({ loadVia: 'gtm' })]));
    m.acceptAll();
    expect(scripts('tiktok').length).toBe(0);
  });
});

describe('Alle Dienste zusammen', () => {
  it('jeder Dienst lädt genau einmal – auch bei mehrfachem Akzeptieren', () => {
    const m = newManager();
    m.init(
      baseConfig([
        googleTagManager({ id: 'GTM-TEST123' }),
        metaPixel({ id: '1' }),
        tiktokPixel({ id: 'CTEST123' }),
        youtube(),
        googleMaps(),
      ]),
    );
    m.acceptAll();
    m.setCategories({ statistics: true, marketing: true });
    m.acceptAll();
    expect(scripts('googletagmanager.com').length).toBe(1);
    expect(scripts('connect.facebook.net').length).toBe(1);
    expect(scripts('analytics.tiktok.com').length).toBe(1);
    expect(document.querySelectorAll('script').length).toBe(3);
  });

  it('Embeds laden selbst nichts und lassen sich einzeln erlauben', () => {
    const m = newManager();
    m.init(baseConfig([youtube(), metaPixel({ id: '1' })]));
    m.setService('youtube', true);
    expect(m.hasConsent('youtube')).toBe(true);
    expect(m.hasConsent('meta-pixel')).toBe(false);
    expect(document.querySelectorAll('script').length).toBe(0);
  });
});
