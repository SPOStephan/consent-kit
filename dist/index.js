import { deleteCookies, ConsentManager, readCookie, writeCookie } from './chunk-KCEHN42M.js';
export { BUILT_IN_CATEGORIES, ConsentManager, deleteCookies, loadScript, matchesPattern, serviceCategories } from './chunk-KCEHN42M.js';

// src/core/texts.ts
var defaultTexts = {
  de: {
    bannerTitle: "Datenschutz-Einstellungen",
    bannerDescription: "Wir m\xF6chten Dienste von Drittanbietern nutzen, um unsere Website zu analysieren und Werbung zu messen. Dabei k\xF6nnen Daten (z. B. Ger\xE4te-Kennungen) an die Anbieter \xFCbermittelt werden, teilweise auch in Drittl\xE4nder wie die USA. Diese Dienste werden nur geladen, wenn Sie einwilligen. Ihre Auswahl k\xF6nnen Sie jederzeit \xFCber \u201ECookie-Einstellungen\u201C \xE4ndern oder widerrufen.",
    acceptAll: "Alle akzeptieren",
    rejectAll: "Alle ablehnen",
    settings: "Einstellungen",
    save: "Auswahl speichern",
    close: "Schlie\xDFen",
    settingsTitle: "Cookie-Einstellungen",
    settingsDescription: "Hier k\xF6nnen Sie festlegen, welche Kategorien und Dienste Sie erlauben. Notwendige Funktionen sind immer aktiv. Ihre Einwilligung ist freiwillig und kann jederzeit mit Wirkung f\xFCr die Zukunft widerrufen werden.",
    imprint: "Impressum",
    privacy: "Datenschutzerkl\xE4rung",
    alwaysActive: "Immer aktiv",
    showDetails: "Details anzeigen",
    hideDetails: "Details ausblenden",
    services: "Dienste",
    provider: "Anbieter",
    purpose: "Zweck",
    cookies: "Cookies",
    duration: "Speicherdauer",
    thirdCountry: "Drittland\xFCbermittlung",
    noThirdCountry: "Keine bekannt",
    noCookies: "Keine",
    privacyPolicy: "Datenschutzerkl\xE4rung des Anbieters",
    allowService: "Diesen Dienst erlauben",
    gpcNotice: "Ihr Browser sendet das Signal \u201EGlobal Privacy Control\u201C. Marketing-Dienste werden daher nicht automatisch aktiviert.",
    consentIdLabel: "Ihre Einwilligungs-ID (f\xFCr R\xFCckfragen)",
    gateTitle: "Externer Inhalt",
    gateDescription: "Hier wird ein Inhalt von {service} ({provider}) angezeigt. Beim Laden werden Daten an den Anbieter \xFCbermittelt{thirdCountry}.",
    gateLoad: "Inhalt laden",
    gateAlwaysAllow: "Beim Laden merken wir uns Ihre Einwilligung f\xFCr {service}. Widerruf \xFCber \u201ECookie-Einstellungen\u201C.",
    categories: {
      necessary: {
        label: "Notwendig",
        description: "Erforderlich f\xFCr den Betrieb der Website, z. B. zum Speichern Ihrer Datenschutz-Einstellungen. Diese Kategorie kann nicht abgew\xE4hlt werden."
      },
      statistics: {
        label: "Statistik",
        description: "Hilft uns zu verstehen, wie Besucher die Website nutzen (z. B. Seitenaufrufe), um sie zu verbessern."
      },
      marketing: {
        label: "Marketing",
        description: "Wird verwendet, um den Erfolg von Werbung zu messen und Ihnen auf anderen Websites passende Werbung anzuzeigen."
      }
    }
  },
  en: {
    bannerTitle: "Privacy settings",
    bannerDescription: "We would like to use third-party services to analyse our website and measure advertising. In doing so, data (e.g. device identifiers) may be transferred to the providers, partly also to third countries such as the USA. These services are only loaded if you consent. You can change or withdraw your choice at any time via \u201CCookie settings\u201D.",
    acceptAll: "Accept all",
    rejectAll: "Reject all",
    settings: "Settings",
    save: "Save selection",
    close: "Close",
    settingsTitle: "Cookie settings",
    settingsDescription: "Choose which categories and services you allow. Necessary functions are always active. Your consent is voluntary and can be withdrawn at any time with effect for the future.",
    imprint: "Legal notice",
    privacy: "Privacy policy",
    alwaysActive: "Always active",
    showDetails: "Show details",
    hideDetails: "Hide details",
    services: "Services",
    provider: "Provider",
    purpose: "Purpose",
    cookies: "Cookies",
    duration: "Storage period",
    thirdCountry: "Third-country transfer",
    noThirdCountry: "None known",
    noCookies: "None",
    privacyPolicy: "Provider\u2019s privacy policy",
    allowService: "Allow this service",
    gpcNotice: "Your browser sends the \u201CGlobal Privacy Control\u201D signal. Marketing services are therefore not activated automatically.",
    consentIdLabel: "Your consent ID (for enquiries)",
    gateTitle: "External content",
    gateDescription: "This area shows content from {service} ({provider}). When loading it, data is transferred to the provider{thirdCountry}.",
    gateLoad: "Load content",
    gateAlwaysAllow: "When loading, we remember your consent for {service}. Withdraw via \u201CCookie settings\u201D.",
    categories: {
      necessary: {
        label: "Necessary",
        description: "Required for the website to work, e.g. to store your privacy settings. This category cannot be deselected."
      },
      statistics: {
        label: "Statistics",
        description: "Helps us understand how visitors use the website (e.g. page views) so we can improve it."
      },
      marketing: {
        label: "Marketing",
        description: "Used to measure the success of advertising and to show you relevant ads on other websites."
      }
    }
  }
};
function resolveLanguage(config) {
  const lang = config.language ?? "de";
  if (lang !== "auto") return lang;
  const candidate = typeof document !== "undefined" && document.documentElement.lang || typeof navigator !== "undefined" && navigator.language || "de";
  return candidate.toLowerCase().startsWith("de") ? "de" : "en";
}
function merge(base, override) {
  if (!override) return base;
  const result = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value === void 0) continue;
    const current = result[key];
    result[key] = value && typeof value === "object" && current && typeof current === "object" ? merge(current, value) : value;
  }
  return result;
}
function resolveTexts(config, language = resolveLanguage(config)) {
  let texts = defaultTexts[language];
  for (const category of config.categories ?? []) {
    texts = merge(texts, {
      categories: { [category.id]: { label: category.label[language], description: category.description[language] } }
    });
  }
  return merge(texts, config.texts?.[language]);
}
function formatText(template, values) {
  return template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? "");
}
function consentCookieMeta(config, owner = "") {
  const days = Math.min(config.cookie?.maxAgeDays ?? 365, 365);
  const duration = days === 365 ? { de: "12 Monate", en: "12 months" } : { de: `${days} Tage`, en: `${days} days` };
  return {
    name: "Einwilligungs-Speicher (consent-kit)",
    provider: owner || "\u2013",
    purpose: {
      de: "Speichert Ihre Datenschutz-Einstellungen (anonyme Consent-ID, Zeitpunkt, Version der Einstellungen, gew\xE4hlte Kategorien).",
      en: "Stores your privacy settings (anonymous consent ID, time, settings version, selected categories)."
    },
    cookies: [{ name: config.cookie?.name ?? "consent_kit", duration }],
    thirdCountryTransfer: null,
    privacyPolicyUrl: config.links.privacy
  };
}

