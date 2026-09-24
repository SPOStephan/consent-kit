import type { CookiePattern } from './types';

/** Liest einen Cookie-Wert (oder undefined). */
export function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const parts = document.cookie ? document.cookie.split('; ') : [];
  for (const part of parts) {
    const eq = part.indexOf('=');
    const key = eq === -1 ? part : part.slice(0, eq);
    if (key === name) return eq === -1 ? '' : part.slice(eq + 1);
  }
  return undefined;
}

export interface WriteCookieOptions {
  maxAgeSeconds: number;
  domain?: string;
  path?: string;
}

/** Schreibt einen First-Party-Cookie mit SameSite=Lax (und Secure unter HTTPS). */
export function writeCookie(name: string, value: string, options: WriteCookieOptions): void {
  if (typeof document === 'undefined') return;
  let cookie = `${name}=${value}; Max-Age=${Math.floor(options.maxAgeSeconds)}; Path=${options.path ?? '/'}; SameSite=Lax`;
  if (options.domain) cookie += `; Domain=${options.domain}`;
  // Secure nur unter HTTPS setzen – sonst würde der Browser den Cookie z. B. bei
  // lokaler Entwicklung über http:// verwerfen.
  if (typeof location !== 'undefined' && location.protocol === 'https:') cookie += '; Secure';
  document.cookie = cookie;
}

/** Alle Cookie-Namen des aktuellen Dokuments. */
export function listCookieNames(): string[] {
  if (typeof document === 'undefined' || !document.cookie) return [];
  return document.cookie.split('; ').map((part) => {
    const eq = part.indexOf('=');
    return eq === -1 ? part : part.slice(0, eq);
  });
}

/** Prüft, ob ein Cookie-Name auf ein Muster passt ("_ga*" = Präfix-Wildcard). */
export function matchesPattern(name: string, pattern: CookiePattern): boolean {
  if (pattern instanceof RegExp) return pattern.test(name);
  if (!pattern.includes('*')) return name === pattern;
  const regex = new RegExp(
    '^' + pattern.split('*').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$',
  );
  return regex.test(name);
}

/**
 * Mögliche Domain-Attribute, unter denen ein Cookie gesetzt worden sein kann.
 * Beispiel für "www.shop.example.de": ["", "www.shop.example.de", ".www.shop.example.de",
 * "shop.example.de", ".shop.example.de", "example.de", ".example.de"]
 */
export function domainCandidates(hostname: string): string[] {
  const result = [''];
  if (!hostname || /^[\d.]+$/.test(hostname) || !hostname.includes('.')) return result;
  const labels = hostname.split('.');
  for (let i = 0; i < labels.length - 1; i++) {
    const d = labels.slice(i).join('.');
    result.push(d, '.' + d);
  }
  return result;
}

/**
 * Löscht alle Cookies, deren Name auf eines der Muster passt – für alle
 * möglichen Domains und den Pfad "/". Gibt die gelöschten Namen zurück.
 */
export function deleteCookies(patterns: readonly CookiePattern[]): string[] {
  if (typeof document === 'undefined' || patterns.length === 0) return [];
  const names = listCookieNames().filter((n) => patterns.some((p) => matchesPattern(n, p)));
  const hostname = typeof location !== 'undefined' ? location.hostname : '';
  const domains = domainCandidates(hostname);
  const paths = ['/'];
  if (typeof location !== 'undefined' && location.pathname !== '/') paths.push(location.pathname);
  for (const name of names) {
    for (const domain of domains) {
      for (const path of paths) {
        document.cookie =
          `${name}=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; Path=${path}` +
          (domain ? `; Domain=${domain}` : '');
      }
    }
  }
  return names;
}
