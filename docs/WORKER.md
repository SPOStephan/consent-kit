# Protokollierung der Einwilligungen (Cloudflare Worker)

## Wofür?

Die DSGVO verlangt, dass Sie eine Einwilligung **nachweisen** können (Art. 7 Abs. 1 DSGVO).
Der Cookie beim Besucher genügt dafür nicht – er liegt auf dessen Gerät. Der Worker speichert
deshalb jede Entscheidung zusätzlich in **Ihrer** Datenbank bei Cloudflare:

| gespeichert | **nicht** gespeichert |
| --- | --- |
| anonyme Consent-ID (UUID), Zeitpunkt, Konfig-Version, Aktion (alle akzeptieren / ablehnen / Auswahl), gewählte Kategorien und Dienste, GPC-Signal, Domain | IP-Adresse, User-Agent, Name, E-Mail, Cookies |

Die IP-Adresse wird nur flüchtig im Arbeitsspeicher für das Rate-Limiting verwendet und nie
gespeichert. Einträge werden nach 3 Jahren automatisch gelöscht (einstellbar).

**Im Nachweisfall:** Der Besucher findet seine „Einwilligungs-ID“ unten im Dialog
„Cookie-Einstellungen“. Mit dieser ID fragen Sie den Worker ab und erhalten alle
Entscheidungen dieses Besuchers mit Zeitstempel.

> Mustertext – rechtlich prüfen lassen. Nennen Sie die Protokollierung (Zweck, Rechtsgrundlage,
> Speicherdauer, Cloudflare als Auftragsverarbeiter) in Ihrer Datenschutzerklärung.

## Kosten

Workers und D1 sind im **kostenlosen Cloudflare-Tarif** enthalten (zum Zeitpunkt der Erstellung: 100.000
Worker-Anfragen pro Tag, 5 GB D1-Speicher). Eine Entscheidung ist ein kleiner Eintrag
(< 1 KB). Für normale Websites reicht der kostenlose Tarif; prüfen Sie die aktuellen Limits
unter https://developers.cloudflare.com/workers/platform/pricing/.

---

## Einrichtung Schritt für Schritt (ca. 20 Minuten)

Sie brauchen: einen Computer mit **Node.js** (ab Version 18) und ein Terminal
(Windows: „PowerShell“, Mac: „Terminal“).

### Schritt 1: Cloudflare-Konto anlegen

1. https://dash.cloudflare.com/sign-up öffnen, mit E-Mail und Passwort registrieren,
   E-Mail bestätigen.
2. Eine Kreditkarte ist für den kostenlosen Tarif nicht nötig.

### Schritt 2: Repository herunterladen und Worker-Ordner öffnen

```bash
git clone https://github.com/SPOStephan/consent-kit.git
cd consent-kit/worker
npm install
```

### Schritt 3: Bei Cloudflare anmelden

```bash
npx wrangler login
```

Es öffnet sich ein Browserfenster → „**Allow**“ klicken. Danach ist das Terminal mit Ihrem
Konto verbunden.

### Schritt 4: Datenbank anlegen

```bash
npx wrangler d1 create consent-log
```

Die Ausgabe enthält eine Zeile wie `database_id = "a1b2c3d4-…"`. Öffnen Sie
`worker/wrangler.toml` in einem Texteditor und ersetzen Sie `HIER-DATABASE-ID-EINTRAGEN`
durch diese ID.

### Schritt 5: Ihre Domains eintragen

In `worker/wrangler.toml` die Zeile `ALLOWED_ORIGINS` anpassen – **alle** Adressen Ihrer
Websites, genau so wie sie in der Adresszeile stehen (mit `https://`, ohne `/` am Ende),
durch Komma getrennt:

```toml
ALLOWED_ORIGINS = "https://meine-seite.de,https://www.meine-seite.de,https://zweite-seite.de"
```

Nur von diesen Adressen werden Einträge angenommen. Kommt später eine Website dazu:
Adresse ergänzen und Schritt 8 wiederholen.

### Schritt 6: Tabelle in der Datenbank anlegen

```bash
npm run db:init
```

