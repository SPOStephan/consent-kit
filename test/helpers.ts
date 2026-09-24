import { vi } from 'vitest';
import { ConsentManager } from '../src/core/manager';
import { resetScriptRegistry } from '../src/core/scripts';
import type { ConsentConfig, ConsentPlugin } from '../src/core/types';

export const meta = {
  name: 'Test',
  provider: 'Test GmbH',
  purpose: { de: 'Test', en: 'Test' },
  cookies: [],
  thirdCountryTransfer: null,
  privacyPolicyUrl: 'https://example.com/privacy',
};

export function clearAllCookies(): void {
  for (const part of document.cookie.split('; ')) {
    const name = part.split('=')[0];
    if (!name) continue;
    document.cookie = `${name}=; Max-Age=0; Path=/`;
    document.cookie = `${name}=; Max-Age=0; Path=/; Domain=example.de`;
    document.cookie = `${name}=; Max-Age=0; Path=/; Domain=.example.de`;
    document.cookie = `${name}=; Max-Age=0; Path=/; Domain=www.example.de`;
  }
}

export function resetDom(): void {
  clearAllCookies();
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  resetScriptRegistry();
  const w = window as unknown as Record<string, unknown>;
  for (const key of ['dataLayer', 'gtag', 'fbq', '_fbq', 'ttq', 'TiktokAnalyticsObject', '__consentKit__', 'consentKit']) {
    delete w[key];
  }
  delete (globalThis as Record<string, unknown>).__consentKit__;
}

export function spyPlugin(id: string, category: ConsentPlugin['category'], extra: Partial<ConsentPlugin> = {}) {
  const plugin = {
    id,
    category,
    meta,
    onInit: vi.fn(),
    onConsent: vi.fn(),
    onGrant: vi.fn(),
    onRevoke: vi.fn(),
    onRouteChange: vi.fn(),
  };
  return Object.assign(plugin, extra) as typeof plugin & ConsentPlugin;
}

export function baseConfig(services: ConsentPlugin[], extra: Partial<ConsentConfig> = {}): ConsentConfig {
  return {
    version: 1,
    links: { imprint: '/impressum', privacy: '/datenschutz' },
    services,
    reloadOnRevoke: false,
    ...extra,
  };
}

export function newManager(): ConsentManager {
  return new ConsentManager();
}

export function storedCookie(name = 'consent_kit'): Record<string, unknown> | undefined {
  const raw = document.cookie
    .split('; ')
    .find((c) => c.startsWith(name + '='))
    ?.slice(name.length + 1);
  return raw ? (JSON.parse(decodeURIComponent(raw)) as Record<string, unknown>) : undefined;
}
