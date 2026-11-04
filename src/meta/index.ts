/**
 * consent-kit/meta – Meta-Pixel-Ereignisse mit Einwilligungsprüfung und Ereignis-ID
 * (für die Deduplizierung mit der Conversions API). Eigener Unterpfad, damit Websites
 * ohne diese Funktionen nichts davon mitladen.
 */
import { hasConsent } from 'consent-kit';

/** Plugin-ID des Meta Pixels (siehe metaPixel()). */
export const META_PIXEL_SERVICE_ID = 'meta-pixel';

/** Meta-Standardereignisse (werden mit fbq('track') gesendet, alle anderen mit 'trackCustom'). */
export const META_STANDARD_EVENTS = [
  'AddPaymentInfo', 'AddToCart', 'AddToWishlist', 'CompleteRegistration', 'Contact', 'CustomizeProduct',
  'Donate', 'FindLocation', 'InitiateCheckout', 'Lead', 'PageView', 'Purchase', 'Schedule', 'Search',
  'StartTrial', 'SubmitApplication', 'Subscribe', 'ViewContent',
] as const;

function createEventId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function readBrowserCookie(name: string): string | undefined {
  const part = document.cookie.split('; ').find((p) => p.startsWith(name + '='));
  return part ? part.slice(name.length + 1) : undefined;
}

/** Optionen für trackMetaEvent. */
export interface MetaEventOptions {
  /**
   * Ereignis-ID für die Deduplizierung mit der Conversions API: Browser und Server senden
   * dasselbe Ereignis mit derselben ID, Meta zählt es einmal. Ohne Angabe wird eine UUID erzeugt.
   */
  eventId?: string;
}

/**
 * Sendet ein Meta-Pixel-Ereignis (z. B. "Lead", "CompleteRegistration", "Purchase") – aber nur,
 * wenn für den Meta Pixel eingewilligt wurde und der Pixel über consent-kit geladen ist.
 * Standardereignisse gehen per fbq('track'), alle anderen per fbq('trackCustom').
 *
 * Gibt die verwendete Ereignis-ID zurück (für den Server-Aufruf) oder `null`, wenn nichts
 * gesendet wurde (keine Einwilligung). Ohne Einwilligung darf auch der Server das Ereignis
 * nicht an Meta senden.
 */
export function trackMetaEvent(
  eventName: string,
  params: Record<string, unknown> = {},
  options: MetaEventOptions = {},
): string | null {
  if (typeof window === 'undefined' || !hasConsent(META_PIXEL_SERVICE_ID)) return null;
  const fbq = (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq;
  if (typeof fbq !== 'function') return null;
  const eventId = options.eventId ?? createEventId();
  const standard = (META_STANDARD_EVENTS as readonly string[]).includes(eventName);
  fbq(standard ? 'track' : 'trackCustom', eventName, params, { eventID: eventId });
  return eventId;
}

/**
 * Meta-Browser-Kennungen (`fbp`, `fbc`) für die Conversions API – nur mit Einwilligung,
 * sonst ein leeres Objekt. Praktisch, um sie z. B. mit einem Formular an den Server zu senden.
 */
export function getMetaBrowserIds(): { fbp?: string; fbc?: string } {
  if (typeof document === 'undefined' || !hasConsent(META_PIXEL_SERVICE_ID)) return {};
  const fbp = readBrowserCookie('_fbp');
  const fbc = readBrowserCookie('_fbc');
  return { ...(fbp ? { fbp } : {}), ...(fbc ? { fbc } : {}) };
}
