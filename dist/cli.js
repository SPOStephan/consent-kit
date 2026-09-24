#!/usr/bin/env node

// src/cli/index.ts
import { writeFileSync as writeFileSync2 } from "fs";
import { resolve as resolve2 } from "path";
import { toHtml, toMarkdown } from "consent-kit/table";

// src/cli/trackers.ts
var TRACKER_DOMAINS = [
  // Google
  { domain: "googletagmanager.com", name: "Google Tag Manager" },
  { domain: "google-analytics.com", name: "Google Analytics" },
  { domain: "analytics.google.com", name: "Google Analytics" },
  { domain: "googleadservices.com", name: "Google Ads" },
  { domain: "doubleclick.net", name: "Google Ads / DoubleClick" },
  { domain: "googlesyndication.com", name: "Google AdSense" },
  { domain: "google.com", name: "Google Ads", pathPrefix: "/pagead" },
  { domain: "google.com", name: "Google Ads", pathPrefix: "/ccm" },
  { domain: "google.com", name: "Google Maps", pathPrefix: "/maps" },
  { domain: "googleapis.com", name: "Google APIs (z. B. Maps, Fonts)" },
  { domain: "gstatic.com", name: "Google Static (z. B. Fonts, Maps)" },
  { domain: "youtube.com", name: "YouTube" },
  { domain: "youtube-nocookie.com", name: "YouTube" },
  { domain: "ytimg.com", name: "YouTube" },
  // Meta
  { domain: "connect.facebook.net", name: "Meta Pixel" },
  { domain: "facebook.com", name: "Meta / Facebook" },
  { domain: "facebook.net", name: "Meta / Facebook" },
  { domain: "instagram.com", name: "Instagram" },
  // TikTok
  { domain: "analytics.tiktok.com", name: "TikTok Pixel" },
  { domain: "tiktok.com", name: "TikTok" },
  { domain: "tiktokw.us", name: "TikTok" },
  // Weitere verbreitete Dienste
  { domain: "snap.licdn.com", name: "LinkedIn Insight Tag" },
  { domain: "px.ads.linkedin.com", name: "LinkedIn Insight Tag" },
  { domain: "linkedin.com", name: "LinkedIn" },
  { domain: "ct.pinterest.com", name: "Pinterest Tag" },
  { domain: "s.pinimg.com", name: "Pinterest Tag" },
  { domain: "bat.bing.com", name: "Microsoft Ads" },
  { domain: "clarity.ms", name: "Microsoft Clarity" },
  { domain: "hotjar.com", name: "Hotjar" },
  { domain: "hotjar.io", name: "Hotjar" },
  { domain: "sc-static.net", name: "Snapchat Pixel" },
  { domain: "snapchat.com", name: "Snapchat" },
  { domain: "twitter.com", name: "X / Twitter" },
  { domain: "ads-twitter.com", name: "X / Twitter Ads" },
  { domain: "vimeo.com", name: "Vimeo" },
  { domain: "vimeocdn.com", name: "Vimeo" },
  { domain: "hs-scripts.com", name: "HubSpot" },
  { domain: "hs-analytics.net", name: "HubSpot" },
  { domain: "fonts.bunny.net", name: "Bunny Fonts" },
  { domain: "use.typekit.net", name: "Adobe Fonts" }
];
function matchTracker(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return void 0;
  }
  const host = parsed.hostname.toLowerCase();
  return TRACKER_DOMAINS.find(
    (t) => (host === t.domain || host.endsWith("." + t.domain)) && (!t.pathPrefix || parsed.pathname.startsWith(t.pathPrefix))
  );
}

