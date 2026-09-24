import { Language, DeepPartial, Texts, ThemeVariables, ConsentPlugin, ConsentConfig } from 'consent-kit';

/**
 * consent-kit/remote – Einstellungen zentral aus dem consent-kit Backend laden.
 *
 * Das Backend liefert eine reine Daten-Beschreibung (JSON) der Website. Diese wird
 * hier in eine normale ConsentConfig mit den eingebauten Plugins übersetzt.
 * Unbekannte oder ungültige Einträge werden ignoriert (lieber ein Dienst zu wenig
 * als ein falsch konfigurierter).
 */

/** Dienst-Beschreibung im Remote-Format. */
type RemoteService = {
    type: 'google-tag-manager';
    id: string;
    analytics?: boolean;
    ads?: boolean;
} | {
    type: 'meta-pixel';
    id?: string;
    loadVia?: 'kit' | 'gtm';
} | {
    type: 'tiktok-pixel';
    id?: string;
    loadVia?: 'kit' | 'gtm';
} | {
    type: 'youtube';
} | {
    type: 'google-maps';
};
/** Einstellungen einer Website, wie sie das Backend unter /config/<siteId> ausliefert. */
interface RemoteSiteConfig {
    schema: 1;
    siteId: string;
    version: number;
    language?: Language | 'auto';
    owner?: string;
    links: {
        imprint: string;
        privacy: string;
    };
    cookieDomain?: string;
    respectGpc?: boolean;
    services: RemoteService[];
    texts?: Partial<Record<Language, DeepPartial<Texts>>>;
    ui?: {
        position?: 'bottom' | 'center';
        colorScheme?: 'auto' | 'light' | 'dark';
        theme?: ThemeVariables;
        darkTheme?: ThemeVariables;
    };
    logging?: {
        endpoint: string;
    };
}
interface RemoteOptions {
    /** Adresse des Backends, z. B. "https://consent.meine-firma.de". */
    endpoint: string;
    /** Kennung der Website im Backend, z. B. "meine-seite". */
    siteId: string;
    /**
     * Rückfallebene, falls das Backend nicht erreichbar ist (vom Backend als
     * „Einbau-Code“ mitgeliefert). Ohne Rückfallebene lädt dann gar nichts.
     */
    fallback?: RemoteSiteConfig;
    /** Zusätzliche eigene Dienste (Plugins), z. B. linkedinInsight('123'). */
    services?: ConsentPlugin[];
    /** Zeitlimit in ms. Standard: 4000. */
    timeout?: number;
    /** Konsolenausgaben. */
    debug?: boolean;
}
/** Übersetzt die Remote-Beschreibung in eine ConsentConfig. */
declare function fromRemoteConfig(remote: RemoteSiteConfig, extraServices?: ConsentPlugin[]): ConsentConfig;
/** Lädt die Einstellungen vom Backend (mit Zeitlimit) und fällt ggf. auf `fallback` zurück. */
declare function loadRemoteConfig(options: RemoteOptions): Promise<ConsentConfig>;

export { type RemoteOptions, type RemoteService, type RemoteSiteConfig, fromRemoteConfig, loadRemoteConfig };
