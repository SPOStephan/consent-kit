# consent-kit

Headless Consent-Management für Websites mit **Vite + React**. Steuert Google Tag Manager
(mit **Google Consent Mode v2**), **Meta Pixel**, **TikTok Pixel** sowie eingebettete Inhalte
wie **YouTube** und **Google Maps** – und lädt sie erst, **nachdem** Besucher eingewilligt haben.

> **Wichtig:** consent-kit ist ein technisches Werkzeug und ersetzt keine Rechtsberatung.
> Alle mitgelieferten Texte sind **Mustertexte – rechtlich prüfen lassen**. Ob Ihre Website die
> Anforderungen der DSGVO und des § 25 TDDDG erfüllt, hängt von Ihrer Konfiguration, Ihren
> Texten und den eingesetzten Diensten ab.

## Was das Kit macht

- **Nichts vor der Einwilligung:** Kein Skript und kein Request an Google, Meta, TikTok & Co.,
  bevor Besucher zugestimmt haben („strict mode“). Das wird bei jedem `npm test` automatisch
  im echten Browser geprüft.
- **Banner mit gleichwertigen Buttons:** „Alle ablehnen“ und „Alle akzeptieren“ auf der ersten
  Ebene, gleich groß, gleich gestaltet. Keine vorausgewählten Kategorien außer „Notwendig“.
- **Einstellungsdialog** mit Kategorien (Notwendig, Statistik, Marketing – erweiterbar) und
  aufklappbaren Details je Dienst: Anbieter, Zweck, Cookies, Speicherdauer, Drittland,
  Link zur Datenschutzerklärung.
- **Widerruf jederzeit** über einen Footer-Link „Cookie-Einstellungen“: Revoke-Signale an die
  Dienste, bekannte Cookies löschen, Seite neu laden.
- **Erneute Abfrage** bei geänderter Konfig-Version und spätestens nach 12 Monaten.
  Eine Ablehnung wird gespeichert – kein erneutes Nachfragen bei jedem Besuch.
- **Google Consent Mode v2**, dataLayer-Events für GTM, **SPA-PageViews** für React Router
  (genau ein PageView pro Routenwechsel, keine Doppelzählung).
- **Barrierefrei** (Tastatur, Fokus, ARIA), **mobil**, **Dark Mode**, anpassbar über CSS-Variablen.
- **Werkzeuge:** `npx consent-kit check <url>` prüft Ihre Live-Seite,
  `npx consent-kit table` erzeugt die Dienste-Tabelle für Ihre Datenschutzerklärung.
- Klein: Core mit allen Plugins unter 10 kB (gzip), keine Laufzeit-Abhängigkeiten außer React.

## Installation

```bash
npm install github:SPOStephan/consent-kit#v0.2.0
```

Die Version steht hinter dem `#`. Für ein Update einfach die neue Version installieren,
z. B. `npm install github:SPOStephan/consent-kit#v0.3.0` (siehe [CHANGELOG](CHANGELOG.md)).
Getestet mit npm und pnpm – das Paket ist bereits fertig gebaut, bei der Installation läuft
kein Build-Schritt.

Das Repository ist privat? Dann lesen Sie [docs/INSTALLATION.md](docs/INSTALLATION.md)
(Zugriff für Vercel, Netlify, Manus und Alternativen).

## Minimalbeispiel

**1. `src/consent.config.ts`** – die einzige Datei pro Website:

```ts
import { defineConfig, googleTagManager, metaPixel, tiktokPixel, youtube } from 'consent-kit';

export default defineConfig({
  version: 1, // erhöhen, wenn sich Dienste ändern → alle werden neu gefragt
  language: 'de',
  links: { imprint: '/impressum', privacy: '/datenschutz' },
  services: [
    googleTagManager({ id: 'GTM-XXXXXXX' }),
    metaPixel({ id: '123456789012345' }),
    tiktokPixel({ id: 'CXXXXXXXXXXXXXXXXXXX' }),
    youtube(),
  ],
});
```

**2. `src/main.tsx`:**

```tsx
import { ConsentProvider } from 'consent-kit/react';
import { ConsentUI } from 'consent-kit/ui';
import 'consent-kit/ui.css';
import consentConfig from './consent.config';

createRoot(document.getElementById('root')!).render(
  <ConsentProvider config={consentConfig}>
    <BrowserRouter>
      <App />
    </BrowserRouter>
    <ConsentUI />
  </ConsentProvider>,
);
```

**3. PageViews bei Routenwechsel und Footer-Link:**

```tsx
import { useLocation } from 'react-router-dom';
import { CookieSettingsLink, usePageViews, ConsentGate } from 'consent-kit/react';

function App() {
  usePageViews(useLocation()); // genau ein PageView pro Routenwechsel
  return (
    <>
      {/* … Ihre Seite … */}
      <ConsentGate service="youtube" aspectRatio="16 / 9">
        <iframe src="https://www.youtube-nocookie.com/embed/VIDEO_ID" title="Video" />
      </ConsentGate>
      <footer>
        <CookieSettingsLink>Cookie-Einstellungen</CookieSettingsLink>
      </footer>
    </>
  );
}
```

Die vollständige Schritt-für-Schritt-Anleitung steht in [docs/INTEGRATION.md](docs/INTEGRATION.md).
Noch schneller: Kopieren Sie [docs/INTEGRATIONS-PROMPT.md](docs/INTEGRATIONS-PROMPT.md) in
Cursor, Manus oder Claude Code.

## Pakete (Unterpfade)

