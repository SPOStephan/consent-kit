/**
 * Erzeugt Einbau-Code, KI-Prompt und Datenschutz-Tabelle für eine Website.
 */
import { fromRemoteConfig } from '../../src/remote/index';
import { toHtml, toMarkdown } from '../../src/table/index';
import { toRemoteConfig, type Site } from './sites';

import { PACKAGE_VERSION } from './version';

export { PACKAGE_VERSION };
const REPO = 'SPOStephan/consent-kit';

export interface EmbedCode {
  version: string;
  install: string;
  remoteFile: string;
  mainTsx: string;
  routeTracking: string;
  footer: string;
  check: string;
  prompt: string;
  tableMarkdown: string;
  tableHtml: string;
}

function serviceList(site: Site): string[] {
  return site.settings.services.map((s) => {
    switch (s.type) {
      case 'google-tag-manager':
        return `Google Tag Manager ${s.id} (${[s.analytics !== false && 'GA4', s.ads !== false && 'Google Ads'].filter(Boolean).join(' + ')})`;
      case 'meta-pixel':
        return s.loadVia === 'gtm' ? 'Meta Pixel (über GTM)' : `Meta Pixel ${s.id}`;
      case 'tiktok-pixel':
        return s.loadVia === 'gtm' ? 'TikTok Pixel (über GTM)' : `TikTok Pixel ${s.id}`;
      case 'youtube':
        return 'YouTube-Einbettungen';
      case 'google-maps':
        return 'Google-Maps-Einbettungen';
    }
  });
}

