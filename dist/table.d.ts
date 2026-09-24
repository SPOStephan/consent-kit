import { Language, ConsentConfig } from 'consent-kit';

/**
 * Erzeugt aus der Konfiguration eine Tabelle aller Dienste für die
 * Datenschutzerklärung (Markdown oder HTML).
 *
 * MUSTERTEXT – RECHTLICH PRÜFEN LASSEN: Die Angaben stammen aus den Plugins bzw.
 * Ihrer Konfiguration und müssen vor der Veröffentlichung geprüft werden.
 */

interface ServiceTableOptions {
    /** Sprache. Standard: Sprache der Konfiguration (bzw. "de"). */
    language?: Language;
    /** Betreiber der Website (wird beim eigenen Einwilligungs-Cookie angezeigt). */
    owner?: string;
    /** Eigenen Einwilligungs-Cookie als "notwendig" aufführen. Standard: true. */
    includeConsentCookie?: boolean;
}
interface ServiceRow {
    name: string;
    category: string;
    provider: string;
    purpose: string;
    cookies: Array<{
        name: string;
        duration: string;
    }>;
    thirdCountry: string;
    privacyPolicyUrl: string;
}
/** Strukturierte Zeilen – falls Sie die Tabelle selbst gestalten möchten. */
declare function getServiceRows(config: ConsentConfig, options?: ServiceTableOptions): ServiceRow[];
/** Tabelle als Markdown. */
declare function toMarkdown(config: ConsentConfig, options?: ServiceTableOptions): string;
/** Tabelle als HTML (ohne eigenes Styling – übernimmt das Design Ihrer Seite). */
declare function toHtml(config: ConsentConfig, options?: ServiceTableOptions): string;

export { type ServiceRow, type ServiceTableOptions, getServiceRows, toHtml, toMarkdown };
