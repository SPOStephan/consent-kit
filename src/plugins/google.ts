import { deleteCookies } from '../core/cookies';
import type { ConsentPlugin, CookieInfo, CookiePattern, PluginContext } from '../core/types';

export interface GoogleTagManagerOptions {
  /** GTM-Container-ID, z. B. "GTM-ABC1234". */
  id: `GTM-${string}`;
  /**
   * Welche Google-Dienste über GTM laufen. Bestimmt die Kategorien und die
   * Angaben im Einstellungsdialog. Standard: beide true.
   */
  analytics?: boolean;
  ads?: boolean;
  /** Name des dataLayer. Standard: "dataLayer". */
  dataLayerName?: string;
  /**
   * Herkunft des GTM-Skripts, z. B. für Server-Side-Tagging mit eigener Domain.
   * Standard: "https://www.googletagmanager.com".
   */
  scriptOrigin?: string;
  /** GTM-Umgebung (Environments), optional. */
  environment?: { auth: string; preview: string };
  /** Name des dataLayer-Events nach jeder Entscheidung. Standard: "consent_update". */
  consentEvent?: string;
  /** Name des dataLayer-Events bei Routenwechsel (SPA). Standard: "virtual_pageview". */
  pageViewEvent?: string;
  /** Anzeigen-Daten schwärzen, solange ad_storage verweigert ist. Standard: true. */
  adsDataRedaction?: boolean;
  /** URL-Passthrough für Google Ads. Standard: false. */
  urlPassthrough?: boolean;
  /**
   * ⚠️ RECHTLICH RISKANT – nur nach Rücksprache mit Ihrer Rechtsberatung aktivieren!
   *
   * Lädt den Google Tag Manager bereits VOR der Einwilligung (Consent Mode
   * "advanced"). Dadurch gehen schon vor jeder Entscheidung Requests an Google
   * (u. a. cookielose Pings mit IP-Adresse und Geräteinformationen). Das ist nach
   * § 25 TDDDG / DSGVO umstritten. Standard: false ("strict mode").
   */
  loadBeforeConsent?: boolean;
}

type Gtag = (...args: unknown[]) => void;
type Win = Window & Record<string, unknown>;

const PROVIDER = 'Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland';

const ANALYTICS_COOKIES: CookieInfo[] = [
  { name: '_ga', duration: { de: '2 Jahre', en: '2 years' }, purpose: { de: 'Unterscheidung von Nutzern (Google Analytics)', en: 'Distinguishes users (Google Analytics)' } },
  { name: '_ga_<ID>', duration: { de: '2 Jahre', en: '2 years' }, purpose: { de: 'Speichert den Sitzungsstatus (Google Analytics 4)', en: 'Stores session state (Google Analytics 4)' } },
];
const ADS_COOKIES: CookieInfo[] = [
  { name: '_gcl_au', duration: { de: '90 Tage', en: '90 days' }, purpose: { de: 'Conversion-Messung (Google Ads)', en: 'Conversion measurement (Google Ads)' } },
  { name: '_gcl_aw / _gcl_dc', duration: { de: '90 Tage', en: '90 days' }, purpose: { de: 'Speichert Klick-Informationen aus Anzeigen (Google Ads)', en: 'Stores ad click information (Google Ads)' } },
  { name: 'IDE (doubleclick.net)', duration: { de: '13 Monate', en: '13 months' }, purpose: { de: 'Personalisierte Werbung (Drittanbieter-Cookie)', en: 'Personalised advertising (third-party cookie)' } },
];

export const GOOGLE_ANALYTICS_COOKIE_PATTERNS: readonly CookiePattern[] = ['_ga', '_ga_*', '_gid', '_gat', '_gat_*', '_dc_gtm_*', 'FPID', 'FPLC', 'FPGSID'];
export const GOOGLE_ADS_COOKIE_PATTERNS: readonly CookiePattern[] = ['_gcl_*', 'FPAU', 'FPGCLAW', 'FPGCLDC'];

