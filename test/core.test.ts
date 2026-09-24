import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteCookies, domainCandidates, matchesPattern } from '../src/core/cookies';
import { loadScript } from '../src/core/scripts';
import { resolveTexts } from '../src/core/texts';
import * as api from '../src/index';
import { baseConfig, newManager, resetDom, spyPlugin, storedCookie } from './helpers';

beforeEach(() => resetDom());
afterEach(() => {
  vi.useRealTimers();
  delete (navigator as { globalPrivacyControl?: boolean }).globalPrivacyControl;
});

describe('Zustand und Speicherung', () => {
  it('startet ohne Entscheidung und ohne Einwilligung', () => {
    const m = newManager();
    const stats = spyPlugin('stats', 'statistics');
    const state = m.init(baseConfig([stats]));
    expect(state.decided).toBe(false);
    expect(m.hasConsent('statistics')).toBe(false);
    expect(m.hasConsent('marketing')).toBe(false);
    expect(m.hasConsent('necessary')).toBe(true);
    expect(stats.onInit).toHaveBeenCalledTimes(1);
    expect(stats.onGrant).not.toHaveBeenCalled();
    expect(document.cookie).not.toContain('consent_kit');
  });

  it('acceptAll speichert alle Kategorien im Cookie und aktiviert Dienste', () => {
    const m = newManager();
    const stats = spyPlugin('stats', 'statistics');
    const ads = spyPlugin('ads', 'marketing');
    m.init(baseConfig([stats, ads]));
    m.acceptAll();
    const state = m.getState();
    expect(state.decided).toBe(true);
    expect(state.consentId).toMatch(/^[0-9a-f-]{36}$/);
    expect(state.categories).toEqual({ necessary: true, statistics: true, marketing: true });
    expect(stats.onGrant).toHaveBeenCalledTimes(1);
    expect(ads.onGrant).toHaveBeenCalledTimes(1);
    const stored = storedCookie();
    expect(stored).toMatchObject({ i: state.consentId, v: '1', d: 1, c: ['necessary', 'statistics', 'marketing'] });
  });

  it('rejectAll erlaubt nur notwendige Dienste', () => {
    const m = newManager();
    const stats = spyPlugin('stats', 'statistics');
    const needed = spyPlugin('needed', 'necessary');
    m.init(baseConfig([stats, needed]));
    expect(needed.onGrant).not.toHaveBeenCalled();
    m.rejectAll();
    expect(m.getState().categories).toEqual({ necessary: true, statistics: false, marketing: false });
    expect(stats.onGrant).not.toHaveBeenCalled();
    expect(needed.onGrant).toHaveBeenCalledTimes(1);
  });

  it('stellt eine gespeicherte Entscheidung beim nächsten Besuch wieder her (Ablehnung wird nicht erneut abgefragt)', () => {
    const m1 = newManager();
    m1.init(baseConfig([]));
    m1.rejectAll();
    const id = m1.getState().consentId;

    const m2 = newManager();
    const stats = spyPlugin('stats', 'statistics');
    const state = m2.init(baseConfig([stats]));
    expect(state.decided).toBe(true);
    expect(state.consentId).toBe(id);
    expect(state.categories.statistics).toBe(false);
  });

  it('aktiviert erlaubte Dienste direkt beim Start, wenn bereits eingewilligt wurde', () => {
    newManager().init(baseConfig([]));
    api.getManager().init(baseConfig([]));
    api.acceptAll();
    const m2 = newManager();
    const stats = spyPlugin('stats', 'statistics');
    m2.init(baseConfig([stats]));
    expect(stats.onInit).toHaveBeenCalledBefore(stats.onConsent);
    expect(stats.onConsent).toHaveBeenCalledBefore(stats.onGrant);
    expect(stats.onGrant).toHaveBeenCalledTimes(1);
  });

  it('fragt bei geänderter Konfig-Version erneut (Consent-ID bleibt erhalten)', () => {
    const m1 = newManager();
    m1.init(baseConfig([]));
    m1.acceptAll();
    const id = m1.getState().consentId;
    const m2 = newManager();
    const stats = spyPlugin('stats', 'statistics');
    const state = m2.init(baseConfig([stats], { version: 2 }));
    expect(state.decided).toBe(false);
    expect(state.consentId).toBe(id);
    expect(stats.onGrant).not.toHaveBeenCalled();
  });

  it('fragt nach 12 Monaten erneut', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    const m1 = newManager();
    m1.init(baseConfig([]));
    m1.acceptAll();
    // Cookie läuft technisch per Max-Age ab – zusätzlich prüfen wir den Zeitstempel.
    vi.setSystemTime(new Date('2026-01-02T00:00:00Z'));
    const m2 = newManager();
    expect(m2.init(baseConfig([])).decided).toBe(false);
  });

  it('begrenzt maxAgeDays auf 365 Tage', () => {
    const m = newManager();
    m.init(baseConfig([], { cookie: { maxAgeDays: 1000 } }));
    const spy = vi.spyOn(document, 'cookie', 'set');
    m.acceptAll();
    expect(spy.mock.calls.find(([c]) => String(c).startsWith('consent_kit='))?.[0]).toContain('Max-Age=31536000');
  });

  it('setzt SameSite=Lax, Secure (unter HTTPS) und die konfigurierte Domain', () => {
    const m = newManager();
    m.init(baseConfig([], { cookie: { domain: '.example.de', name: 'ck' } }));
    const spy = vi.spyOn(document, 'cookie', 'set');
    m.rejectAll();
    const written = String(spy.mock.calls.find(([c]) => String(c).startsWith('ck='))?.[0]);
    expect(written).toContain('SameSite=Lax');
    expect(written).toContain('Secure');
    expect(written).toContain('Domain=.example.de');
  });

  it('ignoriert einen kaputten Cookie', () => {
    document.cookie = 'consent_kit=%7Bkaputt; Path=/';
    expect(newManager().init(baseConfig([])).decided).toBe(false);
  });

  it('setCategories setzt nur die genannten Kategorien', () => {
    const m = newManager();
    const stats = spyPlugin('stats', 'statistics');
    const ads = spyPlugin('ads', 'marketing');
    m.init(baseConfig([stats, ads]));
    m.setCategories({ statistics: true });
    expect(m.hasConsent('statistics')).toBe(true);
    expect(m.hasConsent('marketing')).toBe(false);
    expect(m.hasConsent('stats')).toBe(true);
    expect(m.hasConsent('ads')).toBe(false);
    expect(ads.onGrant).not.toHaveBeenCalled();
  });

  it('kennt eigene Kategorien aus der Konfiguration', () => {
    const m = newManager();
    const video = spyPlugin('video', 'media');
    m.init(
      baseConfig([video], {
        categories: [{ id: 'media', label: { de: 'Medien', en: 'Media' }, description: { de: 'x', en: 'x' } }],
      }),
    );
    m.setCategories({ media: true });
    expect(m.hasConsent('media')).toBe(true);
    expect(video.onGrant).toHaveBeenCalled();
  });

  it('Dienst mit mehreren Kategorien ist erlaubt, sobald eine davon erlaubt ist', () => {
    const m = newManager();
    const gtm = spyPlugin('gtm', ['statistics', 'marketing']);
    m.init(baseConfig([gtm]));
    m.setCategories({ marketing: true });
    expect(m.hasConsent('gtm')).toBe(true);
    expect(gtm.onGrant).toHaveBeenCalledTimes(1);
  });

  it('setService erteilt Einwilligung für genau einen Dienst, ohne das Banner zu entscheiden', () => {
    const m = newManager();
    const yt = spyPlugin('youtube', 'marketing', { onGrant: undefined });
    const ads = spyPlugin('ads', 'marketing');
    m.init(baseConfig([yt, ads]));
    m.setService('youtube', true);
    expect(m.hasConsent('youtube')).toBe(true);
    expect(m.hasConsent('ads')).toBe(false);
    expect(m.hasConsent('marketing')).toBe(false);
    expect(m.getState().decided).toBe(false);
    // bleibt nach "Neuladen" erhalten
    expect(newManager().init(baseConfig([yt, ads])).services).toEqual({ youtube: true });
  });
});

