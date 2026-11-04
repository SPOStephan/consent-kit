import { stateFromCookieValue, consentCookieName, isServiceGranted, categoryIds } from './chunk-KCEHN42M.js';

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

export { hasServerConsent, readConsentState, readCookieFrom, readMetaBrowserIds };
