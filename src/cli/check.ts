import { matchTracker } from './trackers';

/** Bekannte Tracking-Cookies (Name → Dienst). */
const TRACKING_COOKIES: Array<[RegExp, string]> = [
  [/^_ga($|_)/, 'Google Analytics'],
  [/^_gid$/, 'Google Analytics'],
  [/^_gat/, 'Google Analytics'],
  [/^_gcl_/, 'Google Ads'],
  [/^(IDE|DSID|test_cookie)$/, 'Google Ads / DoubleClick'],
  [/^(NID|1P_JAR|AEC|SOCS|CONSENT)$/, 'Google'],
  [/^(VISITOR_INFO1_LIVE|YSC|VISITOR_PRIVACY_METADATA)$/, 'YouTube'],
  [/^_fb[pc]$/, 'Meta Pixel'],
  [/^(fr|datr|sb)$/, 'Meta / Facebook'],
  [/^(_ttp|_tt_enable_cookie|ttcsid.*|tt_.*)$/, 'TikTok'],
  [/^(_uetsid|_uetvid|MUID)$/, 'Microsoft Ads'],
  [/^(_clck|_clsk|CLID)$/, 'Microsoft Clarity'],
  [/^_hj/, 'Hotjar'],
  [/^(li_|lidc|bcookie|UserMatchHistory|AnalyticsSyncHistory)/, 'LinkedIn'],
  [/^_pin/, 'Pinterest'],
  [/^_scid/, 'Snapchat'],
  [/^hubspotutk|^__hs/, 'HubSpot'],
];

/** Namen, die typischerweise von Consent-Tools selbst gesetzt werden (notwendig). */
const CONSENT_COOKIES = /^(consent_kit|cookieconsent|CookieConsent|borlabs|cmplz|OptanonConsent|OptanonAlertBoxClosed|euconsent|usercentrics|uc_)/i;

export interface CheckOptions {
  /** Zusätzlich "Alle ablehnen" klicken und erneut prüfen. */
  reject?: boolean;
  /** Wartezeit nach dem Laden in ms. Standard: 3000. */
  wait?: number;
  /** Nur für Tests: Requests an Tracker abbrechen statt ausführen. */
  abortTrackers?: boolean;
  /** Browser sichtbar starten (zur Fehlersuche). */
  headed?: boolean;
}

export interface Finding {
  kind: 'request' | 'cookie';
  phase: 'load' | 'scroll' | 'reject';
  service: string;
  detail: string;
  count?: number;
}

export interface CheckResult {
  url: string;
  site: string;
  problems: Finding[];
  hints: Finding[];
  rejectButtonFound?: boolean;
  error?: string;
}

