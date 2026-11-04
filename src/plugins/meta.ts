import { readCookie, writeCookie } from '../core/cookies';
import type { ConsentPlugin } from '../core/types';

/** Plugin-ID des Meta Pixels – z. B. für hasConsent('meta-pixel'). */
const META_PIXEL_SERVICE_ID = 'meta-pixel';
const FBC_MAX_AGE_SECONDS = 90 * 24 * 60 * 60;


/** fbclid aus der Einstiegs-URL – nur im Arbeitsspeicher, nie vor der Einwilligung gespeichert. */
function clickIdFromUrl(): string | undefined {
  if (typeof location === 'undefined') return undefined;
  try {
    const value = new URLSearchParams(location.search).get('fbclid')?.trim();
    return value && /^[A-Za-z0-9_\-.]{8,500}$/.test(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Meta Pixel wird ENTWEDER über consent-kit ODER über GTM eingebunden – nie beides,
 * sonst wird doppelt gezählt.
 */
export type MetaPixelOptions =
  | {
      /** Pixel-ID (nur Ziffern), z. B. "123456789012345". */
      id: string;
      /** "kit" (Standard): consent-kit lädt den Pixel und sendet PageViews. */
      loadVia?: 'kit';
      /** Bei Routenwechsel PageView senden. Standard: true. */
      trackRouteChanges?: boolean;
    }
  | {
      /**
       * "gtm": Der Pixel ist als Tag in GTM eingerichtet. consent-kit lädt dann
       * KEIN Skript, zeigt den Dienst aber im Dialog an, sendet beim Widerruf
       * fbq('consent', 'revoke') und löscht die Cookies.
       */
      loadVia: 'gtm';
      id?: string;
    };

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[];
  push: Fbq;
  loaded: boolean;
  version: string;
  disablePushState?: boolean;
  allowDuplicatePageViews?: boolean;
};
type Win = Window & { fbq?: Fbq; _fbq?: Fbq };

function installStub(w: Win): Fbq {
  if (w.fbq) return w.fbq;
  // Entspricht dem offiziellen Meta-Snippet – nur ohne das automatische Einfügen des Skripts.
  const n = function (...args: unknown[]) {
    if (n.callMethod) n.callMethod(...args);
    else n.queue.push(args);
  } as Fbq;
  n.push = n;
  n.loaded = true;
  n.version = '2.0';
  n.queue = [];
  w.fbq = n;
  if (!w._fbq) w._fbq = n;
  return n;
}

export function metaPixel(options: MetaPixelOptions): ConsentPlugin {
  const viaKit = options.loadVia !== 'gtm';
  const trackRouteChanges = options.loadVia !== 'gtm' && options.trackRouteChanges !== false;
  // Klick-ID der Einstiegsseite. Stimmt der Besucher erst nach einem Seitenwechsel zu, steht
  // fbclid nicht mehr in der URL – Meta könnte den Besuch dann keiner Anzeige zuordnen.
  let entryClickId: string | undefined;

  return {
    id: META_PIXEL_SERVICE_ID,
    category: 'marketing',
    meta: {
      name: 'Meta Pixel',
      provider: 'Meta Platforms Ireland Limited, Merrion Road, Dublin 4, D04 X2K5, Irland',
      purpose: {
        de: 'Misst den Erfolg von Werbeanzeigen auf Facebook und Instagram (Conversions), bildet Zielgruppen für Werbung (Remarketing) und ermöglicht personalisierte Werbung.',
        en: 'Measures the success of ads on Facebook and Instagram (conversions), builds audiences for advertising (remarketing) and enables personalised advertising.',
      },
      cookies: [
        { name: '_fbp', duration: { de: '3 Monate', en: '3 months' }, purpose: { de: 'Wiedererkennung des Browsers', en: 'Recognises the browser' } },
        { name: '_fbc', duration: { de: '3 Monate', en: '3 months' }, purpose: { de: 'Speichert den letzten Klick auf eine Anzeige', en: 'Stores the last ad click' } },
        { name: 'fr (facebook.com)', duration: { de: '3 Monate', en: '3 months' }, purpose: { de: 'Personalisierte Werbung (Drittanbieter-Cookie)', en: 'Personalised advertising (third-party cookie)' } },
      ],
      thirdCountryTransfer: {
        de: 'USA (Meta Platforms, Inc.; EU-US Data Privacy Framework, Standardvertragsklauseln)',
        en: 'USA (Meta Platforms, Inc.; EU-US Data Privacy Framework, standard contractual clauses)',
      },
      privacyPolicyUrl: 'https://www.facebook.com/privacy/policy/',
    },
    cookiePatterns: ['_fbp', '_fbc'],

    onInit() {
      entryClickId = clickIdFromUrl();
    },

    onGrant(ctx) {
      if (!viaKit || !options.id) return;
      // _fbc erst NACH der Einwilligung setzen (Format laut Meta: fb.1.<Zeitstempel ms>.<fbclid>).
      // Steht fbclid noch in der URL, setzt der Pixel _fbc selbst.
      if (entryClickId && !clickIdFromUrl() && !readCookie('_fbc')) {
        writeCookie('_fbc', `fb.1.${Date.now()}.${entryClickId}`, { maxAgeSeconds: FBC_MAX_AGE_SECONDS });
        ctx.log('Meta Pixel: _fbc aus der Einstiegs-URL gesetzt');
      }
      const fbq = installStub(window as Win);
      // Meta zählt sonst bei pushState automatisch PageViews → Doppelzählung in SPAs.
      fbq.disablePushState = true;
      fbq.allowDuplicatePageViews = true;
      fbq('consent', 'grant');
      fbq('init', options.id);
      fbq('track', 'PageView');
      ctx.log('Meta Pixel wird geladen');
      void ctx.loadScript('https://connect.facebook.net/en_US/fbevents.js');
    },

    onRevoke() {
      const fbq = (window as Win).fbq;
      if (typeof fbq === 'function') fbq('consent', 'revoke');
    },

    onRouteChange(ctx) {
      if (!trackRouteChanges) return;
      const fbq = (window as Win).fbq;
      if (typeof fbq === 'function') {
        fbq('track', 'PageView');
        ctx.log('Meta Pixel: PageView');
      }
    },
  };
}