/**
 * Google Tag Manager mit Google Consent Mode v2.
 *
 * - Beim Start: dataLayer + gtag anlegen und Consent-Defaults setzen (alles
 *   "denied" außer security_storage). Dabei geht KEIN Request an Google.
 * - Nach Einwilligung: gtag('consent', 'update', …) je Kategorie, Event
 *   "consent_update" ins dataLayer, danach GTM laden.
 * - Bei Routenwechsel: Event "virtual_pageview" ins dataLayer.
 */
export function googleTagManager(options: GoogleTagManagerOptions): ConsentPlugin {
  const analytics = options.analytics !== false;
  const ads = options.ads !== false;
  const dlName = options.dataLayerName ?? 'dataLayer';
  const consentEvent = options.consentEvent ?? 'consent_update';
  const pageViewEvent = options.pageViewEvent ?? 'virtual_pageview';
  const origin = (options.scriptOrigin ?? 'https://www.googletagmanager.com').replace(/\/$/, '');
  const categories = [...(analytics ? ['statistics'] : []), ...(ads ? ['marketing'] : [])];
  if (categories.length === 0) categories.push('statistics');

  let lastSignature = '';
  let loaded = false;
  /** Welche Kategorien waren seit dem Laden von GTM auf dieser Seite erlaubt? */
  const grantedWhileLoaded = { statistics: false, marketing: false };

  const win = () => window as unknown as Win;
  const dataLayer = (): unknown[] => {
    const w = win();
    return (w[dlName] = (w[dlName] as unknown[] | undefined) ?? []) as unknown[];
  };
  const gtag: Gtag = function () {
    // Wichtig: GTM erwartet das arguments-Objekt, kein Array.
    // eslint-disable-next-line prefer-rest-params
    dataLayer().push(arguments);
  };

  const loadGtm = (ctx: PluginContext) => {
    if (loaded) return;
    loaded = true;
    grantedWhileLoaded.statistics ||= analytics && ctx.hasConsent('statistics');
    grantedWhileLoaded.marketing ||= ads && ctx.hasConsent('marketing');
    dataLayer().push({ 'gtm.start': Date.now(), event: 'gtm.js' });
    let src = `${origin}/gtm.js?id=${encodeURIComponent(options.id)}`;
    if (dlName !== 'dataLayer') src += `&l=${encodeURIComponent(dlName)}`;
    if (options.environment) {
      src += `&gtm_auth=${encodeURIComponent(options.environment.auth)}&gtm_preview=${encodeURIComponent(options.environment.preview)}&gtm_cookies_win=x`;
    }
    ctx.log('Google Tag Manager wird geladen:', src);
    void ctx.loadScript(src);
  };

  const services = [analytics && 'Google Analytics 4', ads && 'Google Ads'].filter(Boolean).join(', ');

  return {
    id: 'google-tag-manager',
    category: categories,
    meta: {
      name: services ? `Google Tag Manager (${services})` : 'Google Tag Manager',
      provider: PROVIDER,
      purpose: {
        de:
          'Der Google Tag Manager lädt weitere Google-Dienste. ' +
          (analytics ? 'Google Analytics 4 erstellt Statistiken über die Nutzung der Website. ' : '') +
          (ads ? 'Google Ads misst den Erfolg von Anzeigen (Conversions) und ermöglicht personalisierte Werbung. ' : '') +
          'Die Dienste werden nur entsprechend Ihrer Einwilligung aktiviert (Google Consent Mode v2).',
        en:
          'Google Tag Manager loads further Google services. ' +
          (analytics ? 'Google Analytics 4 creates statistics about the use of the website. ' : '') +
          (ads ? 'Google Ads measures the success of ads (conversions) and enables personalised advertising. ' : '') +
          'The services are only activated according to your consent (Google Consent Mode v2).',
      },
      cookies: [...(analytics ? ANALYTICS_COOKIES : []), ...(ads ? ADS_COOKIES : [])],
      thirdCountryTransfer: {
        de: 'USA (Google LLC; EU-US Data Privacy Framework, Standardvertragsklauseln)',
        en: 'USA (Google LLC; EU-US Data Privacy Framework, standard contractual clauses)',
      },
      privacyPolicyUrl: 'https://policies.google.com/privacy',
    },
    cookiePatterns: [...GOOGLE_ANALYTICS_COOKIE_PATTERNS, ...GOOGLE_ADS_COOKIE_PATTERNS],

    onInit(ctx) {
      const w = win();
      dataLayer();
      if (dlName === 'dataLayer' && typeof w.gtag !== 'function') w.gtag = gtag;
      // Defaults nur einmal pro Seitenaufruf setzen (auch bei Hot Reload).
      const flag = `__consentKitDefaults_${dlName}`;
      if (!w[flag]) {
        w[flag] = true;
        gtag('consent', 'default', {
          ad_storage: 'denied',
          analytics_storage: 'denied',
          ad_user_data: 'denied',
          ad_personalization: 'denied',
          security_storage: 'granted',
          wait_for_update: 500,
        });
        if (options.adsDataRedaction !== false) gtag('set', 'ads_data_redaction', true);
        if (options.urlPassthrough) gtag('set', 'url_passthrough', true);
        ctx.log('Consent Mode v2: Defaults gesetzt (denied)');
      }
      if (options.loadBeforeConsent && typeof console !== 'undefined') {
        console.warn(
          'consent-kit: googleTagManager({ loadBeforeConsent: true }) lädt GTM vor der Einwilligung. ' +
            'Das ist rechtlich riskant (§ 25 TDDDG) – siehe docs/GTM.md.',
        );
      }
    },

    onConsent(ctx) {
      const statistics = analytics && ctx.hasConsent('statistics');
      const marketing = ads && ctx.hasConsent('marketing');
      const decided = ctx.state.decided;
      const signature = `${decided}|${statistics}|${marketing}`;
      if (signature !== lastSignature) {
        lastSignature = signature;
        if (decided || statistics || marketing) {
          const m = marketing ? 'granted' : 'denied';
          gtag('consent', 'update', {
            analytics_storage: statistics ? 'granted' : 'denied',
            ad_storage: m,
            ad_user_data: m,
            ad_personalization: m,
          });
          dataLayer().push({
            event: consentEvent,
            consent_necessary: true,
            consent_statistics: statistics,
            consent_marketing: marketing,
            consent_categories: Object.keys(ctx.state.categories).filter((k) => ctx.state.categories[k]),
          });
          ctx.log('Consent Mode v2: Update', { statistics, marketing });
        }
      }
      // Teil-Widerruf bei weiterhin aktivem GTM: Cookies löschen und neu laden.
      if (!statistics) deleteCookies(GOOGLE_ANALYTICS_COOKIE_PATTERNS);
      if (!marketing) deleteCookies(GOOGLE_ADS_COOKIE_PATTERNS);
      if (loaded) {
        if ((grantedWhileLoaded.statistics && !statistics) || (grantedWhileLoaded.marketing && !marketing)) {
          ctx.requestReload();
        }
        grantedWhileLoaded.statistics ||= statistics;
        grantedWhileLoaded.marketing ||= marketing;
      }
      if (options.loadBeforeConsent) loadGtm(ctx);
    },

    onGrant(ctx) {
      loadGtm(ctx);
    },

    onRevoke() {
      gtag('consent', 'update', {
        analytics_storage: 'denied',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
      });
    },

    onRouteChange(ctx, route) {
      if (!loaded) return;
      dataLayer().push({
        event: pageViewEvent,
        page_path: route.path,
        page_location: route.url,
        page_title: route.title,
        page_referrer: route.referrer,
      });
      ctx.log('dataLayer:', pageViewEvent, route.path);
    },
  };
}
