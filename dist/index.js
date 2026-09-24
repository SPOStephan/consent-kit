// src/core/cookies.ts
function readCookie(name) {
  if (typeof document === "undefined") return void 0;
  const parts = document.cookie ? document.cookie.split("; ") : [];
  for (const part of parts) {
    const eq = part.indexOf("=");
    const key = eq === -1 ? part : part.slice(0, eq);
    if (key === name) return eq === -1 ? "" : part.slice(eq + 1);
  }
  return void 0;
}
function writeCookie(name, value, options) {
  if (typeof document === "undefined") return;
  let cookie = `${name}=${value}; Max-Age=${Math.floor(options.maxAgeSeconds)}; Path=${options.path ?? "/"}; SameSite=Lax`;
  if (options.domain) cookie += `; Domain=${options.domain}`;
  if (typeof location !== "undefined" && location.protocol === "https:") cookie += "; Secure";
  document.cookie = cookie;
}
function listCookieNames() {
  if (typeof document === "undefined" || !document.cookie) return [];
  return document.cookie.split("; ").map((part) => {
    const eq = part.indexOf("=");
    return eq === -1 ? part : part.slice(0, eq);
  });
}
function matchesPattern(name, pattern) {
  if (pattern instanceof RegExp) return pattern.test(name);
  if (!pattern.includes("*")) return name === pattern;
  const regex = new RegExp(
    "^" + pattern.split("*").map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$"
  );
  return regex.test(name);
}
function domainCandidates(hostname) {
  const result = [""];
  if (!hostname || /^[\d.]+$/.test(hostname) || !hostname.includes(".")) return result;
  const labels = hostname.split(".");
  for (let i = 0; i < labels.length - 1; i++) {
    const d = labels.slice(i).join(".");
    result.push(d, "." + d);
  }
  return result;
}
function deleteCookies(patterns) {
  if (typeof document === "undefined" || patterns.length === 0) return [];
  const names = listCookieNames().filter((n) => patterns.some((p) => matchesPattern(n, p)));
  const hostname = typeof location !== "undefined" ? location.hostname : "";
  const domains = domainCandidates(hostname);
  const paths = ["/"];
  if (typeof location !== "undefined" && location.pathname !== "/") paths.push(location.pathname);
  for (const name of names) {
    for (const domain of domains) {
      for (const path of paths) {
        document.cookie = `${name}=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; Path=${path}` + (domain ? `; Domain=${domain}` : "");
      }
    }
  }
  return names;
}

// src/core/scripts.ts
var pending = /* @__PURE__ */ new Map();
function loadScript(src, attributes = {}) {
  if (typeof document === "undefined") return Promise.resolve();
  const known = pending.get(src);
  if (known) return known;
  const existing = Array.from(document.scripts).find((s) => s.getAttribute("src") === src);
  if (existing) {
    const done = Promise.resolve();
    pending.set(src, done);
    return done;
  }
  const promise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.async = true;
    script.src = src;
    script.setAttribute("data-consent-kit", "");
    for (const [key, value] of Object.entries(attributes)) script.setAttribute(key, value);
    script.addEventListener("load", () => resolve());
    script.addEventListener("error", () => {
      pending.delete(src);
      reject(new Error(`consent-kit: Skript konnte nicht geladen werden: ${src}`));
    });
    (document.head || document.documentElement).appendChild(script);
  });
  promise.catch(() => void 0);
  pending.set(src, promise);
  return promise;
}

// src/core/manager.ts
var BUILT_IN_CATEGORIES = ["necessary", "statistics", "marketing"];
var DEFAULT_COOKIE = "consent_kit";
var MAX_AGE_DAYS = 365;
var DAY_MS = 24 * 60 * 60 * 1e3;
function createUuid() {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === "function") c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = bytes[6] & 15 | 64;
  bytes[8] = bytes[8] & 63 | 128;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
