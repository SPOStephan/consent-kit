# Google Tag Manager passend zu consent-kit einrichten

Diese Anleitung erklärt, wie Sie Ihren GTM-Container so einrichten, dass er mit consent-kit
zusammenarbeitet – für Google Analytics 4 (GA4), Google Ads und optional Meta/TikTok.

> Mustertext – rechtlich prüfen lassen. Die Anleitung beschreibt die technische Einrichtung.

---

## Wie consent-kit mit GTM zusammenarbeitet

1. **Beim Seitenstart** (ohne Request an Google) legt consent-kit `window.dataLayer` und
   `gtag()` an und setzt die Consent-Mode-Standardwerte:

   ```js
   gtag('consent', 'default', {
     ad_storage: 'denied',
     analytics_storage: 'denied',
     ad_user_data: 'denied',
     ad_personalization: 'denied',
     security_storage: 'granted',
     wait_for_update: 500,
   });
   gtag('set', 'ads_data_redaction', true);
   ```

2. **Nach der Einwilligung** aktualisiert consent-kit den Consent-Status je Kategorie …

   | Kategorie im Banner | Consent-Mode-Signal |
   | --- | --- |
   | Statistik | `analytics_storage` |
   | Marketing | `ad_storage`, `ad_user_data`, `ad_personalization` |

   … schreibt ein Event ins dataLayer …

   ```js
   {
     event: 'consent_update',
     consent_necessary: true,
     consent_statistics: true,   // oder false
     consent_marketing: false,   // oder true
     consent_categories: ['necessary', 'statistics'],
   }
   ```

   … und **lädt erst danach** den GTM-Container (`gtm.js`). Beim Start von GTM ist der
   Consent-Status also bereits korrekt gesetzt.

3. **Bei jedem Seitenwechsel** (Single-Page-App) schreibt consent-kit – nur wenn GTM geladen
   ist – ein Event:

   ```js
   {
     event: 'virtual_pageview',
     page_path: '/produkte',
     page_location: 'https://meine-seite.de/produkte',
     page_title: 'Produkte',
     page_referrer: 'https://meine-seite.de/',
   }
   ```

4. **Beim Widerruf** setzt consent-kit alles auf `denied`, löscht die Google-Cookies
   (`_ga*`, `_gid`, `_gcl_*` …) und lädt die Seite neu.

**Lädt GTM überhaupt, wenn nur „Statistik“ erlaubt ist?** Ja – GTM lädt, sobald Statistik
**oder** Marketing erlaubt ist. Welche Tags dann feuern, steuert der Consent Mode.

---

## Einmalige Einrichtung im Container

### 1. Einwilligungsübersicht aktivieren

GTM → **Verwaltung** → **Container-Einstellungen** → „**Einwilligungsübersicht aktivieren**“
anhaken → Speichern. Danach gibt es in der Tag-Liste ein Schild-Symbol, über das Sie für
alle Tags die Consent-Einstellungen sehen.

### 2. KEINE zusätzliche CMP-Vorlage verwenden

Verwenden Sie **keine** Consent-Vorlage eines anderen Anbieters (Cookiebot, Usercentrics,
„Consent Mode (Google tags)“ o. Ä.) und keinen eigenen `gtag('consent', 'default', …)`-Tag.
Das erledigt consent-kit. Entfernen Sie solche Tags, falls vorhanden.

### 3. Variablen anlegen

**Variablen** → **Benutzerdefinierte Variablen** → **Neu** → Typ „**Datenschichtvariable**“:

| Name der Variable | Name der Datenschichtvariable |
| --- | --- |
| `DLV - consent_statistics` | `consent_statistics` |
| `DLV - consent_marketing` | `consent_marketing` |
| `DLV - page_location` | `page_location` |
| `DLV - page_title` | `page_title` |
| `DLV - page_referrer` | `page_referrer` |

### 4. Trigger anlegen

**Trigger** → **Neu** → Typ „**Benutzerdefiniertes Ereignis**“:

