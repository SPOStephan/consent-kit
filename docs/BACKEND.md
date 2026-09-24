# consent-kit Backend: Verwaltung, zentrale Einstellungen, Nachweis

Das Backend ist ein kleiner Dienst bei Cloudflare (Worker + Datenbank D1). Er bietet:

| Funktion | Nutzen |
| --- | --- |
| **Admin-Oberfläche** unter `/admin` | Websites anlegen: Domains, GTM-/Pixel-IDs, Dienste, Links, Farben, Texte |
| **Zentrale Einstellungen** | Websites holen ihre Einstellungen beim Laden live vom Backend – eine neue Pixel-ID oder ein neuer Dienst wirkt nach ca. 1 Minute auf der Website, **ohne** die Website neu zu veröffentlichen |
| **Einbau-Code** | Pro Website fertiger KI-Prompt und Code zum Kopieren |
| **Datenschutz-Tabelle** | Übersicht aller Dienste für die Datenschutzerklärung (HTML/Markdown) |
| **Nachweis** | Jede Entscheidung wird protokolliert (ohne IP-Adresse) – Suche per Einwilligungs-ID |
| **Statistik** | Zustimmungs- und Ablehnungsquoten der letzten 30 Tage |

> Alle Texte sind Mustertexte – rechtlich prüfen lassen.

## So funktioniert es

```
Besucher öffnet Ihre Website
   │
   ├─► GET https://consent.ihre-firma.de/config/meine-seite   (Einstellungen, ohne Cookies)
   │      ← Dienste, IDs, Texte, Design
   │
   ├─► Banner erscheint – NOCH KEIN Tracking
   │
   └─► Besucher entscheidet
          ├─► Dienste laden entsprechend der Auswahl
          └─► POST https://consent.ihre-firma.de/log   (Nachweis, ohne IP-Adresse)
```

**Wenn das Backend nicht erreichbar ist**, nutzt die Website die eingebaute Rückfallebene
(eine Kopie der Einstellungen aus dem Einbau-Code). Ohne Rückfallebene lädt aus
Sicherheitsgründen **kein** Dienst.

**Wann werden Besucher erneut gefragt?** Sobald Sie in der Admin-Oberfläche Dienste
hinzufügen, entfernen oder ändern (die Version wird automatisch erhöht) oder auf
„Alle Besucher erneut fragen“ klicken. Änderungen an Farben oder Texten lösen keine neue
Abfrage aus.

## Kosten

Workers, D1, Custom Domains und Cloudflare Access (bis 50 Nutzer) sind im **kostenlosen**
Cloudflare-Tarif enthalten (zum Zeitpunkt der Erstellung: 100.000 Worker-Aufrufe pro Tag).
Jeder Seitenaufruf Ihrer Websites erzeugt einen Aufruf von `/config` (durch den
Browser-Cache meist weniger). Bei sehr viel Traffic bitte die aktuellen Limits prüfen:
https://developers.cloudflare.com/workers/platform/pricing/

Hinweis: Beim ersten Aktivieren von **Zero Trust** (für Cloudflare Access) fragt Cloudflare
ggf. nach einer Zahlungsmethode, auch für den kostenlosen Tarif (0 $). Es entstehen keine
Kosten, solange Sie im Free-Tarif bleiben.

---

## Einrichtung Schritt für Schritt (ca. 45 Minuten)

Sie brauchen: einen Computer mit **Node.js** (ab Version 18) und ein Terminal
(Windows: „PowerShell“, Mac: „Terminal“).

### Schritt 1: Cloudflare-Konto anlegen

https://dash.cloudflare.com/sign-up öffnen, registrieren, E-Mail bestätigen.

### Schritt 2 (empfohlen): Domain zu Cloudflare hinzufügen

Damit das Backend unter einer eigenen Adresse wie `consent.ihre-firma.de` erreichbar ist,
muss **eine** Ihrer Domains ihr DNS bei Cloudflare verwalten. Die Domain bleibt bei Ihrem
bisherigen Anbieter registriert.

1. Im Cloudflare-Dashboard: **Add a domain** (bzw. „Website hinzufügen“) → Domain eingeben →
   **Free**-Tarif wählen.
2. Cloudflare übernimmt die vorhandenen DNS-Einträge – prüfen Sie, dass Website und E-Mail
   (MX-Einträge) in der Liste stehen.
3. Cloudflare zeigt zwei **Nameserver** an. Tragen Sie diese bei Ihrem Domain-Anbieter
   (z. B. IONOS, Strato, All-Inkl) statt der bisherigen Nameserver ein.
4. Nach einigen Minuten bis Stunden meldet Cloudflare „Active“.

Ohne eigene Domain funktioniert das Backend auch unter der kostenlosen Adresse
`consent-kit.<ihr-name>.workers.dev` (dann Schritt 8 überspringen). Sie können später
jederzeit umstellen.

### Schritt 3: Repository herunterladen

```bash
git clone https://github.com/SPOStephan/consent-kit.git
cd consent-kit/worker
npm install
```

