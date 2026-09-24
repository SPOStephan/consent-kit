import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { toHtml, toMarkdown } from 'consent-kit/table';
import { formatCheckResult, runCheck } from './check';
import { loadConfig } from './load-config';

const HELP = `consent-kit – Befehle

  npx consent-kit check <url> [--reject] [--wait=3000] [--json] [--headed]
      Öffnet die Seite in einem unsichtbaren Browser, klickt NICHTS an und listet
      Drittanbieter-Requests und Cookies vor der Einwilligung auf.
      --reject   zusätzlich „Alle ablehnen“ klicken, neu laden und erneut prüfen
      --wait     Wartezeit nach dem Laden in Millisekunden (Standard 3000)
      --json     Ergebnis als JSON ausgeben
      Benötigt Playwright:  npm i -D playwright && npx playwright install chromium

  npx consent-kit table [pfad/zur/consent.config.ts] [--format=md|html|both]
                        [--lang=de|en] [--owner="Firma GmbH"] [--out=datei]
      Erzeugt eine Tabelle aller Dienste (Anbieter, Zweck, Cookies, Speicherdauer,
      Drittland) für die Datenschutzerklärung. Mustertext – rechtlich prüfen lassen.
      Standard-Pfad: src/consent.config.ts

  npx consent-kit help
`;

function parseArgs(argv: string[]) {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (const arg of argv) {
    if (arg.startsWith('--')) {
      const [key, ...rest] = arg.slice(2).split('=');
      flags[key!] = rest.length ? rest.join('=') : true;
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;
  const { positional, flags } = parseArgs(rest);

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    console.log(HELP);
    return 0;
  }

  if (command === 'check') {
    const url = positional[0];
    if (!url) {
      console.error('Bitte eine URL angeben, z. B.: npx consent-kit check https://meine-seite.de');
      return 2;
    }
    const options = {
      reject: flags.reject === true,
      wait: typeof flags.wait === 'string' ? Number(flags.wait) : undefined,
      headed: flags.headed === true,
      // Nur für automatisierte Tests: Tracker-Requests abbrechen statt ausführen.
      abortTrackers: process.env.CONSENT_KIT_ABORT_TRACKERS === '1',
    };
    const normalized = /^https?:\/\//.test(url) ? url : `https://${url}`;
    const result = await runCheck(normalized, options);
    console.log(flags.json ? JSON.stringify(result, null, 2) : formatCheckResult(result, options));
    return result.error ? 2 : result.problems.length ? 1 : 0;
  }

  if (command === 'table') {
    const { config, file } = await loadConfig(positional[0]);
    const lang = flags.lang === 'en' ? 'en' : flags.lang === 'de' ? 'de' : undefined;
    const owner = typeof flags.owner === 'string' ? flags.owner : undefined;
    const format = typeof flags.format === 'string' ? flags.format : 'both';
    const md = toMarkdown(config, { language: lang, owner });
    const html = toHtml(config, { language: lang, owner });
    const output =
      format === 'md' || format === 'markdown'
        ? md
        : format === 'html'
          ? html
          : `## Markdown\n\n${md}\n## HTML\n\n${html}`;
    if (typeof flags.out === 'string') {
      writeFileSync(resolve(flags.out), output);
      console.error(`Tabelle aus ${file} gespeichert in ${resolve(flags.out)} (Mustertext – rechtlich prüfen lassen).`);
    } else {
      console.log(output);
    }
    return 0;
  }

  console.error(`Unbekannter Befehl: ${command}\n`);
  console.log(HELP);
  return 2;
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(`Fehler: ${(error as Error).message ?? error}`);
    process.exit(2);
  },
);