describe('Widerruf', () => {
  it('ruft onRevoke auf, löscht Cookies und lädt die Seite neu', () => {
    vi.useFakeTimers();
    const reload = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload, hostname: 'www.example.de', pathname: '/', search: '', href: 'https://www.example.de/', protocol: 'https:' },
    });
    try {
      const m = newManager();
      const ads = spyPlugin('ads', 'marketing', { cookiePatterns: ['_fbp', '_ga*'] });
      m.init(baseConfig([ads], { reloadOnRevoke: true }));
      m.acceptAll();
      document.cookie = '_fbp=1; Path=/';
      document.cookie = '_ga_ABC=1; Path=/; Domain=.example.de';
      document.cookie = 'other=1; Path=/';
      const revoked = vi.fn();
      m.on('consent:revoked', revoked);
      m.rejectAll();
      expect(ads.onRevoke).toHaveBeenCalledTimes(1);
      expect(revoked).toHaveBeenCalledWith(expect.objectContaining({ revokedServices: ['ads'] }));
      expect(document.cookie).not.toContain('_fbp');
      expect(document.cookie).not.toContain('_ga_ABC');
      expect(document.cookie).toContain('other=1');
      vi.runAllTimers();
      expect(reload).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    }
  });

  it('lädt nicht neu, wenn nur ein Embed ohne Skript widerrufen wird', () => {
    vi.useFakeTimers();
    const m = newManager();
    const yt = spyPlugin('youtube', 'marketing', { onGrant: undefined });
    m.init(baseConfig([yt], { reloadOnRevoke: true }));
    m.setService('youtube', true);
    const reloadSpy = vi.fn();
    m.on('consent:revoked', reloadSpy);
    m.setService('youtube', false);
    expect(reloadSpy).toHaveBeenCalled();
    expect(yt.onRevoke).toHaveBeenCalled();
    vi.runAllTimers(); // würde in jsdom bei location.reload() einen Fehler melden
  });

  it('löscht Cookies nicht erlaubter Dienste auch beim Start', () => {
    document.cookie = '_ttp=1; Path=/';
    const m = newManager();
    m.init(baseConfig([spyPlugin('tt', 'marketing', { cookiePatterns: ['_ttp'] })]));
    expect(document.cookie).not.toContain('_ttp');
  });
});

