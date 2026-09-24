/**
 * Öffentliche Typen von consent-kit.
 *
 * Alles hier ist bewusst streng typisiert, damit Tippfehler in der
 * consent.config.ts sofort im Editor auffallen.
 */
/** Unterstützte Sprachen der Standardtexte. */
type Language = 'de' | 'en';
/** Ein Text in allen unterstützten Sprachen. */
type LocalizedText = Record<Language, string>;
/** Eingebaute Kategorien. Weitere können über `config.categories` ergänzt werden. */
type BuiltInCategory = 'necessary' | 'statistics' | 'marketing';
/** Kategorie-ID (eingebaut oder eigene). */
type CategoryId = BuiltInCategory | (string & {});
/** Beschreibung eines vom Dienst gesetzten Cookies (für Dialog und Datenschutz-Tabelle). */
interface CookieInfo {
    /** Name oder Muster, z. B. "_ga" oder "_ga_<ID>". */
    name: string;
    /** Speicherdauer in Worten, z. B. { de: '2 Jahre', en: '2 years' }. */
    duration: LocalizedText;
    /** Optional: Zweck dieses einzelnen Cookies. */
    purpose?: LocalizedText;
}
/** Anbieterinformationen eines Dienstes – werden im Einstellungsdialog angezeigt. */
interface ServiceMeta {
    /** Name des Dienstes, z. B. "Meta Pixel". */
    name: string;
    /** Anbieter inkl. Anschrift, z. B. "Meta Platforms Ireland Ltd., ...". */
    provider: string;
    /** Zweck der Verarbeitung. */
    purpose: LocalizedText;
    /** Gesetzte Cookies. Leeres Array = keine Cookies bekannt. */
    cookies: CookieInfo[];
    /**
     * Übermittlung in Drittländer, z. B. { de: 'USA (EU-US Data Privacy Framework)', ... }.
     * `null` = keine Drittlandübermittlung bekannt.
     */
    thirdCountryTransfer: LocalizedText | null;
    /** Link zur Datenschutzerklärung des Anbieters. */
    privacyPolicyUrl: string;
}
/** Muster zum Löschen von Cookies: exakter Name, Wildcard ("_ga*") oder RegExp. */
type CookiePattern = string | RegExp;
/** Information über einen Routenwechsel in einer Single-Page-App. */
interface RouteInfo {
    /** Pfad inkl. Query, z. B. "/produkte?seite=2". */
    path: string;
    /** Vollständige URL. */
    url: string;
    /** Dokumenttitel zum Zeitpunkt des Wechsels. */
    title: string;
    /** Vorherige URL. */
    referrer: string;
}
/** Kontext, der an Plugin-Hooks übergeben wird. */
interface PluginContext {
    /** Aktueller Einwilligungszustand. */
    readonly state: ConsentState;
    /** Prüft Einwilligung für eine Kategorie oder einen Dienst. */
    hasConsent(categoryOrServiceId: string): boolean;
    /** Fügt ein <script> ein – nie doppelt (gleiche src wird nur einmal geladen). */
    loadScript(src: string, attributes?: Record<string, string>): Promise<void>;
    /** Debug-Ausgabe (nur wenn `debug: true`). */
    log(...args: unknown[]): void;
    /**
     * Fordert nach der aktuellen Entscheidung einen Seiten-Reload an (z. B. wenn
     * ein Teil-Widerruf ein bereits geladenes Skript betrifft).
     */
    requestReload(): void;
}
/**
 * Plugin-Interface für einen Dienst.
 *
 * Reihenfolge beim Start: `onInit` (immer, auch ohne Einwilligung – darf NICHTS
 * laden und KEINE Requests auslösen) → `onConsent` (mit gespeichertem Zustand)
 * → `onGrant` (nur wenn eingewilligt).
 */