export function generateEmbed(site: Site, endpoint: string, now = new Date()): EmbedCode {
  const remote = toRemoteConfig(site, endpoint);
  const config = fromRemoteConfig(remote);
  const install = `npm install github:${REPO}#${PACKAGE_VERSION}`;
  const primaryDomain = site.settings.domains[0] ?? 'https://ihre-seite.de';
  const hasEmbeds = site.settings.services.some((s) => s.type === 'youtube' || s.type === 'google-maps');

  const remoteFile = `// src/consent.remote.ts – erzeugt vom consent-kit Backend am ${now.toISOString().slice(0, 10)}.
// Die Einstellungen werden beim Laden der Seite live vom Backend geholt.
// "fallback" ist eine Sicherheitskopie für den Fall, dass das Backend nicht
// erreichbar ist. Sie darf veralten – bei Gelegenheit einfach neu kopieren.
import type { RemoteOptions } from 'consent-kit/remote';

export const consentRemote: RemoteOptions = {
  endpoint: ${JSON.stringify(endpoint)},
  siteId: ${JSON.stringify(site.id)},
  fallback: ${JSON.stringify(remote, null, 2).replace(/\n/g, '\n  ')},
};
`;

  const mainTsx = `// src/main.tsx (Ausschnitt)
import { ConsentProvider } from 'consent-kit/react';
import { ConsentUI } from 'consent-kit/ui';
import 'consent-kit/ui.css';
import { consentRemote } from './consent.remote';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConsentProvider remote={consentRemote}>
      <App />
      <ConsentUI />
    </ConsentProvider>
  </StrictMode>,
);
`;

  const routeTracking = `// Innerhalb des Routers (z. B. in App.tsx) – genau ein PageView pro Seitenwechsel
import { usePageViews } from 'consent-kit/react';

// React Router:
import { useLocation } from 'react-router-dom';
function RouteTracking() {
  usePageViews(useLocation());
  return null;
}

// wouter:
// import { useLocation } from 'wouter';
// function RouteTracking() { const [location] = useLocation(); usePageViews(location); return null; }
`;

  const footer = `import { CookieSettingsLink } from 'consent-kit/react';

<CookieSettingsLink>Cookie-Einstellungen</CookieSettingsLink>
`;

  const check = `npx consent-kit check ${primaryDomain} --reject`;

  const prompt = `Du baust in dieses Vite/React-Projekt das Consent-Management "consent-kit" ein.
Die Einstellungen (Dienste, IDs, Texte, Design) kommen zentral aus meinem consent-kit Backend –
du musst mich NICHT nach IDs fragen. Arbeite die Schritte A–G nacheinander ab und erkläre mir
jeden Schritt kurz auf Deutsch in einfacher Sprache. Frage mich, bevor du etwas veröffentlichst
oder deployst. Behaupte nirgends, die Seite sei damit "rechtssicher" – alle Texte sind
Mustertexte, die ich rechtlich prüfen lassen muss.

Diese Website: ${site.settings.name} (${site.settings.domains.join(', ')})
Website-Kennung im Backend: ${site.id}
Aktive Dienste laut Backend: ${serviceList(site).join('; ') || 'keine'}
Dokumentation nach der Installation: node_modules/consent-kit/README.md und node_modules/consent-kit/docs/

A) INSTALLIEREN
   ${install}
   (bei pnpm: pnpm add github:${REPO}#${PACKAGE_VERSION})

B) EINSTELLUNGEN EINBINDEN
   Lege die Datei src/consent.remote.ts mit GENAU diesem Inhalt an:

${remoteFile.replace(/^/gm, '   ')}
C) ALLE FEST EINGEBAUTEN TRACKING-SNIPPETS ENTFERNEN
   - Durchsuche das GESAMTE Projekt (index.html, public/, src/, besonders main.tsx, App.tsx,
     Layout-/Head-/SEO-Komponenten, .env-Dateien, vite.config.*) nach: googletagmanager.com, GTM-,
     gtag(, dataLayer, google-analytics, G-, AW-, connect.facebook.net, fbq(, analytics.tiktok.com,
     ttq, react-ga, react-gtm, react-facebook-pixel, tiktok-pixel, @vercel/analytics, plausible,
     hotjar, clarity.
   - Entferne alle diese Snippets vollständig (inkl. <noscript>) und deinstalliere Tracking-Pakete.
     Das Laden übernimmt ab jetzt ausschließlich consent-kit.
   - Prüfe, ob die gefundenen IDs zu den oben genannten aktiven Diensten passen. Wenn nicht
     (z. B. ein anderer Pixel oder ein Dienst fehlt): NICHT selbst einbauen, sondern mir melden –
     ich trage ihn im Backend nach.
   - Zeige mir eine Liste: Datei → was entfernt wurde.

D) EXTERNE RESSOURCEN FINDEN UND MELDEN
   - Suche nach fonts.googleapis.com, fonts.gstatic.com, use.typekit.net, fonts.bunny.net, unpkg.com,
     cdn.jsdelivr.net, cdnjs.cloudflare.com, maps.googleapis.com, www.google.com/recaptcha,
     Chat-Widgets, externen Bildern/Videos/iframes.
   - Google Fonts lokal einbinden (z. B. npm install @fontsource-variable/<schrift> + Import in
     main.tsx) und die Google-Einbindung entfernen.
   - Alles andere mir in einer Liste mit Vorschlag melden; erst nach meiner Zustimmung ändern.

E) PROVIDER, BANNER, ROUTER-ANBINDUNG UND FOOTER-LINK EINBAUEN
   - src/main.tsx:

${mainTsx.replace(/^/gm, '     ')}
   - Seitenwechsel melden (Komponente INNERHALB des Routers einbinden):

${routeTracking.replace(/^/gm, '     ')}
   - Footer: auf JEDER Seite sichtbar einen Link "Cookie-Einstellungen":

${footer.replace(/^/gm, '     ')}
   - Prüfe, dass Impressum (${site.settings.links.imprint}) und Datenschutzerklärung (${site.settings.links.privacy})
     erreichbar sind.

F) EINBETTUNGEN HINTER <ConsentGate> LEGEN
   - Finde alle <iframe> und Einbettungen von Drittanbietern und lege sie in
       import { ConsentGate } from 'consent-kit/react';
       <ConsentGate service="youtube" aspectRatio="16 / 9"> …iframe… </ConsentGate>
     (Google Maps: service="google-maps"; YouTube-URLs auf www.youtube-nocookie.com umstellen.)
   ${hasEmbeds ? '- YouTube/Google Maps sind im Backend aktiviert.' : '- Im Backend sind derzeit KEINE Einbettungen aktiviert. Findest du welche, melde sie mir – ich aktiviere sie im Backend.'}

G) PRÜFEN UND ERGEBNIS ZEIGEN
   - npm run build (muss ohne Fehler durchlaufen).
   - npm i -D playwright && npx playwright install chromium
   - npx vite preview (Port 4173) im Hintergrund starten, dann:
       npx consent-kit check http://localhost:4173 --reject
     Hinweis: Die Adresse ${new URL(endpoint).host} ist mein eigenes consent-kit Backend
     und darf in den „Hinweisen“ erscheinen. Bei „❌ Problemen“: beheben und erneut prüfen, bis „✅ OK“.
   - Zeige mir die vollständige Ausgabe und fasse zusammen, was geändert wurde. Erinnere mich,
     nach dem Deploy die Live-Seite zu prüfen:
       ${check}
`;

  return {
    version: PACKAGE_VERSION,
    install,
    remoteFile,
    mainTsx,
    routeTracking,
    footer,
    check,
    prompt,
    tableMarkdown: toMarkdown(config, { owner: site.settings.owner || undefined }),
    tableHtml: toHtml(config, { owner: site.settings.owner || undefined }),
  };
}