// src/plugins/google.ts
var PROVIDER = "Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland";
var ANALYTICS_COOKIES = [
  { name: "_ga", duration: { de: "2 Jahre", en: "2 years" }, purpose: { de: "Unterscheidung von Nutzern (Google Analytics)", en: "Distinguishes users (Google Analytics)" } },
  { name: "_ga_<ID>", duration: { de: "2 Jahre", en: "2 years" }, purpose: { de: "Speichert den Sitzungsstatus (Google Analytics 4)", en: "Stores session state (Google Analytics 4)" } }
];
var ADS_COOKIES = [
  { name: "_gcl_au", duration: { de: "90 Tage", en: "90 days" }, purpose: { de: "Conversion-Messung (Google Ads)", en: "Conversion measurement (Google Ads)" } },
  { name: "_gcl_aw / _gcl_dc", duration: { de: "90 Tage", en: "90 days" }, purpose: { de: "Speichert Klick-Informationen aus Anzeigen (Google Ads)", en: "Stores ad click information (Google Ads)" } },
  { name: "IDE (doubleclick.net)", duration: { de: "13 Monate", en: "13 months" }, purpose: { de: "Personalisierte Werbung (Drittanbieter-Cookie)", en: "Personalised advertising (third-party cookie)" } }
];
var GOOGLE_ANALYTICS_COOKIE_PATTERNS = ["_ga", "_ga_*", "_gid", "_gat", "_gat_*", "_dc_gtm_*", "FPID", "FPLC", "FPGSID"];
var GOOGLE_ADS_COOKIE_PATTERNS = ["_gcl_*", "FPAU", "FPGCLAW", "FPGCLDC"];
function googleTagManager(options) {
  const analytics = options.analytics !== false;
  const ads = options.ads !== false;
  const dlName = options.dataLayerName ?? "dataLayer";
  const consentEvent = options.consentEvent ?? "consent_update";
  const pageViewEvent = options.pageViewEvent ?? "virtual_pageview";
  const origin = (options.scriptOrigin ?? "https://www.googletagmanager.com").replace(/\/$/, "");
  const categories = [...analytics ? ["statistics"] : [], ...ads ? ["marketing"] : []];
  if (categories.length === 0) categories.push("statistics");
  let lastSignature = "";
  let loaded = false;
  const grantedWhileLoaded = { statistics: false, marketing: false };
  const win = () => window;
  const dataLayer = () => {
    const w = win();
    return w[dlName] = w[dlName] ?? [];
  };
  const gtag = function() {
    dataLayer().push(arguments);
  };
  const loadGtm = (ctx) => {
    if (loaded) return;
    loaded = true;
    grantedWhileLoaded.statistics || (grantedWhileLoaded.statistics = analytics && ctx.hasConsent("statistics"));
    grantedWhileLoaded.marketing || (grantedWhileLoaded.marketing = ads && ctx.hasConsent("marketing"));
    dataLayer().push({ "gtm.start": Date.now(), event: "gtm.js" });
    let src = `${origin}/gtm.js?id=${encodeURIComponent(options.id)}`;
    if (dlName !== "dataLayer") src += `&l=${encodeURIComponent(dlName)}`;
    if (options.environment) {
      src += `&gtm_auth=${encodeURIComponent(options.environment.auth)}&gtm_preview=${encodeURIComponent(options.environment.preview)}&gtm_cookies_win=x`;
    }
    ctx.log("Google Tag Manager wird geladen:", src);
    void ctx.loadScript(src);
  };
  const services = [analytics && "Google Analytics 4", ads && "Google Ads"].filter(Boolean).join(", ");
  return {
    id: "google-tag-manager",
    category: categories,
    meta: {
      name: services ? `Google Tag Manager (${services})` : "Google Tag Manager",
      provider: PROVIDER,
      purpose: {
        de: "Der Google Tag Manager l\xE4dt weitere Google-Dienste. " + (analytics ? "Google Analytics 4 erstellt Statistiken \xFCber die Nutzung der Website. " : "") + (ads ? "Google Ads misst den Erfolg von Anzeigen (Conversions) und erm\xF6glicht personalisierte Werbung. " : "") + "Die Dienste werden nur entsprechend Ihrer Einwilligung aktiviert (Google Consent Mode v2).",
        en: "Google Tag Manager loads further Google services. " + (analytics ? "Google Analytics 4 creates statistics about the use of the website. " : "") + (ads ? "Google Ads measures the success of ads (conversions) and enables personalised advertising. " : "") + "The services are only activated according to your consent (Google Consent Mode v2)."
      },
      cookies: [...analytics ? ANALYTICS_COOKIES : [], ...ads ? ADS_COOKIES : []],
      thirdCountryTransfer: {
        de: "USA (Google LLC; EU-US Data Privacy Framework, Standardvertragsklauseln)",
        en: "USA (Google LLC; EU-US Data Privacy Framework, standard contractual clauses)"
      },
      privacyPolicyUrl: "https://policies.google.com/privacy"
    },
    cookiePatterns: [...GOOGLE_ANALYTICS_COOKIE_PATTERNS, ...GOOGLE_ADS_COOKIE_PATTERNS],
    onInit(ctx) {
      const w = win();
      dataLayer();
      if (dlName === "dataLayer" && typeof w.gtag !== "function") w.gtag = gtag;
      const flag = `__consentKitDefaults_${dlName}`;
      if (!w[flag]) {
        w[flag] = true;
        gtag("consent", "default", {
          ad_storage: "denied",
          analytics_storage: "denied",
          ad_user_data: "denied",
          ad_personalization: "denied",
          security_storage: "granted",
          wait_for_update: 500
        });
        if (options.adsDataRedaction !== false) gtag("set", "ads_data_redaction", true);
        if (options.urlPassthrough) gtag("set", "url_passthrough", true);
        ctx.log("Consent Mode v2: Defaults gesetzt (denied)");
      }
      if (options.loadBeforeConsent && typeof console !== "undefined") {
        console.warn(
          "consent-kit: googleTagManager({ loadBeforeConsent: true }) l\xE4dt GTM vor der Einwilligung. Das ist rechtlich riskant (\xA7 25 TDDDG) \u2013 siehe docs/GTM.md."
        );
      }
    },
    onConsent(ctx) {
      const statistics = analytics && ctx.hasConsent("statistics");
      const marketing = ads && ctx.hasConsent("marketing");
      const decided = ctx.state.decided;
      const signature = `${decided}|${statistics}|${marketing}`;
      if (signature !== lastSignature) {
        lastSignature = signature;
        if (decided || statistics || marketing) {
          const m = marketing ? "granted" : "denied";
          gtag("consent", "update", {
            analytics_storage: statistics ? "granted" : "denied",
            ad_storage: m,
            ad_user_data: m,
            ad_personalization: m
          });
          dataLayer().push({
            event: consentEvent,
            consent_necessary: true,
            consent_statistics: statistics,
            consent_marketing: marketing,
            consent_categories: Object.keys(ctx.state.categories).filter((k) => ctx.state.categories[k])
          });
          ctx.log("Consent Mode v2: Update", { statistics, marketing });
        }
      }
      if (!statistics) deleteCookies(GOOGLE_ANALYTICS_COOKIE_PATTERNS);
      if (!marketing) deleteCookies(GOOGLE_ADS_COOKIE_PATTERNS);
      if (loaded) {
        if (grantedWhileLoaded.statistics && !statistics || grantedWhileLoaded.marketing && !marketing) {
          ctx.requestReload();
        }
        grantedWhileLoaded.statistics || (grantedWhileLoaded.statistics = statistics);
        grantedWhileLoaded.marketing || (grantedWhileLoaded.marketing = marketing);
      }
      if (options.loadBeforeConsent) loadGtm(ctx);
    },
    onGrant(ctx) {
      loadGtm(ctx);
    },
    onRevoke() {
      gtag("consent", "update", {
        analytics_storage: "denied",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied"
      });
    },
    onRouteChange(ctx, route) {
      if (!loaded) return;
      dataLayer().push({
        event: pageViewEvent,
        page_path: route.path,
        page_location: route.url,
        page_title: route.title,
        page_referrer: route.referrer
      });
      ctx.log("dataLayer:", pageViewEvent, route.path);
    }
  };
}

