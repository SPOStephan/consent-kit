# Meta Conversions API mit consent-kit

Seit v0.3.0 bringt consent-kit alles mit, um Meta-Ereignisse **im Browser (Pixel) und auf dem
Server (Conversions API, CAPI)** einwilligungskonform und ohne Doppelzählung zu senden.

> Mustertexte und technische Hinweise – rechtlich prüfen lassen. Server-Ereignisse an Meta sind
> eine Datenübermittlung zu Werbezwecken und brauchen dieselbe Einwilligung wie der Pixel.

## Überblick

| Baustein | Import | Zweck |
| --- | --- | --- |
| `metaPixel({ id })` | `consent-kit` | lädt den Pixel nach Einwilligung; setzt `_fbc` aus der Einstiegs-URL nach |
| `trackMetaEvent(name, params, { eventId })` | `consent-kit/meta` | Ereignis im Browser senden – nur mit Einwilligung, gibt die Ereignis-ID zurück |
| `getMetaBrowserIds()` | `consent-kit/meta` | `fbp`/`fbc` des Besuchers – nur mit Einwilligung |
| `hasServerConsent(cookies, config, 'meta-pixel')` | `consent-kit/server` | Einwilligung auf dem Server prüfen (gleiche Regeln wie im Browser) |
| `readMetaBrowserIds(cookies)` | `consent-kit/server` | `fbp`/`fbc` aus dem Cookie-Header lesen |

## 1. Browser: Ereignis senden

```ts
import { trackMetaEvent, getMetaBrowserIds } from 'consent-kit/meta';

const eventId = trackMetaEvent('Lead', { content_name: 'KI-Check' });
// eventId ist null, wenn keine Einwilligung vorliegt → dann auch serverseitig nichts senden.

await fetch('/api/lead', {
  method: 'POST',
  body: JSON.stringify({ email, metaEventId: eventId, ...getMetaBrowserIds() }),
});
```

- Standardereignisse (`Lead`, `CompleteRegistration`, `Purchase`, `Subscribe`, …) gehen per
  `fbq('track')`, eigene Namen (z. B. `DisqualifiedLead`) per `fbq('trackCustom')`.
- Ohne `eventId` erzeugt consent-kit eine UUID. Dieselbe ID muss der Server als `event_id`
  verwenden – Meta zählt das Ereignis dann nur einmal.

## 2. Server: Einwilligung prüfen und an Meta senden

```ts
import { hasServerConsent, readMetaBrowserIds } from 'consent-kit/server';
import consentConfig from '../src/consent.config'; // dieselbe Konfiguration wie im Browser

export async function handler(req, res) {
  const cookies = req.headers.cookie; // oder req.cookies
  if (!hasServerConsent(cookies, consentConfig, 'meta-pixel')) return; // nichts an Meta senden
  const { fbp, fbc } = readMetaBrowserIds(cookies);
  // → POST https://graph.facebook.com/v{n}/{PIXEL_ID}/events mit event_id = metaEventId,
  //   action_source "website", event_source_url, user_data (gehashte em/ph, client_ip_address,
  //   client_user_agent, fbp, fbc).
}
```

`consent.config.ts` lässt sich auf dem Server importieren: Die Plugins greifen erst beim Ausführen
auf `window` zu, nicht beim Import.

### Ereignisse ohne Browser-Anfrage (z. B. Zahlungs-Webhooks)

Ein Stripe-Webhook kommt ohne Cookies des Besuchers. Speichern Sie deshalb beim Start des
Bezahlvorgangs, ob eine Meta-Einwilligung vorlag, zusammen mit `fbp`/`fbc` und einer
Ereignis-ID – und verwenden Sie diese Werte im Webhook. Liegt keine Einwilligung vor, wird
nichts an Meta gesendet.

## 3. Klick-ID (`fbclid`) bei späterer Einwilligung

Meta ordnet Besuche über die Klick-ID `fbclid` einer Anzeige zu. Der Pixel setzt das Cookie
`_fbc` aber nur, wenn `fbclid` beim Laden in der URL steht. Stimmt ein Besucher erst nach einem
Seitenwechsel zu, ging die Zuordnung bisher verloren.

`metaPixel()` merkt sich `fbclid` der Einstiegsseite deshalb **nur im Arbeitsspeicher** (kein
Cookie, kein Storage vor der Einwilligung) und setzt `_fbc` (`fb.1.<Zeitstempel>.<fbclid>`,
90 Tage) im Moment der Einwilligung – sofern noch kein `_fbc` existiert und `fbclid` nicht mehr in
der URL steht (dann setzt es der Pixel selbst). Nach einem vollständigen Neuladen der Seite ist
der Wert weg; in Single-Page-Apps bleibt er erhalten.
