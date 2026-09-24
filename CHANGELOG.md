# Changelog

Alle wichtigen Änderungen an consent-kit. Versionen folgen [Semantic Versioning](https://semver.org/lang/de/):
`MAJOR.MINOR.PATCH` – bei MAJOR-Sprüngen kann eine Anpassung Ihrer `consent.config.ts` nötig sein.

Installation einer bestimmten Version: `npm install github:SPOStephan/consent-kit#vX.Y.Z`

## [0.1.0] – 2026-09-24

Erste Version.

### Core
- Einwilligung im First-Party-Cookie `consent_kit` (SameSite=Lax, Secure unter HTTPS,
  Domain konfigurierbar): anonyme Consent-ID, Zeitstempel, Konfig-Version, Kategorien,
  individuelle Dienst-Entscheidungen.
- API: `init`, `acceptAll`, `rejectAll`, `setCategories`, `setService`, `openSettings`,
  `getState`, `hasConsent`, `on`, `notifyRouteChange`, `autoTrackRouteChanges`.
- Events `consent:ready`, `consent:changed`, `consent:revoked`.
- Plugin-Interface (`onInit`, `onConsent`, `onGrant`, `onRevoke`, `onRouteChange`,
  `cookiePatterns`), Skripte werden nie doppelt eingefügt, mehrfaches `init()` ist unschädlich.
- Widerruf: Revoke-Signale, Cookies löschen, Seite neu laden.
- Erneute Abfrage bei neuer Konfig-Version und nach spätestens 12 Monaten.
- Optional: Global Privacy Control (`respectGpc`), Protokollierung (`logging.endpoint`).

### Dienste
- `googleTagManager` mit Google Consent Mode v2 (strict mode; `loadBeforeConsent` optional
  und als rechtlich riskant gekennzeichnet), dataLayer-Events `consent_update` und
  `virtual_pageview`.
- `metaPixel`, `tiktokPixel` – über das Kit oder über GTM (`loadVia: 'gtm'`).
- `youtube`, `googleMaps`, `embed` für `<ConsentGate>`.

### React und UI
- `consent-kit/react`: `ConsentProvider`, `useConsent`, `ConsentGate`, `usePageViews`,
  `CookieSettingsLink`.
- `consent-kit/ui` + `ui.css`: Banner (unten/mittig) und Einstellungsdialog, barrierefrei,
  mobil, Dark Mode, CSS-Variablen. Texte auf Deutsch und Englisch (Mustertexte).

### Werkzeuge
- `npx consent-kit check <url> [--reject]` – prüft eine Seite ohne Klick auf Tracking vor der
  Einwilligung.
- `npx consent-kit table` – Dienste-Tabelle für die Datenschutzerklärung (Markdown/HTML).

### Tests
- Unit-Tests (Vitest), Browser-Tests gegen die Demo-Seite (Playwright, inkl. axe), Größenprüfung.