// src/plugins/meta.ts
var META_PIXEL_SERVICE_ID = "meta-pixel";
var FBC_MAX_AGE_SECONDS = 90 * 24 * 60 * 60;
function clickIdFromUrl() {
  if (typeof location === "undefined") return void 0;
  try {
    const value = new URLSearchParams(location.search).get("fbclid")?.trim();
    return value && /^[A-Za-z0-9_\-.]{8,500}$/.test(value) ? value : void 0;
  } catch {
    return void 0;
  }
}
function installStub(w) {
  if (w.fbq) return w.fbq;
  const n = function(...args) {
    if (n.callMethod) n.callMethod(...args);
    else n.queue.push(args);
  };
  n.push = n;
  n.loaded = true;
  n.version = "2.0";
  n.queue = [];
  w.fbq = n;
  if (!w._fbq) w._fbq = n;
  return n;
}
function metaPixel(options) {
  const viaKit = options.loadVia !== "gtm";
  const trackRouteChanges = options.loadVia !== "gtm" && options.trackRouteChanges !== false;
  let entryClickId;
  return {
    id: META_PIXEL_SERVICE_ID,
    category: "marketing",
    meta: {
      name: "Meta Pixel",
      provider: "Meta Platforms Ireland Limited, Merrion Road, Dublin 4, D04 X2K5, Irland",
      purpose: {
        de: "Misst den Erfolg von Werbeanzeigen auf Facebook und Instagram (Conversions), bildet Zielgruppen f\xFCr Werbung (Remarketing) und erm\xF6glicht personalisierte Werbung.",
        en: "Measures the success of ads on Facebook and Instagram (conversions), builds audiences for advertising (remarketing) and enables personalised advertising."
      },
      cookies: [
        { name: "_fbp", duration: { de: "3 Monate", en: "3 months" }, purpose: { de: "Wiedererkennung des Browsers", en: "Recognises the browser" } },
        { name: "_fbc", duration: { de: "3 Monate", en: "3 months" }, purpose: { de: "Speichert den letzten Klick auf eine Anzeige", en: "Stores the last ad click" } },
        { name: "fr (facebook.com)", duration: { de: "3 Monate", en: "3 months" }, purpose: { de: "Personalisierte Werbung (Drittanbieter-Cookie)", en: "Personalised advertising (third-party cookie)" } }
      ],
      thirdCountryTransfer: {
        de: "USA (Meta Platforms, Inc.; EU-US Data Privacy Framework, Standardvertragsklauseln)",
        en: "USA (Meta Platforms, Inc.; EU-US Data Privacy Framework, standard contractual clauses)"
      },
      privacyPolicyUrl: "https://www.facebook.com/privacy/policy/"
    },
    cookiePatterns: ["_fbp", "_fbc"],
    onInit() {
      entryClickId = clickIdFromUrl();
    },
    onGrant(ctx) {
      if (!viaKit || !options.id) return;
      if (entryClickId && !clickIdFromUrl() && !readCookie("_fbc")) {
        writeCookie("_fbc", `fb.1.${Date.now()}.${entryClickId}`, { maxAgeSeconds: FBC_MAX_AGE_SECONDS });
        ctx.log("Meta Pixel: _fbc aus der Einstiegs-URL gesetzt");
      }
      const fbq = installStub(window);
      fbq.disablePushState = true;
      fbq.allowDuplicatePageViews = true;
      fbq("consent", "grant");
      fbq("init", options.id);
      fbq("track", "PageView");
      ctx.log("Meta Pixel wird geladen");
      void ctx.loadScript("https://connect.facebook.net/en_US/fbevents.js");
    },
    onRevoke() {
      const fbq = window.fbq;
      if (typeof fbq === "function") fbq("consent", "revoke");
    },
    onRouteChange(ctx) {
      if (!trackRouteChanges) return;
      const fbq = window.fbq;
      if (typeof fbq === "function") {
        fbq("track", "PageView");
        ctx.log("Meta Pixel: PageView");
      }
    }
  };
}

