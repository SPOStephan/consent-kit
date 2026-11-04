import { beforeEach, describe, expect, it } from 'vitest';
import { acceptAll, init, rejectAll } from '../src/index';
import { getMetaBrowserIds, trackMetaEvent } from '../src/meta/index';
import { metaPixel } from '../src/plugins/meta';
import { baseConfig, newManager, resetDom } from './helpers';

type W = Window & { fbq?: { queue: unknown[][] } };
const w = () => window as W;
const cookie = (name: string) => document.cookie.split('; ').find((c) => c.startsWith(name + '='))?.slice(name.length + 1);

function setUrl(path: string) {
  history.replaceState(null, '', path);
}

beforeEach(() => {
  resetDom();
  setUrl('/');
});

describe('trackMetaEvent', () => {
  it('sendet ohne Einwilligung nichts und gibt null zurück', () => {
    init(baseConfig([metaPixel({ id: '1' })]));
    expect(trackMetaEvent('Lead')).toBeNull();
    rejectAll();
    expect(trackMetaEvent('Lead')).toBeNull();
    expect(w().fbq).toBeUndefined();
  });

  it('sendet Standardereignisse per track mit eventID, eigene per trackCustom', () => {
    init(baseConfig([metaPixel({ id: '1' })]));
    acceptAll();
    expect(trackMetaEvent('Lead', { content_name: 'KI-Check' }, { eventId: 'evt-1' })).toBe('evt-1');
    const generated = trackMetaEvent('CompleteRegistration');
    expect(generated).toMatch(/^[0-9a-f-]{36}$/);
    expect(trackMetaEvent('DisqualifiedLead', {}, { eventId: 'evt-3' })).toBe('evt-3');
    const queue = w().fbq?.queue ?? [];
    expect(queue).toContainEqual(['track', 'Lead', { content_name: 'KI-Check' }, { eventID: 'evt-1' }]);
    expect(queue).toContainEqual(['track', 'CompleteRegistration', {}, { eventID: generated }]);
    expect(queue).toContainEqual(['trackCustom', 'DisqualifiedLead', {}, { eventID: 'evt-3' }]);
  });

  it('gibt fbp/fbc nur mit Einwilligung heraus', () => {
    init(baseConfig([metaPixel({ id: '1' })]));
    expect(getMetaBrowserIds()).toEqual({});
    acceptAll();
    document.cookie = '_fbp=fb.1.1700000000000.123; Path=/'; // setzt der Pixel nach dem Laden
    expect(getMetaBrowserIds()).toEqual({ fbp: 'fb.1.1700000000000.123' });
  });
});

describe('Meta Pixel: Klick-ID der Einstiegsseite', () => {
  it('speichert fbclid vor der Einwilligung nirgends', () => {
    setUrl('/landing?fbclid=IwAR0abcdefgh_123');
    const m = newManager();
    m.init(baseConfig([metaPixel({ id: '1' })]));
    expect(cookie('_fbc')).toBeUndefined();
    expect(JSON.stringify({ ...sessionStorage })).not.toContain('IwAR0');
    expect(JSON.stringify({ ...localStorage })).not.toContain('IwAR0');
  });

  it('setzt _fbc bei späterer Einwilligung, wenn fbclid nicht mehr in der URL steht', () => {
    setUrl('/landing?fbclid=IwAR0abcdefgh_123');
    const m = newManager();
    m.init(baseConfig([metaPixel({ id: '1' })]));
    setUrl('/ki-check'); // SPA-Seitenwechsel vor der Zustimmung
    m.acceptAll();
    expect(cookie('_fbc')).toMatch(/^fb\.1\.\d{13}\.IwAR0abcdefgh_123$/);
  });

  it('überlässt das Setzen dem Pixel, wenn fbclid noch in der URL steht, und überschreibt kein vorhandenes _fbc', () => {
    setUrl('/landing?fbclid=IwAR0abcdefgh_123');
    const m = newManager();
    m.init(baseConfig([metaPixel({ id: '1' })]));
    m.acceptAll();
    expect(cookie('_fbc')).toBeUndefined();

    resetDom();
    setUrl('/landing?fbclid=IwAR0abcdefgh_123');
    const m2 = newManager();
    m2.init(baseConfig([metaPixel({ id: '1' })]));
    setUrl('/weiter');
    document.cookie = '_fbc=fb.1.1700000000000.OLD; Path=/';
    m2.acceptAll();
    expect(cookie('_fbc')).toBe('fb.1.1700000000000.OLD');
  });

  it('ignoriert ungültige fbclid-Werte', () => {
    setUrl('/landing?fbclid=%3Cscript%3E');
    const m = newManager();
    m.init(baseConfig([metaPixel({ id: '1' })]));
    setUrl('/weiter');
    m.acceptAll();
    expect(cookie('_fbc')).toBeUndefined();
  });
});