### Schritt 4: Bei Cloudflare anmelden

```bash
npx wrangler login
```

Im Browserfenster „**Allow**“ klicken.

### Schritt 5: Datenbank anlegen

```bash
npx wrangler d1 create consent-kit
```

Die Ausgabe enthält `database_id = "…"`. Öffnen Sie `worker/wrangler.toml` in einem
Texteditor und ersetzen Sie `HIER-DATABASE-ID-EINTRAGEN` durch diese ID. Dann die Tabellen
anlegen:

```bash
npm run db:migrate
```

### Schritt 6: Notfall-Token festlegen

Das Admin-Token ist ein Notfall-Zugang (falls Cloudflare Access einmal nicht funktioniert)
und erlaubt Abfragen per Kommandozeile. Zufälliges Token erzeugen:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Ausgabe **im Passwort-Manager speichern** und bei Cloudflare hinterlegen:

```bash
npx wrangler secret put ADMIN_TOKEN
```

### Schritt 7: Veröffentlichen

```bash
npm run deploy
```

Am Ende steht die Adresse, z. B. `https://consent-kit.<ihr-name>.workers.dev`.
Test: Adresse im Browser öffnen → „ok“.

### Schritt 8: Eigene Domain verbinden

Cloudflare-Dashboard → **Workers & Pages** → `consent-kit` → **Settings** →
**Domains & Routes** → **Add** → **Custom domain** → `consent.ihre-firma.de` → **Add domain**.

Nach kurzer Zeit ist das Backend unter `https://consent.ihre-firma.de` erreichbar
(Test: „ok“). Das HTTPS-Zertifikat erstellt Cloudflare automatisch.

### Schritt 9: Admin-Oberfläche mit Cloudflare Access schützen

1. Cloudflare-Dashboard → **Zero Trust**. Beim ersten Mal: einen **Team-Namen** wählen
   (z. B. `ihre-firma` → ergibt `ihre-firma.cloudflareaccess.com`) und den **Free**-Tarif.
2. **Access** → **Applications** → **Add an application** → **Self-hosted**.
3. Name: `consent-kit Admin`, Sitzungsdauer z. B. `24 hours`.
4. **Public hostname** (bzw. „Application domain“): Subdomain `consent`, Domain
   `ihre-firma.de`, **Path: `admin`**.
   Wichtig: **nur** der Pfad `admin` wird geschützt – `/config` und `/log` müssen für Ihre
   Websites öffentlich bleiben.
   (Ohne eigene Domain: Hostname `consent-kit.<ihr-name>.workers.dev`, Path `admin`.)
5. **Policy** hinzufügen: Name `Nur ich`, Action **Allow**, Include → **Emails** → Ihre
   E-Mail-Adresse.
6. Anmeldemethode: **One-time PIN** (Code per E-Mail) ist voreingestellt – passt.
7. Speichern. Öffnen Sie danach die Anwendung und kopieren Sie unter **Overview** bzw.
   **Basic information** den Wert **Application Audience (AUD) Tag**.
8. In `worker/wrangler.toml` eintragen:

   ```toml
   ACCESS_TEAM_DOMAIN = "ihre-firma.cloudflareaccess.com"
   ACCESS_AUD = "der-kopierte-aud-tag"
   ```

9. Erneut veröffentlichen: `npm run deploy`

Das Backend prüft die Anmeldung zusätzlich selbst (digitale Signatur, AUD, Ablaufzeit).
Ist Access falsch eingerichtet, bleibt die Admin-Oberfläche also gesperrt – sie öffnet sich
nicht „aus Versehen“.

### Schritt 10: Kontrolle (wichtig!)

In einem **privaten Browserfenster**:

| Adresse | Erwartet |
| --- | --- |
| `https://consent.ihre-firma.de/` | „ok“ |
| `https://consent.ihre-firma.de/admin` | Cloudflare-Anmeldeseite (E-Mail-Code) |
| nach der Anmeldung | Admin-Oberfläche mit „Angemeldet: ihre@email.de“ |
| `https://consent.ihre-firma.de/config/gibts-nicht` | `{"error": "site not found"}` – **ohne** Anmeldeseite |

Erscheint bei `/config/…` eine Anmeldeseite, ist in Schritt 9 der Pfad `admin` nicht gesetzt.

### Schritt 11: Erste Website anlegen und einbauen

1. `https://consent.ihre-firma.de/admin` öffnen → **+ Neue Website**.
2. Kennung (z. B. `meine-seite`), Name, Domains (mit und ohne `www`), Links, Dienste und
   IDs eintragen → **Website anlegen**. Fehler werden verständlich angezeigt.
3. Reiter **Einbau** → **1. KI-Prompt** kopieren und in Cursor, Manus oder Claude Code im
   Projekt dieser Website einfügen. Die KI baut alles ein und prüft das Ergebnis.
4. Reiter **Datenschutz-Tabelle** → Tabelle in die Datenschutzerklärung übernehmen.
5. Website veröffentlichen und prüfen: `npx consent-kit check https://ihre-seite.de --reject`

