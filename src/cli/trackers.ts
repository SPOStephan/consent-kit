/**
 * Zentrale Liste bekannter Drittanbieter-Domains, die vor einer Einwilligung
 * NICHT kontaktiert werden dürfen. Wird von den End-to-End-Tests und vom
 * Prüf-Werkzeug (`consent-kit check`) verwendet – hier erweitern.
 */
export interface TrackerDomain {
  /** Domain (inkl. aller Subdomains). */
  domain: string;
  /** Anzeigename. */
  name: string;
  /** Optional: nur Pfade mit diesem Präfix zählen (z. B. google.com/pagead). */
  pathPrefix?: string;
}

export const TRACKER_DOMAINS: readonly TrackerDomain[] = [
  // Google
  { domain: 'googletagmanager.com', name: 'Google Tag Manager' },
  { domain: 'google-analytics.com', name: 'Google Analytics' },
  { domain: 'analytics.google.com', name: 'Google Analytics' },
  { domain: 'googleadservices.com', name: 'Google Ads' },
  { domain: 'doubleclick.net', name: 'Google Ads / DoubleClick' },
  { domain: 'googlesyndication.com', name: 'Google AdSense' },
  { domain: 'google.com', name: 'Google Ads', pathPrefix: '/pagead' },
  { domain: 'google.com', name: 'Google Ads', pathPrefix: '/ccm' },
  { domain: 'google.com', name: 'Google Maps', pathPrefix: '/maps' },
  { domain: 'googleapis.com', name: 'Google APIs (z. B. Maps, Fonts)' },
  { domain: 'gstatic.com', name: 'Google Static (z. B. Fonts, Maps)' },
  { domain: 'youtube.com', name: 'YouTube' },
  { domain: 'youtube-nocookie.com', name: 'YouTube' },
  { domain: 'ytimg.com', name: 'YouTube' },
  // Meta
  { domain: 'connect.facebook.net', name: 'Meta Pixel' },
  { domain: 'facebook.com', name: 'Meta / Facebook' },
  { domain: 'facebook.net', name: 'Meta / Facebook' },
  { domain: 'instagram.com', name: 'Instagram' },
  // TikTok
  { domain: 'analytics.tiktok.com', name: 'TikTok Pixel' },
  { domain: 'tiktok.com', name: 'TikTok' },
  { domain: 'tiktokw.us', name: 'TikTok' },
  // Weitere verbreitete Dienste
  { domain: 'snap.licdn.com', name: 'LinkedIn Insight Tag' },
  { domain: 'px.ads.linkedin.com', name: 'LinkedIn Insight Tag' },
  { domain: 'linkedin.com', name: 'LinkedIn' },
  { domain: 'ct.pinterest.com', name: 'Pinterest Tag' },
  { domain: 's.pinimg.com', name: 'Pinterest Tag' },
  { domain: 'bat.bing.com', name: 'Microsoft Ads' },
  { domain: 'clarity.ms', name: 'Microsoft Clarity' },
  { domain: 'hotjar.com', name: 'Hotjar' },
  { domain: 'hotjar.io', name: 'Hotjar' },
  { domain: 'sc-static.net', name: 'Snapchat Pixel' },
  { domain: 'snapchat.com', name: 'Snapchat' },
  { domain: 'twitter.com', name: 'X / Twitter' },
  { domain: 'ads-twitter.com', name: 'X / Twitter Ads' },
  { domain: 'vimeo.com', name: 'Vimeo' },
  { domain: 'vimeocdn.com', name: 'Vimeo' },
  { domain: 'hs-scripts.com', name: 'HubSpot' },
  { domain: 'hs-analytics.net', name: 'HubSpot' },
  { domain: 'fonts.bunny.net', name: 'Bunny Fonts' },
  { domain: 'use.typekit.net', name: 'Adobe Fonts' },
];

/** Findet den passenden Tracker-Eintrag für eine URL (oder undefined). */
export function matchTracker(url: string): TrackerDomain | undefined {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return undefined;
  }
  const host = parsed.hostname.toLowerCase();
  return TRACKER_DOMAINS.find(
    (t) =>
      (host === t.domain || host.endsWith('.' + t.domain)) &&
      (!t.pathPrefix || parsed.pathname.startsWith(t.pathPrefix)),
  );
}
