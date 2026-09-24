'use strict';

var consentKit = require('consent-kit');

// src/table/index.ts
var HEADINGS = {
  de: {
    title: "\xDCbersicht der eingesetzten Dienste",
    note: "Mustertext \u2013 rechtlich pr\xFCfen lassen. Generiert mit consent-kit.",
    name: "Dienst",
    category: "Kategorie",
    provider: "Anbieter",
    purpose: "Zweck",
    cookies: "Cookies (Speicherdauer)",
    thirdCountry: "Drittland\xFCbermittlung",
    privacy: "Datenschutzerkl\xE4rung",
    none: "Keine",
    noneKnown: "Keine bekannt"
  },
  en: {
    title: "Overview of the services used",
    note: "Sample text \u2013 have it reviewed by a lawyer. Generated with consent-kit.",
    name: "Service",
    category: "Category",
    provider: "Provider",
    purpose: "Purpose",
    cookies: "Cookies (storage period)",
    thirdCountry: "Third-country transfer",
    privacy: "Privacy policy",
    none: "None",
    noneKnown: "None known"
  }
};
function getServiceRows(config, options = {}) {
  const language = options.language ?? (config.language === "en" ? "en" : "de");
  const texts = consentKit.resolveTexts(config, language);
  const h = HEADINGS[language];
  const label = (id) => texts.categories[id]?.label ?? id;
  const row = (meta, categories) => ({
    name: meta.name,
    category: categories.map(label).join(", "),
    provider: meta.provider,
    purpose: meta.purpose[language],
    cookies: meta.cookies.map((c) => ({ name: c.name, duration: c.duration[language] })),
    thirdCountry: meta.thirdCountryTransfer?.[language] ?? h.noneKnown,
    privacyPolicyUrl: meta.privacyPolicyUrl
  });
  const rows = [];
  if (options.includeConsentCookie !== false) rows.push(row(consentKit.consentCookieMeta(config, options.owner), ["necessary"]));
  for (const plugin of config.services) rows.push(row(plugin.meta, consentKit.serviceCategories(plugin)));
  return rows;
}
var escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
var escapeMd = (s) => s.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
function toMarkdown(config, options = {}) {
  const language = options.language ?? (config.language === "en" ? "en" : "de");
  const h = HEADINGS[language];
  const rows = getServiceRows(config, { ...options, language });
  const lines = [
    `<!-- ${h.note} -->`,
    "",
    `| ${h.name} | ${h.category} | ${h.provider} | ${h.purpose} | ${h.cookies} | ${h.thirdCountry} | ${h.privacy} |`,
    "| --- | --- | --- | --- | --- | --- | --- |"
  ];
  for (const r of rows) {
    const cookies = r.cookies.length ? r.cookies.map((c) => `\`${c.name.replace(/[|`]/g, "")}\` (${escapeMd(c.duration)})`).join("<br>") : h.none;
    lines.push(
      `| ${escapeMd(r.name)} | ${escapeMd(r.category)} | ${escapeMd(r.provider)} | ${escapeMd(r.purpose)} | ${cookies} | ${escapeMd(r.thirdCountry)} | [Link](${r.privacyPolicyUrl}) |`
    );
  }
  return lines.join("\n") + "\n";
}
function toHtml(config, options = {}) {
  const language = options.language ?? (config.language === "en" ? "en" : "de");
  const h = HEADINGS[language];
  const rows = getServiceRows(config, { ...options, language });
  const out = [
    `<!-- ${h.note} -->`,
    '<table class="consent-kit-services">',
    `  <caption>${escapeHtml(h.title)}</caption>`,
    "  <thead>",
    `    <tr><th scope="col">${h.name}</th><th scope="col">${h.category}</th><th scope="col">${h.provider}</th><th scope="col">${h.purpose}</th><th scope="col">${h.cookies}</th><th scope="col">${h.thirdCountry}</th><th scope="col">${h.privacy}</th></tr>`,
    "  </thead>",
    "  <tbody>"
  ];
  for (const r of rows) {
    const cookies = r.cookies.length ? `<ul>${r.cookies.map((c) => `<li><code>${escapeHtml(c.name)}</code> (${escapeHtml(c.duration)})</li>`).join("")}</ul>` : h.none;
    out.push(
      `    <tr><th scope="row">${escapeHtml(r.name)}</th><td>${escapeHtml(r.category)}</td><td>${escapeHtml(r.provider)}</td><td>${escapeHtml(r.purpose)}</td><td>${cookies}</td><td>${escapeHtml(r.thirdCountry)}</td><td><a href="${escapeHtml(r.privacyPolicyUrl)}" rel="noopener noreferrer">${escapeHtml(r.privacyPolicyUrl)}</a></td></tr>`
    );
  }
  out.push("  </tbody>", "</table>");
  return out.join("\n") + "\n";
}

exports.getServiceRows = getServiceRows;
exports.toHtml = toHtml;
exports.toMarkdown = toMarkdown;
