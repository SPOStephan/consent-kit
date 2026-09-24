import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  autoTrackRouteChanges,
  formatText,
  getManager,
  init,
  resolveLanguage,
  resolveTexts,
  type ConsentConfig,
  type ConsentState,
  type Language,
  type Texts,
} from 'consent-kit';

interface ConsentContextValue {
  config: ConsentConfig;
  language: Language;
  texts: Texts;
}

const ConsentContext = createContext<ConsentContextValue | null>(null);

// ---------------------------------------------------------------- Store

let snapshot: { state: ConsentState; ready: boolean } | null = null;

function readSnapshot() {
  const m = getManager();
  const state = m.getState();
  const ready = m.isReady();
  if (
    !snapshot ||
    snapshot.ready !== ready ||
    JSON.stringify(snapshot.state) !== JSON.stringify(state)
  ) {
    snapshot = { state, ready };
  }
  return snapshot;
}

function subscribe(callback: () => void): () => void {
  const m = getManager();
  const offs = [m.on('consent:ready', callback), m.on('consent:changed', callback)];
  return () => offs.forEach((off) => off());
}

const serverSnapshot = {
  state: {
    decided: false,
    consentId: '',
    timestamp: '',
    configVersion: '',
    categories: { necessary: true },
    services: {},
    gpc: false,
  } as ConsentState,
  ready: false,
};

// ---------------------------------------------------------------- Provider

export interface ConsentProviderProps {
  /** Ihre Konfiguration aus consent.config.ts. */
  config: ConsentConfig;
  children?: ReactNode;
}

/**
 * Startet consent-kit und stellt den Zustand für useConsent(), <ConsentGate> und
 * die Standard-UI bereit. Einmal um die App legen (z. B. in main.tsx).
 */
