import { C as ConsentConfig, a as ConsentState, b as ConsentPlugin, c as ConsentEvent, d as ConsentEventMap, S as ServiceMeta, L as Language, T as Texts, e as CookiePattern, f as CategoryId } from './types-9jtg_RQh.cjs';
export { B as BuiltInCategory, g as CategoryDefinition, h as ConsentAction, i as CookieInfo, D as DeepPartial, j as LocalizedText, P as PluginContext, R as RouteInfo, k as ThemeVariables } from './types-9jtg_RQh.cjs';

declare const BUILT_IN_CATEGORIES: readonly ["necessary", "statistics", "marketing"];
type Handler<E extends ConsentEvent> = (payload: ConsentEventMap[E]) => void;
/** Kategorien eines Dienstes als Array. */
declare function serviceCategories(plugin: Pick<ConsentPlugin, 'category'>): readonly string[];
declare class ConsentManager {
    config: ConsentConfig | undefined;
    private state;
    private readonly handlers;
    /** Dienste, deren onGrant auf dieser Seite bereits lief (Skripte geladen). */
    private readonly active;
    private readonly initializedPlugins;
    private lastPath;
    private lastUrl;
    private ready;
    private reloadScheduled;
    private reloadRequested;
    /** Initialisiert consent-kit. Mehrfacher Aufruf ist unschädlich (StrictMode, Hot Reload). */
    init(config: ConsentConfig): ConsentState;
    isReady(): boolean;
    /** Aktueller Zustand (Kopie). */
    getState(): ConsentState;
    /** Alle Kategorie-IDs (eingebaut + eigene). */
    getCategoryIds(): string[];
    getServices(): readonly ConsentPlugin[];
    /** Prüft die Einwilligung für eine Kategorie oder einen Dienst (per ID). */
    hasConsent(id: string): boolean;
    /** Alle Kategorien erlauben (bei aktivem GPC ohne Marketing). */
    acceptAll(): void;
    /** Alles außer "notwendig" ablehnen. */
    rejectAll(): void;
    /**
     * Kategorien einzeln setzen, z. B. setCategories({ statistics: true, marketing: false }).
     * Nicht genannte Kategorien werden abgelehnt. Optional können einzelne Dienste
     * abweichend erlaubt/abgelehnt werden.
     */
    setCategories(categories: Record<string, boolean>, services?: Record<string, boolean>): void;
    /**
     * Einwilligung für genau einen Dienst (z. B. "Inhalt laden" bei einem YouTube-Video).
     * Die übrige Auswahl bleibt unverändert; das Banner bleibt sichtbar, solange noch
     * nicht entschieden wurde.
     */
    setService(serviceId: string, granted: boolean): void;
    /** Öffnet den Einstellungsdialog (für den Footer-Link "Cookie-Einstellungen"). */
    openSettings(): void;
    /** Abonniert ein Ereignis. Gibt eine Funktion zum Abbestellen zurück. */
    on<E extends ConsentEvent>(event: E, handler: Handler<E>): () => void;
    /**
     * Meldet einen Routenwechsel in einer Single-Page-App. Aktive Dienste senden
     * dann einen PageView. Der erste Seitenaufruf wird ignoriert (den senden die
     * Dienste beim Laden selbst), ebenso doppelte Meldungen desselben Pfads.
     */
    notifyRouteChange(path?: string): void;
    /** Löscht die gespeicherte Entscheidung (z. B. für Tests). Keine Revoke-Signale. */
    forget(): void;
    private decide;
    private apply;
    /** Ruft onConsent / onRevoke / onGrant der Plugins passend zum Zustand auf. */
    private applyPlugins;
    /** Löscht bekannte Cookies aller Dienste ohne Einwilligung. */
    private cleanupCookies;
    private isGranted;
    private gpcActive;
    private context;
    private readonly log;
    private safe;
    private emit;
    private load;
    private save;
    private sendLog;
}

declare const defaultTexts: Record<Language, Texts>;
/** Ermittelt die Sprache der Oberfläche. */
declare function resolveLanguage(config: Pick<ConsentConfig, 'language'>): Language;
/** Standardtexte + eigene Kategorien + Overrides aus der Konfiguration. */
declare function resolveTexts(config: ConsentConfig, language?: Language): Texts;
/** Ersetzt {platzhalter} in einem Text. */
declare function formatText(template: string, values: Record<string, string>): string;
/**
 * Angaben zum eigenen Einwilligungs-Cookie (Kategorie "notwendig") – für Dialog
 * und Datenschutz-Tabelle. MUSTERTEXT – rechtlich prüfen lassen.
 */
declare function consentCookieMeta(config: ConsentConfig, owner?: string): ServiceMeta;

/**
 * Fügt ein externes Skript dynamisch per <script>-Element ein.
 * Dasselbe Skript (gleiche src) wird nie doppelt eingefügt – auch nicht nach
 * Hot Reload oder mehrfachem init().
 */
