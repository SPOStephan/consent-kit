import { useEffect, useId, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import {
  consentCookieMeta,
  getManager,
  serviceCategories,
  type ConsentConfig,
  type ConsentPlugin,
  type ConsentState,
  type Language,
  type ServiceMeta,
  type Texts,
  type ThemeVariables,
} from 'consent-kit';
import { useConsent, useConsentContext } from 'consent-kit/react';

// ---------------------------------------------------------------- Hilfen

const THEME_VARS: Record<keyof ThemeVariables, string> = {
  background: '--ck-bg',
  text: '--ck-text',
  accent: '--ck-accent',
  buttonBackground: '--ck-btn-bg',
  buttonText: '--ck-btn-text',
  border: '--ck-border',
  radius: '--ck-radius',
  fontFamily: '--ck-font',
  maxWidth: '--ck-max-width',
  zIndex: '--ck-z',
};

const COLOR_KEYS = new Set<keyof ThemeVariables>(['background', 'text', 'accent', 'buttonBackground', 'buttonText', 'border']);

function themeCss(theme: ThemeVariables | undefined, colors: boolean): string {
  if (!theme) return '';
  return Object.entries(theme)
    .filter(([key, value]) => value && key in THEME_VARS && COLOR_KEYS.has(key as keyof ThemeVariables) === colors)
    .map(([key, value]) => `${THEME_VARS[key as keyof ThemeVariables]}:${String(value).replace(/[;{}<>]/g, '')};`)
    .join('');
}

/**
 * Erzeugt CSS aus ui.theme / ui.darkTheme.
 * Farben aus `theme` gelten nur im hellen Schema, Farben aus `darkTheme` nur im
 * dunklen – so bleiben die kontrastreichen Dark-Mode-Standardwerte erhalten,
 * wenn nur `theme` gesetzt ist. Maße und Schrift gelten immer.
 */
export function buildThemeCss(config: Pick<ConsentConfig, 'ui'>): string {
  const sel = (scheme: string) => `.ck-root[data-ck-scheme="${scheme}"],.ck-gate[data-ck-scheme="${scheme}"]`;
  const layout = themeCss(config.ui?.theme, false);
  const light = themeCss(config.ui?.theme, true);
  const dark = themeCss(config.ui?.darkTheme, true);
  let css = layout ? `.ck-root,.ck-gate{${layout}}` : '';
  if (light) css += `${sel('light')}{${light}}@media not all and (prefers-color-scheme: dark){${sel('auto')}{${light}}}`;
  if (dark) css += `${sel('dark')}{${dark}}@media (prefers-color-scheme: dark){${sel('auto')}{${dark}}}`;
  return css;
}

function pathOf(href: string): string | null {
  try {
    return new URL(href, location.href).pathname.replace(/\/$/, '') || '/';
  } catch {
    return null;
  }
}

/** Liegt die aktuelle Seite auf Impressum oder Datenschutzerklärung? */
function isLegalPage(config: ConsentConfig, pathname: string): boolean {
  const current = pathname.replace(/\/$/, '') || '/';
  return [config.links.imprint, config.links.privacy].some((l) => pathOf(l) === current);
}

function usePathname(): string {
  const [pathname, setPathname] = useState(() => (typeof location === 'undefined' ? '/' : location.pathname));
  useEffect(() => {
    const update = () => setPathname(location.pathname);
    const off = getManager().on('route:changed', update);
    window.addEventListener('popstate', update);
    return () => {
      off();
      window.removeEventListener('popstate', update);
    };
  }, []);
  return pathname;
}

const HOST_ID = 'consent-kit-root';

/** Container ganz am Anfang von <body>, damit das Banner in der Tab-Reihenfolge zuerst kommt. */
function usePortalHost(): HTMLElement | null {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    let el = document.getElementById(HOST_ID);
    if (!el) {
      el = document.createElement('div');
      el.id = HOST_ID;
      document.body.insertBefore(el, document.body.firstChild);
    }
    setHost(el);
  }, []);
  return host;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Fokus im Dialog halten, beim Öffnen hineinsetzen und beim Schließen zurückgeben. */
