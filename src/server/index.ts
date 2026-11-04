/**
 * consent-kit/server – Einwilligung serverseitig auswerten (z. B. vor einem Meta-Conversions-API-
 * oder TikTok-Events-API-Aufruf). Liest denselben First-Party-Cookie wie der Browser und wendet
 * dieselben Regeln an (Konfig-Version, Ablauf nach 12 Monaten, Einzelentscheidungen je Dienst).
 *
 * Läuft in Node, Edge-Runtimes und Serverless-Funktionen – ohne DOM und ohne React.
 *
 * Hinweis: Die Entscheidung liegt im Cookie des Besuchers. Für Ereignisse ohne Browser-Anfrage
 * (z. B. Zahlungs-Webhooks) muss der Zustand zum Zeitpunkt der Handlung gespeichert und später
 * verwendet werden – siehe docs/SERVER.md.
 */
import {
  categoryIds,
  consentCookieName,
  isServiceGranted,
  stateFromCookieValue,
} from '../core/manager';
import type { ConsentConfig, ConsentState } from '../core/types';

/** Cookie-Header (string) oder bereits geparste Cookies (z. B. `req.cookies` in Next.js/Vercel). */
export type CookieSource = string | null | undefined | Record<string, string | undefined>;

/** Liest einen Cookie aus einem `Cookie`-Header oder einem Cookie-Objekt (Wert bleibt URL-kodiert). */
export function readCookieFrom(source: CookieSource, name: string): string | undefined {
  if (!source) return undefined;
  if (typeof source !== 'string') {
    const value = source[name];
    // Frameworks dekodieren Cookie-Werte teils schon – für einheitliche Auswertung neu kodieren.
    return value === undefined ? undefined : value.includes('%') ? value : encodeURIComponent(value);
  }
  for (const part of source.split(/;\s*/)) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return undefined;
}

/** Einwilligungszustand aus dem Cookie der Anfrage (gleiche Regeln wie im Browser). */
export function readConsentState(source: CookieSource, config: ConsentConfig, now?: number): ConsentState {
  return stateFromCookieValue(readCookieFrom(source, consentCookieName(config)), config, { now });
}

/**
 * Liegt eine Einwilligung für einen Dienst (Plugin-ID, z. B. "meta-pixel") oder eine
 * Kategorie (z. B. "marketing") vor? Ohne gültige Entscheidung immer `false`
 * (außer für "necessary").
 */
export function hasServerConsent(
  source: CookieSource,
  config: ConsentConfig,
  categoryOrServiceId: string,
  now?: number,
): boolean {
  if (categoryOrServiceId === 'necessary') return true;
  const state = readConsentState(source, config, now);
  const plugin = config.services.find((p) => p.id === categoryOrServiceId);
  if (plugin) return isServiceGranted(plugin, state);
  if (!categoryIds(config).includes(categoryOrServiceId)) return false;
  return state.decided && state.categories[categoryOrServiceId] === true;
}

/** Meta-Browser-Kennungen für die Conversions API (`fbp`, `fbc`) aus den Cookies `_fbp`/`_fbc`. */
export function readMetaBrowserIds(source: CookieSource): { fbp?: string; fbc?: string } {
  const decode = (value: string | undefined) => {
    if (!value) return undefined;
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  };
  const fbp = decode(readCookieFrom(source, '_fbp'));
  const fbc = decode(readCookieFrom(source, '_fbc'));
  return { ...(fbp ? { fbp } : {}), ...(fbc ? { fbc } : {}) };
}