describe('Ereignisse', () => {
  it('sendet consent:ready und consent:changed', () => {
    const m = newManager();
    const ready = vi.fn();
    const changed = vi.fn();
    m.on('consent:ready', ready);
    const off = m.on('consent:changed', changed);
    m.init(baseConfig([]));
    expect(ready).toHaveBeenCalledTimes(1);
    m.acceptAll();
    expect(changed).toHaveBeenCalledWith(expect.objectContaining({ action: 'accept-all' }));
    off();
    m.rejectAll();
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('Fehler in Handlern und Plugins brechen nichts ab', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const m = newManager();
    const broken = spyPlugin('broken', 'statistics', {
      onGrant: () => {
        throw new Error('kaputt');
      },
    });
    const ok = spyPlugin('ok', 'statistics');
    m.on('consent:changed', () => {
      throw new Error('handler kaputt');
    });
    m.init(baseConfig([broken, ok]));
    m.acceptAll();
    expect(ok.onGrant).toHaveBeenCalled();
    expect(error).toHaveBeenCalledTimes(2);
  });

  it('openSettings löst ui:open-settings aus', () => {
    const m = newManager();
    const open = vi.fn();
    m.on('ui:open-settings', open);
    m.openSettings();
    expect(open).toHaveBeenCalled();
  });
});

describe('Mehrfaches init (StrictMode, Hot Reload)', () => {
  it('ruft onInit/onGrant nur einmal auf', () => {
    const stats = spyPlugin('stats', 'statistics');
    const config = baseConfig([stats]);
    api.init(config);
    api.acceptAll();
    api.init(config);
    api.init({ ...config });
    expect(stats.onInit).toHaveBeenCalledTimes(1);
    expect(stats.onGrant).toHaveBeenCalledTimes(1);
    expect(api.getManager()).toBe(api.getManager());
  });

  it('stellt window.consentKit bereit', () => {
    api.init(baseConfig([]));
    const w = window as unknown as { consentKit: { openSettings: () => void } };
    expect(typeof w.consentKit.openSettings).toBe('function');
  });
});

describe('Single-Page-App', () => {
  it('ignoriert den ersten Seitenaufruf und doppelte Meldungen', () => {
    const m = newManager();
    const stats = spyPlugin('stats', 'statistics');
    m.init(baseConfig([stats]));
    m.acceptAll();
    m.notifyRouteChange('/'); // initiale Route
    expect(stats.onRouteChange).not.toHaveBeenCalled();
    m.notifyRouteChange('/a');
    m.notifyRouteChange('/a');
    m.notifyRouteChange('/b');
    expect(stats.onRouteChange).toHaveBeenCalledTimes(2);
    expect(stats.onRouteChange.mock.calls[1]?.[1]).toMatchObject({ path: '/b' });
  });

  it('sendet keine PageViews für Dienste ohne Einwilligung', () => {
    const m = newManager();
    const stats = spyPlugin('stats', 'statistics');
    m.init(baseConfig([stats]));
    m.rejectAll();
    m.notifyRouteChange('/x');
    expect(stats.onRouteChange).not.toHaveBeenCalled();
  });

  it('autoTrackRouteChanges erkennt pushState', async () => {
    const stats = spyPlugin('stats', 'statistics');
    api.init(baseConfig([stats]));
    api.acceptAll();
    const stop = api.autoTrackRouteChanges();
    history.pushState({}, '', '/neu');
    await new Promise((r) => setTimeout(r, 5));
    stop();
    history.pushState({}, '', '/');
    expect(stats.onRouteChange).toHaveBeenCalledTimes(1);
  });
});

describe('Global Privacy Control', () => {
  it('wertet GPC als Ablehnung von Marketing bei acceptAll', () => {
    (navigator as { globalPrivacyControl?: boolean }).globalPrivacyControl = true;
    const m = newManager();
    m.init(baseConfig([], { respectGpc: true }));
    m.acceptAll();
    expect(m.getState()).toMatchObject({ gpc: true, categories: { statistics: true, marketing: false } });
  });

  it('ignoriert GPC ohne respectGpc', () => {
    (navigator as { globalPrivacyControl?: boolean }).globalPrivacyControl = true;
    const m = newManager();
    m.init(baseConfig([]));
    m.acceptAll();
    expect(m.hasConsent('marketing')).toBe(true);
  });
});

describe('Protokollierung', () => {
  it('sendet Consent-ID, Zeitstempel, Version, Kategorien und Domain – ohne IP/User-Agent', () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const m = newManager();
    m.init(baseConfig([], { logging: { endpoint: 'https://log.example.de/log' } }));
    m.rejectAll();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://log.example.de/log');
    expect(init).toMatchObject({ method: 'POST', keepalive: true, credentials: 'omit' });
    const body = JSON.parse(String(init.body));
    expect(body).toEqual({
      consentId: m.getState().consentId,
      timestamp: m.getState().timestamp,
      configVersion: '1',
      action: 'reject-all',
      categories: { necessary: true, statistics: false, marketing: false },
      services: {},
      gpc: false,
      domain: 'www.example.de',
    });
    expect(JSON.stringify(body)).not.toMatch(/userAgent|Mozilla|ip/i);
    vi.unstubAllGlobals();
  });
});

