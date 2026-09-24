import * as react from 'react';
import { ReactNode, CSSProperties } from 'react';
import { ConsentConfig, ConsentState, Language, Texts } from 'consent-kit';
export { ConsentConfig, ConsentState } from 'consent-kit';

interface ConsentContextValue {
    config: ConsentConfig;
    language: Language;
    texts: Texts;
}
interface ConsentProviderProps {
    /** Ihre Konfiguration aus consent.config.ts. */
    config: ConsentConfig;
    children?: ReactNode;
}
/**
 * Startet consent-kit und stellt den Zustand für useConsent(), <ConsentGate> und
 * die Standard-UI bereit. Einmal um die App legen (z. B. in main.tsx).
 */
declare function ConsentProvider({ config, children }: ConsentProviderProps): react.JSX.Element;
/** Konfiguration, Sprache und Texte (nur innerhalb von <ConsentProvider>). */
declare function useConsentContext(): ConsentContextValue;
interface UseConsentResult {
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
declare function useConsent(): UseConsentResult;
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
declare function usePageViews(location?: string | {
    pathname: string;
    search?: string;
}): void;
/** Komponenten-Variante von usePageViews() – z. B. <PageViews path={location.pathname} />. */
declare function PageViews({ path }: {
    path?: string;
}): null;
interface CookieSettingsLinkProps {
    children?: ReactNode;
    className?: string;
    style?: CSSProperties;
}
/** Button im Link-Stil für den Footer: öffnet die Cookie-Einstellungen. */
declare function CookieSettingsLink({ children, className, style }: CookieSettingsLinkProps): react.JSX.Element;
interface ConsentGateProps {
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
declare function ConsentGate({ service, children, placeholder, aspectRatio, className }: ConsentGateProps): react.JSX.Element;

export { ConsentGate, type ConsentGateProps, ConsentProvider, type ConsentProviderProps, CookieSettingsLink, type CookieSettingsLinkProps, PageViews, type UseConsentResult, useConsent, useConsentContext, usePageViews };