// src/plugins/tiktok.ts
var METHODS = [
  "page",
  "track",
  "identify",
  "instances",
  "debug",
  "on",
  "off",
  "once",
  "ready",
  "alias",
  "group",
  "enableCookie",
  "disableCookie",
  "holdConsent",
  "revokeConsent",
  "grantConsent"
];
function call(method, ...args) {
  const ttq = window.ttq;
  const fn = ttq?.[method];
  if (typeof fn === "function") fn.apply(ttq, args);
}
function installStub2(w, loadScript2) {
  if (w.ttq && typeof w.ttq.load === "function") return w.ttq;
  w.TiktokAnalyticsObject = "ttq";
  const ttq = w.ttq = w.ttq ?? [];
  ttq.methods = METHODS;
  ttq.setAndDefer = (target, method) => {
    target[method] = function(...args) {
      target.push([method, ...args]);
    };
  };
  for (const m of METHODS) ttq.setAndDefer(ttq, m);
  ttq.instance = (id) => {
    const e = ttq._i?.[id] ?? [];
    for (const m of METHODS) ttq.setAndDefer(e, m);
    return e;
  };
  ttq.load = (id, options) => {
    const base = "https://analytics.tiktok.com/i18n/pixel/events.js";
    ttq._i = ttq._i ?? {};
    ttq._i[id] = [];
    ttq._i[id]._u = base;
    ttq._t = ttq._t ?? {};
    ttq._t[id] = Date.now();
    ttq._o = ttq._o ?? {};
    ttq._o[id] = options ?? {};
    void loadScript2(`${base}?sdkid=${encodeURIComponent(id)}&lib=ttq`);
  };
  return ttq;
}
function tiktokPixel(options) {
  const viaKit = options.loadVia !== "gtm";
  const trackRouteChanges = options.loadVia !== "gtm" && options.trackRouteChanges !== false;
  return {
    id: "tiktok-pixel",
    category: "marketing",
    meta: {
      name: "TikTok Pixel",
      provider: "TikTok Technology Limited, 10 Earlsfort Terrace, Dublin, D02 T380, Irland",
      purpose: {
        de: "Misst den Erfolg von Werbeanzeigen auf TikTok (Conversions), bildet Zielgruppen f\xFCr Werbung und erm\xF6glicht personalisierte Werbung.",
        en: "Measures the success of ads on TikTok (conversions), builds audiences for advertising and enables personalised advertising."
      },
      cookies: [
        { name: "_ttp", duration: { de: "13 Monate", en: "13 months" }, purpose: { de: "Wiedererkennung des Browsers", en: "Recognises the browser" } },
        { name: "_tt_enable_cookie", duration: { de: "13 Monate", en: "13 months" }, purpose: { de: "Pr\xFCft, ob Cookies gesetzt werden k\xF6nnen", en: "Checks whether cookies can be set" } },
        { name: "ttcsid / ttcsid_<ID>", duration: { de: "13 Monate", en: "13 months" }, purpose: { de: "Sitzungs-Kennung f\xFCr die Conversion-Messung", en: "Session identifier for conversion measurement" } }
      ],
      thirdCountryTransfer: {
        de: "USA, Singapur, weitere Drittl\xE4nder (u. a. Fernzugriff aus China); Standardvertragsklauseln",
        en: "USA, Singapore, other third countries (including remote access from China); standard contractual clauses"
      },
      privacyPolicyUrl: "https://www.tiktok.com/legal/page/eea/privacy-policy/de"
    },
    cookiePatterns: ["_ttp", "_tt_enable_cookie", "ttcsid", "ttcsid_*"],
    onGrant(ctx) {
      if (!viaKit || !options.id) return;
      const ttq = installStub2(window, ctx.loadScript);
      ttq.load(options.id);
      call("grantConsent");
      call("page");
      ctx.log("TikTok Pixel wird geladen");
    },
    onRevoke() {
      call("revokeConsent");
    },
    onRouteChange(ctx) {
      if (!trackRouteChanges) return;
      call("page");
      ctx.log("TikTok Pixel: page");
    }
  };
}