function currentPath() {
  return typeof location === "undefined" ? "" : location.pathname + location.search;
}
function gpcSignal() {
  return typeof navigator !== "undefined" && navigator.globalPrivacyControl === true;
}
function serviceCategories(plugin) {
  return typeof plugin.category === "string" ? [plugin.category] : plugin.category;
}
var ConsentManager = class {
  constructor() {
    this.state = emptyState("");
    this.handlers = /* @__PURE__ */ new Map();
    /** Dienste, deren onGrant auf dieser Seite bereits lief (Skripte geladen). */
    this.active = /* @__PURE__ */ new Set();
    this.initializedPlugins = /* @__PURE__ */ new Set();
    this.lastPath = "";
    this.lastUrl = "";
    this.ready = false;
    this.reloadScheduled = false;
    this.reloadRequested = false;
    this.log = (...args) => {
      if (this.config?.debug && typeof console !== "undefined") console.info("[consent-kit]", ...args);
    };
  }
  /** Initialisiert consent-kit. Mehrfacher Aufruf ist unschädlich (StrictMode, Hot Reload). */
  init(config) {
    const firstRun = !this.config;
    if (!firstRun && this.config === config) return this.getState();
    this.config = config;
    if (typeof window === "undefined") {
      this.state = emptyState(String(config.version));
      return this.getState();
    }
    if (config.debug) validateConfig(config, this.log);
    if (firstRun) {
      this.lastPath = currentPath();
      this.lastUrl = location.href;
    }
    this.state = this.load();
    const ctx = this.context();
    for (const plugin of config.services) {
      if (this.initializedPlugins.has(plugin.id)) continue;
      this.initializedPlugins.add(plugin.id);
      this.safe(plugin, "onInit", () => plugin.onInit?.(ctx));
    }
    this.applyPlugins([]);
    this.cleanupCookies();
    this.ready = true;
    this.emit("consent:ready", { state: this.getState() });
    window.consentKit = publicApi(this);
    return this.getState();
  }
  isReady() {
    return this.ready;
  }
  /** Aktueller Zustand (Kopie). */
  getState() {
    return cloneState(this.state);
  }
  /** Alle Kategorie-IDs (eingebaut + eigene). */
  getCategoryIds() {
    const ids = [...BUILT_IN_CATEGORIES];
    for (const c of this.config?.categories ?? []) if (!ids.includes(c.id)) ids.push(c.id);
    return ids;
  }
  getServices() {
    return this.config?.services ?? [];
  }
  /** Prüft die Einwilligung für eine Kategorie oder einen Dienst (per ID). */
  hasConsent(id) {
    if (id === "necessary") return true;
    const plugin = this.getServices().find((p) => p.id === id);
    if (plugin) return this.isGranted(plugin, this.state);
    return this.state.decided && this.state.categories[id] === true;
  }
  /** Alle Kategorien erlauben (bei aktivem GPC ohne Marketing). */
  acceptAll() {
    const categories = {};
    const gpc = this.gpcActive();
    for (const id of this.getCategoryIds()) categories[id] = !(gpc && id === "marketing");
    this.decide(categories, {}, "accept-all");
  }
  /** Alles außer "notwendig" ablehnen. */
  rejectAll() {
    const categories = {};
    for (const id of this.getCategoryIds()) categories[id] = id === "necessary";
    this.decide(categories, {}, "reject-all");
  }
  /**
   * Kategorien einzeln setzen, z. B. setCategories({ statistics: true, marketing: false }).
   * Nicht genannte Kategorien werden abgelehnt. Optional können einzelne Dienste
   * abweichend erlaubt/abgelehnt werden.
   */
  setCategories(categories, services = {}) {
    const next = {};
    for (const id of this.getCategoryIds()) next[id] = id === "necessary" || categories[id] === true;
    this.decide(next, services, "custom");
  }
  /**
   * Einwilligung für genau einen Dienst (z. B. "Inhalt laden" bei einem YouTube-Video).
   * Die übrige Auswahl bleibt unverändert; das Banner bleibt sichtbar, solange noch
   * nicht entschieden wurde.
   */
  setService(serviceId, granted) {
    const services = { ...this.state.services, [serviceId]: granted };
    this.apply({ ...this.state, services }, "service");
  }
  /** Öffnet den Einstellungsdialog (für den Footer-Link "Cookie-Einstellungen"). */
  openSettings() {
    this.emit("ui:open-settings", {});
  }
  /** Abonniert ein Ereignis. Gibt eine Funktion zum Abbestellen zurück. */
  on(event, handler) {
    let set = this.handlers.get(event);
    if (!set) this.handlers.set(event, set = /* @__PURE__ */ new Set());
    set.add(handler);
    return () => set.delete(handler);
  }
  /**
   * Meldet einen Routenwechsel in einer Single-Page-App. Aktive Dienste senden
   * dann einen PageView. Der erste Seitenaufruf wird ignoriert (den senden die
   * Dienste beim Laden selbst), ebenso doppelte Meldungen desselben Pfads.
   */
  notifyRouteChange(path = currentPath()) {
    if (typeof window === "undefined" || !this.config) return;
    if (path === this.lastPath) return;
    const route = {
      path,
      url: location.href,
      title: document.title,
      referrer: this.lastUrl
    };
    this.lastPath = path;
    this.lastUrl = location.href;
    const ctx = this.context();
    this.emit("route:changed", { route });
    for (const plugin of this.config.services) {
      if (!this.active.has(plugin.id)) continue;
      this.safe(plugin, "onRouteChange", () => plugin.onRouteChange?.(ctx, route));
    }
  }
  /** Löscht die gespeicherte Entscheidung (z. B. für Tests). Keine Revoke-Signale. */
  forget() {
    const config = this.config;
    if (!config) return;
    const { name, path, domain } = cookieOptions(config);
    writeCookie(name, "", { maxAgeSeconds: 0, path, domain });
    this.state = emptyState(String(config.version));
  }
  // ---------------------------------------------------------------- intern
  decide(categories, services, action) {
    const next = {
      ...this.state,
      decided: true,
      categories: { ...categories, necessary: true },
      services: { ...services }
    };
    this.apply(next, action);
  }
  apply(next, action) {
    const config = this.config;
    if (!config) {
      if (typeof console !== "undefined") console.warn("consent-kit: init(config) wurde noch nicht aufgerufen.");
      return;
    }
    const previous = this.state;
    const known = new Set(config.services.map((p) => p.id));
    const services = {};
    for (const [id, value] of Object.entries(next.services)) if (known.has(id)) services[id] = value;
    this.state = {
      ...next,
      services,
      consentId: previous.consentId || createUuid(),
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      configVersion: String(config.version),
      gpc: this.gpcActive()
    };
    this.save();
    const revoked = config.services.filter((p) => (this.active.has(p.id) || this.isGranted(p, previous)) && !this.isGranted(p, this.state)).map((p) => p.id);
    const needsReload = config.services.some(
      (p) => revoked.includes(p.id) && this.active.has(p.id) && typeof p.onGrant === "function"
    );
    this.reloadRequested = false;
    this.applyPlugins(revoked);
    this.cleanupCookies();
    const state = this.getState();
    this.emit("consent:changed", { state, previous: cloneState(previous), action });
    if (revoked.length) this.emit("consent:revoked", { state, revokedServices: revoked });
    this.sendLog(action);
    if ((needsReload || this.reloadRequested) && config.reloadOnRevoke !== false && !this.reloadScheduled) {
      this.reloadScheduled = true;
      this.log("Widerruf \u2013 Seite wird neu geladen, da geladene Skripte nicht entladen werden k\xF6nnen.");
      setTimeout(() => location.reload(), 50);
    }
  }
  /** Ruft onConsent / onRevoke / onGrant der Plugins passend zum Zustand auf. */
  applyPlugins(revoked) {
    const config = this.config;
    if (!config) return;
    const ctx = this.context();
    for (const plugin of config.services) {
      this.safe(plugin, "onConsent", () => plugin.onConsent?.(ctx));
    }
    for (const plugin of config.services) {
      if (!revoked.includes(plugin.id)) continue;
      this.safe(plugin, "onRevoke", () => plugin.onRevoke?.(ctx));
      this.active.delete(plugin.id);
    }
    for (const plugin of config.services) {
      if (this.active.has(plugin.id) || !this.isGranted(plugin, this.state)) continue;
      this.active.add(plugin.id);
      this.log("Dienst wird aktiviert:", plugin.id);
      this.safe(plugin, "onGrant", () => plugin.onGrant?.(ctx));
    }
  }
  /** Löscht bekannte Cookies aller Dienste ohne Einwilligung. */
  cleanupCookies() {
    for (const plugin of this.getServices()) {
      if (this.isGranted(plugin, this.state) || !plugin.cookiePatterns?.length) continue;
      const deleted = deleteCookies(plugin.cookiePatterns);
      if (deleted.length) this.log("Cookies gel\xF6scht:", plugin.id, deleted);
    }
  }
  isGranted(plugin, state) {
    const override = state.services[plugin.id];
    if (override !== void 0) return override;
    if (!state.decided) return false;
    return serviceCategories(plugin).some((c) => c === "necessary" || state.categories[c] === true);
  }
  gpcActive() {
    return this.config?.respectGpc === true && gpcSignal();
  }
  context() {
    const self = this;
    return {
      get state() {
        return self.getState();
      },
      hasConsent: (id) => self.hasConsent(id),
      loadScript,
      log: this.log,
      requestReload: () => {
        this.reloadRequested = true;
      }
    };
  }
  safe(plugin, hook, fn) {
    try {
      fn();
    } catch (error) {
      if (typeof console !== "undefined") console.error(`consent-kit: Fehler in ${plugin.id}.${hook}`, error);
    }
  }
  emit(event, payload) {
    for (const handler of Array.from(this.handlers.get(event) ?? [])) {
      try {
        handler(payload);
      } catch (error) {
        if (typeof console !== "undefined") console.error(`consent-kit: Fehler in Event-Handler f\xFCr ${event}`, error);
      }
    }
  }
  load() {
    const config = this.config;
    const version = String(config.version);
    const empty = emptyState(version);
    empty.gpc = this.gpcActive();
    const raw = readCookie(cookieOptions(config).name);
    if (!raw) return empty;
    let stored;
    try {
      stored = JSON.parse(decodeURIComponent(raw));
    } catch {
      return empty;
    }
    if (!stored || typeof stored !== "object" || typeof stored.i !== "string") return empty;
    const age = Date.now() - Date.parse(stored.t);
    if (stored.v !== version || !(age >= 0 && age < maxAgeDays(config) * DAY_MS)) {
      return { ...empty, consentId: stored.i };
    }
    const categories = {};
    for (const id of this.getCategoryIds()) categories[id] = id === "necessary" || (stored.c ?? []).includes(id);
    const services = {};
    for (const [id, value] of Object.entries(stored.s ?? {})) services[id] = value === 1;
    return {
      ...empty,
      decided: stored.d === 1,
      consentId: stored.i,
      timestamp: stored.t,
      categories,
      services
    };
  }
  save() {
    const config = this.config;
    const s = this.state;
    const stored = {
      i: s.consentId,
      t: s.timestamp,
      v: s.configVersion,
      d: s.decided ? 1 : 0,
      c: Object.keys(s.categories).filter((k) => s.categories[k]),
      s: Object.fromEntries(Object.entries(s.services).map(([k, v]) => [k, v ? 1 : 0]))
    };
    const { name, path, domain } = cookieOptions(config);
    writeCookie(name, encodeURIComponent(JSON.stringify(stored)), {
      maxAgeSeconds: maxAgeDays(config) * 24 * 60 * 60,
      path,
      domain
    });
  }
  sendLog(action) {
    const endpoint = this.config?.logging?.endpoint;
    if (!endpoint || typeof fetch === "undefined") return;
    const s = this.state;
    const body = JSON.stringify({
      consentId: s.consentId,
      timestamp: s.timestamp,
      configVersion: s.configVersion,
      action,
      categories: s.categories,
      services: s.services,
      gpc: s.gpc,
      domain: location.hostname
    });
    fetch(endpoint, {
      method: "POST",
      body,
      keepalive: true,
      credentials: "omit",
      headers: { "Content-Type": "text/plain;charset=UTF-8" }
    }).catch((error) => this.log("Protokollierung fehlgeschlagen", error));
  }
};
function emptyState(version) {
  return {
    decided: false,
    consentId: "",
    timestamp: "",
    configVersion: version,
    categories: { necessary: true },
    services: {},
    gpc: false
  };
}
function cloneState(state) {
  return { ...state, categories: { ...state.categories }, services: { ...state.services } };
}
function maxAgeDays(config) {
  const days = config.cookie?.maxAgeDays ?? MAX_AGE_DAYS;
  return Math.max(1, Math.min(days, MAX_AGE_DAYS));
}
function cookieOptions(config) {
  return {
    name: config.cookie?.name ?? DEFAULT_COOKIE,
    path: config.cookie?.path ?? "/",
    domain: config.cookie?.domain
  };
}
function validateConfig(config, log) {
  const ids = /* @__PURE__ */ new Set();
  const categories = /* @__PURE__ */ new Set([...BUILT_IN_CATEGORIES, ...(config.categories ?? []).map((c) => c.id)]);
  for (const plugin of config.services) {
    if (ids.has(plugin.id)) console.warn(`consent-kit: Dienst "${plugin.id}" ist doppelt konfiguriert.`);
    ids.add(plugin.id);
    for (const c of serviceCategories(plugin)) {
      if (!categories.has(c)) console.warn(`consent-kit: Dienst "${plugin.id}" nutzt unbekannte Kategorie "${c}".`);
    }
  }
  if (!config.links?.imprint || !config.links?.privacy) {
    console.warn("consent-kit: links.imprint und links.privacy m\xFCssen gesetzt sein.");
  }
  log("Konfiguration geladen", config);
}
function publicApi(m) {
  return {
    acceptAll: () => m.acceptAll(),
    rejectAll: () => m.rejectAll(),
    setCategories: (c, s) => m.setCategories(c, s),
    openSettings: () => m.openSettings(),
    getState: () => m.getState(),
    hasConsent: (id) => m.hasConsent(id)
  };
}

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
  return {
    id: "meta-pixel",
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
    onGrant(ctx) {
      if (!viaKit || !options.id) return;
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

export { BUILT_IN_CATEGORIES, ConsentManager, GOOGLE_ADS_COOKIE_PATTERNS, GOOGLE_ANALYTICS_COOKIE_PATTERNS, acceptAll, autoTrackRouteChanges, consentCookieMeta, defaultTexts, defineConfig, definePlugin, deleteCookies, embed, formatText, getManager, getState, googleMaps, googleTagManager, hasConsent, init, loadScript, matchesPattern, metaPixel, notifyRouteChange, on, openSettings, rejectAll, resolveLanguage, resolveTexts, serviceCategories, setCategories, setService, tiktokPixel, youtube };