describe('Hilfsfunktionen', () => {
  it('matchesPattern unterstützt Wildcards und RegExp', () => {
    expect(matchesPattern('_ga_ABC', '_ga*')).toBe(true);
    expect(matchesPattern('_gat', '_ga')).toBe(false);
    expect(matchesPattern('_gcl_au', /^_gcl_/)).toBe(true);
  });

  it('domainCandidates listet alle übergeordneten Domains', () => {
    expect(domainCandidates('www.example.de')).toEqual(['', 'www.example.de', '.www.example.de', 'example.de', '.example.de']);
    expect(domainCandidates('localhost')).toEqual(['']);
  });

  it('deleteCookies löscht passende Cookies', () => {
    document.cookie = '_gid=1; Path=/';
    expect(deleteCookies(['_gid'])).toEqual(['_gid']);
    expect(document.cookie).not.toContain('_gid');
  });

  it('loadScript fügt jedes Skript nur einmal ein', () => {
    void loadScript('https://cdn.example.com/a.js');
    void loadScript('https://cdn.example.com/a.js');
    expect(document.querySelectorAll('script[src="https://cdn.example.com/a.js"]').length).toBe(1);
  });

  it('resolveTexts übernimmt Overrides und eigene Kategorien', () => {
    const texts = resolveTexts(
      baseConfig([], {
        language: 'en',
        texts: { en: { acceptAll: 'OK for all', categories: { marketing: { label: 'Ads' } } } },
        categories: [{ id: 'media', label: { de: 'Medien', en: 'Media' }, description: { de: 'd', en: 'e' } }],
      }),
    );
    expect(texts.acceptAll).toBe('OK for all');
    expect(texts.rejectAll).toBe('Reject all');
    expect(texts.categories.marketing).toEqual({ label: 'Ads', description: expect.any(String) });
    expect(texts.categories.media?.label).toBe('Media');
  });
});
