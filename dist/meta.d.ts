/** Plugin-ID des Meta Pixels (siehe metaPixel()). */
declare const META_PIXEL_SERVICE_ID = "meta-pixel";
/** Meta-Standardereignisse (werden mit fbq('track') gesendet, alle anderen mit 'trackCustom'). */
declare const META_STANDARD_EVENTS: readonly ["AddPaymentInfo", "AddToCart", "AddToWishlist", "CompleteRegistration", "Contact", "CustomizeProduct", "Donate", "FindLocation", "InitiateCheckout", "Lead", "PageView", "Purchase", "Schedule", "Search", "StartTrial", "SubmitApplication", "Subscribe", "ViewContent"];
/** Optionen für trackMetaEvent. */
interface MetaEventOptions {
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
declare function trackMetaEvent(eventName: string, params?: Record<string, unknown>, options?: MetaEventOptions): string | null;
/**
 * Meta-Browser-Kennungen (`fbp`, `fbc`) für die Conversions API – nur mit Einwilligung,
 * sonst ein leeres Objekt. Praktisch, um sie z. B. mit einem Formular an den Server zu senden.
 */
declare function getMetaBrowserIds(): {
    fbp?: string;
    fbc?: string;
};

export { META_PIXEL_SERVICE_ID, META_STANDARD_EVENTS, type MetaEventOptions, getMetaBrowserIds, trackMetaEvent };
