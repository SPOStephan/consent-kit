import { googleMaps, youtube, tiktokPixel, metaPixel, googleTagManager } from 'consent-kit';

// src/remote/index.ts
var str = (v) => typeof v === "string" && v.length > 0;
function toPlugin(s) {
  switch (s.type) {
    case "google-tag-manager":
      if (!str(s.id) || !/^GTM-[A-Z0-9]+$/i.test(s.id)) return null;
      return googleTagManager({ id: s.id, analytics: s.analytics !== false, ads: s.ads !== false });
    case "meta-pixel":
      if (s.loadVia === "gtm") return metaPixel({ loadVia: "gtm" });
      return str(s.id) && /^\d+$/.test(s.id) ? metaPixel({ id: s.id }) : null;
    case "tiktok-pixel":
      if (s.loadVia === "gtm") return tiktokPixel({ loadVia: "gtm" });
      return str(s.id) && /^[A-Z0-9]+$/i.test(s.id) ? tiktokPixel({ id: s.id }) : null;
    case "youtube":
      return youtube();
    case "google-maps":
      return googleMaps();
    default:
      return null;
  }
}
function fromRemoteConfig(remote, extraServices = []) {
  if (!remote || remote.schema !== 1 || !remote.links || !Array.isArray(remote.services)) {
    throw new Error("consent-kit: ung\xFCltige Remote-Konfiguration");
  }
  const services = remote.services.map(toPlugin).filter((p) => p !== null);
  for (const extra of extraServices) if (!services.some((p) => p.id === extra.id)) services.push(extra);
  return {
    // Eigene Plugins fließen in die Version ein – kommt eins dazu, wird neu gefragt.
    version: extraServices.length ? `${remote.version}+${extraServices.map((p) => p.id).join(",")}` : remote.version,
    language: remote.language ?? "de",
    owner: remote.owner,
    links: remote.links,
    cookie: remote.cookieDomain ? { domain: remote.cookieDomain } : void 0,
    respectGpc: remote.respectGpc === true,
    services,
    texts: remote.texts,
    ui: remote.ui,
    logging: remote.logging?.endpoint ? { endpoint: remote.logging.endpoint, siteId: remote.siteId } : void 0
  };
}
async function loadRemoteConfig(options) {
  const url = `${options.endpoint.replace(/\/$/, "")}/config/${encodeURIComponent(options.siteId)}`;
  const controller = typeof AbortController !== "undefined" ? new AbortController() : void 0;
  const timer = setTimeout(() => controller?.abort(), options.timeout ?? 4e3);
  try {
    const response = await fetch(url, { signal: controller?.signal, credentials: "omit", headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const remote = await response.json();
    if (remote.siteId !== options.siteId) throw new Error("falsche Website-Kennung");
    return fromRemoteConfig(remote, options.services);
  } catch (error) {
    if (options.fallback) {
      if (typeof console !== "undefined") {
        console.warn(`consent-kit: Einstellungen konnten nicht geladen werden (${error.message}) \u2013 R\xFCckfallebene wird verwendet.`);
      }
      return fromRemoteConfig(options.fallback, options.services);
    }
    throw new Error(`consent-kit: Einstellungen konnten nicht geladen werden (${error.message}).`);
  } finally {
    clearTimeout(timer);
  }
}

export { fromRemoteConfig, loadRemoteConfig };