---

## Im Alltag

| Aufgabe | So geht’s |
| --- | --- |
| Neue Pixel-ID / neuer Dienst | Admin → Website → Einstellungen → Speichern. Wirkt nach ca. 1 Minute; Besucher werden neu gefragt. |
| Farbe oder Text ändern | Admin → Speichern. Wirkt nach ca. 1 Minute, keine neue Abfrage. |
| Neue Domain (z. B. zusätzliche Subdomain) | Admin → Domains ergänzen → Speichern. |
| Nachweis im Streitfall | Der Besucher nennt seine **Einwilligungs-ID** (unten im Dialog „Cookie-Einstellungen“). Admin → „Nachweis suchen“ → Ergebnis als JSON kopieren. |
| Rückfallebene aktualisieren | Gelegentlich Admin → Einbau → Datei `consent.remote.ts` neu in die Website kopieren. |

**Abfrage per Kommandozeile** (z. B. für Skripte):

```bash
curl -H "Authorization: Bearer IHR-ADMIN-TOKEN" https://consent.ihre-firma.de/consent/EINWILLIGUNGS-ID
```

## Backend aktualisieren

Wenn es eine neue consent-kit-Version gibt:

```bash
cd consent-kit
git pull
cd worker
npm install
npm run db:migrate     # spielt neue Datenbank-Änderungen ein (falls vorhanden)
npm run deploy
```

## Datenschutz-Hinweise (Mustertext – rechtlich prüfen lassen)

- **Einstellungen laden:** Beim Aufruf Ihrer Website fragt der Browser des Besuchers die
  Einstellungen bei Ihrem Backend ab – dabei erhält Cloudflare technisch bedingt die
  IP-Adresse. Das Backend speichert sie nicht. Cloudflare ist hier Ihr Auftragsverarbeiter:
  Informationen zum Auftragsverarbeitungsvertrag (DPA) von Cloudflare finden Sie unter
  https://www.cloudflare.com/cloudflare-customer-dpa/ – prüfen Sie dort, wie er für Ihr Konto
  gilt bzw. abgeschlossen wird. Nennen Sie Cloudflare und den Zweck
  („Bereitstellung der Einwilligungsverwaltung“) in Ihrer Datenschutzerklärung.
- **Protokoll:** gespeichert werden anonyme Consent-ID, Zeitpunkt, Konfig-Version, Aktion,
  Kategorien, einzelne Dienste, GPC-Signal, Domain und Website-Kennung – **keine** IP-Adresse,
  **kein** User-Agent. Löschung nach 3 Jahren (`RETENTION_DAYS`).
- **Eigene Domain** (`consent.ihre-firma.de`) statt `workers.dev` ist empfehlenswert: Die
  Anfrage geht dann an Ihre eigene Domain.
- `npx consent-kit check` zeigt die Adresse Ihres Backends unter „Hinweise“ an – das ist
  erwartet und kein Tracking.

## Technische Details

| Adresse | Zugriff | Zweck |
| --- | --- | --- |
| `GET /config/<id>` | öffentlich, CORS `*`, Cache 60 s | Einstellungen einer Website |
| `POST /log` | nur von hinterlegten Domains, 20/min pro IP | Protokollierung |
| `GET /admin` | Cloudflare Access / Token | Admin-Oberfläche |
| `/admin/api/…` | Cloudflare Access / Token, CSRF-Schutz | Admin-API |
| `GET /consent/<id>` | Cloudflare Access / Token | Nachweis per Kommandozeile |

- Datenbank-Schema: `worker/migrations/`
- Admin-Oberfläche: ohne externe Skripte oder Schriften, strenge Content-Security-Policy.
- Tests: `worker/test/backend.test.ts` (Unit) und `e2e/admin.spec.ts` (Browser) laufen bei
  `npm test` mit.

**Lokal ausprobieren** (ohne Cloudflare-Konto):

```bash
cd worker
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run dev            # Admin-Oberfläche: http://localhost:8787/admin
```

## Häufige Fragen

**Die Website zeigt kein Banner.** Browser-Konsole (F12) öffnen. „Einstellungen konnten nicht
geladen werden“ → Kennung (`siteId`) und Adresse (`endpoint`) in `consent.remote.ts` prüfen,
`https://consent.ihre-firma.de/config/<kennung>` im Browser öffnen.

**Protokollierung meldet „origin not allowed“.** Die Adresse der Website fehlt unter
„Domains“ in der Admin-Oberfläche (z. B. die Variante mit bzw. ohne `www`).

**Ich komme nicht mehr in die Admin-Oberfläche.** `/admin` öffnen → „Notfall-Zugang mit dem
Admin-Token“. Token vergessen: `npx wrangler secret put ADMIN_TOKEN` setzt ein neues.

**Alle Daten ansehen/exportieren?** Cloudflare-Dashboard → **Storage & Databases** → **D1** →
`consent-kit` → **Console**, z. B. `SELECT * FROM consent_log ORDER BY received_at DESC LIMIT 100;`