const MULTI_PART_TLDS = new Set(['co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'com.au', 'net.au', 'org.au', 'co.at', 'or.at', 'gv.at', 'co.nz', 'co.jp', 'com.br', 'com.tr', 'co.za', 'com.cn']);

/** Näherung an die "registrierbare Domain" (eTLD+1) ohne externe Abhängigkeit. */
export function siteOf(hostname: string): string {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (/^[\d.]+$/.test(host) || host.includes(':') || !host.includes('.')) return host;
  const labels = host.split('.');
  const lastTwo = labels.slice(-2).join('.');
  return MULTI_PART_TLDS.has(lastTwo) ? labels.slice(-3).join('.') : lastTwo;
}

function classifyCookie(name: string): string | undefined {
  return TRACKING_COOKIES.find(([re]) => re.test(name))?.[1];
}

interface LoggedRequest {
  url: string;
  phase: Finding['phase'];
}

type PlaywrightModule = typeof import('playwright');

async function loadPlaywright(): Promise<PlaywrightModule> {
  const { createRequire } = await import('node:module');
  const { pathToFileURL } = await import('node:url');
  const { join } = await import('node:path');
  // Zuerst im Projekt suchen, in dem der Befehl ausgeführt wird.
  const require = createRequire(join(process.cwd(), 'package.json'));
  for (const name of ['playwright', 'playwright-core', '@playwright/test']) {
    try {
      const resolved = require.resolve(name);
      const mod = (await import(pathToFileURL(resolved).href)) as PlaywrightModule & { default?: PlaywrightModule };
      return (mod.chromium ? mod : mod.default) as PlaywrightModule;
    } catch {
      // nächsten versuchen
    }
  }
  try {
    return (await import('playwright')) as PlaywrightModule;
  } catch {
    throw new Error(
      'Für die Prüfung wird Playwright benötigt. Bitte einmalig installieren:\n' +
        '  npm install --save-dev playwright\n' +
        '  npx playwright install chromium',
    );
  }
}

/** Öffnet die Seite ohne Klick und sammelt Drittanbieter-Requests und Cookies. */
export async function runCheck(url: string, options: CheckOptions = {}): Promise<CheckResult> {
  const target = new URL(url);
  const site = siteOf(target.hostname);
  const result: CheckResult = { url: target.href, site, problems: [], hints: [] };
  const { chromium } = await loadPlaywright();
  let browser;
  try {
    browser = await chromium.launch({ headless: !options.headed });
  } catch (error) {
    throw new Error(
      'Der Browser für die Prüfung fehlt. Bitte einmalig ausführen:\n  npx playwright install chromium\n\n' +
        String((error as Error).message ?? error).split('\n')[0],
    );
  }
  const wait = options.wait ?? 3000;
  const logged: LoggedRequest[] = [];
  let phase: Finding['phase'] = 'load';

  try {
    const context = await browser.newContext({ locale: 'de-DE', viewport: { width: 1280, height: 900 } });
    context.on('request', (request) => {
      if (request.url().startsWith('http')) logged.push({ url: request.url(), phase });
    });
    if (options.abortTrackers) {
      await context.route('**/*', (route) => (matchTracker(route.request().url()) ? route.abort() : route.continue()));
    }
    const page = await context.newPage();
    await page.goto(target.href, { waitUntil: 'load', timeout: 60_000 });
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
    await page.waitForTimeout(wait);
    const cookiesLoad = await context.cookies();

    // Scrollen ist KEIN Klick – manche Banner werten es trotzdem (unzulässig) als Einwilligung.
    phase = 'scroll';
    await page
      .evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += Math.max(400, window.innerHeight / 2)) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 100));
        }
      })
      .catch(() => undefined);
    await page.waitForTimeout(Math.min(wait, 2000));
    const cookiesScroll = await context.cookies();

    collect(result, logged, site, 'load');
    collect(result, logged, site, 'scroll');
    collectCookies(result, cookiesLoad, site, 'load');
    collectCookies(result, cookiesScroll.filter((c) => !cookiesLoad.some((l) => l.name === c.name && l.domain === c.domain)), site, 'scroll');

    if (options.reject) {
      const button = page
        .getByRole('button', { name: /^(alle ablehnen|ablehnen|alles ablehnen|nur notwendige|nur essenzielle|reject all|reject|decline|decline all|only necessary)/i })
        .first();
      result.rejectButtonFound = (await button.count()) > 0;
      if (result.rejectButtonFound) {
        phase = 'reject';
        await button.click();
        await page.waitForTimeout(1000);
        await page.reload({ waitUntil: 'load' });
        await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
        await page.waitForTimeout(wait);
        collect(result, logged, site, 'reject');
        const all = await context.cookies();
        collectCookies(result, all, site, 'reject', true);
      }
    }
  } catch (error) {
    result.error = (error as Error).message;
  } finally {
    await browser.close();
  }
  return result;
}