declare function loadScript(src: string, attributes?: Record<string, string>): Promise<void>;

/** Prüft, ob ein Cookie-Name auf ein Muster passt ("_ga*" = Präfix-Wildcard). */
declare function matchesPattern(name: string, pattern: CookiePattern): boolean;
/**
 * Löscht alle Cookies, deren Name auf eines der Muster passt – für alle
 * möglichen Domains und den Pfad "/". Gibt die gelöschten Namen zurück.
 */
declare function deleteCookies(patterns: readonly CookiePattern[]): string[];

interface GoogleTagManagerOptions {
    /** GTM-Container-ID, z. B. "GTM-ABC1234". */
    id: `GTM-${string}`;
    /**
     * Welche Google-Dienste über GTM laufen. Bestimmt die Kategorien und die
     * Angaben im Einstellungsdialog. Standard: beide true.
     */
    analytics?: boolean;
    ads?: boolean;
    /** Name des dataLayer. Standard: "dataLayer". */
    dataLayerName?: string;
    /**
     * Herkunft des GTM-Skripts, z. B. für Server-Side-Tagging mit eigener Domain.
     * Standard: "https://www.googletagmanager.com".
     */
    scriptOrigin?: string;
    /** GTM-Umgebung (Environments), optional. */
    environment?: {
        auth: string;
        preview: string;
    };
    /** Name des dataLayer-Events nach jeder Entscheidung. Standard: "consent_update". */
    consentEvent?: string;
    /** Name des dataLayer-Events bei Routenwechsel (SPA). Standard: "virtual_pageview". */
    pageViewEvent?: string;
    /** Anzeigen-Daten schwärzen, solange ad_storage verweigert ist. Standard: true. */
    adsDataRedaction?: boolean;
    /** URL-Passthrough für Google Ads. Standard: false. */
    urlPassthrough?: boolean;
    /**
     * ⚠️ RECHTLICH RISKANT – nur nach Rücksprache mit Ihrer Rechtsberatung aktivieren!
     *
     * Lädt den Google Tag Manager bereits VOR der Einwilligung (Consent Mode
     * "advanced"). Dadurch gehen schon vor jeder Entscheidung Requests an Google
     * (u. a. cookielose Pings mit IP-Adresse und Geräteinformationen). Das ist nach
     * § 25 TDDDG / DSGVO umstritten. Standard: false ("strict mode").
     */
    loadBeforeConsent?: boolean;
}
declare const GOOGLE_ANALYTICS_COOKIE_PATTERNS: readonly CookiePattern[];
declare const GOOGLE_ADS_COOKIE_PATTERNS: readonly CookiePattern[];
/**
 * Google Tag Manager mit Google Consent Mode v2.
 *
 * - Beim Start: dataLayer + gtag anlegen und Consent-Defaults setzen (alles
 *   "denied" außer security_storage). Dabei geht KEIN Request an Google.
 * - Nach Einwilligung: gtag('consent', 'update', …) je Kategorie, Event
 *   "consent_update" ins dataLayer, danach GTM laden.
 * - Bei Routenwechsel: Event "virtual_pageview" ins dataLayer.
 */
declare function googleTagManager(options: GoogleTagManagerOptions): ConsentPlugin;

/**
 * Meta Pixel wird ENTWEDER über consent-kit ODER über GTM eingebunden – nie beides,
 * sonst wird doppelt gezählt.
 */
type MetaPixelOptions = {
    /** Pixel-ID (nur Ziffern), z. B. "123456789012345". */
    id: string;
    /** "kit" (Standard): consent-kit lädt den Pixel und sendet PageViews. */
    loadVia?: 'kit';
    /** Bei Routenwechsel PageView senden. Standard: true. */
    trackRouteChanges?: boolean;
} | {
    /**
     * "gtm": Der Pixel ist als Tag in GTM eingerichtet. consent-kit lädt dann
     * KEIN Skript, zeigt den Dienst aber im Dialog an, sendet beim Widerruf
     * fbq('consent', 'revoke') und löscht die Cookies.
     */
    loadVia: 'gtm';
    id?: string;
};
declare function metaPixel(options: MetaPixelOptions): ConsentPlugin;

/**
 * TikTok Pixel wird ENTWEDER über consent-kit ODER über GTM eingebunden – nie beides,
 * sonst wird doppelt gezählt.
 */