function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean, onEscape?: () => void) {
  const escapeRef = useRef(onEscape);
  escapeRef.current = onEscape;
  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    if (!node) return;
    const previous = document.activeElement as HTMLElement | null;
    const initial = node.querySelector<HTMLElement>('[data-ck-autofocus]') ?? node;
    initial.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && escapeRef.current) {
        event.preventDefault();
        escapeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (event.shiftKey && (document.activeElement === first || document.activeElement === node)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    node.addEventListener('keydown', onKey);
    return () => {
      node.removeEventListener('keydown', onKey);
      if (previous && document.contains(previous)) previous.focus();
    };
  }, [active, ref]);
}

function Links({ config, texts }: { config: ConsentConfig; texts: Texts }) {
  return (
    <p className="ck-links">
      <a href={config.links.privacy}>{texts.privacy}</a>
      <a href={config.links.imprint}>{texts.imprint}</a>
    </p>
  );
}

// ---------------------------------------------------------------- Banner

export interface ConsentBannerProps {
  position: 'bottom' | 'center';
  onOpenSettings(): void;
}

/** Erste Ebene: "Alle ablehnen" und "Alle akzeptieren" gleichwertig nebeneinander. */
export function ConsentBanner({ position, onOpenSettings }: ConsentBannerProps) {
  const { config, texts } = useConsentContext();
  const { state, acceptAll, rejectAll } = useConsent();
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const modal = position === 'center';
  useFocusTrap(ref, modal);

  return (
    <>
      {modal ? <div className="ck-backdrop" aria-hidden="true" /> : null}
      <div
        ref={ref}
        className={`ck-banner ck-banner--${position}`}
        role={modal ? 'dialog' : 'region'}
        aria-modal={modal ? true : undefined}
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
        data-testid="consent-banner"
      >
        <div className="ck-banner__body">
          <h2 id={titleId} className="ck-title">
            {texts.bannerTitle}
          </h2>
          <p id={descId} className="ck-text">
            {texts.bannerDescription}
          </p>
          {state.gpc ? <p className="ck-note">{texts.gpcNotice}</p> : null}
          <Links config={config} texts={texts} />
        </div>
        <div className="ck-actions">
          <button type="button" className="ck-btn" onClick={onOpenSettings}>
            {texts.settings}
          </button>
          <button type="button" className="ck-btn" onClick={rejectAll}>
            {texts.rejectAll}
          </button>
          <button type="button" className="ck-btn" onClick={acceptAll}>
            {texts.acceptAll}
          </button>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- Einstellungen

interface Draft {
  categories: Record<string, boolean>;
  services: Record<string, boolean>;
}

function initialDraft(state: ConsentState, categoryIds: string[]): Draft {
  const categories: Record<string, boolean> = {};
  for (const id of categoryIds) categories[id] = id === 'necessary' || (state.decided && state.categories[id] === true);
  return { categories, services: { ...state.services } };
}

function draftGranted(draft: Draft, plugin: ConsentPlugin): boolean {
  const override = draft.services[plugin.id];
  if (override !== undefined) return override;
  return serviceCategories(plugin).some((c) => draft.categories[c]);
}

function ServiceDetails({ meta, texts, language, children }: { meta: ServiceMeta; texts: Texts; language: Language; children?: ReactNode }) {
  return (
    <li className="ck-service">
      <div className="ck-service__head">
        <span className="ck-service__name">{meta.name}</span>
        {children}
      </div>
      <dl className="ck-service__meta">
        <dt>{texts.provider}</dt>
        <dd>{meta.provider}</dd>
        <dt>{texts.purpose}</dt>
        <dd>{meta.purpose[language]}</dd>
        <dt>{texts.cookies}</dt>
        <dd>
          {meta.cookies.length === 0 ? (
            texts.noCookies
          ) : (
            <ul className="ck-cookies">
              {meta.cookies.map((c) => (
                <li key={c.name}>
                  <code>{c.name}</code> – {texts.duration}: {c.duration[language]}
                  {c.purpose ? ` (${c.purpose[language]})` : ''}
                </li>
              ))}
            </ul>
          )}
        </dd>
        <dt>{texts.thirdCountry}</dt>
        <dd>{meta.thirdCountryTransfer?.[language] ?? texts.noThirdCountry}</dd>
        <dt>{texts.privacyPolicy}</dt>
        <dd>
          <a href={meta.privacyPolicyUrl} target="_blank" rel="noopener noreferrer">
            {meta.privacyPolicyUrl}
          </a>
        </dd>
      </dl>
    </li>
  );
}

export interface ConsentSettingsProps {
  onClose(): void;
  /** Betreiber der Website (für den eigenen Einwilligungs-Cookie), optional. */
  owner?: string;
}

/** Zweite Ebene: Kategorien mit Schaltern und aufklappbaren Dienst-Details. */
export function ConsentSettings({ onClose, owner }: ConsentSettingsProps) {
  const { config, texts, language } = useConsentContext();
  const { state, acceptAll, rejectAll, setCategories } = useConsent();
  const categoryIds = useMemo(() => getManager().getCategoryIds(), []);
  const [draft, setDraft] = useState(() => initialDraft(state, categoryIds));
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const ref = useRef<HTMLDivElement>(null);
  const baseId = useId();
  useFocusTrap(ref, true, onClose);

  const visibleCategories = categoryIds.filter(
    (id) => id === 'necessary' || config.services.some((p) => serviceCategories(p).includes(id)),
  );

  const toggleCategory = (id: string, value: boolean) =>
    setDraft((d) => {
      const services = { ...d.services };
      for (const p of config.services) if (serviceCategories(p).includes(id)) delete services[p.id];
      return { categories: { ...d.categories, [id]: value }, services };
    });
  const toggleService = (plugin: ConsentPlugin, value: boolean) =>
    setDraft((d) => ({ ...d, services: { ...d.services, [plugin.id]: value } }));

  const finish = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <>
      <div className="ck-backdrop" aria-hidden="true" />
      <div
        ref={ref}
        className="ck-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${baseId}-title`}
        aria-describedby={`${baseId}-desc`}
        tabIndex={-1}
        data-testid="consent-settings"
      >
        <div className="ck-dialog__header">
          <h2 id={`${baseId}-title`} className="ck-title">
            {texts.settingsTitle}
          </h2>
          <button type="button" className="ck-close" onClick={onClose} aria-label={texts.close} data-ck-autofocus="">
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div className="ck-dialog__body">
          <p id={`${baseId}-desc`} className="ck-text">
            {texts.settingsDescription}
          </p>
          {state.gpc ? <p className="ck-note">{texts.gpcNotice}</p> : null}
          <ul className="ck-categories">
            {visibleCategories.map((id) => {
              const label = texts.categories[id]?.label ?? id;
              const description = texts.categories[id]?.description ?? '';
              const necessary = id === 'necessary';
              const plugins = config.services.filter((p) => serviceCategories(p).includes(id));
              const inputId = `${baseId}-cat-${id}`;
              const detailsId = `${baseId}-details-${id}`;
              const open = expanded[id] === true;
              const count = plugins.length + (necessary ? 1 : 0);
              return (
                <li key={id} className="ck-category">
                  <div className="ck-category__head">
                    <label className="ck-switch" htmlFor={inputId}>
                      <input
                        id={inputId}
                        type="checkbox"
                        role="switch"
                        checked={necessary || draft.categories[id] === true}
                        disabled={necessary}
                        aria-describedby={`${inputId}-desc`}
                        onChange={(e) => toggleCategory(id, e.currentTarget.checked)}
                        data-testid={`category-${id}`}
                      />
                      <span className="ck-switch__track" aria-hidden="true" />
                      <span className="ck-category__label">{label}</span>
                    </label>
                    {necessary ? <span className="ck-badge">{texts.alwaysActive}</span> : null}
                  </div>
                  <p id={`${inputId}-desc`} className="ck-category__desc">
                    {description}
                  </p>
                  <button
                    type="button"
                    className="ck-details-toggle"
                    aria-expanded={open}
                    aria-controls={detailsId}
                    onClick={() => setExpanded((e) => ({ ...e, [id]: !open }))}
                  >
                    {open ? texts.hideDetails : texts.showDetails} ({count} {texts.services})
                  </button>
                  <ul id={detailsId} className="ck-services" hidden={!open}>
                    {necessary ? <ServiceDetails meta={consentCookieMeta(config, owner)} texts={texts} language={language} /> : null}
                    {plugins.map((plugin) => (
                      <ServiceDetails key={plugin.id} meta={plugin.meta} texts={texts} language={language}>
                        {necessary ? null : (
                          <label className="ck-switch ck-switch--small">
                            <input
                              type="checkbox"
                              role="switch"
                              checked={draftGranted(draft, plugin)}
                              onChange={(e) => toggleService(plugin, e.currentTarget.checked)}
                              aria-label={`${texts.allowService}: ${plugin.meta.name}`}
                              data-testid={`service-${plugin.id}-${id}`}
                            />
                            <span className="ck-switch__track" aria-hidden="true" />
                            <span className="ck-switch__text">{texts.allowService}</span>
                          </label>
                        )}
                      </ServiceDetails>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
          <Links config={config} texts={texts} />
          {state.consentId ? (
            <p className="ck-consent-id">
              {texts.consentIdLabel}: <code data-testid="consent-id">{state.consentId}</code>
            </p>
          ) : null}
        </div>
        <div className="ck-actions ck-dialog__footer">
          <button type="button" className="ck-btn" onClick={() => finish(rejectAll)}>
            {texts.rejectAll}
          </button>
          <button type="button" className="ck-btn" onClick={() => finish(() => setCategories(draft.categories, draft.services))}>
            {texts.save}
          </button>
          <button type="button" className="ck-btn" onClick={() => finish(acceptAll)}>
            {texts.acceptAll}
          </button>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- Gesamt-UI

export interface ConsentUIProps {
  /** Betreiber der Website (wird beim eigenen Einwilligungs-Cookie als Anbieter angezeigt). */
  owner?: string;
}

/**
 * Fertige Oberfläche: Banner (wenn noch nicht entschieden) und Einstellungsdialog
 * (über openSettings() bzw. den Footer-Link). Muss innerhalb von <ConsentProvider> stehen.
 * CSS einbinden: import 'consent-kit/ui.css'
 */
export function ConsentUI({ owner }: ConsentUIProps = {}) {
  const { config } = useConsentContext();
  const { state, ready } = useConsent();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const pathname = usePathname();
  const host = usePortalHost();
  const style = useMemo(() => buildThemeCss(config), [config]);

  useEffect(() => getManager().on('ui:open-settings', () => setSettingsOpen(true)), []);

  if (!ready || !host) return null;
  // Auf Impressum/Datenschutz nie blockieren: dort immer das nicht-modale Banner unten.
  const position = config.ui?.position === 'center' && !isLegalPage(config, pathname) ? 'center' : 'bottom';

  return createPortal(
    <div className="ck-root" data-ck-scheme={config.ui?.colorScheme ?? 'auto'}>
      {style ? <style>{style}</style> : null}
      {!state.decided && !settingsOpen ? (
        <ConsentBanner position={position} onOpenSettings={() => setSettingsOpen(true)} />
      ) : null}
      {settingsOpen ? <ConsentSettings owner={owner} onClose={() => setSettingsOpen(false)} /> : null}
    </div>,
    host,
  );
}
