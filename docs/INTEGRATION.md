# consent-kit in eine bestehende Vite/React-Website einbauen

Diese Anleitung führt Schritt für Schritt durch den Einbau. Dauer: ca. 30–60 Minuten.
Tipp: Den Großteil kann eine KI für Sie erledigen – siehe
[INTEGRATIONS-PROMPT.md](INTEGRATIONS-PROMPT.md).

> Alle Texte des Kits sind **Mustertexte – rechtlich prüfen lassen**.

> **Sie nutzen das consent-kit Backend?** Dann brauchen Sie diese Anleitung nicht im Detail:
> Legen Sie die Website in der Admin-Oberfläche an und kopieren Sie unter **Einbau** den
> fertigen KI-Prompt bzw. Code (statt `consent.config.ts` gibt es dann eine
> `consent.remote.ts`). Siehe [BACKEND.md](BACKEND.md). Diese Anleitung beschreibt den Betrieb
> **ohne** Backend.

---

## Schritt 1: Paket installieren

Im Ordner Ihrer Website (dort, wo die `package.json` liegt):

```bash
npm install github:SPOStephan/consent-kit#v0.3.0
```

In der `package.json` steht danach:

```json
"consent-kit": "github:SPOStephan/consent-kit#v0.3.0"
```

Ist das Repository privat, lesen Sie zuerst [INSTALLATION.md](INSTALLATION.md).

## Schritt 2: Bestehende Tracking-Snippets entfernen

**Ganz wichtig:** Alle fest eingebauten Tracking-Codes müssen raus – sonst laden sie weiterhin
ohne Einwilligung. Suchen Sie im gesamten Projekt (vor allem `index.html`, `src/main.tsx`,
`src/App.tsx`, Layout-/Head-Komponenten) nach:

| Suchbegriff | Dienst |
| --- | --- |
| `googletagmanager.com`, `GTM-`, `gtag(`, `dataLayer`, `G-`, `AW-` | Google Tag Manager / Analytics / Ads |
| `connect.facebook.net`, `fbq(` | Meta Pixel |
| `analytics.tiktok.com`, `ttq` | TikTok Pixel |
| `react-ga`, `react-gtm`, `react-facebook-pixel`, `@vercel/analytics` | Tracking-Bibliotheken |

Notieren Sie sich dabei die IDs (GTM-Container-ID, Meta-Pixel-ID, TikTok-Pixel-ID) –
Sie brauchen sie in Schritt 3. Entfernen Sie die Snippets vollständig (auch `<noscript>`-Teile).
Deinstallieren Sie ggf. Tracking-Pakete (`npm uninstall react-ga4` o. Ä.).

## Schritt 3: `src/consent.config.ts` anlegen

```ts
import { defineConfig, googleTagManager, googleMaps, metaPixel, tiktokPixel, youtube } from 'consent-kit';

export default defineConfig({
  // Erhöhen Sie die Version, wenn Sie Dienste hinzufügen/ändern –
  // dann werden alle Besucher erneut gefragt.
  version: 1,
  language: 'de',
  links: {
    imprint: '/impressum',
    privacy: '/datenschutz',
  },
  // Optional: Einwilligung auch für Subdomains teilen (z. B. shop.meine-seite.de)
  // cookie: { domain: '.meine-seite.de' },
  services: [
    googleTagManager({ id: 'GTM-XXXXXXX' }),
    // Meta und TikTok: ENTWEDER hier ODER in GTM – nie beides (siehe GTM.md)
    metaPixel({ id: '123456789012345' }),
    tiktokPixel({ id: 'CXXXXXXXXXXXXXXXXXXX' }),
    // Nur eintragen, wenn Sie diese Inhalte einbetten:
    youtube(),
    googleMaps(),
  ],
  // Optional:
  // respectGpc: true,
  // logging: { endpoint: 'https://consent-log.<ihr-name>.workers.dev/log' },
  // ui: { position: 'bottom', theme: { accent: '#0a7c55', fontFamily: 'Inter, sans-serif' } },
});
```

Nicht genutzte Dienste einfach weglassen. Tippfehler markiert der Editor sofort rot.

## Schritt 4: Provider und Banner einbauen

In `src/main.tsx` (oder dort, wo `createRoot(...).render(...)` steht):

```tsx
import { ConsentProvider } from 'consent-kit/react';
import { ConsentUI } from 'consent-kit/ui';
import 'consent-kit/ui.css';
import consentConfig from './consent.config';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConsentProvider config={consentConfig}>
      <App />
      <ConsentUI owner="Meine Firma GmbH" />
    </ConsentProvider>
  </StrictMode>,
);
```

`<ConsentUI />` zeigt das Banner (solange nicht entschieden wurde) und den
Einstellungsdialog. Es kann innerhalb oder außerhalb des Routers stehen.

## Schritt 5: PageViews bei Seitenwechseln (React Router)

Damit GTM, Meta und TikTok bei jedem Seitenwechsel genau einen PageView erhalten, fügen Sie
**innerhalb** des Routers eine kleine Komponente ein:

```tsx
import { useLocation } from 'react-router-dom';
import { usePageViews } from 'consent-kit/react';

function RouteTracking() {
  usePageViews(useLocation());
  return null;
}

// z. B. in App.tsx:
<BrowserRouter>
  <RouteTracking />
  <Routes>…</Routes>
</BrowserRouter>
```

**Mit wouter** (häufig bei Manus-Projekten):

