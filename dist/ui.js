import { useRef, useId, useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getManager, serviceCategories, consentCookieMeta } from 'consent-kit';
import { useConsentContext, useConsent } from 'consent-kit/react';
import { jsxs, Fragment, jsx } from 'react/jsx-runtime';

// src/ui/index.tsx
var THEME_VARS = {
  background: "--ck-bg",
  text: "--ck-text",
  accent: "--ck-accent",
  buttonBackground: "--ck-btn-bg",
  buttonText: "--ck-btn-text",
  border: "--ck-border",
  radius: "--ck-radius",
  fontFamily: "--ck-font",
  maxWidth: "--ck-max-width",
  zIndex: "--ck-z"
};
function themeCss(theme) {
  if (!theme) return "";
  return Object.entries(theme).filter(([key, value]) => value && key in THEME_VARS).map(([key, value]) => `${THEME_VARS[key]}:${String(value).replace(/[;{}<>]/g, "")};`).join("");
}
function buildStyle(config) {
  const light = themeCss(config.ui?.theme);
  const dark = themeCss(config.ui?.darkTheme);
  let css = light ? `.ck-root{${light}}` : "";
  if (dark) {
    css += `.ck-root[data-ck-scheme="dark"]{${dark}}`;
    css += `@media (prefers-color-scheme: dark){.ck-root[data-ck-scheme="auto"]{${dark}}}`;
  }
  return css;
}
function pathOf(href) {
  try {
    return new URL(href, location.href).pathname.replace(/\/$/, "") || "/";
  } catch {
    return null;
  }
}
function isLegalPage(config, pathname) {
  const current = pathname.replace(/\/$/, "") || "/";
  return [config.links.imprint, config.links.privacy].some((l) => pathOf(l) === current);
}
function usePathname() {
  const [pathname, setPathname] = useState(() => typeof location === "undefined" ? "/" : location.pathname);
  useEffect(() => {
    const update = () => setPathname(location.pathname);
    const off = getManager().on("route:changed", update);
    window.addEventListener("popstate", update);
    return () => {
      off();
      window.removeEventListener("popstate", update);
    };
  }, []);
  return pathname;
}
var HOST_ID = "consent-kit-root";
function usePortalHost() {
  const [host, setHost] = useState(null);
  useEffect(() => {
    let el = document.getElementById(HOST_ID);
    if (!el) {
      el = document.createElement("div");
      el.id = HOST_ID;
      document.body.insertBefore(el, document.body.firstChild);
    }
    setHost(el);
  }, []);
  return host;
}
var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
function useFocusTrap(ref, active, onEscape) {
  const escapeRef = useRef(onEscape);
  escapeRef.current = onEscape;
  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    if (!node) return;
    const previous = document.activeElement;
    const initial = node.querySelector("[data-ck-autofocus]") ?? node;
    initial.focus();
    const onKey = (event) => {
      if (event.key === "Escape" && escapeRef.current) {
        event.preventDefault();
        escapeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = Array.from(node.querySelectorAll(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === node)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    node.addEventListener("keydown", onKey);
    return () => {
      node.removeEventListener("keydown", onKey);
      if (previous && document.contains(previous)) previous.focus();
    };
  }, [active, ref]);
}
function Links({ config, texts }) {
  return /* @__PURE__ */ jsxs("p", { className: "ck-links", children: [
    /* @__PURE__ */ jsx("a", { href: config.links.privacy, children: texts.privacy }),
    /* @__PURE__ */ jsx("a", { href: config.links.imprint, children: texts.imprint })
  ] });
}
function ConsentBanner({ position, onOpenSettings }) {
  const { config, texts } = useConsentContext();
  const { state, acceptAll, rejectAll } = useConsent();
  const ref = useRef(null);
  const titleId = useId();
  const descId = useId();
  const modal = position === "center";
  useFocusTrap(ref, modal);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    modal ? /* @__PURE__ */ jsx("div", { className: "ck-backdrop", "aria-hidden": "true" }) : null,
    /* @__PURE__ */ jsxs(
      "div",
      {
        ref,
        className: `ck-banner ck-banner--${position}`,
        role: modal ? "dialog" : "region",
        "aria-modal": modal ? true : void 0,
        "aria-labelledby": titleId,
        "aria-describedby": descId,
        tabIndex: -1,
        "data-testid": "consent-banner",
        children: [
          /* @__PURE__ */ jsxs("div", { className: "ck-banner__body", children: [
            /* @__PURE__ */ jsx("h2", { id: titleId, className: "ck-title", children: texts.bannerTitle }),
            /* @__PURE__ */ jsx("p", { id: descId, className: "ck-text", children: texts.bannerDescription }),
            state.gpc ? /* @__PURE__ */ jsx("p", { className: "ck-note", children: texts.gpcNotice }) : null,
            /* @__PURE__ */ jsx(Links, { config, texts })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "ck-actions", children: [
            /* @__PURE__ */ jsx("button", { type: "button", className: "ck-btn", onClick: onOpenSettings, children: texts.settings }),
            /* @__PURE__ */ jsx("button", { type: "button", className: "ck-btn", onClick: rejectAll, children: texts.rejectAll }),
            /* @__PURE__ */ jsx("button", { type: "button", className: "ck-btn", onClick: acceptAll, children: texts.acceptAll })
          ] })
        ]
      }
    )
  ] });
}
function initialDraft(state, categoryIds) {
  const categories = {};
  for (const id of categoryIds) categories[id] = id === "necessary" || state.decided && state.categories[id] === true;
  return { categories, services: { ...state.services } };
}
function draftGranted(draft, plugin) {
  const override = draft.services[plugin.id];
  if (override !== void 0) return override;
  return serviceCategories(plugin).some((c) => draft.categories[c]);
}
function ServiceDetails({ meta, texts, language, children }) {
  return /* @__PURE__ */ jsxs("li", { className: "ck-service", children: [
    /* @__PURE__ */ jsxs("div", { className: "ck-service__head", children: [
      /* @__PURE__ */ jsx("span", { className: "ck-service__name", children: meta.name }),
      children
    ] }),
    /* @__PURE__ */ jsxs("dl", { className: "ck-service__meta", children: [
      /* @__PURE__ */ jsx("dt", { children: texts.provider }),
      /* @__PURE__ */ jsx("dd", { children: meta.provider }),
      /* @__PURE__ */ jsx("dt", { children: texts.purpose }),
      /* @__PURE__ */ jsx("dd", { children: meta.purpose[language] }),
      /* @__PURE__ */ jsx("dt", { children: texts.cookies }),
      /* @__PURE__ */ jsx("dd", { children: meta.cookies.length === 0 ? texts.noCookies : /* @__PURE__ */ jsx("ul", { className: "ck-cookies", children: meta.cookies.map((c) => /* @__PURE__ */ jsxs("li", { children: [
        /* @__PURE__ */ jsx("code", { children: c.name }),
        " \u2013 ",
        texts.duration,
        ": ",
        c.duration[language],
        c.purpose ? ` (${c.purpose[language]})` : ""
      ] }, c.name)) }) }),
      /* @__PURE__ */ jsx("dt", { children: texts.thirdCountry }),
      /* @__PURE__ */ jsx("dd", { children: meta.thirdCountryTransfer?.[language] ?? texts.noThirdCountry }),
      /* @__PURE__ */ jsx("dt", { children: texts.privacyPolicy }),
      /* @__PURE__ */ jsx("dd", { children: /* @__PURE__ */ jsx("a", { href: meta.privacyPolicyUrl, target: "_blank", rel: "noopener noreferrer", children: meta.privacyPolicyUrl }) })
    ] })
  ] });
}
function ConsentSettings({ onClose, owner }) {
  const { config, texts, language } = useConsentContext();
  const { state, acceptAll, rejectAll, setCategories } = useConsent();
  const categoryIds = useMemo(() => getManager().getCategoryIds(), []);
  const [draft, setDraft] = useState(() => initialDraft(state, categoryIds));
  const [expanded, setExpanded] = useState({});
  const ref = useRef(null);
  const baseId = useId();
  useFocusTrap(ref, true, onClose);
  const visibleCategories = categoryIds.filter(
    (id) => id === "necessary" || config.services.some((p) => serviceCategories(p).includes(id))
  );
  const toggleCategory = (id, value) => setDraft((d) => {
    const services = { ...d.services };
    for (const p of config.services) if (serviceCategories(p).includes(id)) delete services[p.id];
    return { categories: { ...d.categories, [id]: value }, services };
  });
  const toggleService = (plugin, value) => setDraft((d) => ({ ...d, services: { ...d.services, [plugin.id]: value } }));
  const finish = (action) => {
    action();
    onClose();
  };
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("div", { className: "ck-backdrop", "aria-hidden": "true" }),
    /* @__PURE__ */ jsxs(
      "div",
      {
        ref,
        className: "ck-dialog",
        role: "dialog",
        "aria-modal": "true",
        "aria-labelledby": `${baseId}-title`,
        "aria-describedby": `${baseId}-desc`,
        tabIndex: -1,
        "data-testid": "consent-settings",
        children: [
          /* @__PURE__ */ jsxs("div", { className: "ck-dialog__header", children: [
            /* @__PURE__ */ jsx("h2", { id: `${baseId}-title`, className: "ck-title", children: texts.settingsTitle }),
            /* @__PURE__ */ jsx("button", { type: "button", className: "ck-close", onClick: onClose, "aria-label": texts.close, "data-ck-autofocus": "", children: /* @__PURE__ */ jsx("span", { "aria-hidden": "true", children: "\xD7" }) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "ck-dialog__body", children: [
            /* @__PURE__ */ jsx("p", { id: `${baseId}-desc`, className: "ck-text", children: texts.settingsDescription }),
            state.gpc ? /* @__PURE__ */ jsx("p", { className: "ck-note", children: texts.gpcNotice }) : null,
            /* @__PURE__ */ jsx("ul", { className: "ck-categories", children: visibleCategories.map((id) => {
              const label = texts.categories[id]?.label ?? id;
              const description = texts.categories[id]?.description ?? "";
              const necessary = id === "necessary";
              const plugins = config.services.filter((p) => serviceCategories(p).includes(id));
              const inputId = `${baseId}-cat-${id}`;
              const detailsId = `${baseId}-details-${id}`;
              const open = expanded[id] === true;
              const count = plugins.length + (necessary ? 1 : 0);
              return /* @__PURE__ */ jsxs("li", { className: "ck-category", children: [
                /* @__PURE__ */ jsxs("div", { className: "ck-category__head", children: [
                  /* @__PURE__ */ jsxs("label", { className: "ck-switch", htmlFor: inputId, children: [
                    /* @__PURE__ */ jsx(
                      "input",
                      {
                        id: inputId,
                        type: "checkbox",
                        role: "switch",
                        checked: necessary || draft.categories[id] === true,
                        disabled: necessary,
                        "aria-describedby": `${inputId}-desc`,
                        onChange: (e) => toggleCategory(id, e.currentTarget.checked),
                        "data-testid": `category-${id}`
                      }
                    ),
                    /* @__PURE__ */ jsx("span", { className: "ck-switch__track", "aria-hidden": "true" }),
                    /* @__PURE__ */ jsx("span", { className: "ck-category__label", children: label })
                  ] }),
                  necessary ? /* @__PURE__ */ jsx("span", { className: "ck-badge", children: texts.alwaysActive }) : null
                ] }),
                /* @__PURE__ */ jsx("p", { id: `${inputId}-desc`, className: "ck-category__desc", children: description }),
                /* @__PURE__ */ jsxs(
                  "button",
                  {
                    type: "button",
                    className: "ck-details-toggle",
                    "aria-expanded": open,
                    "aria-controls": detailsId,
                    onClick: () => setExpanded((e) => ({ ...e, [id]: !open })),
                    children: [
                      open ? texts.hideDetails : texts.showDetails,
                      " (",
                      count,
                      " ",
                      texts.services,
                      ")"
                    ]
                  }
                ),
                /* @__PURE__ */ jsxs("ul", { id: detailsId, className: "ck-services", hidden: !open, children: [
                  necessary ? /* @__PURE__ */ jsx(ServiceDetails, { meta: consentCookieMeta(config, owner), texts, language }) : null,
                  plugins.map((plugin) => /* @__PURE__ */ jsx(ServiceDetails, { meta: plugin.meta, texts, language, children: necessary ? null : /* @__PURE__ */ jsxs("label", { className: "ck-switch ck-switch--small", children: [
                    /* @__PURE__ */ jsx(
                      "input",
                      {
                        type: "checkbox",
                        role: "switch",
                        checked: draftGranted(draft, plugin),
                        onChange: (e) => toggleService(plugin, e.currentTarget.checked),
                        "aria-label": `${texts.allowService}: ${plugin.meta.name}`,
                        "data-testid": `service-${plugin.id}-${id}`
                      }
                    ),
                    /* @__PURE__ */ jsx("span", { className: "ck-switch__track", "aria-hidden": "true" }),
                    /* @__PURE__ */ jsx("span", { className: "ck-switch__text", children: texts.allowService })
                  ] }) }, plugin.id))
                ] })
              ] }, id);
            }) }),
            /* @__PURE__ */ jsx(Links, { config, texts })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "ck-actions ck-dialog__footer", children: [
            /* @__PURE__ */ jsx("button", { type: "button", className: "ck-btn", onClick: () => finish(rejectAll), children: texts.rejectAll }),
            /* @__PURE__ */ jsx("button", { type: "button", className: "ck-btn", onClick: () => finish(() => setCategories(draft.categories, draft.services)), children: texts.save }),
            /* @__PURE__ */ jsx("button", { type: "button", className: "ck-btn", onClick: () => finish(acceptAll), children: texts.acceptAll })
          ] })
        ]
      }
    )
  ] });
}
function ConsentUI({ owner } = {}) {
  const { config } = useConsentContext();
  const { state, ready } = useConsent();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const pathname = usePathname();
  const host = usePortalHost();
  const style = useMemo(() => buildStyle(config), [config]);
  useEffect(() => getManager().on("ui:open-settings", () => setSettingsOpen(true)), []);
  if (!ready || !host) return null;
  const position = config.ui?.position === "center" && !isLegalPage(config, pathname) ? "center" : "bottom";
  return createPortal(
    /* @__PURE__ */ jsxs("div", { className: "ck-root", "data-ck-scheme": config.ui?.colorScheme ?? "auto", children: [
      style ? /* @__PURE__ */ jsx("style", { children: style }) : null,
      !state.decided && !settingsOpen ? /* @__PURE__ */ jsx(ConsentBanner, { position, onOpenSettings: () => setSettingsOpen(true) }) : null,
      settingsOpen ? /* @__PURE__ */ jsx(ConsentSettings, { owner, onClose: () => setSettingsOpen(false) }) : null
    ] }),
    host
  );
}

export { ConsentBanner, ConsentSettings, ConsentUI };
