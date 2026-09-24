# Installation, Updates und privates Repository

## Standard: Installation per Git-URL

```bash
npm install github:SPOStephan/consent-kit#v0.1.0
# pnpm:  pnpm add github:SPOStephan/consent-kit#v0.1.0
```

- Das Paket liegt im Repository **fertig gebaut** (`dist/`). Bei der Installation läuft kein
  Build-Schritt – deshalb klappt es zuverlässig mit npm und pnpm (auch pnpm 10, das
  Build-Skripte von Abhängigkeiten standardmäßig blockiert).
- In Ihr Projekt gelangen nur `dist/`, `docs/`, `README.md`, `CHANGELOG.md`, `LICENSE` und
  `package.json` – nicht die Demo, Tests oder der Worker.
- `#v0.1.0` ist ein Git-Tag. Ohne Tag (`#main`) bekämen Sie immer den neuesten Stand – das ist
  für Live-Websites **nicht** zu empfehlen.

**Update:** `npm install github:SPOStephan/consent-kit#v0.2.0` – vorher das CHANGELOG lesen.

Getestet (v0.1.0): frisches Vite-8-Projekt mit React 19 und TypeScript 6 über
`npm install github:…`, `pnpm add github:…`, Build, `npx consent-kit table` und
`npx consent-kit check`.

---

## Wenn das Repository privat bleiben soll

Bei einem **privaten** Repository braucht **jeder Rechner, der `npm install` ausführt**, Zugriff
auf GitHub – also Ihr Computer **und** jede Hosting-Plattform, die Ihre Seite baut
(Vercel, Netlify, Manus, Cloudflare Pages …). Ohne Zugriff bricht der Build mit
„Permission denied“ oder „Repository not found“ ab.

### Option A: Repository öffentlich machen (empfohlen, am einfachsten)

Das Repository enthält **keine Geheimnisse**: Ihre GTM-/Pixel-IDs stehen nur in der
`consent.config.ts` der jeweiligen Website (und sind dort ohnehin im ausgelieferten JavaScript
für jeden sichtbar). Öffentlich = funktioniert überall ohne Einrichtung.
GitHub → Repository → **Settings** → **General** → ganz unten „**Change visibility**“.
Die Lizenz steht in `LICENSE` (derzeit MIT – bei Bedarf anpassen).

### Option B: Privat + Zugriffstoken auf der Hosting-Plattform

1. GitHub → **Settings** (Ihr Profil) → **Developer settings** → **Personal access tokens** →
   **Fine-grained tokens** → „Generate new token“: nur Repository `consent-kit`,
   Berechtigung **Contents: Read-only**, Ablaufdatum setzen.
2. In `package.json` Ihrer Website die HTTPS-Form verwenden:
   `"consent-kit": "git+https://github.com/SPOStephan/consent-kit.git#v0.1.0"`
3. Auf der Plattform eine Umgebungsvariable `GITHUB_TOKEN` mit dem Token anlegen und den
   Installationsbefehl ändern:

   ```bash
   git config --global url."https://x-access-token:${GITHUB_TOKEN}@github.com/".insteadOf "https://github.com/" && npm install
   ```

   - **Vercel:** Project → Settings → Environment Variables (`GITHUB_TOKEN`), dann
     Settings → Build & Development → **Install Command** überschreiben (Befehl oben).
   - **Netlify:** Site configuration → Environment variables (`GITHUB_TOKEN`); Build command:
     `git config --global url."https://x-access-token:${GITHUB_TOKEN}@github.com/".insteadOf "https://github.com/" && npm install && npm run build`
   - **Manus:** Ob und wie Manus beim Build eigene Umgebungsvariablen und Installationsbefehle
     erlaubt, hängt vom Projekt-Typ ab. Wenn das nicht möglich ist: Option A, C oder D.

   **Niemals** den Token direkt in `package.json` oder ins Repository schreiben.

### Option C: GitHub Packages (privates npm-Paket)

Das Paket wird als `@spostephan/consent-kit` in die GitHub-Paketverwaltung veröffentlicht.
Installation dann mit einer `.npmrc` in jeder Website:

```ini
@spostephan:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NPM_TOKEN}
```

und der Umgebungsvariable `NPM_TOKEN` (Token mit `read:packages`) lokal und auf der
Hosting-Plattform. Vorteil: echte npm-Versionen. Nachteil: Token-Einrichtung auf jeder
Plattform, Veröffentlichungsschritt bei jeder Version. **(Wird nur nach Ihrer Freigabe
eingerichtet.)**

### Option D: Paket-Datei ins Website-Repository legen

```bash
# im consent-kit-Ordner
npm pack                      # erzeugt consent-kit-0.1.0.tgz
# Datei nach <website>/vendor/ kopieren, dann in der Website:
npm install ./vendor/consent-kit-0.1.0.tgz
```

Funktioniert überall ohne Token (die Datei liegt ja im Website-Repository). Nachteil: Updates
müssen Sie pro Website von Hand kopieren.

### Empfehlung

| | Aufwand | Updates | funktioniert auf Vercel/Netlify/Manus |
| --- | --- | --- | --- |
| A: öffentlich | keiner | Tag ändern | ✅ ohne Einrichtung |
| B: privat + Token | mittel | Tag ändern | ✅ nach Einrichtung (Manus unklar) |
| C: GitHub Packages | mittel–hoch | Version ändern | ✅ nach Einrichtung |
| D: .tgz-Datei | gering | Datei kopieren | ✅ ohne Einrichtung |

Für den Start ist **A** am einfachsten. Wenn der Code nicht öffentlich sein soll, ist **D** die
robusteste Lösung ohne Token-Verwaltung.