interface ConsentPlugin {
    /** Eindeutige ID, z. B. "google-tag-manager". */
    id: string;
    /**
     * Kategorie(n). Bei mehreren Kategorien gilt der Dienst als erlaubt, sobald
     * EINE davon erlaubt ist (z. B. GTM für Statistik UND Marketing).
     */
    category: CategoryId | readonly CategoryId[];
    /** Anbieterinformationen für Dialog und Datenschutz-Tabelle. */
    meta: ServiceMeta;
    /** Cookies, die beim Widerruf gelöscht werden. */
    cookiePatterns?: readonly CookiePattern[];
    /** Wird bei jedem Start aufgerufen. Darf nichts nachladen! */
    onInit?(ctx: PluginContext): void;
    /** Wird bei jeder Zustandsänderung (und einmal beim Start) aufgerufen. */
    onConsent?(ctx: PluginContext): void;
    /** Wird höchstens einmal pro Seitenaufruf aufgerufen, sobald eingewilligt ist. */
    onGrant?(ctx: PluginContext): void;
    /** Wird aufgerufen, wenn eine erteilte Einwilligung widerrufen wird. */
    onRevoke?(ctx: PluginContext): void;
    /** Wird bei Routenwechseln aufgerufen – nur wenn der Dienst aktiv (geladen) ist. */
    onRouteChange?(ctx: PluginContext, route: RouteInfo): void;
}
/** Eigene zusätzliche Kategorie (z. B. "media" für externe Medien). */
interface CategoryDefinition {
    id: string;
    label: LocalizedText;
    description: LocalizedText;
}
/** Texte der Oberfläche. Alle Standardtexte sind MUSTERTEXTE – rechtlich prüfen lassen. */
interface Texts {
    bannerTitle: string;
    bannerDescription: string;
    acceptAll: string;
    rejectAll: string;
    settings: string;
    save: string;
    close: string;
    settingsTitle: string;
    settingsDescription: string;
    imprint: string;
    privacy: string;
    alwaysActive: string;
    showDetails: string;
    hideDetails: string;
    services: string;
    provider: string;
    purpose: string;
    cookies: string;
    duration: string;
    thirdCountry: string;
    noThirdCountry: string;
    noCookies: string;
    privacyPolicy: string;
    allowService: string;
    gpcNotice: string;
    gateTitle: string;
    gateDescription: string;
    gateLoad: string;
    gateAlwaysAllow: string;
    categories: Record<string, {
        label: string;
        description: string;
    }>;
}
/** Tiefe Teil-Überschreibung. */
type DeepPartial<T> = {
    [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};
/** Design-Variablen, werden als CSS-Custom-Properties gesetzt. */
interface ThemeVariables {
    /** Hintergrundfarbe von Banner und Dialog. */
    background?: string;
    /** Textfarbe. */
    text?: string;
    /** Akzentfarbe (Schalter, Links, Fokus). */
    accent?: string;
    /** Hintergrund der Buttons – ALLE Buttons nutzen dieselbe Farbe. */
    buttonBackground?: string;
    /** Textfarbe der Buttons. */
    buttonText?: string;
    /** Rahmenfarbe. */
    border?: string;
    /** Eckenradius, z. B. "12px". */
    radius?: string;
    /** Schriftfamilie – bitte eine lokal eingebundene Schrift verwenden. */
    fontFamily?: string;
    /** Maximale Breite, z. B. "960px". */
    maxWidth?: string;
    /** z-index, z. B. "2147483000". */
    zIndex?: string;
}
/** Konfiguration einer Website (Inhalt der consent.config.ts). */
interface ConsentConfig {
    /**
     * Konfig-Version. Wird sie erhöht (z. B. weil ein neuer Dienst dazukommt),
     * werden alle Besucher erneut gefragt.
     */
    version: number | string;
    /** Sprache der Oberfläche. "auto" = <html lang> bzw. Browsersprache. Standard: "de". */
    language?: Language | 'auto';
    /** Links zu Impressum und Datenschutzerklärung (Pflicht). */
    links: {
        imprint: string;
        privacy: string;
    };
    /** Cookie-Einstellungen für den Einwilligungs-Cookie. */
    cookie?: {
        /** Name des Cookies. Standard: "consent_kit". */
        name?: string;
        /** Domain, z. B. ".meine-seite.de" damit auch Subdomains den Zustand teilen. */
        domain?: string;
        /** Pfad. Standard: "/". */
        path?: string;
        /** Gültigkeit in Tagen. Standard und Maximum: 365 (danach erneute Abfrage). */
        maxAgeDays?: number;
    };
    /** Dienste (Plugins), z. B. googleTagManager({ id: 'GTM-XXXX' }). */
    services: readonly ConsentPlugin[];
    /** Zusätzliche Kategorien neben necessary, statistics, marketing. */
    categories?: readonly CategoryDefinition[];
    /** Optionale Protokollierung jeder Entscheidung (Nachweis). */
    logging?: {
        /** URL des Protokollierungs-Endpunkts (z. B. der Cloudflare Worker). */
        endpoint: string;
    };
    /**
     * Global Privacy Control: Sendet der Browser GPC, wird Marketing bei
     * "Alle akzeptieren" nicht aktiviert. Standard: false.
     */
    respectGpc?: boolean;
    /** Seite nach Widerruf neu laden (Standard: true), da geladene Skripte nicht entladen werden können. */
    reloadOnRevoke?: boolean;
    /** Text-Überschreibungen pro Sprache. */
    texts?: Partial<Record<Language, DeepPartial<Texts>>>;
    /** Darstellung. */
    ui?: {
        /** Position des Banners. Standard: "bottom". */
        position?: 'bottom' | 'center';
        /** Farbschema. Standard: "auto" (folgt dem System). */
        colorScheme?: 'auto' | 'light' | 'dark';
        /** Design-Variablen. */
        theme?: ThemeVariables;
        /** Dark-Mode-Variablen (werden bei dunklem Schema verwendet). */
        darkTheme?: ThemeVariables;
    };
    /** Konsolenausgaben zur Fehlersuche. */
    debug?: boolean;
}
/** Gespeicherter Einwilligungszustand. */
interface ConsentState {
    /** true, sobald der Besucher (für die aktuelle Konfig-Version) entschieden hat. */
    decided: boolean;
    /** Anonyme Consent-ID (UUID). Leer, solange nicht entschieden. */
    consentId: string;
    /** Zeitpunkt der Entscheidung (ISO 8601). Leer, solange nicht entschieden. */
    timestamp: string;
    /** Konfig-Version, für die entschieden wurde. */
    configVersion: string;
    /** Einwilligung je Kategorie. "necessary" ist immer true. */
    categories: Record<string, boolean>;
    /** Individuelle Einwilligungen/Ablehnungen einzelner Dienste (überschreiben die Kategorie). */
    services: Record<string, boolean>;
    /** true, wenn der Browser Global Privacy Control sendet und respectGpc aktiv ist. */
    gpc: boolean;
}
/** Aktion, die zu einer Entscheidung geführt hat (für Protokoll und Events). */
type ConsentAction = 'accept-all' | 'reject-all' | 'custom' | 'service';
interface ConsentEventMap {
    /** Nach init(): Zustand geladen. */
    'consent:ready': {
        state: ConsentState;
    };
    /** Nach jeder Entscheidung. */
    'consent:changed': {
        state: ConsentState;
        previous: ConsentState;
        action: ConsentAction;
    };
    /** Wenn mindestens ein zuvor erlaubter Dienst widerrufen wurde. */
    'consent:revoked': {
        state: ConsentState;
        revokedServices: string[];
    };
    /** openSettings() wurde aufgerufen (für die UI). */
    'ui:open-settings': Record<string, never>;
}
type ConsentEvent = keyof ConsentEventMap;

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
declare function defineConfig<const T extends ConsentConfig>(config: T): T;
/** Hilfsfunktion für eigene Dienste (Plugins). */
declare function definePlugin<const T extends ConsentPlugin>(plugin: T): T;
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

export { BUILT_IN_CATEGORIES, type BuiltInCategory, type CategoryDefinition, type CategoryId, type ConsentAction, type ConsentConfig, type ConsentEvent, type ConsentEventMap, ConsentManager, type ConsentPlugin, type ConsentState, type CookieInfo, type CookiePattern, type DeepPartial, GOOGLE_ADS_COOKIE_PATTERNS, GOOGLE_ANALYTICS_COOKIE_PATTERNS, type GoogleTagManagerOptions, type Language, type LocalizedText, type PluginContext, type RouteInfo, type ServiceMeta, type Texts, type ThemeVariables, acceptAll, autoTrackRouteChanges, defaultTexts, defineConfig, definePlugin, deleteCookies, formatText, getManager, getState, googleTagManager, hasConsent, init, loadScript, matchesPattern, notifyRouteChange, on, openSettings, rejectAll, resolveLanguage, resolveTexts, serviceCategories, setCategories, setService };