// src/plugins/embeds.ts
var GOOGLE = "Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland";
var USA = {
  de: "USA (Google LLC; EU-US Data Privacy Framework, Standardvertragsklauseln)",
  en: "USA (Google LLC; EU-US Data Privacy Framework, standard contractual clauses)"
};
function youtube(options = {}) {
  return {
    id: "youtube",
    category: options.category ?? "marketing",
    meta: {
      name: "YouTube",
      provider: GOOGLE,
      purpose: {
        de: "Anzeige eingebetteter Videos. Beim Laden werden u. a. IP-Adresse und Ger\xE4teinformationen an YouTube/Google \xFCbermittelt; Google kann diese Daten auch f\xFCr Werbezwecke nutzen.",
        en: "Displays embedded videos. When loading, data such as IP address and device information is transferred to YouTube/Google; Google may also use this data for advertising."
      },
      cookies: [
        { name: "VISITOR_INFO1_LIVE", duration: { de: "6 Monate", en: "6 months" } },
        { name: "YSC", duration: { de: "Sitzung", en: "Session" } },
        { name: "VISITOR_PRIVACY_METADATA", duration: { de: "6 Monate", en: "6 months" } }
      ],
      thirdCountryTransfer: USA,
      privacyPolicyUrl: "https://policies.google.com/privacy",
      ...options.meta
    }
  };
}
function googleMaps(options = {}) {
  return {
    id: "google-maps",
    category: options.category ?? "marketing",
    meta: {
      name: "Google Maps",
      provider: GOOGLE,
      purpose: {
        de: "Anzeige interaktiver Karten. Beim Laden werden u. a. IP-Adresse und Ger\xE4teinformationen an Google \xFCbermittelt.",
        en: "Displays interactive maps. When loading, data such as IP address and device information is transferred to Google."
      },
      cookies: [{ name: "NID (google.com)", duration: { de: "6 Monate", en: "6 months" } }],
      thirdCountryTransfer: USA,
      privacyPolicyUrl: "https://policies.google.com/privacy",
      ...options.meta
    }
  };
}
function embed(options) {
  return { id: options.id, category: options.category ?? "marketing", meta: options.meta };
}