### Schritt 7: Geheimes Admin-Token festlegen

Das Token ist das Passwort für die Abfrage. Erzeugen Sie ein zufälliges:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Kopieren Sie die Ausgabe, **speichern Sie sie in Ihrem Passwort-Manager** und hinterlegen Sie
sie bei Cloudflare:

```bash
npx wrangler secret put ADMIN_TOKEN
```

(Token einfügen, Enter.) Das Token steht damit **nicht** im Repository.

### Schritt 8: Worker veröffentlichen

```bash
npm run deploy
```

Am Ende steht die Adresse Ihres Workers, z. B.
`https://consent-log.<ihr-name>.workers.dev`. Test im Browser: diese Adresse öffnen → „ok“.

### Schritt 9: Websites anbinden

In der `consent.config.ts` **jeder** Website ergänzen:

```ts
logging: { endpoint: 'https://consent-log.<ihr-name>.workers.dev/log' },
```

Neu bauen und veröffentlichen. Test: Website öffnen, im Banner etwas auswählen, dann im Dialog
„Cookie-Einstellungen“ unten die Einwilligungs-ID ablesen und abfragen (Schritt 10).

### Schritt 10: Abfrage im Nachweisfall

```bash
curl -H "Authorization: Bearer IHR-ADMIN-TOKEN" https://consent-log.<ihr-name>.workers.dev/consent/EINWILLIGUNGS-ID
```

Windows PowerShell:

```powershell
Invoke-RestMethod -Headers @{ Authorization = "Bearer IHR-ADMIN-TOKEN" } https://consent-log.<ihr-name>.workers.dev/consent/EINWILLIGUNGS-ID | ConvertTo-Json -Depth 5
```

Antwort (Beispiel):

```json
{
  "consentId": "46afb41e-031b-4f3a-b233-cca02495494d",
  "count": 1,
  "entries": [
    {
      "receivedAt": "2026-09-24T08:43:02.767Z",
      "clientTimestamp": "2026-09-24T08:43:02.749Z",
      "configVersion": "1",
      "action": "custom",
      "categories": { "necessary": true, "statistics": true, "marketing": false },
      "services": {},
      "gpc": false,
      "domain": "meine-seite.de"
    }
  ]
}
```

---

## Technische Details

| Funktion | Umsetzung |
| --- | --- |
| Nur eigene Domains | `Origin`-Header muss in `ALLOWED_ORIGINS` stehen, gemeldete Domain muss dazu passen; CORS nur für diese Domains |
| Rate-Limiting | Cloudflare Rate Limiting: 20 Einträge pro Minute und IP (in `wrangler.toml` änderbar) |
| Eingabeprüfung | strenge Prüfung (UUID, bekannte Aktionen, max. 4 KB); unbekannte Felder werden verworfen |
| Abfrage | nur mit `Authorization: Bearer <ADMIN_TOKEN>` (mind. 20 Zeichen), Vergleich in konstanter Zeit |
| Aufbewahrung | täglicher Cron löscht Einträge älter als `RETENTION_DAYS` (Standard 1095 Tage = 3 Jahre) |
| Datenbank | `worker/schema.sql` |

**Lokal testen** (ohne Cloudflare-Konto):

```bash
cd worker
cp .dev.vars.example .dev.vars
npm run db:init:local
npm run dev            # http://localhost:8787
```

**Automatische Tests:** `worker/test/worker.test.ts` (laufen bei `npm test` im Hauptordner mit).

## Häufige Fragen

**Die Website meldet in der Browser-Konsole einen CORS-Fehler.** Die Adresse der Website steht
nicht (exakt) in `ALLOWED_ORIGINS` – z. B. fehlt die Variante mit bzw. ohne `www.`.
Ergänzen und `npm run deploy`.

**Token vergessen?** Neues Token erzeugen und mit `npx wrangler secret put ADMIN_TOKEN`
überschreiben.

**Alle Daten ansehen/exportieren?** Im Cloudflare-Dashboard → **Storage & Databases** → **D1** →
`consent-log` → **Console**, z. B. `SELECT * FROM consent_log ORDER BY received_at DESC LIMIT 100;`
