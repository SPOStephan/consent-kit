import { deleteCookies, readCookie, writeCookie } from './cookies';
import { loadScript } from './scripts';
import type {
  ConsentAction,
  ConsentConfig,
  ConsentEvent,
  ConsentEventMap,
  ConsentPlugin,
  ConsentState,
  PluginContext,
  RouteInfo,
} from './types';

export const BUILT_IN_CATEGORIES = ['necessary', 'statistics', 'marketing'] as const;
const DEFAULT_COOKIE = 'consent_kit';
const MAX_AGE_DAYS = 365;
const DAY_MS = 24 * 60 * 60 * 1000;

type Handler<E extends ConsentEvent> = (payload: ConsentEventMap[E]) => void;

/** Format des Cookies (kurze Schlüssel, damit der Cookie klein bleibt). */
interface StoredState {
  /** Consent-ID */
  i: string;
  /** Zeitstempel (ISO) */
  t: string;
  /** Konfig-Version */
  v: string;
  /** Banner-Entscheidung getroffen */
  d: 0 | 1;
  /** Erlaubte Kategorien */
  c: string[];
  /** Individuelle Dienst-Entscheidungen */
  s: Record<string, 0 | 1>;
}

export function createUuid(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function currentPath(): string {
  return typeof location === 'undefined' ? '' : location.pathname + location.search;
}

function gpcSignal(): boolean {
  return typeof navigator !== 'undefined' && (navigator as { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
}

/** Kategorien eines Dienstes als Array. */
export function serviceCategories(plugin: Pick<ConsentPlugin, 'category'>): readonly string[] {
  return typeof plugin.category === 'string' ? [plugin.category] : plugin.category;
}

export class ConsentManager {
  config: ConsentConfig | undefined;
  private state: ConsentState = emptyState('');
  private readonly handlers = new Map<ConsentEvent, Set<Handler<never>>>();
  /** Dienste, deren onGrant auf dieser Seite bereits lief (Skripte geladen). */
  private readonly active = new Set<string>();
  private readonly initializedPlugins = new Set<string>();
  private lastPath = '';
  private lastUrl = '';
  private ready = false;
  private reloadScheduled = false;

  /** Initialisiert consent-kit. Mehrfacher Aufruf ist unschädlich (StrictMode, Hot Reload). */
  init(config: ConsentConfig): ConsentState {
    const firstRun = !this.config;
    if (!firstRun && this.config === config) return this.getState();
    this.config = config;
    if (typeof window === 'undefined') {
      this.state = emptyState(String(config.version));
      return this.getState();
    }
    if (config.debug) validateConfig(config, this.log);

    if (firstRun) {
      this.lastPath = currentPath();
      this.lastUrl = location.href;
    }
    this.state = this.load();
    const ctx = this.context();

    for (const plugin of config.services) {
      if (this.initializedPlugins.has(plugin.id)) continue;
      this.initializedPlugins.add(plugin.id);
      this.safe(plugin, 'onInit', () => plugin.onInit?.(ctx));
    }
    this.applyPlugins([]);
    this.cleanupCookies();
    this.ready = true;
    this.emit('consent:ready', { state: this.getState() });
    (window as unknown as { consentKit?: unknown }).consentKit = publicApi(this);
    return this.getState();
  }

  isReady(): boolean {
    return this.ready;
  }

  /** Aktueller Zustand (Kopie). */
  getState(): ConsentState {
    return cloneState(this.state);
  }

  /** Alle Kategorie-IDs (eingebaut + eigene). */
  getCategoryIds(): string[] {
    const ids: string[] = [...BUILT_IN_CATEGORIES];
    for (const c of this.config?.categories ?? []) if (!ids.includes(c.id)) ids.push(c.id);
    return ids;
  }

  getServices(): readonly ConsentPlugin[] {
    return this.config?.services ?? [];
  }

  /** Prüft die Einwilligung für eine Kategorie oder einen Dienst (per ID). */
  hasConsent(id: string): boolean {
    if (id === 'necessary') return true;
    const plugin = this.getServices().find((p) => p.id === id);
    if (plugin) return this.isGranted(plugin, this.state);
    return this.state.decided && this.state.categories[id] === true;
  }

  /** Alle Kategorien erlauben (bei aktivem GPC ohne Marketing). */
  acceptAll(): void {
    const categories: Record<string, boolean> = {};
    const gpc = this.gpcActive();
    for (const id of this.getCategoryIds()) categories[id] = !(gpc && id === 'marketing');
    this.decide(categories, {}, 'accept-all');
  }

  /** Alles außer "notwendig" ablehnen. */
  rejectAll(): void {
    const categories: Record<string, boolean> = {};
    for (const id of this.getCategoryIds()) categories[id] = id === 'necessary';
    this.decide(categories, {}, 'reject-all');
  }

  /**
   * Kategorien einzeln setzen, z. B. setCategories({ statistics: true, marketing: false }).
   * Nicht genannte Kategorien werden abgelehnt. Optional können einzelne Dienste
   * abweichend erlaubt/abgelehnt werden.
   */
  setCategories(categories: Record<string, boolean>, services: Record<string, boolean> = {}): void {
    const next: Record<string, boolean> = {};
    for (const id of this.getCategoryIds()) next[id] = id === 'necessary' || categories[id] === true;
    this.decide(next, services, 'custom');
  }

  /**
   * Einwilligung für genau einen Dienst (z. B. "Inhalt laden" bei einem YouTube-Video).
   * Die übrige Auswahl bleibt unverändert; das Banner bleibt sichtbar, solange noch
   * nicht entschieden wurde.
   */
  setService(serviceId: string, granted: boolean): void {
    const services = { ...this.state.services, [serviceId]: granted };
    this.apply({ ...this.state, services }, 'service');
  }

  /** Öffnet den Einstellungsdialog (für den Footer-Link "Cookie-Einstellungen"). */
  openSettings(): void {
    this.emit('ui:open-settings', {});
  }

  /** Abonniert ein Ereignis. Gibt eine Funktion zum Abbestellen zurück. */
  on<E extends ConsentEvent>(event: E, handler: Handler<E>): () => void {
    let set = this.handlers.get(event);
    if (!set) this.handlers.set(event, (set = new Set()));
    set.add(handler as Handler<never>);
    return () => set.delete(handler as Handler<never>);
  }

  /**
   * Meldet einen Routenwechsel in einer Single-Page-App. Aktive Dienste senden
   * dann einen PageView. Der erste Seitenaufruf wird ignoriert (den senden die
   * Dienste beim Laden selbst), ebenso doppelte Meldungen desselben Pfads.
   */
  notifyRouteChange(path: string = currentPath()): void {
    if (typeof window === 'undefined' || !this.config) return;
    if (path === this.lastPath) return;
    const route: RouteInfo = {
      path,
      url: location.href,
      title: document.title,
      referrer: this.lastUrl,
    };
    this.lastPath = path;
    this.lastUrl = location.href;
    const ctx = this.context();
    for (const plugin of this.config.services) {
      if (!this.active.has(plugin.id)) continue;
      this.safe(plugin, 'onRouteChange', () => plugin.onRouteChange?.(ctx, route));
    }
  }

  /** Löscht die gespeicherte Entscheidung (z. B. für Tests). Keine Revoke-Signale. */
  forget(): void {
    const config = this.config;
    if (!config) return;
    const { name, path, domain } = cookieOptions(config);
    writeCookie(name, '', { maxAgeSeconds: 0, path, domain });
    this.state = emptyState(String(config.version));
  }

  // ---------------------------------------------------------------- intern

  private decide(categories: Record<string, boolean>, services: Record<string, boolean>, action: ConsentAction): void {
    const next: ConsentState = {
      ...this.state,
      decided: true,
      categories: { ...categories, necessary: true },
      services: { ...services },
    };
    this.apply(next, action);
  }

  private apply(next: ConsentState, action: ConsentAction): void {
    const config = this.config;
    if (!config) {
      if (typeof console !== 'undefined') console.warn('consent-kit: init(config) wurde noch nicht aufgerufen.');
      return;
    }
    const previous = this.state;
    const known = new Set(config.services.map((p) => p.id));
    const services: Record<string, boolean> = {};
    for (const [id, value] of Object.entries(next.services)) if (known.has(id)) services[id] = value;

    this.state = {
      ...next,
      services,
      consentId: previous.consentId || createUuid(),
      timestamp: new Date().toISOString(),
      configVersion: String(config.version),
      gpc: this.gpcActive(),
    };
    this.save();

    const revoked = config.services
      .filter((p) => (this.active.has(p.id) || this.isGranted(p, previous)) && !this.isGranted(p, this.state))
      .map((p) => p.id);
    // Nur Dienste, die tatsächlich Skripte geladen haben (onGrant), erfordern einen Reload.
    const needsReload = config.services.some(
      (p) => revoked.includes(p.id) && this.active.has(p.id) && typeof p.onGrant === 'function',
    );

    this.applyPlugins(revoked);
    this.cleanupCookies();

    const state = this.getState();
    this.emit('consent:changed', { state, previous: cloneState(previous), action });
    if (revoked.length) this.emit('consent:revoked', { state, revokedServices: revoked });
    this.sendLog(action);

    if (needsReload && config.reloadOnRevoke !== false && !this.reloadScheduled) {
      this.reloadScheduled = true;
      this.log('Widerruf – Seite wird neu geladen, da geladene Skripte nicht entladen werden können.');
      setTimeout(() => location.reload(), 50);
    }
  }

  /** Ruft onConsent / onRevoke / onGrant der Plugins passend zum Zustand auf. */
  private applyPlugins(revoked: string[]): void {
    const config = this.config;
    if (!config) return;
    const ctx = this.context();
    for (const plugin of config.services) {
      this.safe(plugin, 'onConsent', () => plugin.onConsent?.(ctx));
    }
    for (const plugin of config.services) {
      if (!revoked.includes(plugin.id)) continue;
      this.safe(plugin, 'onRevoke', () => plugin.onRevoke?.(ctx));
      this.active.delete(plugin.id);
    }
    for (const plugin of config.services) {
      if (this.active.has(plugin.id) || !this.isGranted(plugin, this.state)) continue;
      this.active.add(plugin.id);
      this.log('Dienst wird aktiviert:', plugin.id);
      this.safe(plugin, 'onGrant', () => plugin.onGrant?.(ctx));
    }
  }

  /** Löscht bekannte Cookies aller Dienste ohne Einwilligung. */
  private cleanupCookies(): void {
    for (const plugin of this.getServices()) {
      if (this.isGranted(plugin, this.state) || !plugin.cookiePatterns?.length) continue;
      const deleted = deleteCookies(plugin.cookiePatterns);
      if (deleted.length) this.log('Cookies gelöscht:', plugin.id, deleted);
    }
  }

  private isGranted(plugin: ConsentPlugin, state: ConsentState): boolean {
    const override = state.services[plugin.id];
    if (override !== undefined) return override;
    if (!state.decided) return false;
    return serviceCategories(plugin).some((c) => c === 'necessary' || state.categories[c] === true);
  }

  private gpcActive(): boolean {
    return this.config?.respectGpc === true && gpcSignal();
  }

  private context(): PluginContext {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    return {
      get state() {
        return self.getState();
      },
      hasConsent: (id) => self.hasConsent(id),
      loadScript,
      log: this.log,
    };
  }

  private readonly log = (...args: unknown[]): void => {
    if (this.config?.debug && typeof console !== 'undefined') console.info('[consent-kit]', ...args);
  };

  private safe(plugin: ConsentPlugin, hook: string, fn: () => void): void {
    try {
      fn();
    } catch (error) {
      if (typeof console !== 'undefined') console.error(`consent-kit: Fehler in ${plugin.id}.${hook}`, error);
    }
  }

  private emit<E extends ConsentEvent>(event: E, payload: ConsentEventMap[E]): void {
    for (const handler of Array.from(this.handlers.get(event) ?? [])) {
      try {
        (handler as Handler<E>)(payload);
      } catch (error) {
        if (typeof console !== 'undefined') console.error(`consent-kit: Fehler in Event-Handler für ${event}`, error);
      }
    }
  }

  private load(): ConsentState {
    const config = this.config!;
    const version = String(config.version);
    const empty = emptyState(version);
    empty.gpc = this.gpcActive();
    const raw = readCookie(cookieOptions(config).name);
    if (!raw) return empty;
    let stored: StoredState;
    try {
      stored = JSON.parse(decodeURIComponent(raw)) as StoredState;
    } catch {
      return empty;
    }
    if (!stored || typeof stored !== 'object' || typeof stored.i !== 'string') return empty;
    // Konfig-Version geändert oder älter als 12 Monate → erneut fragen.
    const age = Date.now() - Date.parse(stored.t);
    if (stored.v !== version || !(age >= 0 && age < maxAgeDays(config) * DAY_MS)) {
      return { ...empty, consentId: stored.i };
    }
    const categories: Record<string, boolean> = {};
    for (const id of this.getCategoryIds()) categories[id] = id === 'necessary' || (stored.c ?? []).includes(id);
    const services: Record<string, boolean> = {};
    for (const [id, value] of Object.entries(stored.s ?? {})) services[id] = value === 1;
    return {
      ...empty,
      decided: stored.d === 1,
      consentId: stored.i,
      timestamp: stored.t,
      categories,
      services,
    };
  }

  private save(): void {
    const config = this.config!;
    const s = this.state;
    const stored: StoredState = {
      i: s.consentId,
      t: s.timestamp,
      v: s.configVersion,
      d: s.decided ? 1 : 0,
      c: Object.keys(s.categories).filter((k) => s.categories[k]),
      s: Object.fromEntries(Object.entries(s.services).map(([k, v]) => [k, v ? 1 : 0])),
    };
    const { name, path, domain } = cookieOptions(config);
    writeCookie(name, encodeURIComponent(JSON.stringify(stored)), {
      maxAgeSeconds: maxAgeDays(config) * 24 * 60 * 60,
      path,
      domain,
    });
  }

  private sendLog(action: ConsentAction): void {
    const endpoint = this.config?.logging?.endpoint;
    if (!endpoint || typeof fetch === 'undefined') return;
    const s = this.state;
    const body = JSON.stringify({
      consentId: s.consentId,
      timestamp: s.timestamp,
      configVersion: s.configVersion,
      action,
      categories: s.categories,
      services: s.services,
      gpc: s.gpc,
      domain: location.hostname,
    });
    // text/plain = "einfacher" Request ohne CORS-Preflight; keepalive überlebt einen Reload.
    fetch(endpoint, {
      method: 'POST',
      body,
      keepalive: true,
      credentials: 'omit',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    }).catch((error: unknown) => this.log('Protokollierung fehlgeschlagen', error));
  }
}

function emptyState(version: string): ConsentState {
  return {
    decided: false,
    consentId: '',
    timestamp: '',
    configVersion: version,
    categories: { necessary: true },
    services: {},
    gpc: false,
  };
}

function cloneState(state: ConsentState): ConsentState {
  return { ...state, categories: { ...state.categories }, services: { ...state.services } };
}

function maxAgeDays(config: ConsentConfig): number {
  const days = config.cookie?.maxAgeDays ?? MAX_AGE_DAYS;
  return Math.max(1, Math.min(days, MAX_AGE_DAYS));
}

function cookieOptions(config: ConsentConfig) {
  return {
    name: config.cookie?.name ?? DEFAULT_COOKIE,
    path: config.cookie?.path ?? '/',
    domain: config.cookie?.domain,
  };
}

function validateConfig(config: ConsentConfig, log: (...args: unknown[]) => void): void {
  const ids = new Set<string>();
  const categories = new Set<string>([...BUILT_IN_CATEGORIES, ...(config.categories ?? []).map((c) => c.id)]);
  for (const plugin of config.services) {
    if (ids.has(plugin.id)) console.warn(`consent-kit: Dienst "${plugin.id}" ist doppelt konfiguriert.`);
    ids.add(plugin.id);
    for (const c of serviceCategories(plugin)) {
      if (!categories.has(c)) console.warn(`consent-kit: Dienst "${plugin.id}" nutzt unbekannte Kategorie "${c}".`);
    }
  }
  if (!config.links?.imprint || !config.links?.privacy) {
    console.warn('consent-kit: links.imprint und links.privacy müssen gesetzt sein.');
  }
  log('Konfiguration geladen', config);
}

/** API, die zusätzlich als window.consentKit bereitsteht (z. B. für Links ohne React). */
function publicApi(m: ConsentManager) {
  return {
    acceptAll: () => m.acceptAll(),
    rejectAll: () => m.rejectAll(),
    setCategories: (c: Record<string, boolean>, s?: Record<string, boolean>) => m.setCategories(c, s),
    openSettings: () => m.openSettings(),
    getState: () => m.getState(),
    hasConsent: (id: string) => m.hasConsent(id),
  };
}