function collect(result: CheckResult, logged: LoggedRequest[], site: string, phase: Finding['phase']): void {
  const groups = new Map<string, Finding>();
  for (const { url, phase: p } of logged) {
    if (p !== phase) continue;
    const host = new URL(url).hostname;
    if (siteOf(host) === site) continue;
    const tracker = matchTracker(url);
    const key = (tracker ? 'p' : 'h') + host;
    const existing = groups.get(key);
    if (existing) {
      existing.count = (existing.count ?? 1) + 1;
      continue;
    }
    const finding: Finding = { kind: 'request', phase, service: tracker?.name ?? host, detail: url, count: 1 };
    groups.set(key, finding);
    (tracker ? result.problems : result.hints).push(finding);
  }
}

function collectCookies(
  result: CheckResult,
  cookies: Array<{ name: string; domain: string }>,
  site: string,
  phase: Finding['phase'],
  onlyProblems = false,
): void {
  for (const cookie of cookies) {
    const service = classifyCookie(cookie.name);
    const thirdParty = siteOf(cookie.domain.replace(/^\./, '')) !== site;
    const detail = `${cookie.name} (${cookie.domain})`;
    if (service || thirdParty) {
      result.problems.push({ kind: 'cookie', phase, service: service ?? cookie.domain.replace(/^\./, ''), detail });
    } else if (!onlyProblems && !CONSENT_COOKIES.test(cookie.name)) {
      result.hints.push({ kind: 'cookie', phase, service: 'Erstanbieter', detail });
    }
  }
}

const PHASE: Record<Finding['phase'], string> = {
  load: 'beim Laden',
  scroll: 'nach Scrollen',
  reject: 'nach „Alle ablehnen“ + Neuladen',
};

/** Deutsche Ausgabe für die Kommandozeile. */
export function formatCheckResult(result: CheckResult, options: CheckOptions = {}): string {
  const lines: string[] = [];
  lines.push(`consent-kit check – ${result.url}`);
  lines.push(`Geprüft: Seite geöffnet, NICHTS angeklickt${options.reject ? ', danach „Alle ablehnen“ geklickt' : ''}.`);
  lines.push('');
  if (result.error) {
    lines.push(`⚠️  Fehler bei der Prüfung: ${result.error}`);
    lines.push('');
  }
  if (options.reject && result.rejectButtonFound === false) {
    lines.push('⚠️  Kein Button „Alle ablehnen“ gefunden – die Prüfung nach Ablehnung wurde übersprungen.');
    lines.push('   Auf der ersten Ebene des Banners muss eine gleichwertige Ablehnen-Möglichkeit vorhanden sein.');
    lines.push('');
  }
  if (result.problems.length === 0) {
    lines.push('✅ OK – keine Requests an bekannte Tracking-Dienste und keine Tracking-Cookies ohne Einwilligung gefunden.');
  } else {
    lines.push(`❌ ${result.problems.length} Problem(e) gefunden:`);
    result.problems.forEach((f, i) => {
      if (f.kind === 'request') {
        lines.push(`  ${i + 1}. Request an ${f.service} ${PHASE[f.phase]}${f.count && f.count > 1 ? ` (${f.count}×)` : ''}:`);
        lines.push(`     ${truncate(f.detail)}`);
      } else {
        lines.push(`  ${i + 1}. Cookie ${f.detail} (${f.service}) ${PHASE[f.phase]} gesetzt`);
      }
    });
  }
  if (result.hints.length) {
    lines.push('');
    lines.push('ℹ️  Hinweise (bitte prüfen, ob notwendig):');
    for (const f of result.hints) {
      lines.push(
        f.kind === 'request'
          ? `  - Request an Drittanbieter ${f.service} ${PHASE[f.phase]}${f.count && f.count > 1 ? ` (${f.count}×)` : ''}`
          : `  - Cookie ${f.detail} ${PHASE[f.phase]}`,
      );
    }
    lines.push('    Externe Ressourcen (z. B. Schriftarten, CDNs) übertragen die IP-Adresse der Besucher an Dritte.');
  }
  lines.push('');
  lines.push('Hinweis: Diese Prüfung ist eine technische Momentaufnahme und keine Rechtsberatung.');
  return lines.join('\n');
}

function truncate(s: string, max = 140): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}
