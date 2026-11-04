import { C as ConsentConfig, a as ConsentState } from './types-9jtg_RQh.js';

/** Cookie-Header (string) oder bereits geparste Cookies (z. B. `req.cookies` in Next.js/Vercel). */
type CookieSource = string | null | undefined | Record<string, string | undefined>;
/** Liest einen Cookie aus einem `Cookie`-Header oder einem Cookie-Objekt (Wert bleibt URL-kodiert). */
declare function readCookieFrom(source: CookieSource, name: string): string | undefined;
/** Einwilligungszustand aus dem Cookie der Anfrage (gleiche Regeln wie im Browser). */
declare function readConsentState(source: CookieSource, config: ConsentConfig, now?: number): ConsentState;
/**
 * Liegt eine Einwilligung für einen Dienst (Plugin-ID, z. B. "meta-pixel") oder eine
 * Kategorie (z. B. "marketing") vor? Ohne gültige Entscheidung immer `false`
 * (außer für "necessary").
 */
declare function hasServerConsent(source: CookieSource, config: ConsentConfig, categoryOrServiceId: string, now?: number): boolean;
/** Meta-Browser-Kennungen für die Conversions API (`fbp`, `fbc`) aus den Cookies `_fbp`/`_fbc`. */
declare function readMetaBrowserIds(source: CookieSource): {
    fbp?: string;
    fbc?: string;
};

export { type CookieSource, hasServerConsent, readConsentState, readCookieFrom, readMetaBrowserIds };