// src/cli/check.ts
var TRACKING_COOKIES = [
  [/^_ga($|_)/, "Google Analytics"],
  [/^_gid$/, "Google Analytics"],
  [/^_gat/, "Google Analytics"],
  [/^_gcl_/, "Google Ads"],
  [/^(IDE|DSID|test_cookie)$/, "Google Ads / DoubleClick"],
  [/^(NID|1P_JAR|AEC|SOCS|CONSENT)$/, "Google"],
  [/^(VISITOR_INFO1_LIVE|YSC|VISITOR_PRIVACY_METADATA)$/, "YouTube"],
  [/^_fb[pc]$/, "Meta Pixel"],
  [/^(fr|datr|sb)$/, "Meta / Facebook"],
  [/^(_ttp|_tt_enable_cookie|ttcsid.*|tt_.*)$/, "TikTok"],
  [/^(_uetsid|_uetvid|MUID)$/, "Microsoft Ads"],
  [/^(_clck|_clsk|CLID)$/, "Microsoft Clarity"],
  [/^_hj/, "Hotjar"],
  [/^(li_|lidc|bcookie|UserMatchHistory|AnalyticsSyncHistory)/, "LinkedIn"],
  [/^_pin/, "Pinterest"],
  [/^_scid/, "Snapchat"],
  [/^hubspotutk|^__hs/, "HubSpot"]
];
var CONSENT_COOKIES = /^(consent_kit|cookieconsent|CookieConsent|borlabs|cmplz|OptanonConsent|OptanonAlertBoxClosed|euconsent|usercentrics|uc_)/i;
var MULTI_PART_TLDS = /* @__PURE__ */ new Set(["co.uk", "org.uk", "ac.uk", "gov.uk", "com.au", "net.au", "org.au", "co.at", "or.at", "gv.at", "co.nz", "co.jp", "com.br", "com.tr", "co.za", "com.cn"]);
function siteOf(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (/^[\d.]+$/.test(host) || host.includes(":") || !host.includes(".")) return host;
  const labels = host.split(".");
  const lastTwo = labels.slice(-2).join(".");
  return MULTI_PART_TLDS.has(lastTwo) ? labels.slice(-3).join(".") : lastTwo;
}
function classifyCookie(name) {
  return TRACKING_COOKIES.find(([re]) => re.test(name))?.[1];
}
async function loadPlaywright() {
  const { createRequire: createRequire2 } = await import("module");
  const { pathToFileURL: pathToFileURL2 } = await import("url");
  const { join: join2 } = await import("path");
  const require2 = createRequire2(join2(process.cwd(), "package.json"));
  for (const name of ["playwright", "playwright-core", "@playwright/test"]) {
    try {
      const resolved = require2.resolve(name);
      const mod = await import(pathToFileURL2(resolved).href);
      return mod.chromium ? mod : mod.default;
    } catch {
    }
  }
  try {
    return await import("playwright");
  } catch {
    throw new Error(
      "F\xFCr die Pr\xFCfung wird Playwright ben\xF6tigt. Bitte einmalig installieren:\n  npm install --save-dev playwright\n  npx playwright install chromium"
    );
  }
}
async function runCheck(url, options = {}) {
  const target = new URL(url);
  const site = siteOf(target.hostname);
  const result = { url: target.href, site, problems: [], hints: [] };
  const { chromium } = await loadPlaywright();
  let browser;
  try {
    browser = await chromium.launch({ headless: !options.headed });
  } catch (error) {
    throw new Error(
      "Der Browser f\xFCr die Pr\xFCfung fehlt. Bitte einmalig ausf\xFChren:\n  npx playwright install chromium\n\n" + String(error.message ?? error).split("\n")[0]
    );
  }
  const wait = options.wait ?? 3e3;
  const logged = [];
  let phase = "load";
  try {
    const context = await browser.newContext({ locale: "de-DE", viewport: { width: 1280, height: 900 } });
    context.on("request", (request) => {
      if (request.url().startsWith("http")) logged.push({ url: request.url(), phase });
    });
    if (options.abortTrackers) {
      await context.route("**/*", (route) => matchTracker(route.request().url()) ? route.abort() : route.continue());
    }
    const page = await context.newPage();
    await page.goto(target.href, { waitUntil: "load", timeout: 6e4 });
    await page.waitForLoadState("networkidle", { timeout: 15e3 }).catch(() => void 0);
    await page.waitForTimeout(wait);
    const cookiesLoad = await context.cookies();
    phase = "scroll";
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += Math.max(400, window.innerHeight / 2)) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 100));
      }
    }).catch(() => void 0);
    await page.waitForTimeout(Math.min(wait, 2e3));
    const cookiesScroll = await context.cookies();
    collect(result, logged, site, "load");
    collect(result, logged, site, "scroll");
    collectCookies(result, cookiesLoad, site, "load");
    collectCookies(result, cookiesScroll.filter((c) => !cookiesLoad.some((l) => l.name === c.name && l.domain === c.domain)), site, "scroll");
    if (options.reject) {
      const button = page.getByRole("button", { name: /^(alle ablehnen|ablehnen|alles ablehnen|nur notwendige|nur essenzielle|reject all|reject|decline|decline all|only necessary)/i }).first();
      result.rejectButtonFound = await button.count() > 0;
      if (result.rejectButtonFound) {
        phase = "reject";
        await button.click();
        await page.waitForTimeout(1e3);
        await page.reload({ waitUntil: "load" });
        await page.waitForLoadState("networkidle", { timeout: 15e3 }).catch(() => void 0);
        await page.waitForTimeout(wait);
        collect(result, logged, site, "reject");
        const all = await context.cookies();
        collectCookies(result, all, site, "reject", true);
      }
    }
  } catch (error) {
    result.error = error.message;
  } finally {
    await browser.close();
  }
  return result;
}
function collect(result, logged, site, phase) {
  const groups = /* @__PURE__ */ new Map();
  for (const { url, phase: p } of logged) {
    if (p !== phase) continue;
    const host = new URL(url).hostname;
    if (siteOf(host) === site) continue;
    const tracker = matchTracker(url);
    const key = (tracker ? "p" : "h") + host;
    const existing = groups.get(key);
    if (existing) {
      existing.count = (existing.count ?? 1) + 1;
      continue;
    }
    const finding = { kind: "request", phase, service: tracker?.name ?? host, detail: url, count: 1 };
    groups.set(key, finding);
    (tracker ? result.problems : result.hints).push(finding);
  }
}
function collectCookies(result, cookies, site, phase, onlyProblems = false) {
  for (const cookie of cookies) {
    const service = classifyCookie(cookie.name);
    const thirdParty = siteOf(cookie.domain.replace(/^\./, "")) !== site;
    const detail = `${cookie.name} (${cookie.domain})`;
    if (service || thirdParty) {
      result.problems.push({ kind: "cookie", phase, service: service ?? cookie.domain.replace(/^\./, ""), detail });
    } else if (!onlyProblems && !CONSENT_COOKIES.test(cookie.name)) {
      result.hints.push({ kind: "cookie", phase, service: "Erstanbieter", detail });
    }
  }
}
var PHASE = {
  load: "beim Laden",
  scroll: "nach Scrollen",
  reject: "nach \u201EAlle ablehnen\u201C + Neuladen"
};
function formatCheckResult(result, options = {}) {
  const lines = [];
  lines.push(`consent-kit check \u2013 ${result.url}`);
  lines.push(`Gepr\xFCft: Seite ge\xF6ffnet, NICHTS angeklickt${options.reject ? ", danach \u201EAlle ablehnen\u201C geklickt" : ""}.`);
  lines.push("");
  if (result.error) {
    lines.push(`\u26A0\uFE0F  Fehler bei der Pr\xFCfung: ${result.error}`);
    lines.push("");
  }
  if (options.reject && result.rejectButtonFound === false) {
    lines.push("\u26A0\uFE0F  Kein Button \u201EAlle ablehnen\u201C gefunden \u2013 die Pr\xFCfung nach Ablehnung wurde \xFCbersprungen.");
    lines.push("   Auf der ersten Ebene des Banners muss eine gleichwertige Ablehnen-M\xF6glichkeit vorhanden sein.");
    lines.push("");
  }
  if (result.problems.length === 0) {
    lines.push("\u2705 OK \u2013 keine Requests an bekannte Tracking-Dienste und keine Tracking-Cookies ohne Einwilligung gefunden.");
  } else {
    lines.push(`\u274C ${result.problems.length} Problem(e) gefunden:`);
    result.problems.forEach((f, i) => {
      if (f.kind === "request") {
        lines.push(`  ${i + 1}. Request an ${f.service} ${PHASE[f.phase]}${f.count && f.count > 1 ? ` (${f.count}\xD7)` : ""}:`);
        lines.push(`     ${truncate(f.detail)}`);
      } else {
        lines.push(`  ${i + 1}. Cookie ${f.detail} (${f.service}) ${PHASE[f.phase]} gesetzt`);
      }
    });
  }
  if (result.hints.length) {
    lines.push("");
    lines.push("\u2139\uFE0F  Hinweise (bitte pr\xFCfen, ob notwendig):");
    for (const f of result.hints) {
      lines.push(
        f.kind === "request" ? `  - Request an Drittanbieter ${f.service} ${PHASE[f.phase]}${f.count && f.count > 1 ? ` (${f.count}\xD7)` : ""}` : `  - Cookie ${f.detail} ${PHASE[f.phase]}`
      );
    }
    lines.push("    Externe Ressourcen (z. B. Schriftarten, CDNs) \xFCbertragen die IP-Adresse der Besucher an Dritte.");
  }
  lines.push("");
  lines.push("Hinweis: Diese Pr\xFCfung ist eine technische Momentaufnahme und keine Rechtsberatung.");
  return lines.join("\n");
}
function truncate(s, max = 140) {
  return s.length > max ? s.slice(0, max - 1) + "\u2026" : s;
}