| Name | Ereignisname | Auslösen bei |
| --- | --- | --- |
| `CK - Virtual Pageview` | `virtual_pageview` | Alle benutzerdefinierten Ereignisse |
| `CK - Consent Update Statistik` | `consent_update` | Einige: `DLV - consent_statistics` ist gleich `true` |
| `CK - Consent Update Marketing` | `consent_update` | Einige: `DLV - consent_marketing` ist gleich `true` |

---

## Google Analytics 4

### Google-Tag (GA4-Konfiguration)

- **Tag-Typ:** Google-Tag, Tag-ID `G-XXXXXXXXXX`
- **Trigger:** „**Initialisierung – Alle Seiten**“ (Initialization – All Pages)
- **Einwilligungseinstellungen:** „Keine zusätzliche Einwilligung erforderlich“ – der
  Google-Tag berücksichtigt `analytics_storage` automatisch (integrierte Einwilligungsprüfung).

Der Google-Tag sendet beim Laden automatisch einen `page_view` für die aktuelle Seite –
das ist der erste Seitenaufruf.

### Seitenwechsel (Single-Page-App)

- **Tag-Typ:** Google Analytics: GA4-Ereignis
- **Mess-ID:** `G-XXXXXXXXXX`
- **Ereignisname:** `page_view`
- **Ereignisparameter:**
  `page_location` = `{{DLV - page_location}}`,
  `page_title` = `{{DLV - page_title}}`,
  `page_referrer` = `{{DLV - page_referrer}}`
- **Trigger:** `CK - Virtual Pageview`

**Wichtig gegen Doppelzählung:** In **GA4** → **Verwaltung** → **Datenstreams** → Ihr Stream →
**Erweiterte Analysen** → Zahnrad bei „Seitenaufrufe“ → „**Seitenänderungen auf Grundlage von
Browserverlaufsereignissen**“ **deaktivieren**. Sonst zählt GA4 jeden Seitenwechsel zusätzlich
selbst.

---

## Google Ads

- **Conversion-Verknüpfung** (Conversion Linker): Trigger „Initialisierung – Alle Seiten“.
- **Conversion-Tracking-Tags:** Trigger wie gewohnt (z. B. Danke-Seite als `CK - Virtual Pageview`
  mit Bedingung `Page Path` bzw. `{{DLV - page_location}}` enthält `/danke`).
- **Remarketing-Tag:** Trigger „Initialisierung – Alle Seiten“ **und** `CK - Virtual Pageview`.

Die Google-Ads-Tags haben integrierte Einwilligungsprüfungen für `ad_storage`,
`ad_user_data` und `ad_personalization`. Ist nur „Statistik“ erlaubt, lädt GTM zwar, die
Werbe-Signale stehen aber auf „denied“ – Google-Ads-Tags setzen dann keine Werbe-Cookies.
Wenn Sie in diesem Fall gar keine Ads-Requests möchten, geben Sie den Ads-Tags zusätzlich die
Einwilligungsprüfung `ad_storage` („Zusätzliche Einwilligung erforderlich“).

---

## Meta und TikTok: über GTM oder über das Kit?

**Entscheiden Sie sich pro Pixel für genau einen Weg. Beide gleichzeitig = doppelte Zählung.**

| | Über consent-kit (empfohlen) | Über GTM |
| --- | --- | --- |
| Konfiguration | `metaPixel({ id: '…' })` | `metaPixel({ loadVia: 'gtm' })` |
| Wer lädt das Skript? | consent-kit, erst nach Marketing-Einwilligung | GTM (Tag mit Einwilligungsprüfung) |
| PageViews bei Seitenwechsel | automatisch | GTM-Trigger `CK - Virtual Pageview` |
| Revoke-Signal, Cookies löschen | automatisch | automatisch |
| Aufwand | gering | höher, Fehler möglich |

Mit `loadVia: 'gtm'` lädt consent-kit **kein** Pixel-Skript, zeigt den Dienst aber im Dialog
und in der Datenschutz-Tabelle an, sendet beim Widerruf `fbq('consent', 'revoke')` bzw.
`ttq.revokeConsent()` und löscht die Cookies.

