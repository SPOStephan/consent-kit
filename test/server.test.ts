import { beforeEach, describe, expect, it } from 'vitest';
import { hasServerConsent, readConsentState, readMetaBrowserIds } from '../src/server/index';
import { metaPixel } from '../src/plugins/meta';
import { googleTagManager } from '../src/plugins/google';
import { baseConfig, newManager, resetDom } from './helpers';

const config = baseConfig([metaPixel({ id: '1' }), googleTagManager({ id: 'GTM-ABC1234' })]);
const header = () => document.cookie; // Cookie-Header, wie ihn der Browser an den Server sendet

beforeEach(() => resetDom());

describe('consent-kit/server', () => {
  it('ohne Cookie: keine Einwilligung (außer notwendig)', () => {
    expect(hasServerConsent(undefined, config, 'meta-pixel')).toBe(false);
    expect(hasServerConsent('', config, 'marketing')).toBe(false);
    expect(hasServerConsent(null, config, 'necessary')).toBe(true);
  });

  it('liest dieselbe Entscheidung wie der Browser', () => {
    const m = newManager();
    m.init(config);
    m.setCategories({ statistics: true, marketing: false });
    expect(hasServerConsent(header(), config, 'meta-pixel')).toBe(false);
    expect(hasServerConsent(header(), config, 'statistics')).toBe(true);
    m.acceptAll();
    expect(hasServerConsent(header(), config, 'meta-pixel')).toBe(true);
    expect(hasServerConsent(header(), config, 'marketing')).toBe(true);
    expect(readConsentState(header(), config).consentId).toBe(m.getState().consentId);
    m.rejectAll();
    expect(hasServerConsent(header(), config, 'meta-pixel')).toBe(false);
  });

  it('beachtet Einzelentscheidungen je Dienst', () => {
    const m = newManager();
    m.init(config);
    m.setCategories({ marketing: true }, { 'meta-pixel': false });
    expect(hasServerConsent(header(), config, 'meta-pixel')).toBe(false);
    expect(hasServerConsent(header(), config, 'marketing')).toBe(true);
  });

  it('verwirft Entscheidungen mit alter Konfig-Version oder nach Ablauf', () => {
    const m = newManager();
    m.init(config);
    m.acceptAll();
    expect(hasServerConsent(header(), { ...config, version: 2 }, 'meta-pixel')).toBe(false);
    const later = Date.now() + 366 * 24 * 60 * 60 * 1000;
    expect(hasServerConsent(header(), config, 'meta-pixel', later)).toBe(false);
  });

  it('akzeptiert bereits geparste Cookie-Objekte (z. B. req.cookies) und unbekannte IDs sind false', () => {
    const m = newManager();
    m.init(config);
    m.acceptAll();
    const raw = document.cookie.split('; ').find((c) => c.startsWith('consent_kit='))!.slice('consent_kit='.length);
    expect(hasServerConsent({ consent_kit: decodeURIComponent(raw) }, config, 'meta-pixel')).toBe(true);
    expect(hasServerConsent({ consent_kit: raw }, config, 'meta-pixel')).toBe(true);
    expect(hasServerConsent(header(), config, 'gibt-es-nicht')).toBe(false);
  });

  it('liest fbp und fbc für die Conversions API', () => {
    expect(readMetaBrowserIds('a=1; _fbp=fb.1.1700000000000.123; _fbc=fb.1.1700000000001.IwAR0x')).toEqual({
      fbp: 'fb.1.1700000000000.123',
      fbc: 'fb.1.1700000000001.IwAR0x',
    });
    expect(readMetaBrowserIds(undefined)).toEqual({});
  });
});