type TikTokPixelOptions = {
    /** Pixel-ID, z. B. "C1ABCDEF2GHIJKLMN3OP". */
    id: string;
    /** "kit" (Standard): consent-kit lädt den Pixel und sendet PageViews. */
    loadVia?: 'kit';
    /** Bei Routenwechsel ttq.page() senden. Standard: true. */
    trackRouteChanges?: boolean;
} | {
    /**
     * "gtm": Der Pixel ist als Tag in GTM eingerichtet. consent-kit lädt dann
     * KEIN Skript, zeigt den Dienst aber im Dialog an, sendet beim Widerruf
     * ttq.revokeConsent() und löscht die Cookies.
     */
    loadVia: 'gtm';
    id?: string;
};
declare function tiktokPixel(options: TikTokPixelOptions): ConsentPlugin;

interface EmbedOptions {
    /** Kategorie. Standard: "marketing". Tipp: eigene Kategorie "media" anlegen. */
    category?: CategoryId;
    /** Angaben überschreiben (z. B. Zweck). */
    meta?: Partial<ServiceMeta>;
}
/**
 * YouTube-Videos. Wird zusammen mit <ConsentGate service="youtube"> verwendet.
 * Tipp: youtube-nocookie.com als Einbettungs-Domain verwenden.
 */
declare function youtube(options?: EmbedOptions): ConsentPlugin;
/** Google Maps. Wird zusammen mit <ConsentGate service="google-maps"> verwendet. */
declare function googleMaps(options?: EmbedOptions): ConsentPlugin;
/** Beliebiger eingebetteter Inhalt (z. B. Vimeo, Calendly) – für <ConsentGate>. */
declare function embed(options: {
    id: string;
    category?: CategoryId;
    meta: ServiceMeta;
}): ConsentPlugin;

/**
 * consent-kit – Core (framework-unabhängig, ohne React).
 *
 * Hinweis: consent-kit ist ein technisches Werkzeug. Ob eine Website damit die
 * rechtlichen Anforderungen erfüllt, hängt von Konfiguration, Texten und den
 * eingesetzten Diensten ab – bitte rechtlich prüfen lassen.
 */

/**
 * Die Instanz liegt global, damit auch bei Hot Reload oder mehrfach gebündelten
 * Kopien immer derselbe Zustand verwendet wird.
 */
declare function getManager(): ConsentManager;
/** Hilfsfunktion für eine vollständig typisierte consent.config.ts. */
declare function defineConfig(config: ConsentConfig): ConsentConfig;
/** Hilfsfunktion für eigene Dienste (Plugins). */
declare function definePlugin(plugin: ConsentPlugin): ConsentPlugin;
/** Startet consent-kit. Mehrfacher Aufruf ist unschädlich. */
declare function init(config: ConsentConfig): ConsentState;
/** Alle Kategorien erlauben. */
declare function acceptAll(): void;
/** Alles außer "notwendig" ablehnen. */
declare function rejectAll(): void;
/** Kategorien einzeln setzen, z. B. setCategories({ statistics: true }). */
declare function setCategories(categories: Record<string, boolean>, services?: Record<string, boolean>): void;
/** Einwilligung für genau einen Dienst erteilen oder entziehen. */
declare function setService(serviceId: string, granted: boolean): void;
/** Öffnet den Einstellungsdialog – z. B. für den Footer-Link "Cookie-Einstellungen". */
declare function openSettings(): void;
/** Aktueller Einwilligungszustand. */
declare function getState(): ConsentState;
/** Einwilligung für Kategorie oder Dienst vorhanden? */
declare function hasConsent(categoryOrServiceId: string): boolean;
/** Ereignis abonnieren: consent:ready, consent:changed, consent:revoked. */
declare function on<E extends ConsentEvent>(event: E, handler: (payload: ConsentEventMap[E]) => void): () => void;
/**
 * Meldet einen Routenwechsel (Single-Page-App). Aktive Dienste senden genau einen
 * PageView. Ohne Argument wird location.pathname + location.search verwendet.
 */
declare function notifyRouteChange(path?: string): void;
/**
 * Erkennt Routenwechsel automatisch (history.pushState/replaceState/popstate) –
 * für Seiten ohne React Router. Gibt eine Stop-Funktion zurück.
 */
declare function autoTrackRouteChanges(): () => void;

export { BUILT_IN_CATEGORIES, CategoryId, ConsentConfig, ConsentEvent, ConsentEventMap, ConsentManager, ConsentPlugin, ConsentState, CookiePattern, type EmbedOptions, GOOGLE_ADS_COOKIE_PATTERNS, GOOGLE_ANALYTICS_COOKIE_PATTERNS, type GoogleTagManagerOptions, Language, type MetaPixelOptions, ServiceMeta, Texts, type TikTokPixelOptions, acceptAll, autoTrackRouteChanges, consentCookieMeta, defaultTexts, defineConfig, definePlugin, deleteCookies, embed, formatText, getManager, getState, googleMaps, googleTagManager, hasConsent, init, loadScript, matchesPattern, metaPixel, notifyRouteChange, on, openSettings, rejectAll, resolveLanguage, resolveTexts, serviceCategories, setCategories, setService, tiktokPixel, youtube };