### Einrichtung in GTM (nur bei `loadVia: 'gtm'`)

**Meta Pixel** (Community-Vorlage „Facebook Pixel“ von facebookarchive oder Custom HTML):

- **Einwilligungseinstellungen:** „**Zusätzliche Einwilligung für das Auslösen von Tags
  erforderlich**“ → `ad_storage` (und `ad_user_data`).
- **Trigger für den Basis-Code + PageView:** „Initialisierung – Alle Seiten“ **und**
  `CK - Consent Update Marketing` (damit der Pixel auch direkt nach dem Klick auf „Alle
  akzeptieren“ startet). Unter **Erweiterte Einstellungen** → **Tag-Auslösungsoptionen** →
  „**Einmal pro Seite**“.
- **Seitenwechsel:** zweiter Tag „PageView“ mit Trigger `CK - Virtual Pageview`.
- In der Vorlage die Option für automatische History-PageViews ausschalten
  (bzw. im Custom HTML vor dem Laden `fbq.disablePushState = true;` setzen), sonst doppelte
  PageViews.

**TikTok Pixel** (offizielle Vorlage „TikTok Pixel“ im Community-Vorlagen-Katalog):

- **Einwilligungseinstellungen:** zusätzliche Einwilligung `ad_storage`.
- **Trigger:** „Initialisierung – Alle Seiten“ + `CK - Consent Update Marketing`
  („Einmal pro Seite“) und für Seitenwechsel `CK - Virtual Pageview`.

---

## Testen mit dem Vorschaumodus (Tag Assistant)

1. In GTM auf **Vorschau** klicken und Ihre Seite eingeben.
2. Im Banner zunächst **nichts** anklicken: Tag Assistant verbindet sich **nicht** – richtig so,
   denn GTM wird erst nach Einwilligung geladen.
3. „Alle akzeptieren“ klicken → Tag Assistant verbindet sich. Unter **Einwilligung** sehen Sie
   „Standard: denied“ und „Aktualisierung: granted“.
4. Seite wechseln → Ereignis `virtual_pageview` erscheint, der GA4-`page_view`-Tag feuert genau
   einmal.
5. Über „Cookie-Einstellungen“ → „Alle ablehnen“ → die Seite lädt neu, GTM lädt nicht mehr.

## Optional: GTM vor der Einwilligung laden (rechtlich riskant)

```ts
googleTagManager({ id: 'GTM-XXXXXXX', loadBeforeConsent: true });
```

> ⚠️ **Rechtlich riskant.** In diesem Modus („Consent Mode advanced“) wird GTM sofort geladen.
> Google erhält dann schon **vor** jeder Entscheidung Requests (u. a. cookielose Pings mit
> IP-Adresse und Geräteinformationen). Ob das mit § 25 TDDDG und der DSGVO vereinbar ist, ist
> umstritten. Verwenden Sie diese Option nur nach Rücksprache mit Ihrer Rechtsberatung.
> `npx consent-kit check` meldet die dadurch entstehenden Requests als Problem.

## Weitere Optionen

```ts
googleTagManager({
  id: 'GTM-XXXXXXX',
  analytics: true,               // GA4 über GTM (Kategorie Statistik)
  ads: true,                     // Google Ads über GTM (Kategorie Marketing)
  dataLayerName: 'dataLayer',
  scriptOrigin: 'https://sgtm.meine-seite.de', // z. B. Server-Side-Tagging
  environment: { auth: '…', preview: 'env-3' }, // GTM-Umgebungen
  consentEvent: 'consent_update',
  pageViewEvent: 'virtual_pageview',
  urlPassthrough: false,
  adsDataRedaction: true,
});
```

Nutzen Sie nur GA4 (keine Google Ads), setzen Sie `ads: false` – dann erscheint GTM im
Dialog nur unter „Statistik“ und lädt nur mit Statistik-Einwilligung.
