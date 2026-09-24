'use strict';

var react = require('react');
var consentKit = require('consent-kit');
var remote = require('consent-kit/remote');
var jsxRuntime = require('react/jsx-runtime');

// src/react/index.tsx
var ConsentContext = react.createContext(null);
var snapshot = null;
function readSnapshot() {
  const m = consentKit.getManager();
  const state = m.getState();
  const ready = m.isReady();
  if (!snapshot || snapshot.ready !== ready || JSON.stringify(snapshot.state) !== JSON.stringify(state)) {
    snapshot = { state, ready };
  }
  return snapshot;
}
function subscribe(callback) {
  const m = consentKit.getManager();
  const offs = [m.on("consent:ready", callback), m.on("consent:changed", callback)];
  return () => offs.forEach((off) => off());
}
var serverSnapshot = {
  state: {
    decided: false,
    consentId: "",
    timestamp: "",
    configVersion: "",
    categories: { necessary: true },
    services: {},
    gpc: false
  },
  ready: false
};
function ConsentProvider({ config: localConfig, remote: remote$1, children }) {
  const [remoteConfig, setRemoteConfig] = react.useState(null);
  const remoteKey = remote$1 ? `${remote$1.endpoint}|${remote$1.siteId}` : "";
  const remoteRef = react.useRef(remote$1);
  remoteRef.current = remote$1;
  react.useEffect(() => {
    const options = remoteRef.current;
    if (!options) return;
    let cancelled = false;
    remote.loadRemoteConfig(options).then(
      (loaded) => {
        if (!cancelled) setRemoteConfig(loaded);
      },
      (error) => {
        if (typeof console !== "undefined") console.error(error);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [remoteKey]);
  const config = localConfig ?? remoteConfig;
  react.useEffect(() => {
    if (config) consentKit.init(config);
  }, [config]);
  const value = react.useMemo(() => {
    if (!config) return { config: null, language: "de", texts: consentKit.defaultTexts.de };
    const language = consentKit.resolveLanguage(config);
    return { config, language, texts: consentKit.resolveTexts(config, language) };
  }, [config]);
  return /* @__PURE__ */ jsxRuntime.jsx(ConsentContext.Provider, { value, children });
}
function useConsentContext() {
  const ctx = react.useContext(ConsentContext);
  if (!ctx) throw new Error("consent-kit: useConsent() muss innerhalb von <ConsentProvider> verwendet werden.");
  return ctx;
}
function useConsentConfig() {
  return useConsentContext().config;
}
function useConsent() {
  const { state, ready } = react.useSyncExternalStore(subscribe, readSnapshot, () => serverSnapshot);
  return react.useMemo(() => {
    const m = consentKit.getManager();
    return {
      state,
      ready,
      decided: state.decided,
      // state wird genutzt, damit Komponenten bei Änderungen neu rendern.
      hasConsent: (id) => ready ? m.hasConsent(id) : false,
      acceptAll: () => m.acceptAll(),
      rejectAll: () => m.rejectAll(),
      setCategories: (c, s) => m.setCategories(c, s),
      setService: (id, granted) => m.setService(id, granted),
      openSettings: () => m.openSettings()
    };
  }, [state, ready]);
}
function usePageViews(location) {
  const path = location === void 0 ? void 0 : typeof location === "string" ? location : location.pathname + (location.search ?? "");
  const auto = path === void 0;
  react.useEffect(() => {
    if (!auto) return;
    return consentKit.autoTrackRouteChanges();
  }, [auto]);
  react.useEffect(() => {
    if (path === void 0) return;
    consentKit.getManager().notifyRouteChange(path);
  }, [path]);
}
function PageViews({ path }) {
  usePageViews(path);
  return null;
}
function CookieSettingsLink({ children, className, style }) {
  const ctx = react.useContext(ConsentContext);
  return /* @__PURE__ */ jsxRuntime.jsx(
    "button",
    {
      type: "button",
      className: className ?? "ck-settings-link",
      style,
      onClick: () => consentKit.getManager().openSettings(),
      children: children ?? ctx?.texts.settingsTitle ?? "Cookie-Einstellungen"
    }
  );
}
function ConsentGate({ service, children, placeholder, aspectRatio, className }) {
  const { config, texts, language } = useConsentContext();
  const { hasConsent, setService } = useConsent();
  const load = react.useCallback(() => setService(service, true), [service, setService]);
  if (hasConsent(service)) return /* @__PURE__ */ jsxRuntime.jsx(jsxRuntime.Fragment, { children: typeof children === "function" ? children() : children });
  if (placeholder !== void 0) return /* @__PURE__ */ jsxRuntime.jsx(jsxRuntime.Fragment, { children: typeof placeholder === "function" ? placeholder(load) : placeholder });
  const plugin = config?.services.find((p) => p.id === service);
  const name = plugin?.meta.name ?? service;
  const third = plugin?.meta.thirdCountryTransfer?.[language];
  const thirdText = third ? language === "de" ? `, ggf. auch in Drittl\xE4nder (${third})` : `, possibly also to third countries (${third})` : "";
  return /* @__PURE__ */ jsxRuntime.jsx(
    "div",
    {
      className: ["ck-gate", className].filter(Boolean).join(" "),
      "data-ck-scheme": config?.ui?.colorScheme ?? "auto",
      style: aspectRatio ? { aspectRatio } : void 0,
      role: "group",
      "aria-label": `${texts.gateTitle}: ${name}`,
      children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "ck-gate__inner", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("p", { className: "ck-gate__title", children: [
          texts.gateTitle,
          ": ",
          name
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("p", { className: "ck-gate__text", children: [
          consentKit.formatText(texts.gateDescription, { service: name, provider: plugin?.meta.provider ?? "", thirdCountry: thirdText }),
          plugin?.meta.privacyPolicyUrl ? /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
            " ",
            /* @__PURE__ */ jsxRuntime.jsx("a", { href: plugin.meta.privacyPolicyUrl, target: "_blank", rel: "noopener noreferrer", children: texts.privacyPolicy })
          ] }) : null
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "ck-btn", onClick: load, children: texts.gateLoad }),
        /* @__PURE__ */ jsxRuntime.jsx("p", { className: "ck-gate__hint", children: consentKit.formatText(texts.gateAlwaysAllow, { service: name }) })
      ] })
    }
  );
}

exports.ConsentGate = ConsentGate;
exports.ConsentProvider = ConsentProvider;
exports.CookieSettingsLink = CookieSettingsLink;
exports.PageViews = PageViews;
exports.useConsent = useConsent;
exports.useConsentConfig = useConsentConfig;
exports.useConsentContext = useConsentContext;
exports.usePageViews = usePageViews;