// src/cli/load-config.ts
import { existsSync, unlinkSync, writeFileSync } from "fs";
import { createRequire } from "module";
import { dirname, join, resolve } from "path";
import { pathToFileURL } from "url";
var DEFAULT_CONFIG_PATHS = [
  "src/consent.config.ts",
  "consent.config.ts",
  "src/consent.config.js",
  "consent.config.js",
  "src/consent.config.mjs",
  "consent.config.mjs"
];
function looksLikeConfig(value) {
  return !!value && typeof value === "object" && Array.isArray(value.services) && !!value.links;
}
function pickConfig(mod) {
  const candidates = [mod.default, mod.consentConfig, mod.config, ...Object.values(mod)];
  const found = candidates.find(looksLikeConfig);
  if (!found) {
    throw new Error("In der Datei wurde keine Konfiguration gefunden. Bitte `export default defineConfig({...})` oder `export const consentConfig = ...` verwenden.");
  }
  return found;
}
async function loadConfig(path, cwd = process.cwd()) {
  const file = path ? resolve(cwd, path) : DEFAULT_CONFIG_PATHS.map((p) => join(cwd, p)).find((p) => existsSync(p));
  if (!file || !existsSync(file)) {
    throw new Error(`Konfigurationsdatei nicht gefunden${path ? `: ${path}` : ` (gesucht: ${DEFAULT_CONFIG_PATHS.join(", ")})`}.`);
  }
  if (!/\.[cm]?tsx?$/.test(file)) {
    return { config: pickConfig(await import(pathToFileURL(file).href)), file };
  }
  const require2 = createRequire(join(cwd, "package.json"));
  const errors = [];
  try {
    const esbuild = await import(pathToFileURL(require2.resolve("esbuild")).href);
    const build = esbuild.build ?? esbuild.default.build;
    const out = await build({
      entryPoints: [file],
      bundle: true,
      write: false,
      format: "esm",
      platform: "node",
      packages: "external",
      logLevel: "silent"
    });
    const tmp = join(dirname(file), `.consent-kit-config-${process.pid}.mjs`);
    writeFileSync(tmp, out.outputFiles[0].text);
    try {
      return { config: pickConfig(await import(pathToFileURL(tmp).href)), file };
    } finally {
      unlinkSync(tmp);
    }
  } catch (error) {
    errors.push(`esbuild: ${error.message.split("\n")[0]}`);
  }
  try {
    const tsx = await import(pathToFileURL(require2.resolve("tsx/esm/api")).href);
    return { config: pickConfig(await tsx.tsImport(pathToFileURL(file).href, import.meta.url)), file };
  } catch (error) {
    errors.push(`tsx: ${error.message.split("\n")[0]}`);
  }
  try {
    return { config: pickConfig(await import(pathToFileURL(file).href)), file };
  } catch (error) {
    errors.push(`node: ${error.message.split("\n")[0]}`);
  }
  throw new Error(
    "Die TypeScript-Konfiguration konnte nicht geladen werden. Installieren Sie z. B. tsx (npm i -D tsx) oder verwenden Sie Node.js 22.18 oder neuer.\n  " + errors.join("\n  ")
  );
}

