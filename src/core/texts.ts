import type { ConsentConfig, DeepPartial, Language, ServiceMeta, Texts } from './types';

/*
 * ============================================================================
 *  MUSTERTEXT – RECHTLICH PRÜFEN LASSEN
 *  Die folgenden Standardtexte sind unverbindliche Vorlagen. Sie ersetzen
 *  keine Rechtsberatung und müssen vor dem Einsatz auf die eigene Website
 *  angepasst und rechtlich geprüft werden.
 *
 *  SAMPLE TEXT – HAVE IT REVIEWED BY A LAWYER
 * ============================================================================
 */
export const defaultTexts: Record<Language, Texts> = {
  de: {
    bannerTitle: 'Datenschutz-Einstellungen',
    bannerDescription:
      'Wir möchten Dienste von Drittanbietern nutzen, um unsere Website zu analysieren und Werbung zu messen. ' +
      'Dabei können Daten (z. B. Geräte-Kennungen) an die Anbieter übermittelt werden, teilweise auch in Drittländer wie die USA. ' +
      'Diese Dienste werden nur geladen, wenn Sie einwilligen. Ihre Auswahl können Sie jederzeit über „Cookie-Einstellungen“ ändern oder widerrufen.',
    acceptAll: 'Alle akzeptieren',
    rejectAll: 'Alle ablehnen',
    settings: 'Einstellungen',
    save: 'Auswahl speichern',
    close: 'Schließen',
    settingsTitle: 'Cookie-Einstellungen',
    settingsDescription:
      'Hier können Sie festlegen, welche Kategorien und Dienste Sie erlauben. Notwendige Funktionen sind immer aktiv. ' +
      'Ihre Einwilligung ist freiwillig und kann jederzeit mit Wirkung für die Zukunft widerrufen werden.',
    imprint: 'Impressum',
    privacy: 'Datenschutzerklärung',
    alwaysActive: 'Immer aktiv',
    showDetails: 'Details anzeigen',
    hideDetails: 'Details ausblenden',
    services: 'Dienste',
    provider: 'Anbieter',
    purpose: 'Zweck',
    cookies: 'Cookies',
    duration: 'Speicherdauer',
    thirdCountry: 'Drittlandübermittlung',
    noThirdCountry: 'Keine bekannt',
    noCookies: 'Keine',
    privacyPolicy: 'Datenschutzerklärung des Anbieters',
    allowService: 'Diesen Dienst erlauben',
    gpcNotice:
      'Ihr Browser sendet das Signal „Global Privacy Control“. Marketing-Dienste werden daher nicht automatisch aktiviert.',
    gateTitle: 'Externer Inhalt',
    gateDescription:
      'Hier wird ein Inhalt von {service} ({provider}) angezeigt. Beim Laden werden Daten an den Anbieter übermittelt{thirdCountry}.',
    gateLoad: 'Inhalt laden',
    gateAlwaysAllow: 'Beim Laden merken wir uns Ihre Einwilligung für {service}. Widerruf über „Cookie-Einstellungen“.',
    categories: {
      necessary: {
        label: 'Notwendig',
        description:
          'Erforderlich für den Betrieb der Website, z. B. zum Speichern Ihrer Datenschutz-Einstellungen. Diese Kategorie kann nicht abgewählt werden.',
      },
      statistics: {
        label: 'Statistik',
        description:
          'Hilft uns zu verstehen, wie Besucher die Website nutzen (z. B. Seitenaufrufe), um sie zu verbessern.',
      },
      marketing: {
        label: 'Marketing',
        description:
          'Wird verwendet, um den Erfolg von Werbung zu messen und Ihnen auf anderen Websites passende Werbung anzuzeigen.',
      },
    },
  },
  en: {
    bannerTitle: 'Privacy settings',
    bannerDescription:
      'We would like to use third-party services to analyse our website and measure advertising. ' +
      'In doing so, data (e.g. device identifiers) may be transferred to the providers, partly also to third countries such as the USA. ' +
      'These services are only loaded if you consent. You can change or withdraw your choice at any time via “Cookie settings”.',
    acceptAll: 'Accept all',
    rejectAll: 'Reject all',
    settings: 'Settings',
    save: 'Save selection',
    close: 'Close',
    settingsTitle: 'Cookie settings',
    settingsDescription:
      'Choose which categories and services you allow. Necessary functions are always active. ' +
      'Your consent is voluntary and can be withdrawn at any time with effect for the future.',
    imprint: 'Legal notice',
    privacy: 'Privacy policy',
    alwaysActive: 'Always active',
    showDetails: 'Show details',
    hideDetails: 'Hide details',
    services: 'Services',
    provider: 'Provider',
    purpose: 'Purpose',
    cookies: 'Cookies',
    duration: 'Storage period',
    thirdCountry: 'Third-country transfer',
    noThirdCountry: 'None known',
    noCookies: 'None',
    privacyPolicy: 'Provider’s privacy policy',
    allowService: 'Allow this service',
    gpcNotice:
      'Your browser sends the “Global Privacy Control” signal. Marketing services are therefore not activated automatically.',
    gateTitle: 'External content',
    gateDescription:
      'This area shows content from {service} ({provider}). When loading it, data is transferred to the provider{thirdCountry}.',
    gateLoad: 'Load content',
    gateAlwaysAllow: 'When loading, we remember your consent for {service}. Withdraw via “Cookie settings”.',
    categories: {
      necessary: {
        label: 'Necessary',
        description:
          'Required for the website to work, e.g. to store your privacy settings. This category cannot be deselected.',
      },
      statistics: {
        label: 'Statistics',
        description: 'Helps us understand how visitors use the website (e.g. page views) so we can improve it.',
      },
      marketing: {
        label: 'Marketing',
        description: 'Used to measure the success of advertising and to show you relevant ads on other websites.',
      },
    },
  },
};

