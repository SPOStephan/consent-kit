'use strict';

// src/core/manager.ts
var BUILT_IN_CATEGORIES = ["necessary", "statistics", "marketing"];
var DEFAULT_COOKIE = "consent_kit";
var MAX_AGE_DAYS = 365;
var DAY_MS = 24 * 60 * 60 * 1e3;
function serviceCategories(plugin) {
  return typeof plugin.category === "string" ? [plugin.category] : plugin.category;
}
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
function maxAgeDays(config) {
  const days = config.cookie?.maxAgeDays ?? MAX_AGE_DAYS;
  return Math.max(1, Math.min(days, MAX_AGE_DAYS));
}

// src/server/index.ts
function readCookieFrom(source, name) {
  if (!source) return void 0;
  if (typeof source !== "string") {
    const value = source[name];
    return value === void 0 ? void 0 : value.includes("%") ? value : encodeURIComponent(value);
  }
  for (const part of source.split(/;\s*/)) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return void 0;
}
function readConsentState(source, config, now) {
  return stateFromCookieValue(readCookieFrom(source, consentCookieName(config)), config, { now });
}
function hasServerConsent(source, config, categoryOrServiceId, now) {
  if (categoryOrServiceId === "necessary") return true;
  const state = readConsentState(source, config, now);
  const plugin = config.services.find((p) => p.id === categoryOrServiceId);
  if (plugin) return isServiceGranted(plugin, state);
  if (!categoryIds(config).includes(categoryOrServiceId)) return false;
  return state.decided && state.categories[categoryOrServiceId] === true;
}
function readMetaBrowserIds(source) {
  const decode = (value) => {
    if (!value) return void 0;
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  };
  const fbp = decode(readCookieFrom(source, "_fbp"));
  const fbc = decode(readCookieFrom(source, "_fbc"));
  return { ...fbp ? { fbp } : {}, ...fbc ? { fbc } : {} };
}

exports.hasServerConsent = hasServerConsent;
exports.readConsentState = readConsentState;
exports.readCookieFrom = readCookieFrom;
exports.readMetaBrowserIds = readMetaBrowserIds;
