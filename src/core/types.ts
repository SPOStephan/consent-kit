/**
 * Öffentliche Typen von consent-kit.
 *
 * Alles hier ist bewusst streng typisiert, damit Tippfehler in der
 * consent.config.ts sofort im Editor auffallen.
 */

/** Unterstützte Sprachen der Standardtexte. */
export type Language = 'de' | 'en';

/** Ein Text in allen unterstützten Sprachen. */
export type LocalizedText = Record<Language, string>;

/** Eingebaute Kategorien. Weitere können über `config.categories` ergänzt werden. */
export type BuiltInCategory = 'necessary' | 'statistics' | 'marketing';

/** Kategorie-ID (eingebaut oder eigene). */
export type CategoryId = BuiltInCategory | (string & {});

/** Beschreibung eines vom Dienst gesetzten Cookies (für Dialog und Datenschutz-Tabelle). */
export interface CookieInfo {
  /** Name oder Muster, z. B. "_ga" oder "_ga_<ID>". */
  name: string;
  /** Speicherdauer in Worten, z. B. { de: '2 Jahre', en: '2 years' }. */
  duration: LocalizedText;
  /** Optional: Zweck dieses einzelnen Cookies. */
  purpose?: LocalizedText;
}

/** Anbieterinformationen eines Dienstes – werden im Einstellungsdialog angezeigt. */
export interface ServiceMeta {
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
export type CookiePattern = string | RegExp;

/** Information über einen Routenwechsel in einer Single-Page-App. */
export interface RouteInfo {
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
export interface PluginContext {
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
export interface ConsentPlugin {
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
export interface CategoryDefinition {
  id: string;
  label: LocalizedText;
  description: LocalizedText;
}

/** Texte der Oberfläche. Alle Standardtexte sind MUSTERTEXTE – rechtlich prüfen lassen. */
export interface Texts {
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
  categories: Record<string, { label: string; description: string }>;
}

/** Tiefe Teil-Überschreibung. */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

/** Design-Variablen, werden als CSS-Custom-Properties gesetzt. */
export interface ThemeVariables {
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
export interface ConsentConfig {
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
export interface ConsentState {
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
export type ConsentAction = 'accept-all' | 'reject-all' | 'custom' | 'service';

export interface ConsentEventMap {
  /** Nach init(): Zustand geladen. */
  'consent:ready': { state: ConsentState };
  /** Nach jeder Entscheidung. */
  'consent:changed': { state: ConsentState; previous: ConsentState; action: ConsentAction };
  /** Wenn mindestens ein zuvor erlaubter Dienst widerrufen wurde. */
  'consent:revoked': { state: ConsentState; revokedServices: string[] };
  /** Routenwechsel wurde gemeldet (notifyRouteChange). */
  'route:changed': { route: RouteInfo };
  /** openSettings() wurde aufgerufen (für die UI). */
  'ui:open-settings': Record<string, never>;
}

export type ConsentEvent = keyof ConsentEventMap;