/** Ermittelt die Sprache der Oberfläche. */
export function resolveLanguage(config: Pick<ConsentConfig, 'language'>): Language {
  const lang = config.language ?? 'de';
  if (lang !== 'auto') return lang;
  const candidate =
    (typeof document !== 'undefined' && document.documentElement.lang) ||
    (typeof navigator !== 'undefined' && navigator.language) ||
    'de';
  return candidate.toLowerCase().startsWith('de') ? 'de' : 'en';
}

function merge<T>(base: T, override: DeepPartial<T> | undefined): T {
  if (!override) return base;
  const result: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue;
    const current = result[key];
    result[key] =
      value && typeof value === 'object' && current && typeof current === 'object'
        ? merge(current, value as DeepPartial<typeof current>)
        : value;
  }
  return result as T;
}

/** Standardtexte + eigene Kategorien + Overrides aus der Konfiguration. */
export function resolveTexts(config: ConsentConfig, language = resolveLanguage(config)): Texts {
  let texts = defaultTexts[language];
  for (const category of config.categories ?? []) {
    texts = merge(texts, {
      categories: { [category.id]: { label: category.label[language], description: category.description[language] } },
    });
  }
  return merge(texts, config.texts?.[language]);
}

/** Ersetzt {platzhalter} in einem Text. */
export function formatText(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? '');
}

/**
 * Angaben zum eigenen Einwilligungs-Cookie (Kategorie "notwendig") – für Dialog
 * und Datenschutz-Tabelle. MUSTERTEXT – rechtlich prüfen lassen.
 */
export function consentCookieMeta(config: ConsentConfig, owner = ''): ServiceMeta {
  const days = Math.min(config.cookie?.maxAgeDays ?? 365, 365);
  const duration = days === 365 ? { de: '12 Monate', en: '12 months' } : { de: `${days} Tage`, en: `${days} days` };
  return {
    name: 'Einwilligungs-Speicher (consent-kit)',
    provider: owner || '–',
    purpose: {
      de: 'Speichert Ihre Datenschutz-Einstellungen (anonyme Consent-ID, Zeitpunkt, Version der Einstellungen, gewählte Kategorien).',
      en: 'Stores your privacy settings (anonymous consent ID, time, settings version, selected categories).',
    },
    cookies: [{ name: config.cookie?.name ?? 'consent_kit', duration }],
    thirdCountryTransfer: null,
    privacyPolicyUrl: config.links.privacy,
  };
}