```tsx
import { useLocation } from 'wouter';
function RouteTracking() {
  const [location] = useLocation();
  usePageViews(location);
  return null;
}
```

**Ohne Router:** `usePageViews()` ohne Argument erkennt Wechsel automatisch über die History-API.

Der erste Seitenaufruf wird nicht doppelt gezählt.

## Schritt 6: Footer-Link „Cookie-Einstellungen“

Der Widerruf muss so einfach sein wie die Einwilligung. Fügen Sie im Footer (auf jeder Seite
sichtbar) ein:

```tsx
import { CookieSettingsLink } from 'consent-kit/react';

<CookieSettingsLink>Cookie-Einstellungen</CookieSettingsLink>
```

Der Button sieht aus wie ein Link und übernimmt Schrift und Farbe Ihres Footers.
Eigenes Styling: `className="…"`. Ohne React: `window.consentKit.openSettings()`.

## Schritt 7: Eingebettete Inhalte (YouTube, Google Maps, …)

Jedes `<iframe>` eines Drittanbieters wird in ein `<ConsentGate>` gelegt:

```tsx
import { ConsentGate } from 'consent-kit/react';

<ConsentGate service="youtube" aspectRatio="16 / 9">
  <iframe src="https://www.youtube-nocookie.com/embed/VIDEO_ID" title="Video" allowFullScreen />
</ConsentGate>

<ConsentGate service="google-maps" aspectRatio="4 / 3">
  <iframe src="https://www.google.com/maps/embed?pb=…" title="Karte" loading="lazy" />
</ConsentGate>
```

Vorher erscheint ein Platzhalter mit Hinweis und Button „Inhalt laden“ – das ist eine
Einwilligung für genau diesen Dienst. Andere Anbieter (Vimeo, Calendly, …) ergänzen Sie mit
`embed({ id: 'vimeo', meta: {...} })` in der Konfiguration.

## Schritt 8: Externe Ressourcen prüfen

Auch **Google Fonts**, CDNs (unpkg, jsdelivr, cdnjs), reCAPTCHA oder Chat-Widgets übertragen
die IP-Adresse an Dritte. Suchen Sie nach `fonts.googleapis.com`, `fonts.gstatic.com`,
`cdn.`, `unpkg.com`, `jsdelivr.net`, `use.typekit.net`.

**Google Fonts lokal einbinden** (Beispiel „Inter“):

```bash
npm install @fontsource-variable/inter
```

```ts
// src/main.tsx
import '@fontsource-variable/inter';
```

Danach den `<link href="https://fonts.googleapis.com/…">` aus `index.html` und `@import`-Zeilen
aus CSS-Dateien entfernen.

## Schritt 9: Datenschutzerklärung ergänzen

```bash
npx consent-kit table --owner="Meine Firma GmbH" --out=dienste-tabelle.md
```

erzeugt eine Tabelle aller Dienste (Anbieter, Zweck, Cookies, Speicherdauer, Drittland) als
Markdown und HTML. Alternativ direkt in React:
`import { getServiceRows } from 'consent-kit/table'`. **Mustertext – rechtlich prüfen lassen.**

## Schritt 10: Testen

```bash
npm run build
npx vite preview            # läuft auf http://localhost:4173

# in einem zweiten Terminal (einmalig: npm i -D playwright && npx playwright install chromium)
npx consent-kit check http://localhost:4173 --reject
```

Ergebnis „✅ OK“ = keine Tracking-Requests und -Cookies vor der Einwilligung und nach
„Alle ablehnen“. Nach dem Veröffentlichen prüfen Sie zusätzlich die Live-Seite:

```bash
npx consent-kit check https://meine-seite.de --reject
```

Manuell im Browser: Entwicklertools (F12) → Netzwerk → Seite neu laden → vor dem Klick im
Banner dürfen keine Requests an `googletagmanager.com`, `facebook`, `tiktok` usw. erscheinen.

## Schritt 11: GTM einrichten

Siehe [GTM.md](GTM.md) – insbesondere, wenn Sie Google Analytics 4 und Google Ads über
GTM nutzen.

---

## Updates

```bash
npm install github:SPOStephan/consent-kit#v0.4.0
```

Lesen Sie vorher das [CHANGELOG](../CHANGELOG.md). Wenn sich Ihre Dienste ändern, erhöhen Sie
`version` in der `consent.config.ts`.

## Häufige Fragen

**Das Banner erscheint nicht.** `<ConsentUI />` muss innerhalb von `<ConsentProvider>` stehen,
und `import 'consent-kit/ui.css'` muss vorhanden sein.

**GTM lädt nicht nach „Alle akzeptieren“.** Adblocker deaktivieren; `debug: true` in der
Konfiguration zeigt in der Browser-Konsole, was passiert.

**Ich habe einen neuen Dienst hinzugefügt.** `version` erhöhen – dann werden alle Besucher
erneut gefragt.

**Kann ich das Design anpassen?** Ja, über `ui.theme` (helles Schema) und `ui.darkTheme`
(dunkles Schema) in der Konfiguration oder per CSS, z. B. `.ck-root { --ck-accent: #0a7c55; }`.
Alle Buttons im Banner nutzen bewusst dieselbe Farbe (`--ck-btn-bg`) – bitte keine Hervorhebung
von „Alle akzeptieren“ einbauen.

**Mein Hosting nutzt eine Content-Security-Policy.** Erlauben Sie `style-src 'unsafe-inline'`
(nur für die Design-Variablen) oder setzen Sie das Design per CSS statt über `ui.theme`.