export function ConsentProvider({ config, children }: ConsentProviderProps) {
  useEffect(() => {
    init(config);
  }, [config]);

  const value = useMemo<ConsentContextValue>(() => {
    const language = resolveLanguage(config);
    return { config, language, texts: resolveTexts(config, language) };
  }, [config]);

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

/** Konfiguration, Sprache und Texte (nur innerhalb von <ConsentProvider>). */
export function useConsentContext(): ConsentContextValue {
  const ctx = useContext(ConsentContext);
  if (!ctx) throw new Error('consent-kit: useConsent() muss innerhalb von <ConsentProvider> verwendet werden.');
  return ctx;
}

export interface UseConsentResult {
  /** Aktueller Zustand. */
  state: ConsentState;
  /** true, sobald init() gelaufen ist (im Browser). */
  ready: boolean;
  /** true, wenn der Besucher über das Banner entschieden hat. */
  decided: boolean;
  hasConsent(categoryOrServiceId: string): boolean;
  acceptAll(): void;
  rejectAll(): void;
  setCategories(categories: Record<string, boolean>, services?: Record<string, boolean>): void;
  setService(serviceId: string, granted: boolean): void;
  openSettings(): void;
}

/** Zugriff auf den Einwilligungszustand und die Aktionen. */
export function useConsent(): UseConsentResult {
  const { state, ready } = useSyncExternalStore(subscribe, readSnapshot, () => serverSnapshot);
  return useMemo(() => {
    const m = getManager();
    return {
      state,
      ready,
      decided: state.decided,
      // state wird genutzt, damit Komponenten bei Änderungen neu rendern.
      hasConsent: (id: string) => (ready ? m.hasConsent(id) : false),
      acceptAll: () => m.acceptAll(),
      rejectAll: () => m.rejectAll(),
      setCategories: (c: Record<string, boolean>, s?: Record<string, boolean>) => m.setCategories(c, s),
      setService: (id: string, granted: boolean) => m.setService(id, granted),
      openSettings: () => m.openSettings(),
    };
  }, [state, ready]);
}

// ---------------------------------------------------------------- PageViews

/**
 * Meldet Routenwechsel an consent-kit, damit aktive Dienste genau einen PageView
 * senden (erster Seitenaufruf wird nicht doppelt gezählt).
 *
 * Mit React Router:
 *   const location = useLocation();
 *   usePageViews(location);
 *
 * Ohne Router: usePageViews() – erkennt Wechsel über die History-API.
 */
export function usePageViews(location?: string | { pathname: string; search?: string }): void {
  const path = location === undefined ? undefined : typeof location === 'string' ? location : location.pathname + (location.search ?? '');
  const auto = path === undefined;

  useEffect(() => {
    if (!auto) return;
    return autoTrackRouteChanges();
  }, [auto]);

  useEffect(() => {
    if (path === undefined) return;
    getManager().notifyRouteChange(path);
  }, [path]);
}

/** Komponenten-Variante von usePageViews() – z. B. <PageViews path={location.pathname} />. */
export function PageViews({ path }: { path?: string }) {
  usePageViews(path);
  return null;
}

// ---------------------------------------------------------------- Links

export interface CookieSettingsLinkProps {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** Button im Link-Stil für den Footer: öffnet die Cookie-Einstellungen. */
export function CookieSettingsLink({ children, className, style }: CookieSettingsLinkProps) {
  const ctx = useContext(ConsentContext);
  return (
    <button
      type="button"
      className={className ?? 'ck-settings-link'}
      style={style}
      onClick={() => getManager().openSettings()}
    >
      {children ?? ctx?.texts.settingsTitle ?? 'Cookie-Einstellungen'}
    </button>
  );
}

// ---------------------------------------------------------------- ConsentGate

export interface ConsentGateProps {
  /** ID des Dienstes, z. B. "youtube" oder "google-maps". */
  service: string;
  /** Inhalt, der erst nach Einwilligung gerendert wird (z. B. das <iframe>). */
  children: ReactNode | (() => ReactNode);
  /** Eigener Platzhalter statt des Standard-Platzhalters. */
  placeholder?: ReactNode | ((load: () => void) => ReactNode);
  /** Seitenverhältnis des Platzhalters, z. B. "16 / 9". */
  aspectRatio?: string;
  className?: string;
}

/**
 * Zeigt einen Platzhalter mit Hinweis und Button "Inhalt laden". Erst nach Klick
 * (Einwilligung für genau diesen Dienst) oder vorhandener Einwilligung wird der
 * Inhalt gerendert – vorher geht kein Request an den Anbieter.
 */
export function ConsentGate({ service, children, placeholder, aspectRatio, className }: ConsentGateProps) {
  const { config, texts, language } = useConsentContext();
  const { hasConsent, setService } = useConsent();
  const load = useCallback(() => setService(service, true), [service, setService]);

  if (hasConsent(service)) return <>{typeof children === 'function' ? children() : children}</>;
  if (placeholder !== undefined) return <>{typeof placeholder === 'function' ? placeholder(load) : placeholder}</>;

  const plugin = config.services.find((p) => p.id === service);
  const name = plugin?.meta.name ?? service;
  const third = plugin?.meta.thirdCountryTransfer?.[language];
  const thirdText = third ? (language === 'de' ? `, ggf. auch in Drittländer (${third})` : `, possibly also to third countries (${third})`) : '';

  return (
    <div
      className={['ck-gate', className].filter(Boolean).join(' ')}
      data-ck-scheme={config.ui?.colorScheme ?? 'auto'}
      style={aspectRatio ? { aspectRatio } : undefined}
      role="group"
      aria-label={`${texts.gateTitle}: ${name}`}
    >
      <div className="ck-gate__inner">
        <p className="ck-gate__title">{texts.gateTitle}: {name}</p>
        <p className="ck-gate__text">
          {formatText(texts.gateDescription, { service: name, provider: plugin?.meta.provider ?? '', thirdCountry: thirdText })}
          {plugin?.meta.privacyPolicyUrl ? (
            <>
              {' '}
              <a href={plugin.meta.privacyPolicyUrl} target="_blank" rel="noopener noreferrer">
                {texts.privacyPolicy}
              </a>
            </>
          ) : null}
        </p>
        <button type="button" className="ck-btn" onClick={load}>
          {texts.gateLoad}
        </button>
        <p className="ck-gate__hint">{formatText(texts.gateAlwaysAllow, { service: name })}</p>
      </div>
    </div>
  );
}

export type { ConsentConfig, ConsentState } from 'consent-kit';
