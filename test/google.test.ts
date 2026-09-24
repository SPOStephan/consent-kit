import { beforeEach, describe, expect, it, vi } from 'vitest';
import { googleTagManager } from '../src/plugins/google';
import { resetScriptRegistry } from '../src/core/scripts';
import { baseConfig, newManager, resetDom } from './helpers';

type DL = unknown[];
const dl = () => (window as unknown as { dataLayer: DL }).dataLayer;
/** Wandelt gtag-Aufrufe (arguments-Objekte) in Arrays um. */
const entries = () => dl().map((e) => (Object.prototype.toString.call(e) === '[object Arguments]' ? Array.from(e as ArrayLike<unknown>) : e));
const gtmScripts = () => document.querySelectorAll('script[src*="googletagmanager.com/gtm.js"]');

beforeEach(() => resetDom());

describe('Google Tag Manager + Consent Mode v2', () => {
  it('setzt beim Start sofort die Defaults und lädt NICHTS', () => {
    newManager().init(baseConfig([googleTagManager({ id: 'GTM-TEST123' })]));
    expect(entries()[0]).toEqual([
      'consent',
      'default',
      {
        ad_storage: 'denied',
        analytics_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        security_storage: 'granted',
        wait_for_update: 500,
      },
    ]);
    expect(entries()).toContainEqual(['set', 'ads_data_redaction', true]);
    expect(gtmScripts().length).toBe(0);
    expect(typeof (window as unknown as { gtag: unknown }).gtag).toBe('function');
  });

  it('nach Ablehnung: kein GTM, Update mit denied und consent_update-Event', () => {
    const m = newManager();
    m.init(baseConfig([googleTagManager({ id: 'GTM-TEST123' })]));
    m.rejectAll();
    expect(gtmScripts().length).toBe(0);
    expect(entries()).toContainEqual(['consent', 'update', expect.objectContaining({ analytics_storage: 'denied', ad_storage: 'denied' })]);
    expect(entries()).toContainEqual(expect.objectContaining({ event: 'consent_update', consent_statistics: false, consent_marketing: false }));
  });

  it('nur Statistik: analytics_storage granted, Werbung denied, GTM geladen – Update VOR gtm.js', () => {
    const m = newManager();
    m.init(baseConfig([googleTagManager({ id: 'GTM-TEST123' })]));
    m.setCategories({ statistics: true });
    const e = entries();
    const updateIndex = e.findIndex((x) => Array.isArray(x) && x[1] === 'update');
    const startIndex = e.findIndex((x) => (x as { event?: string }).event === 'gtm.js');
    expect(e[updateIndex]).toEqual([
      'consent',
      'update',
      { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' },
    ]);
    expect(updateIndex).toBeLessThan(startIndex);
    expect(gtmScripts().length).toBe(1);
    expect(gtmScripts()[0]?.getAttribute('src')).toBe('https://www.googletagmanager.com/gtm.js?id=GTM-TEST123');
  });

  it('alle akzeptieren: alles granted, GTM genau einmal', () => {
    const m = newManager();
    const config = baseConfig([googleTagManager({ id: 'GTM-TEST123' })]);
    m.init(config);
    m.acceptAll();
    m.acceptAll();
    newManager().init(config); // zweite Instanz (z. B. Hot Reload)
    expect(entries()).toContainEqual([
      'consent',
      'update',
      { analytics_storage: 'granted', ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted' },
    ]);
    expect(entries()).toContainEqual(expect.objectContaining({ event: 'consent_update', consent_statistics: true, consent_marketing: true }));
    expect(gtmScripts().length).toBe(1);
  });

  it('bei gespeicherter Einwilligung: Default → Update → gtm.js', () => {
    const config = () => baseConfig([googleTagManager({ id: 'GTM-TEST123' })]);
    const first = newManager();
    first.init(config());
    first.acceptAll();
    // frischer Seitenaufruf
    delete (window as unknown as Record<string, unknown>).dataLayer;
    delete (window as unknown as Record<string, unknown>).__consentKitDefaults_dataLayer;
    resetScriptRegistry();
    document.head.innerHTML = '';
    const m = newManager();
    expect(m.init(config()).decided).toBe(true);
    const e = entries();
    expect(gtmScripts().length).toBe(1);
    expect((e[0] as unknown[])[1]).toBe('default');
    const kinds = e.map((x) => (Array.isArray(x) ? x[1] : (x as { event?: string }).event));
    expect(kinds.indexOf('update')).toBeLessThan(kinds.indexOf('gtm.js'));
  });

  it('Routenwechsel: genau ein virtual_pageview pro Wechsel, nicht beim ersten Laden', () => {
    const m = newManager();
    m.init(baseConfig([googleTagManager({ id: 'GTM-TEST123' })]));
    m.acceptAll();
    m.notifyRouteChange('/');
    m.notifyRouteChange('/kontakt');
    m.notifyRouteChange('/kontakt');
    const views = entries().filter((x) => (x as { event?: string }).event === 'virtual_pageview');
    expect(views).toEqual([expect.objectContaining({ page_path: '/kontakt', page_location: expect.any(String) })]);
  });

  it('Routenwechsel ohne Einwilligung: kein Event im dataLayer', () => {
    const m = newManager();
    m.init(baseConfig([googleTagManager({ id: 'GTM-TEST123' })]));
    m.notifyRouteChange('/a');
    expect(entries().some((x) => (x as { event?: string }).event === 'virtual_pageview')).toBe(false);
  });

  it('nur Ads → Kategorie marketing; eigener dataLayer-Name und Server-Origin', () => {
    const plugin = googleTagManager({ id: 'GTM-X', analytics: false, dataLayerName: 'dl2', scriptOrigin: 'https://sst.example.de/' });
    expect(plugin.category).toEqual(['marketing']);
    const m = newManager();
    m.init(baseConfig([plugin]));
    m.setCategories({ statistics: true });
    expect(document.querySelectorAll('script[data-consent-kit]').length).toBe(0);
    m.setCategories({ marketing: true });
    expect(document.querySelector('script[data-consent-kit]')?.getAttribute('src')).toBe('https://sst.example.de/gtm.js?id=GTM-X&l=dl2');
    expect((window as unknown as { dl2: unknown[] }).dl2.length).toBeGreaterThan(0);
  });

  it('Teil-Widerruf (Statistik) löscht GA-Cookies und fordert Reload an', () => {
    vi.useFakeTimers();
    const reload = vi.fn();
    const original = window.location;
    Object.defineProperty(window, 'location', { configurable: true, value: { ...original, reload, hostname: 'www.example.de', pathname: '/', search: '', href: 'https://www.example.de/', protocol: 'https:' } });
    try {
      const m = newManager();
      m.init(baseConfig([googleTagManager({ id: 'GTM-TEST123' })], { reloadOnRevoke: true }));
      m.acceptAll();
      document.cookie = '_ga=GA1.1.1; Path=/';
      document.cookie = '_ga_ABC=1; Path=/';
      document.cookie = '_gcl_au=1; Path=/';
      m.setCategories({ marketing: true });
      expect(document.cookie).not.toContain('_ga');
      expect(document.cookie).toContain('_gcl_au');
      vi.runAllTimers();
      expect(reload).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: original });
      vi.useRealTimers();
    }
  });

  it('loadBeforeConsent lädt GTM sofort (nur mit Warnung)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    newManager().init(baseConfig([googleTagManager({ id: 'GTM-TEST123', loadBeforeConsent: true })]));
    expect(gtmScripts().length).toBe(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('rechtlich riskant'));
  });
});
