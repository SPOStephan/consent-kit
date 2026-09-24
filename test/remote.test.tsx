import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getManager } from 'consent-kit';
import { ConsentProvider, useConsentConfig } from 'consent-kit/react';
import { fromRemoteConfig, loadRemoteConfig, type RemoteSiteConfig } from 'consent-kit/remote';
import { ConsentUI } from 'consent-kit/ui';
import { resetDom } from './helpers';

const REMOTE: RemoteSiteConfig = {
  schema: 1,
  siteId: 'meine-seite',
  version: 3,
  language: 'de',
  owner: 'Muster GmbH',
  links: { imprint: '/impressum', privacy: '/datenschutz' },
  cookieDomain: '.meine-seite.de',
  respectGpc: true,
  services: [
    { type: 'google-tag-manager', id: 'GTM-ABC123', ads: false },
    { type: 'meta-pixel', id: '123456' },
    { type: 'tiktok-pixel', loadVia: 'gtm' },
    { type: 'youtube' },
  ],
  texts: { de: { bannerTitle: 'Datenschutz bei Muster' } },
  ui: { position: 'center', theme: { accent: '#0a7c55' } },
  logging: { endpoint: 'https://consent.muster.de/log' },
};

beforeEach(() => resetDom());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('fromRemoteConfig', () => {
  it('übersetzt die Backend-Beschreibung in eine Konfiguration mit Plugins', () => {
    const config = fromRemoteConfig(REMOTE);
    expect(config.services.map((p) => p.id)).toEqual(['google-tag-manager', 'meta-pixel', 'tiktok-pixel', 'youtube']);
    expect(config.services[0]!.category).toEqual(['statistics']); // ads: false
    expect(config).toMatchObject({
      version: 3,
      owner: 'Muster GmbH',
      cookie: { domain: '.meine-seite.de' },
      respectGpc: true,
      logging: { endpoint: 'https://consent.muster.de/log', siteId: 'meine-seite' },
      ui: { position: 'center' },
    });
  });

  it('ignoriert unbekannte und ungültige Dienste', () => {
    const config = fromRemoteConfig({
      ...REMOTE,
      services: [
        { type: 'google-tag-manager', id: 'UA-123' },
        { type: 'meta-pixel', id: 'abc<script>' },
        { type: 'unbekannt' } as never,
        { type: 'google-maps' },
      ],
    });
    expect(config.services.map((p) => p.id)).toEqual(['google-maps']);
  });

  it('eigene Plugins werden ergänzt und fließen in die Version ein', () => {
    const extra = { id: 'linkedin', category: 'marketing', meta: fromRemoteConfig(REMOTE).services[3]!.meta };
    const config = fromRemoteConfig(REMOTE, [extra]);
    expect(config.services.at(-1)?.id).toBe('linkedin');
    expect(config.version).toBe('3+linkedin');
  });

  it('lehnt kaputte Beschreibungen ab', () => {
    expect(() => fromRemoteConfig({ schema: 2 } as never)).toThrow();
  });
});

describe('loadRemoteConfig', () => {
  it('lädt /config/<siteId> ohne Cookies', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(REMOTE), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const config = await loadRemoteConfig({ endpoint: 'https://consent.muster.de/', siteId: 'meine-seite' });
    expect(fetchMock.mock.calls[0]![0]).toBe('https://consent.muster.de/config/meine-seite');
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ credentials: 'omit' });
    expect(config.version).toBe(3);
  });

  it('nutzt die Rückfallebene, wenn das Backend nicht erreichbar ist', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const config = await loadRemoteConfig({ endpoint: 'https://x', siteId: 'meine-seite', fallback: { ...REMOTE, version: 2 } });
    expect(config.version).toBe(2);
  });

  it('ohne Rückfallebene: Fehler (dann lädt kein Dienst)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 500 })));
    await expect(loadRemoteConfig({ endpoint: 'https://x', siteId: 'meine-seite' })).rejects.toThrow(/HTTP 500/);
  });

  it('akzeptiert keine Einstellungen einer anderen Website', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...REMOTE, siteId: 'andere' }))));
    await expect(loadRemoteConfig({ endpoint: 'https://x', siteId: 'meine-seite' })).rejects.toThrow(/Kennung/);
  });

  it('bricht nach dem Zeitlimit ab', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init: RequestInit) => new Promise((_, reject) => init.signal?.addEventListener('abort', () => reject(new Error('abgebrochen'))))),
    );
    const config = await loadRemoteConfig({ endpoint: 'https://x', siteId: 'meine-seite', timeout: 20, fallback: REMOTE });
    expect(config.version).toBe(3);
  });
});

describe('<ConsentProvider remote>', () => {
  it('zeigt das Banner mit den Einstellungen aus dem Backend', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(REMOTE))));
    function ConfigName() {
      const config = useConsentConfig();
      return <p>{config ? `geladen:${config.services.length}` : 'lädt'}</p>;
    }
    render(
      <ConsentProvider remote={{ endpoint: 'https://consent.muster.de', siteId: 'meine-seite' }}>
        <ConfigName />
        <ConsentUI />
      </ConsentProvider>,
    );
    expect(screen.getByText('lädt')).toBeTruthy();
    const banner = await screen.findByTestId('consent-banner');
    expect(banner.textContent).toContain('Datenschutz bei Muster');
    expect(banner.className).toContain('ck-banner--center');
    expect(screen.getByText('geladen:4')).toBeTruthy();
  });

  it('sendet die Website-Kennung bei der Protokollierung mit', async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.endsWith('/config/meine-seite') ? new Response(JSON.stringify(REMOTE)) : new Response(null, { status: 204 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    render(
      <ConsentProvider remote={{ endpoint: 'https://consent.muster.de', siteId: 'meine-seite' }}>
        <ConsentUI />
      </ConsentProvider>,
    );
    await screen.findByTestId('consent-banner');
    getManager().rejectAll();
    const logCall = fetchMock.mock.calls.find(([url]) => url === 'https://consent.muster.de/log') as unknown as [string, RequestInit];
    expect(JSON.parse(String(logCall[1].body))).toMatchObject({ siteId: 'meine-seite', action: 'reject-all' });
  });

  it('ohne Backend und ohne Rückfallebene: kein Banner, kein Dienst', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    render(
      <ConsentProvider remote={{ endpoint: 'https://x', siteId: 'meine-seite' }}>
        <ConsentUI />
      </ConsentProvider>,
    );
    await vi.waitFor(() => expect(error).toHaveBeenCalled());
    expect(screen.queryByTestId('consent-banner')).toBeNull();
    expect(document.querySelectorAll('script').length).toBe(0);
  });
});