| Import | Inhalt |
| --- | --- |
| `consent-kit` | Core ohne React: `init`, `acceptAll`, `rejectAll`, `setCategories`, `setService`, `openSettings`, `getState`, `hasConsent`, `on`, `notifyRouteChange`, Plugins |
| `consent-kit/react` | `ConsentProvider`, `useConsent()`, `<ConsentGate>`, `usePageViews()`, `<CookieSettingsLink>` |
| `consent-kit/ui` | Fertiges Banner und Einstellungsdialog: `<ConsentUI />` |
| `consent-kit/ui.css` | Standard-Styles (CSS-Variablen, Dark Mode) |
| `consent-kit/table` | Dienste-Tabelle für die Datenschutzerklärung (`toMarkdown`, `toHtml`, `getServiceRows`) |

## Mitgelieferte Dienste

| Funktion | Kategorie | Hinweis |
| --- | --- | --- |
| `googleTagManager({ id })` | Statistik + Marketing | Consent Mode v2, Events `consent_update` und `virtual_pageview` – siehe [docs/GTM.md](docs/GTM.md) |
| `metaPixel({ id })` | Marketing | alternativ `metaPixel({ loadVia: 'gtm' })` |
| `tiktokPixel({ id })` | Marketing | alternativ `tiktokPixel({ loadVia: 'gtm' })` |
| `youtube()`, `googleMaps()`, `embed({...})` | Marketing (änderbar) | für `<ConsentGate>` |

> **Meta- und TikTok-Pixel ENTWEDER über consent-kit ODER über GTM einbinden – nie beides**,
> sonst wird doppelt gezählt. Details in [docs/GTM.md](docs/GTM.md#meta-und-tiktok-über-gtm-oder-über-das-kit).

Eigene Dienste (LinkedIn, Pinterest, …) lassen sich über das Plugin-Interface ergänzen:
[docs/PLUGINS.md](docs/PLUGINS.md).

## Konfiguration (Überblick)

```ts
defineConfig({
  version: 1,                       // Pflicht – erhöhen = neue Abfrage
  language: 'de',                   // 'de' | 'en' | 'auto'
  links: { imprint, privacy },      // Pflicht – im Banner sichtbar
  services: [ … ],                  // Pflicht – aktivierte Dienste
  cookie: { domain: '.meine-seite.de' }, // optional: für Subdomains
  categories: [ … ],                // optional: eigene Kategorien (z. B. "media")
  logging: { endpoint: 'https://…' },    // optional: Nachweis-Protokoll
  respectGpc: true,                 // optional: Global Privacy Control = kein Marketing bei "Alle akzeptieren"
  texts: { de: { bannerTitle: '…' } },   // optional: Text-Overrides
  ui: { position: 'bottom', theme: { accent: '#0a7c55' } }, // optional: Design
  debug: false,
});
```

Alle Optionen sind vollständig typisiert – Tippfehler (z. B. `respectGcp` oder eine
GTM-ID ohne `GTM-`) werden im Editor sofort rot markiert.

## Werkzeuge

```bash
# Live-Seite prüfen (klickt nichts an); optional zusätzlich nach "Alle ablehnen"
npm i -D playwright && npx playwright install chromium   # einmalig
npx consent-kit check https://meine-seite.de --reject

# Tabelle aller Dienste für die Datenschutzerklärung (Markdown + HTML)
npx consent-kit table src/consent.config.ts --owner="Meine Firma GmbH"
```

## Rechtliche und technische Hinweise

- **Mustertexte:** Alle Standardtexte (Banner, Dialog, Dienst-Beschreibungen, Speicherdauern)
  sind **Mustertexte – rechtlich prüfen lassen**. Sie können sie über `texts` und `meta`
  überschreiben.
- **Strict mode ist Standard.** `googleTagManager({ loadBeforeConsent: true })` lädt GTM schon
  vor der Einwilligung (Consent Mode „advanced“). Das ist **rechtlich riskant**, weil dann schon
  vor jeder Entscheidung Requests an Google gehen – nur nach Rücksprache mit Ihrer
  Rechtsberatung verwenden.
- **Safari/ITP:** Safari begrenzt per JavaScript gesetzte Cookies auf 7 Tage. Safari-Besucher
  werden daher ggf. häufiger gefragt. Das ist eine Browser-Einschränkung.
- **Externe Ressourcen:** Google Fonts, CDNs usw. übertragen ebenfalls IP-Adressen. Binden Sie
  Schriften lokal ein – `npx consent-kit check` zeigt solche Requests an.
- **Protokollierung (Nachweis):** Mit `logging.endpoint` wird jede Entscheidung (Consent-ID,
  Zeitstempel, Version, Kategorien, Domain – **ohne** IP-Adresse und User-Agent) an Ihren
  Endpunkt gesendet. Ein fertiger Cloudflare Worker liegt in `worker/` – Einrichtung Schritt für
  Schritt in [docs/WORKER.md](docs/WORKER.md).

## Entwicklung

```bash
npm install
npm run demo        # Demo-Seite mit Hot Reload: http://localhost:5173
npm test            # Typprüfung, Unit-Tests, Browser-Tests, Größenprüfung
npm run build       # baut dist/ (wird mit eingecheckt, damit die Git-Installation ohne Build funktioniert)
```

Ordner: `src/` (Paket), `demo/` (Demo-Seite), `e2e/` (Playwright-Tests), `test/` (Unit-Tests),
`worker/` (Cloudflare Worker für die Protokollierung), `docs/` (Dokumentation).

**Neue Version veröffentlichen:** Version in `package.json` erhöhen, `npm run build && npm test`,
CHANGELOG ergänzen, committen und pushen. Dann auf GitHub → **Releases** → **Draft a new release**
→ Tag `vX.Y.Z` neu anlegen, als Ziel den Branch `main` wählen → **Publish release**.

Lizenz: MIT