// src/cli/index.ts
var HELP = `consent-kit \u2013 Befehle

  npx consent-kit check <url> [--reject] [--wait=3000] [--json] [--headed]
      \xD6ffnet die Seite in einem unsichtbaren Browser, klickt NICHTS an und listet
      Drittanbieter-Requests und Cookies vor der Einwilligung auf.
      --reject   zus\xE4tzlich \u201EAlle ablehnen\u201C klicken, neu laden und erneut pr\xFCfen
      --wait     Wartezeit nach dem Laden in Millisekunden (Standard 3000)
      --json     Ergebnis als JSON ausgeben
      Ben\xF6tigt Playwright:  npm i -D playwright && npx playwright install chromium

  npx consent-kit table [pfad/zur/consent.config.ts] [--format=md|html|both]
                        [--lang=de|en] [--owner="Firma GmbH"] [--out=datei]
      Erzeugt eine Tabelle aller Dienste (Anbieter, Zweck, Cookies, Speicherdauer,
      Drittland) f\xFCr die Datenschutzerkl\xE4rung. Mustertext \u2013 rechtlich pr\xFCfen lassen.
      Standard-Pfad: src/consent.config.ts

  npx consent-kit help
`;
function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (const arg of argv) {
    if (arg.startsWith("--")) {
      const [key, ...rest] = arg.slice(2).split("=");
      flags[key] = rest.length ? rest.join("=") : true;
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}
async function main(argv) {
  const [command, ...rest] = argv;
  const { positional, flags } = parseArgs(rest);
  if (!command || command === "help" || command === "--help" || command === "-h") {
    console.log(HELP);
    return 0;
  }
  if (command === "check") {
    const url = positional[0];
    if (!url) {
      console.error("Bitte eine URL angeben, z. B.: npx consent-kit check https://meine-seite.de");
      return 2;
    }
    const options = {
      reject: flags.reject === true,
      wait: typeof flags.wait === "string" ? Number(flags.wait) : void 0,
      headed: flags.headed === true,
      // Nur für automatisierte Tests: Tracker-Requests abbrechen statt ausführen.
      abortTrackers: process.env.CONSENT_KIT_ABORT_TRACKERS === "1"
    };
    const normalized = /^https?:\/\//.test(url) ? url : `https://${url}`;
    const result = await runCheck(normalized, options);
    console.log(flags.json ? JSON.stringify(result, null, 2) : formatCheckResult(result, options));
    return result.error ? 2 : result.problems.length ? 1 : 0;
  }
  if (command === "table") {
    const { config, file } = await loadConfig(positional[0]);
    const lang = flags.lang === "en" ? "en" : flags.lang === "de" ? "de" : void 0;
    const owner = typeof flags.owner === "string" ? flags.owner : void 0;
    const format = typeof flags.format === "string" ? flags.format : "both";
    const md = toMarkdown(config, { language: lang, owner });
    const html = toHtml(config, { language: lang, owner });
    const output = format === "md" || format === "markdown" ? md : format === "html" ? html : `## Markdown

${md}
## HTML

${html}`;
    if (typeof flags.out === "string") {
      writeFileSync2(resolve2(flags.out), output);
      console.error(`Tabelle aus ${file} gespeichert in ${resolve2(flags.out)} (Mustertext \u2013 rechtlich pr\xFCfen lassen).`);
    } else {
      console.log(output);
    }
    return 0;
  }
  console.error(`Unbekannter Befehl: ${command}
`);
  console.log(HELP);
  return 2;
}
main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (error) => {
    console.error(`Fehler: ${error.message ?? error}`);
    process.exit(2);
  }
);
