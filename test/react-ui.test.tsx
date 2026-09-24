import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getManager, googleTagManager, metaPixel, openSettings, youtube, type ConsentConfig } from 'consent-kit';
import { ConsentGate, ConsentProvider, CookieSettingsLink, useConsent, usePageViews } from 'consent-kit/react';
import { ConsentUI } from 'consent-kit/ui';
import { resetDom } from './helpers';

function makeConfig(extra: Partial<ConsentConfig> = {}): ConsentConfig {
  return {
    version: 1,
    language: 'de',
    links: { imprint: '/impressum', privacy: '/datenschutz' },
    services: [googleTagManager({ id: 'GTM-TEST123' }), metaPixel({ id: '1' }), youtube()],
    reloadOnRevoke: false,
    ...extra,
  };
}

function App({ config, children }: { config: ConsentConfig; children?: React.ReactNode }) {
  return (
    <ConsentProvider config={config}>
      {children}
      <footer>
        <CookieSettingsLink>Cookie-Einstellungen</CookieSettingsLink>
      </footer>
      <ConsentUI owner="Muster GmbH" />
    </ConsentProvider>
  );
}

beforeEach(() => resetDom());
afterEach(() => cleanup());

describe('Banner', () => {
  it('zeigt Titel, Links und gleichwertige Buttons', async () => {
    render(<App config={makeConfig()} />);
    const banner = await screen.findByTestId('consent-banner');
    const reject = within(banner).getByRole('button', { name: 'Alle ablehnen' });
    const accept = within(banner).getByRole('button', { name: 'Alle akzeptieren' });
    expect(reject.className).toBe(accept.className);
    expect(reject.getAttribute('style')).toBeNull();
    expect(accept.getAttribute('style')).toBeNull();
    expect(within(banner).getByRole('link', { name: 'Impressum' }).getAttribute('href')).toBe('/impressum');
    expect(within(banner).getByRole('link', { name: 'Datenschutzerklärung' }).getAttribute('href')).toBe('/datenschutz');
    // Banner steht am Anfang von <body> (Tab-Reihenfolge)
    expect(document.body.firstElementChild?.id).toBe('consent-kit-root');
  });

  it('verschwindet nach "Alle ablehnen" und erscheint beim nächsten Besuch nicht erneut', async () => {
    const config = makeConfig();
    const { unmount } = render(<App config={config} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Alle ablehnen' }));
    expect(screen.queryByTestId('consent-banner')).toBeNull();
    expect(getManager().getState().categories).toMatchObject({ statistics: false, marketing: false });
    unmount();
    resetDomKeepCookies();
    render(<App config={makeConfig()} />);
    await act(async () => undefined);
    expect(screen.queryByTestId('consent-banner')).toBeNull();
  });

  it('center-Modus ist modal mit Fokus im Banner – außer auf Impressum/Datenschutz', async () => {
    render(<App config={makeConfig({ ui: { position: 'center' } })} />);
    const banner = await screen.findByTestId('consent-banner');
    expect(banner.getAttribute('aria-modal')).toBe('true');
    expect(banner.className).toContain('ck-banner--center');
    expect(document.activeElement).toBe(banner);
    cleanup();
    resetDom();
    history.pushState({}, '', '/datenschutz');
    render(<App config={makeConfig({ ui: { position: 'center' } })} />);
    const banner2 = await screen.findByTestId('consent-banner');
    expect(banner2.className).toContain('ck-banner--bottom');
    expect(banner2.getAttribute('aria-modal')).toBeNull();
    history.pushState({}, '', '/');
  });
});

describe('Einstellungsdialog', () => {
  it('hat keine vorausgewählten Kategorien außer "Notwendig" (nicht abwählbar)', async () => {
    render(<App config={makeConfig()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Einstellungen' }));
    const dialog = screen.getByRole('dialog', { name: 'Cookie-Einstellungen' });
    const necessary = within(dialog).getByTestId('category-necessary') as HTMLInputElement;
    const statistics = within(dialog).getByTestId('category-statistics') as HTMLInputElement;
    const marketing = within(dialog).getByTestId('category-marketing') as HTMLInputElement;
    expect(necessary.checked).toBe(true);
    expect(necessary.disabled).toBe(true);
    expect(statistics.checked).toBe(false);
    expect(marketing.checked).toBe(false);
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    // Banner ist während des Dialogs ausgeblendet
    expect(screen.queryByTestId('consent-banner')).toBeNull();
  });

  it('zeigt Dienst-Details: Name, Anbieter, Zweck, Cookies, Dauer, Drittland, Datenschutz-Link', async () => {
    render(<App config={makeConfig()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Einstellungen' }));
    const dialog = screen.getByRole('dialog');
    const toggles = within(dialog).getAllByRole('button', { name: /Details anzeigen/ });
    const marketingToggle = toggles[2]!;
    expect(marketingToggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(marketingToggle);
    expect(marketingToggle.getAttribute('aria-expanded')).toBe('true');
    const details = document.getElementById(marketingToggle.getAttribute('aria-controls')!)!;
    expect(details.hidden).toBe(false);
    const text = details.textContent ?? '';
    expect(text).toContain('Meta Pixel');
    expect(text).toContain('Meta Platforms Ireland Limited');
    expect(text).toContain('_fbp');
    expect(text).toContain('3 Monate');
    expect(text).toContain('USA');
    expect(within(details).getByRole('link', { name: 'https://www.facebook.com/privacy/policy/' })).toBeTruthy();
    expect(text).toContain('YouTube');
  });

  it('speichert eine Auswahl ("Nur Statistik")', async () => {
    render(<App config={makeConfig()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Einstellungen' }));
    fireEvent.click(screen.getByTestId('category-statistics'));
    fireEvent.click(screen.getByRole('button', { name: 'Auswahl speichern' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(getManager().getState()).toMatchObject({ decided: true, categories: { statistics: true, marketing: false } });
  });

  it('Einzelner Dienst lässt sich erlauben', async () => {
    render(<App config={makeConfig()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Einstellungen' }));
    fireEvent.click(screen.getByTestId('service-youtube-marketing'));
    fireEvent.click(screen.getByRole('button', { name: 'Auswahl speichern' }));
    expect(getManager().hasConsent('youtube')).toBe(true);
    expect(getManager().hasConsent('meta-pixel')).toBe(false);
  });

  it('Footer-Link öffnet den Dialog, Escape schließt ihn und gibt den Fokus zurück', async () => {
    render(<App config={makeConfig()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Alle akzeptieren' }));
    const link = screen.getByRole('button', { name: 'Cookie-Einstellungen' });
    link.focus();
    fireEvent.click(link);
    const dialog = screen.getByRole('dialog');
    // Consent-ID wird für Rückfragen angezeigt
    expect(within(dialog).getByTestId('consent-id').textContent).toBe(getManager().getState().consentId);
    // Einstellungen spiegeln die Entscheidung wider
    expect((within(dialog).getByTestId('category-marketing') as HTMLInputElement).checked).toBe(true);
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(link);
  });

  it('Tab bleibt im Dialog (Fokusfalle)', async () => {
    render(<App config={makeConfig()} />);
    await screen.findByTestId('consent-banner');
    act(() => openSettings());
    const dialog = screen.getByRole('dialog');
    const buttons = within(dialog).getAllByRole('button');
    const last = buttons[buttons.length - 1]!;
    // jsdom kennt kein Layout (offsetParent) – der Fokus-Filter lässt aktive Elemente trotzdem zu.
    last.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('Widerruf über den Dialog ist so einfach wie die Erteilung', async () => {
    render(<App config={makeConfig()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Alle akzeptieren' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cookie-Einstellungen' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Alle ablehnen' }));
    expect(getManager().getState().categories).toMatchObject({ statistics: false, marketing: false });
  });

  it('englische Texte', async () => {
    render(<App config={makeConfig({ language: 'en' })} />);
    expect(await screen.findByRole('button', { name: 'Reject all' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Accept all' })).toBeTruthy();
  });

  it('Design-Variablen werden als CSS-Variablen gesetzt', async () => {
    render(<App config={makeConfig({ ui: { theme: { accent: '#ff0000' }, darkTheme: { accent: '#00ff00' }, colorScheme: 'dark' } })} />);
    await screen.findByTestId('consent-banner');
    const style = document.querySelector('.ck-root style')?.textContent ?? '';
    expect(style).toContain('.ck-root[data-ck-scheme="light"],.ck-gate[data-ck-scheme="light"]{--ck-accent:#ff0000;}');
    expect(style).toContain('.ck-root[data-ck-scheme="dark"],.ck-gate[data-ck-scheme="dark"]{--ck-accent:#00ff00;}');
    expect(document.querySelector('.ck-root')?.getAttribute('data-ck-scheme')).toBe('dark');
  });
});

describe('ConsentGate', () => {
  it('zeigt einen Platzhalter und lädt den Inhalt erst nach Klick', async () => {
    render(
      <App config={makeConfig()}>
        <ConsentGate service="youtube">
          <iframe title="Video" src="https://www.youtube-nocookie.com/embed/xyz" />
        </ConsentGate>
      </App>,
    );
    await screen.findByTestId('consent-banner');
    expect(screen.queryByTitle('Video')).toBeNull();
    expect(screen.getByText(/Externer Inhalt: YouTube/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Inhalt laden' }));
    expect(screen.getByTitle('Video')).toBeTruthy();
    // Banner bleibt, da noch keine Gesamtentscheidung getroffen wurde
    expect(screen.getByTestId('consent-banner')).toBeTruthy();
    expect(getManager().hasConsent('meta-pixel')).toBe(false);
  });

  it('rendert direkt, wenn Marketing erlaubt ist', async () => {
    render(
      <App config={makeConfig()}>
        <ConsentGate service="youtube">{() => <p>Video da</p>}</ConsentGate>
      </App>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Alle akzeptieren' }));
    expect(screen.getByText('Video da')).toBeTruthy();
  });
});

describe('useConsent und usePageViews', () => {
  it('useConsent liefert Zustand und Aktionen', async () => {
    function Status() {
      const { decided, hasConsent, acceptAll } = useConsent();
      return (
        <button type="button" onClick={acceptAll}>
          {decided ? 'entschieden' : 'offen'}-{hasConsent('statistics') ? 'stat' : 'keine'}
        </button>
      );
    }
    render(
      <App config={makeConfig()}>
        <Status />
      </App>,
    );
    const button = await screen.findByRole('button', { name: 'offen-keine' });
    fireEvent.click(button);
    expect(screen.getByRole('button', { name: 'entschieden-stat' })).toBeTruthy();
  });

  it('usePageViews meldet Routenwechsel (erste Route wird nicht gezählt)', async () => {
    const seen: string[] = [];
    function Tracker({ path }: { path: string }) {
      usePageViews(path);
      return null;
    }
    const config = makeConfig({
      services: [
        {
          id: 'spy',
          category: 'statistics',
          meta: youtube().meta,
          onGrant() {},
          onRouteChange: (_ctx, route) => seen.push(route.path),
        },
      ],
    });
    const { rerender } = render(
      <App config={config}>
        <Tracker path="/" />
      </App>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Alle akzeptieren' }));
    rerender(
      <App config={config}>
        <Tracker path="/produkte" />
      </App>,
    );
    rerender(
      <App config={config}>
        <Tracker path="/produkte" />
      </App>,
    );
    expect(seen).toEqual(['/produkte']);
  });
});

function resetDomKeepCookies() {
  const cookies = document.cookie;
  resetDom();
  for (const c of cookies.split('; ')) if (c) document.cookie = `${c}; Path=/`;
}