// src/index.ts
var GLOBAL_KEY = "__consentKit__";
function getManager() {
  const g = globalThis;
  return g[GLOBAL_KEY] ?? (g[GLOBAL_KEY] = new ConsentManager());
}
function defineConfig(config) {
  return config;
}
function definePlugin(plugin) {
  return plugin;
}
function init(config) {
  return getManager().init(config);
}
function acceptAll() {
  getManager().acceptAll();
}
function rejectAll() {
  getManager().rejectAll();
}
function setCategories(categories, services) {
  getManager().setCategories(categories, services);
}
function setService(serviceId, granted) {
  getManager().setService(serviceId, granted);
}
function openSettings() {
  getManager().openSettings();
}
function getState() {
  return getManager().getState();
}
function hasConsent(categoryOrServiceId) {
  return getManager().hasConsent(categoryOrServiceId);
}
function on(event, handler) {
  return getManager().on(event, handler);
}
function notifyRouteChange(path) {
  getManager().notifyRouteChange(path);
}
function autoTrackRouteChanges() {
  if (typeof window === "undefined") return () => void 0;
  const notify = () => setTimeout(() => notifyRouteChange(), 0);
  const { pushState, replaceState } = history;
  history.pushState = function(...args) {
    pushState.apply(this, args);
    notify();
  };
  history.replaceState = function(...args) {
    replaceState.apply(this, args);
    notify();
  };
  window.addEventListener("popstate", notify);
  return () => {
    history.pushState = pushState;
    history.replaceState = replaceState;
    window.removeEventListener("popstate", notify);
  };
}

export { GOOGLE_ADS_COOKIE_PATTERNS, GOOGLE_ANALYTICS_COOKIE_PATTERNS, acceptAll, autoTrackRouteChanges, consentCookieMeta, defaultTexts, defineConfig, definePlugin, embed, formatText, getManager, getState, googleMaps, googleTagManager, hasConsent, init, metaPixel, notifyRouteChange, on, openSettings, rejectAll, resolveLanguage, resolveTexts, setCategories, setService, tiktokPixel, youtube };
