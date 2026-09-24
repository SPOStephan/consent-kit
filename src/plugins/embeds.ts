import type { CategoryId, ConsentPlugin, ServiceMeta } from '../core/types';

export interface EmbedOptions {
  /** Kategorie. Standard: "marketing". Tipp: eigene Kategorie "media" anlegen. */
  category?: CategoryId;
  /** Angaben überschreiben (z. B. Zweck). */
  meta?: Partial<ServiceMeta>;
}

const GOOGLE = 'Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland';
const USA = {
  de: 'USA (Google LLC; EU-US Data Privacy Framework, Standardvertragsklauseln)',
  en: 'USA (Google LLC; EU-US Data Privacy Framework, standard contractual clauses)',
};

/**
 * YouTube-Videos. Wird zusammen mit <ConsentGate service="youtube"> verwendet.
 * Tipp: youtube-nocookie.com als Einbettungs-Domain verwenden.
 */
export function youtube(options: EmbedOptions = {}): ConsentPlugin {
  return {
    id: 'youtube',
    category: options.category ?? 'marketing',
    meta: {
      name: 'YouTube',
      provider: GOOGLE,
      purpose: {
        de: 'Anzeige eingebetteter Videos. Beim Laden werden u. a. IP-Adresse und Geräteinformationen an YouTube/Google übermittelt; Google kann diese Daten auch für Werbezwecke nutzen.',
        en: 'Displays embedded videos. When loading, data such as IP address and device information is transferred to YouTube/Google; Google may also use this data for advertising.',
      },
      cookies: [
        { name: 'VISITOR_INFO1_LIVE', duration: { de: '6 Monate', en: '6 months' } },
        { name: 'YSC', duration: { de: 'Sitzung', en: 'Session' } },
        { name: 'VISITOR_PRIVACY_METADATA', duration: { de: '6 Monate', en: '6 months' } },
      ],
      thirdCountryTransfer: USA,
      privacyPolicyUrl: 'https://policies.google.com/privacy',
      ...options.meta,
    },
  };
}

/** Google Maps. Wird zusammen mit <ConsentGate service="google-maps"> verwendet. */
export function googleMaps(options: EmbedOptions = {}): ConsentPlugin {
  return {
    id: 'google-maps',
    category: options.category ?? 'marketing',
    meta: {
      name: 'Google Maps',
      provider: GOOGLE,
      purpose: {
        de: 'Anzeige interaktiver Karten. Beim Laden werden u. a. IP-Adresse und Geräteinformationen an Google übermittelt.',
        en: 'Displays interactive maps. When loading, data such as IP address and device information is transferred to Google.',
      },
      cookies: [{ name: 'NID (google.com)', duration: { de: '6 Monate', en: '6 months' } }],
      thirdCountryTransfer: USA,
      privacyPolicyUrl: 'https://policies.google.com/privacy',
      ...options.meta,
    },
  };
}

/** Beliebiger eingebetteter Inhalt (z. B. Vimeo, Calendly) – für <ConsentGate>. */
export function embed(options: { id: string; category?: CategoryId; meta: ServiceMeta }): ConsentPlugin {
  return { id: options.id, category: options.category ?? 'marketing', meta: options.meta };
}
