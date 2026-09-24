/**
 * Erzeugt aus der Konfiguration eine Tabelle aller Dienste für die
 * Datenschutzerklärung (Markdown oder HTML).
 *
 * MUSTERTEXT – RECHTLICH PRÜFEN LASSEN: Die Angaben stammen aus den Plugins bzw.
 * Ihrer Konfiguration und müssen vor der Veröffentlichung geprüft werden.
 */
import {
  consentCookieMeta,
  resolveTexts,
  serviceCategories,
  type ConsentConfig,
  type Language,
  type ServiceMeta,
} from 'consent-kit';

export interface ServiceTableOptions {
  /** Sprache. Standard: Sprache der Konfiguration (bzw. "de"). */
  language?: Language;
  /** Betreiber der Website (wird beim eigenen Einwilligungs-Cookie angezeigt). */
  owner?: string;
  /** Eigenen Einwilligungs-Cookie als "notwendig" aufführen. Standard: true. */
  includeConsentCookie?: boolean;
}

export interface ServiceRow {
  name: string;
  category: string;
  provider: string;
  purpose: string;
  cookies: Array<{ name: string; duration: string }>;
  thirdCountry: string;
  privacyPolicyUrl: string;
}

const HEADINGS: Record<Language, Record<string, string>> = {
  de: {
    title: 'Übersicht der eingesetzten Dienste',
    note: 'Mustertext – rechtlich prüfen lassen. Generiert mit consent-kit.',
    name: 'Dienst',
    category: 'Kategorie',
    provider: 'Anbieter',
    purpose: 'Zweck',
    cookies: 'Cookies (Speicherdauer)',
    thirdCountry: 'Drittlandübermittlung',
    privacy: 'Datenschutzerklärung',
    none: 'Keine',
    noneKnown: 'Keine bekannt',
  },
  en: {
    title: 'Overview of the services used',
    note: 'Sample text – have it reviewed by a lawyer. Generated with consent-kit.',
    name: 'Service',
    category: 'Category',
    provider: 'Provider',
    purpose: 'Purpose',
    cookies: 'Cookies (storage period)',
    thirdCountry: 'Third-country transfer',
    privacy: 'Privacy policy',
    none: 'None',
    noneKnown: 'None known',
  },
};

/** Strukturierte Zeilen – falls Sie die Tabelle selbst gestalten möchten. */
export function getServiceRows(config: ConsentConfig, options: ServiceTableOptions = {}): ServiceRow[] {
  const language = options.language ?? (config.language === 'en' ? 'en' : 'de');
  const texts = resolveTexts(config, language);
  const h = HEADINGS[language];
  const label = (id: string) => texts.categories[id]?.label ?? id;
  const row = (meta: ServiceMeta, categories: readonly string[]): ServiceRow => ({
    name: meta.name,
    category: categories.map(label).join(', '),
    provider: meta.provider,
    purpose: meta.purpose[language],
    cookies: meta.cookies.map((c) => ({ name: c.name, duration: c.duration[language] })),
    thirdCountry: meta.thirdCountryTransfer?.[language] ?? h.noneKnown!,
    privacyPolicyUrl: meta.privacyPolicyUrl,
  });
  const rows: ServiceRow[] = [];
  if (options.includeConsentCookie !== false) rows.push(row(consentCookieMeta(config, options.owner), ['necessary']));
  for (const plugin of config.services) rows.push(row(plugin.meta, serviceCategories(plugin)));
  return rows;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const escapeMd = (s: string) =>
  s.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

/** Tabelle als Markdown. */
export function toMarkdown(config: ConsentConfig, options: ServiceTableOptions = {}): string {
  const language = options.language ?? (config.language === 'en' ? 'en' : 'de');
  const h = HEADINGS[language];
  const rows = getServiceRows(config, { ...options, language });
  const lines = [
    `<!-- ${h.note} -->`,
    '',
    `| ${h.name} | ${h.category} | ${h.provider} | ${h.purpose} | ${h.cookies} | ${h.thirdCountry} | ${h.privacy} |`,
    '| --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const r of rows) {
    const cookies = r.cookies.length ? r.cookies.map((c) => `\`${c.name.replace(/[|`]/g, '')}\` (${escapeMd(c.duration)})`).join('<br>') : h.none!;
    lines.push(
      `| ${escapeMd(r.name)} | ${escapeMd(r.category)} | ${escapeMd(r.provider)} | ${escapeMd(r.purpose)} | ${cookies} | ${escapeMd(r.thirdCountry)} | [Link](${r.privacyPolicyUrl}) |`,
    );
  }
  return lines.join('\n') + '\n';
}

/** Tabelle als HTML (ohne eigenes Styling – übernimmt das Design Ihrer Seite). */
export function toHtml(config: ConsentConfig, options: ServiceTableOptions = {}): string {
  const language = options.language ?? (config.language === 'en' ? 'en' : 'de');
  const h = HEADINGS[language];
  const rows = getServiceRows(config, { ...options, language });
  const out = [
    `<!-- ${h.note} -->`,
    '<table class="consent-kit-services">',
    `  <caption>${escapeHtml(h.title!)}</caption>`,
    '  <thead>',
    `    <tr><th scope="col">${h.name}</th><th scope="col">${h.category}</th><th scope="col">${h.provider}</th><th scope="col">${h.purpose}</th><th scope="col">${h.cookies}</th><th scope="col">${h.thirdCountry}</th><th scope="col">${h.privacy}</th></tr>`,
    '  </thead>',
    '  <tbody>',
  ];
  for (const r of rows) {
    const cookies = r.cookies.length
      ? `<ul>${r.cookies.map((c) => `<li><code>${escapeHtml(c.name)}</code> (${escapeHtml(c.duration)})</li>`).join('')}</ul>`
      : h.none!;
    out.push(
      `    <tr><th scope="row">${escapeHtml(r.name)}</th><td>${escapeHtml(r.category)}</td><td>${escapeHtml(r.provider)}</td><td>${escapeHtml(r.purpose)}</td><td>${cookies}</td><td>${escapeHtml(r.thirdCountry)}</td><td><a href="${escapeHtml(r.privacyPolicyUrl)}" rel="noopener noreferrer">${escapeHtml(r.privacyPolicyUrl)}</a></td></tr>`,
    );
  }
  out.push('  </tbody>', '</table>');
  return out.join('\n') + '\n';
}
