import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { expect, test } from '@playwright/test';
import { formatCheckResult, runCheck, siteOf } from '../src/cli/check';

const execFileAsync = promisify(execFile);
const run = (cmd: string, args: string[]) =>
  execFileAsync(cmd, args, { env: { ...process.env, CONSENT_KIT_ABORT_TRACKERS: '1' } });
const BASE = 'http://localhost:4173';

test.describe('Prüf-Werkzeug (consent-kit check)', () => {
  test.describe.configure({ mode: 'serial' });
  test.skip(({ browserName }) => browserName !== 'chromium');

  test('Demo-Seite: OK vor der Einwilligung und nach "Alle ablehnen"', async () => {
    const result = await runCheck(`${BASE}/`, { reject: true, wait: 500, abortTrackers: true });
    expect(result.error).toBeUndefined();
    expect(result.rejectButtonFound).toBe(true);
    expect(result.problems).toEqual([]);
    expect(formatCheckResult(result, { reject: true })).toContain('✅ OK');
  });

  test('Negativbeispiel: findet GTM-Request und _ga-Cookie vor der Einwilligung', async () => {
    const result = await runCheck(`${BASE}/test/tracker-vorab.html`, { wait: 300, abortTrackers: true });
    expect(result.problems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'request', service: 'Google Tag Manager', phase: 'load' }),
        expect.objectContaining({ kind: 'cookie', service: 'Google Analytics' }),
      ]),
    );
    const text = formatCheckResult(result);
    expect(text).toContain('❌');
    expect(text).toContain('Request an Google Tag Manager beim Laden');
    expect(text).toContain('Cookie _ga');
  });

  test('CLI-Befehl: Exit-Code 0 bei OK, deutsche Ausgabe', async () => {
    const { stdout } = await run('node', ['dist/cli.js', 'check', `${BASE}/`, '--wait=300']);
    expect(stdout).toContain('consent-kit check');
    expect(stdout).toContain('✅ OK');
  });

  test('CLI-Befehl: Exit-Code 1 bei Problemen', async () => {
    const error = await run('node', ['dist/cli.js', 'check', `${BASE}/test/tracker-vorab.html`, '--wait=300', '--json']).catch((e) => e);
    expect(error.code).toBe(1);
    expect(JSON.parse(error.stdout).problems.length).toBeGreaterThan(0);
  });
});

test.describe('Tabellen-Generator (consent-kit table)', () => {
  test.skip(({ browserName }) => browserName !== 'chromium');

  test('erzeugt Markdown und HTML aus einer TypeScript-Konfiguration', async () => {
    const md = await run('node', ['dist/cli.js', 'table', 'demo/src/consent.config.ts', '--format=md']);
    expect(md.stdout).toContain('| Dienst | Kategorie | Anbieter |');
    expect(md.stdout).toContain('Meta Pixel');
    expect(md.stdout).toContain('Mustertext – rechtlich prüfen lassen');
    const html = await run('node', ['dist/cli.js', 'table', 'demo/src/consent.config.ts', '--format=html', '--lang=en']);
    expect(html.stdout).toContain('<table class="consent-kit-services">');
    expect(html.stdout).toContain('Third-country transfer');
  });

  test('Datenschutz-Seite der Demo zeigt die Tabelle', async ({ page }) => {
    await page.goto(`${BASE}/datenschutz`);
    const table = page.locator('table.services');
    await expect(table.getByRole('rowheader', { name: 'TikTok Pixel' })).toBeVisible();
    await expect(table).toContainText('_fbp');
  });
});

test('siteOf ermittelt die registrierbare Domain', () => {
  expect(siteOf('www.shop.example.de')).toBe('example.de');
  expect(siteOf('www.example.co.uk')).toBe('example.co.uk');
  expect(siteOf('localhost')).toBe('localhost');
});
