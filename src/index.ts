/**
 * consent-kit – Core (framework-unabhängig, ohne React).
 *
 * Hinweis: consent-kit ist ein technisches Werkzeug. Ob eine Website damit die
 * rechtlichen Anforderungen erfüllt, hängt von Konfiguration, Texten und den
 * eingesetzten Diensten ab – bitte rechtlich prüfen lassen.
 */
import { ConsentManager } from './core/manager';
import type { ConsentConfig, ConsentEvent, ConsentEventMap, ConsentPlugin, ConsentState } from './core/types';

export type * from './core/types';
export { ConsentManager, serviceCategories, BUILT_IN_CATEGORIES } from './core/manager';
export { defaultTexts, resolveLanguage, resolveTexts, formatText, consentCookieMeta } from './core/texts';
export { loadScript } from './core/scripts';
export { deleteCookies, matchesPattern } from './core/cookies';
export { googleTagManager, GOOGLE_ANALYTICS_COOKIE_PATTERNS, GOOGLE_ADS_COOKIE_PATTERNS } from './plugins/google';
export type { GoogleTagManagerOptions } from './plugins/google';
export { metaPixel } from './plugins/meta';
export type { MetaPixelOptions } from './plugins/meta';
export { tiktokPixel } from './plugins/tiktok';
export type { TikTokPixelOptions } from './plugins/tiktok';
export { youtube, googleMaps, embed } from './plugins/embeds';
export type { EmbedOptions } from './plugins/embeds';

const GLOBAL_KEY = '__consentKit__';

/**
 * Die Instanz liegt global, damit auch bei Hot Reload oder mehrfach gebündelten
 * Kopien immer derselbe Zustand verwendet wird.
 */
export function getManager(): ConsentManager {
  const g = globalThis as unknown as Record<string, ConsentManager | undefined>;
  return (g[GLOBAL_KEY] ??= new ConsentManager());
}

/** Hilfsfunktion für eine vollständig typisierte consent.config.ts. */
export function defineConfig(config: ConsentConfig): ConsentConfig {
  return config;
}

/** Hilfsfunktion für eigene Dienste (Plugins). */
export function definePlugin(plugin: ConsentPlugin): ConsentPlugin {
  return plugin;
}

/** Startet consent-kit. Mehrfacher Aufruf ist unschädlich. */
export function init(config: ConsentConfig): ConsentState {
  return getManager().init(config);
}

/** Alle Kategorien erlauben. */
export function acceptAll(): void {
  getManager().acceptAll();
}

/** Alles außer "notwendig" ablehnen. */
export function rejectAll(): void {
  getManager().rejectAll();
}

/** Kategorien einzeln setzen, z. B. setCategories({ statistics: true }). */
export function setCategories(categories: Record<string, boolean>, services?: Record<string, boolean>): void {
  getManager().setCategories(categories, services);
}

/** Einwilligung für genau einen Dienst erteilen oder entziehen. */
export function setService(serviceId: string, granted: boolean): void {
  getManager().setService(serviceId, granted);
}

/** Öffnet den Einstellungsdialog – z. B. für den Footer-Link "Cookie-Einstellungen". */
export function openSettings(): void {
  getManager().openSettings();
}

/** Aktueller Einwilligungszustand. */
export function getState(): ConsentState {
  return getManager().getState();
}

/** Einwilligung für Kategorie oder Dienst vorhanden? */
export function hasConsent(categoryOrServiceId: string): boolean {
  return getManager().hasConsent(categoryOrServiceId);
}

/** Ereignis abonnieren: consent:ready, consent:changed, consent:revoked. */
export function on<E extends ConsentEvent>(event: E, handler: (payload: ConsentEventMap[E]) => void): () => void {
  return getManager().on(event, handler);
}

/**
 * Meldet einen Routenwechsel (Single-Page-App). Aktive Dienste senden genau einen
 * PageView. Ohne Argument wird location.pathname + location.search verwendet.
 */
export function notifyRouteChange(path?: string): void {
  getManager().notifyRouteChange(path);
}

/**
 * Erkennt Routenwechsel automatisch (history.pushState/replaceState/popstate) –
 * für Seiten ohne React Router. Gibt eine Stop-Funktion zurück.
 */
export function autoTrackRouteChanges(): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const notify = () => setTimeout(() => notifyRouteChange(), 0);
  const { pushState, replaceState } = history;
  history.pushState = function (...args: Parameters<History['pushState']>) {
    pushState.apply(this, args);
    notify();
  };
  history.replaceState = function (...args: Parameters<History['replaceState']>) {
    replaceState.apply(this, args);
    notify();
  };
  window.addEventListener('popstate', notify);
  return () => {
    history.pushState = pushState;
    history.replaceState = replaceState;
    window.removeEventListener('popstate', notify);
  };
}
