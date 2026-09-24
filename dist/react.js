import { createContext, useEffect, useMemo, useContext, useSyncExternalStore, useCallback } from 'react';
import { init, resolveLanguage, resolveTexts, getManager, autoTrackRouteChanges, formatText } from 'consent-kit';
import { jsx, Fragment, jsxs } from 'react/jsx-runtime';

// src/react/index.tsx
var ConsentContext = createContext(null);
var snapshot = null;
function readSnapshot() {
  const m = getManager();
  const state = m.getState();
  const ready = m.isReady();
  if (!snapshot || snapshot.ready !== ready || JSON.stringify(snapshot.state) !== JSON.stringify(state)) {
    snapshot = { state, ready };
  }
  return snapshot;
}
function subscribe(callback) {
  const m = getManager();
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
function ConsentProvider({ config, children }) {
  useEffect(() => {
    init(config);
  }, [config]);
  const value = useMemo(() => {
    const language = resolveLanguage(config);
    return { config, language, texts: resolveTexts(config, language) };
  }, [config]);
  return /* @__PURE__ */ jsx(ConsentContext.Provider, { value, children });
}
function useConsentContext() {
  const ctx = useContext(ConsentContext);
  if (!ctx) throw new Error("consent-kit: useConsent() muss innerhalb von <ConsentProvider> verwendet werden.");
  return ctx;
}
function useConsent() {
  const { state, ready } = useSyncExternalStore(subscribe, readSnapshot, () => serverSnapshot);
  return useMemo(() => {
    const m = getManager();
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
  useEffect(() => {
    if (!auto) return;
    return autoTrackRouteChanges();
  }, [auto]);
  useEffect(() => {
    if (path === void 0) return;
    getManager().notifyRouteChange(path);
  }, [path]);
}
function PageViews({ path }) {
  usePageViews(path);
  return null;
}
function CookieSettingsLink({ children, className, style }) {
  const ctx = useContext(ConsentContext);
  return /* @__PURE__ */ jsx(
    "button",
    {
      type: "button",
      className: className ?? "ck-settings-link",
      style,
      onClick: () => getManager().openSettings(),
      children: children ?? ctx?.texts.settingsTitle ?? "Cookie-Einstellungen"
    }
  );
}
function ConsentGate({ service, children, placeholder, aspectRatio, className }) {
  const { config, texts, language } = useConsentContext();
  const { hasConsent, setService } = useConsent();
  const load = useCallback(() => setService(service, true), [service, setService]);
  if (hasConsent(service)) return /* @__PURE__ */ jsx(Fragment, { children: typeof children === "function" ? children() : children });
  if (placeholder !== void 0) return /* @__PURE__ */ jsx(Fragment, { children: typeof placeholder === "function" ? placeholder(load) : placeholder });
  const plugin = config.services.find((p) => p.id === service);
  const name = plugin?.meta.name ?? service;
  const third = plugin?.meta.thirdCountryTransfer?.[language];
  const thirdText = third ? language === "de" ? `, ggf. auch in Drittl\xE4nder (${third})` : `, possibly also to third countries (${third})` : "";
  return /* @__PURE__ */ jsx(
    "div",
    {
      className: ["ck-gate", className].filter(Boolean).join(" "),
      "data-ck-scheme": config.ui?.colorScheme ?? "auto",
      style: aspectRatio ? { aspectRatio } : void 0,
      role: "group",
      "aria-label": `${texts.gateTitle}: ${name}`,
      children: /* @__PURE__ */ jsxs("div", { className: "ck-gate__inner", children: [
        /* @__PURE__ */ jsxs("p", { className: "ck-gate__title", children: [
          texts.gateTitle,
          ": ",
          name
        ] }),
        /* @__PURE__ */ jsxs("p", { className: "ck-gate__text", children: [
          formatText(texts.gateDescription, { service: name, provider: plugin?.meta.provider ?? "", thirdCountry: thirdText }),
          plugin?.meta.privacyPolicyUrl ? /* @__PURE__ */ jsxs(Fragment, { children: [
            " ",
            /* @__PURE__ */ jsx("a", { href: plugin.meta.privacyPolicyUrl, target: "_blank", rel: "noopener noreferrer", children: texts.privacyPolicy })
          ] }) : null
        ] }),
        /* @__PURE__ */ jsx("button", { type: "button", className: "ck-btn", onClick: load, children: texts.gateLoad }),
        /* @__PURE__ */ jsx("p", { className: "ck-gate__hint", children: formatText(texts.gateAlwaysAllow, { service: name }) })
      ] })
    }
  );
}

export { ConsentGate, ConsentProvider, CookieSettingsLink, PageViews, useConsent, useConsentContext, usePageViews };
