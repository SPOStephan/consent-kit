import type { ConsentPlugin } from '../core/types';

/**
 * TikTok Pixel wird ENTWEDER über consent-kit ODER über GTM eingebunden – nie beides,
 * sonst wird doppelt gezählt.
 */
export type TikTokPixelOptions =
  | {
      /** Pixel-ID, z. B. "C1ABCDEF2GHIJKLMN3OP". */
      id: string;
      /** "kit" (Standard): consent-kit lädt den Pixel und sendet PageViews. */
      loadVia?: 'kit';
      /** Bei Routenwechsel ttq.page() senden. Standard: true. */
      trackRouteChanges?: boolean;
    }
  | {
      /**
       * "gtm": Der Pixel ist als Tag in GTM eingerichtet. consent-kit lädt dann
       * KEIN Skript, zeigt den Dienst aber im Dialog an, sendet beim Widerruf
       * ttq.revokeConsent() und löscht die Cookies.
       */
      loadVia: 'gtm';
      id?: string;
    };

const METHODS = [
  'page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group',
  'enableCookie', 'disableCookie', 'holdConsent', 'revokeConsent', 'grantConsent',
] as const;

type Ttq = unknown[] & Record<string, unknown> & {
  methods: readonly string[];
  setAndDefer(target: Record<string, unknown> & unknown[], method: string): void;
  instance(id: string): unknown;
  load(id: string, options?: Record<string, unknown>): void;
  _i?: Record<string, unknown[] & { _u?: string }>;
  _t?: Record<string, number>;
  _o?: Record<string, unknown>;
};
type Win = Window & { ttq?: Ttq; TiktokAnalyticsObject?: string };

function call(method: string, ...args: unknown[]): void {
  const ttq = (window as Win).ttq;
  const fn = ttq?.[method];
  if (typeof fn === 'function') (fn as (...a: unknown[]) => void).apply(ttq, args);
}

/** Nachbau des offiziellen TikTok-Snippets – das Skript wird aber über consent-kit (nie doppelt) geladen. */
function installStub(w: Win, loadScript: (src: string) => Promise<void>): Ttq {
  if (w.ttq && typeof w.ttq.load === 'function') return w.ttq;
  w.TiktokAnalyticsObject = 'ttq';
  const ttq = (w.ttq = (w.ttq ?? []) as Ttq);
  ttq.methods = METHODS;
  ttq.setAndDefer = (target, method) => {
    target[method as unknown as number] = function (...args: unknown[]) {
      target.push([method, ...args]);
    };
  };
  for (const m of METHODS) ttq.setAndDefer(ttq, m);
  ttq.instance = (id: string) => {
    const e = (ttq._i?.[id] ?? []) as unknown as Record<string, unknown> & unknown[];
    for (const m of METHODS) ttq.setAndDefer(e, m);
    return e;
  };
  ttq.load = (id: string, options?: Record<string, unknown>) => {
    const base = 'https://analytics.tiktok.com/i18n/pixel/events.js';
    ttq._i = ttq._i ?? {};
    ttq._i[id] = [] as unknown[] & { _u?: string };
    ttq._i[id]._u = base;
    ttq._t = ttq._t ?? {};
    ttq._t[id] = Date.now();
    ttq._o = ttq._o ?? {};
    ttq._o[id] = options ?? {};
    void loadScript(`${base}?sdkid=${encodeURIComponent(id)}&lib=ttq`);
  };
  return ttq;
}

export function tiktokPixel(options: TikTokPixelOptions): ConsentPlugin {
  const viaKit = options.loadVia !== 'gtm';
  const trackRouteChanges = options.loadVia !== 'gtm' && options.trackRouteChanges !== false;

  return {
    id: 'tiktok-pixel',
    category: 'marketing',
    meta: {
      name: 'TikTok Pixel',
      provider: 'TikTok Technology Limited, 10 Earlsfort Terrace, Dublin, D02 T380, Irland',
      purpose: {
        de: 'Misst den Erfolg von Werbeanzeigen auf TikTok (Conversions), bildet Zielgruppen für Werbung und ermöglicht personalisierte Werbung.',
        en: 'Measures the success of ads on TikTok (conversions), builds audiences for advertising and enables personalised advertising.',
      },
      cookies: [
        { name: '_ttp', duration: { de: '13 Monate', en: '13 months' }, purpose: { de: 'Wiedererkennung des Browsers', en: 'Recognises the browser' } },
        { name: '_tt_enable_cookie', duration: { de: '13 Monate', en: '13 months' }, purpose: { de: 'Prüft, ob Cookies gesetzt werden können', en: 'Checks whether cookies can be set' } },
        { name: 'ttcsid / ttcsid_<ID>', duration: { de: '13 Monate', en: '13 months' }, purpose: { de: 'Sitzungs-Kennung für die Conversion-Messung', en: 'Session identifier for conversion measurement' } },
      ],
      thirdCountryTransfer: {
        de: 'USA, Singapur, weitere Drittländer (u. a. Fernzugriff aus China); Standardvertragsklauseln',
        en: 'USA, Singapore, other third countries (including remote access from China); standard contractual clauses',
      },
      privacyPolicyUrl: 'https://www.tiktok.com/legal/page/eea/privacy-policy/de',
    },
    cookiePatterns: ['_ttp', '_tt_enable_cookie', 'ttcsid', 'ttcsid_*'],

    onGrant(ctx) {
      if (!viaKit || !options.id) return;
      const ttq = installStub(window as Win, ctx.loadScript);
      ttq.load(options.id);
      call('grantConsent');
      call('page');
      ctx.log('TikTok Pixel wird geladen');
    },

    onRevoke() {
      call('revokeConsent');
    },

    onRouteChange(ctx) {
      if (!trackRouteChanges) return;
      call('page');
      ctx.log('TikTok Pixel: page');
    },
  };
}
