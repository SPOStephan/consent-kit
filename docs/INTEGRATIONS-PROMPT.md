# Integrations-Prompt für Cursor, Manus oder Claude Code

> **Mit Backend?** Verwenden Sie stattdessen den Prompt aus der Admin-Oberfläche (Reiter
> **Einbau**) – er enthält bereits alle IDs und Einstellungen Ihrer Website. Dieser Prompt hier
> ist für den Betrieb **ohne** Backend (mit `consent.config.ts`).

Kopieren Sie den folgenden Text **komplett** in die KI Ihres Website-Projekts. Die KI baut
consent-kit ein, entfernt alte Tracking-Codes und prüft am Ende das Ergebnis.

Vorher anpassen: die Versionsnummer (`v0.3.0`), falls es eine neuere gibt – siehe
[CHANGELOG](../CHANGELOG.md).

---

```text
Du baust in dieses Vite/React-Projekt das Consent-Management "consent-kit" ein.
Arbeite die Schritte A–G nacheinander ab. Erkläre mir jeden Schritt kurz auf Deutsch in
einfacher Sprache. Frage mich, bevor du etwas veröffentlichst oder deployst.
Behaupte nirgends, die Seite sei damit "rechtssicher" oder vollständig datenschutzkonform –
alle Texte sind Mustertexte, die ich rechtlich prüfen lassen muss.

Dokumentation des Pakets (nach der Installation lokal verfügbar):
node_modules/consent-kit/README.md und node_modules/consent-kit/docs/ (INTEGRATION.md, GTM.md)

A) INSTALLIEREN
   - Führe aus: npm install github:SPOStephan/consent-kit#v0.3.0
     (bei pnpm: pnpm add github:SPOStephan/consent-kit#v0.3.0)
   - Prüfe, dass in package.json "consent-kit" mit genau dieser Version steht.

B) KONFIGURATION ANLEGEN: src/consent.config.ts
   - Durchsuche zuerst das Projekt nach vorhandenen Tracking-IDs (GTM-…, G-…, AW-…,
     Meta-Pixel-ID in fbq('init', '…'), TikTok-ID in ttq.load('…')) und zeige sie mir.
   - Frage mich dann nach: GTM-Container-ID, Meta-Pixel-ID, TikTok-Pixel-ID (jeweils "habe ich
     nicht" möglich), ob Meta/TikTok über das Kit ODER über GTM laufen sollen (nie beides!),
     Pfad von Impressum und Datenschutzerklärung, Name der Firma, ob Subdomains die
     Einwilligung teilen sollen (dann cookie.domain), ob YouTube/Google Maps/andere
     Einbettungen genutzt werden. Warte auf meine Antworten.
   - Lege die Datei so an (nur die Dienste, die ich wirklich nutze):

     import { defineConfig, googleTagManager, metaPixel, tiktokPixel, youtube, googleMaps } from 'consent-kit';
     export default defineConfig({
       version: 1,
       language: 'de',
       links: { imprint: '/impressum', privacy: '/datenschutz' },
       services: [
         googleTagManager({ id: 'GTM-…' }),
         metaPixel({ id: '…' }),            // oder metaPixel({ loadVia: 'gtm' })
         tiktokPixel({ id: '…' }),          // oder tiktokPixel({ loadVia: 'gtm' })
         youtube(),                          // nur wenn YouTube eingebettet ist
         googleMaps(),                       // nur wenn Google Maps eingebettet ist
       ],
     });

   - Verwende NICHT die Option loadBeforeConsent.

C) ALLE FEST EINGEBAUTEN TRACKING-SNIPPETS FINDEN UND ENTFERNEN
   - Durchsuche das GESAMTE Projekt (index.html, public/, src/, besonders main.tsx, App.tsx,
     Layout-, Head- und SEO-Komponenten, .env-Dateien, vite.config.*) nach:
     googletagmanager.com, GTM-, gtag(, dataLayer, google-analytics, G-, AW-,
     connect.facebook.net, fbq(, analytics.tiktok.com, ttq, react-ga, react-gtm,
     react-facebook-pixel, tiktok-pixel, @vercel/analytics, plausible, hotjar, clarity.
   - Entferne alle diese Snippets vollständig (inkl. <noscript>-Teile) und deinstalliere
     Tracking-Pakete. Das Laden übernimmt ab jetzt ausschließlich consent-kit.
   - Zeige mir eine Liste: Datei → was entfernt wurde.

D) EXTERNE RESSOURCEN FINDEN UND MELDEN
   - Suche nach Ressourcen, die ohne Einwilligung von fremden Servern geladen werden:
     fonts.googleapis.com, fonts.gstatic.com, use.typekit.net, fonts.bunny.net, unpkg.com,
     cdn.jsdelivr.net, cdnjs.cloudflare.com, maps.googleapis.com, www.google.com/recaptcha,
     Chat-Widgets, externe Bilder/Videos/iframes.
   - Google Fonts: binde sie lokal ein (z. B. npm install @fontsource-variable/<schrift> und
     import in main.tsx, oder Schriftdateien in public/fonts mit @font-face) und entferne die
     <link>/@import-Einbindung von Google.
   - Alles andere: melde es mir in einer Liste mit Vorschlag (lokal einbinden, hinter
     <ConsentGate> legen oder entfernen). Ändere es erst nach meiner Zustimmung.

E) PROVIDER, BANNER, ROUTER-ANBINDUNG UND FOOTER-LINK EINBAUEN
   - In src/main.tsx:
       import { ConsentProvider } from 'consent-kit/react';
       import { ConsentUI } from 'consent-kit/ui';
       import 'consent-kit/ui.css';
       import consentConfig from './consent.config';
     und die App umschließen:
       <ConsentProvider config={consentConfig}>
         <App />
         <ConsentUI owner="<Firmenname>" />
       </ConsentProvider>
   - Seitenwechsel melden – eine Komponente INNERHALB des Routers:
       React Router:  function RouteTracking() { usePageViews(useLocation()); return null; }
       wouter:        function RouteTracking() { const [l] = useLocation(); usePageViews(l); return null; }
       ohne Router:   usePageViews() in der App-Komponente
     (usePageViews aus 'consent-kit/react'.)
   - Footer: auf JEDER Seite sichtbar einen Link "Cookie-Einstellungen":
       import { CookieSettingsLink } from 'consent-kit/react';
       <CookieSettingsLink>Cookie-Einstellungen</CookieSettingsLink>
     (übernimmt Schrift/Farbe des Footers; ggf. className vergeben).
   - Prüfe, dass Impressum und Datenschutzerklärung unter den Pfaden aus der Konfiguration
     erreichbar sind.

F) EINBETTUNGEN HINTER <ConsentGate> LEGEN
   - Finde alle <iframe> und Einbettungen von Drittanbietern (YouTube, Google Maps, Vimeo,
     Calendly, Instagram, …).
   - Lege jede in:
       import { ConsentGate } from 'consent-kit/react';
       <ConsentGate service="youtube" aspectRatio="16 / 9"> …iframe… </ConsentGate>
     YouTube-URLs auf https://www.youtube-nocookie.com/embed/… umstellen.
   - Für Anbieter ohne fertiges Plugin: in consent.config.ts
       embed({ id: 'vimeo', meta: { name, provider, purpose: {de, en}, cookies: [],
               thirdCountryTransfer: {de, en} oder null, privacyPolicyUrl } })
     ergänzen und service="vimeo" verwenden.

G) PRÜFEN UND ERGEBNIS ZEIGEN
   - npm run build (muss ohne Fehler durchlaufen, TypeScript-Fehler beheben).
   - npm i -D playwright && npx playwright install chromium
   - Starte npx vite preview (Port 4173) im Hintergrund und führe aus:
       npx consent-kit check http://localhost:4173 --reject
   - Zeige mir die vollständige Ausgabe. Bei "❌ Problemen": Ursache suchen, beheben, erneut
     prüfen, bis "✅ OK" erscheint. "Hinweise" erkläre mir kurz.
   - Erzeuge die Dienste-Tabelle für die Datenschutzerklärung:
       npx consent-kit table --owner="<Firmenname>" --out=consent-dienste.md
     und frage mich, ob sie in die Datenschutz-Seite übernommen werden soll
     (Mustertext – rechtlich prüfen lassen).
   - Fasse am Ende zusammen: was geändert wurde, welche Dienste aktiv sind, was ich noch in
     Google Tag Manager einstellen muss (siehe node_modules/consent-kit/docs/GTM.md) und dass ich nach
     dem Deploy die Live-Seite mit
       npx consent-kit check https://<meine-domain> --reject
     prüfen soll.
```
