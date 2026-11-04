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
    return categoryIds(this.config);
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
    return isServiceGranted(plugin, state);
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
    return stateFromCookieValue(readCookie(cookieOptions(this.config).name), this.config, { gpc: this.gpcActive() });
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
function categoryIds(config) {
  const ids = [...BUILT_IN_CATEGORIES];
  for (const c of config?.categories ?? []) if (!ids.includes(c.id)) ids.push(c.id);
  return ids;
}
function isServiceGranted(plugin, state) {
  const override = state.services[plugin.id];
  if (override !== void 0) return override;
  if (!state.decided) return false;
  return serviceCategories(plugin).some((c) => c === "necessary" || state.categories[c] === true);
}
function stateFromCookieValue(raw, config, options = {}) {
  const version = String(config.version);
  const empty = emptyState(version);
  empty.gpc = options.gpc === true;
  if (!raw) return empty;
  let stored;
  try {
    stored = JSON.parse(decodeURIComponent(raw));
  } catch {
    return empty;
  }
  if (!stored || typeof stored !== "object" || typeof stored.i !== "string") return empty;
  const age = (options.now ?? Date.now()) - Date.parse(stored.t);
  if (stored.v !== version || !(age >= 0 && age < maxAgeDays(config) * DAY_MS)) {
    return { ...empty, consentId: stored.i };
  }
  const categories = {};
  for (const id of categoryIds(config)) categories[id] = id === "necessary" || (stored.c ?? []).includes(id);
  const services = {};
  for (const [id, value] of Object.entries(stored.s ?? {})) services[id] = value === 1;
  return { ...empty, decided: stored.d === 1, consentId: stored.i, timestamp: stored.t, categories, services };
}
function consentCookieName(config) {
  return config.cookie?.name ?? DEFAULT_COOKIE;
}
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
    name: consentCookieName(config),
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

export { BUILT_IN_CATEGORIES, ConsentManager, categoryIds, consentCookieName, deleteCookies, isServiceGranted, loadScript, matchesPattern, readCookie, serviceCategories, stateFromCookieValue, writeCookie };
