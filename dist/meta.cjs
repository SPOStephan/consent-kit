'use strict';

var consentKit = require('consent-kit');

// src/meta/index.ts
var META_PIXEL_SERVICE_ID = "meta-pixel";
var META_STANDARD_EVENTS = [
  "AddPaymentInfo",
  "AddToCart",
  "AddToWishlist",
  "CompleteRegistration",
  "Contact",
  "CustomizeProduct",
  "Donate",
  "FindLocation",
  "InitiateCheckout",
  "Lead",
  "PageView",
  "Purchase",
  "Schedule",
  "Search",
  "StartTrial",
  "SubmitApplication",
  "Subscribe",
  "ViewContent"
];
function createEventId() {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
function readBrowserCookie(name) {
  const part = document.cookie.split("; ").find((p) => p.startsWith(name + "="));
  return part ? part.slice(name.length + 1) : void 0;
}
function trackMetaEvent(eventName, params = {}, options = {}) {
  if (typeof window === "undefined" || !consentKit.hasConsent(META_PIXEL_SERVICE_ID)) return null;
  const fbq = window.fbq;
  if (typeof fbq !== "function") return null;
  const eventId = options.eventId ?? createEventId();
  const standard = META_STANDARD_EVENTS.includes(eventName);
  fbq(standard ? "track" : "trackCustom", eventName, params, { eventID: eventId });
  return eventId;
}
function getMetaBrowserIds() {
  if (typeof document === "undefined" || !consentKit.hasConsent(META_PIXEL_SERVICE_ID)) return {};
  const fbp = readBrowserCookie("_fbp");
  const fbc = readBrowserCookie("_fbc");
  return { ...fbp ? { fbp } : {}, ...fbc ? { fbc } : {} };
}

exports.META_PIXEL_SERVICE_ID = META_PIXEL_SERVICE_ID;
exports.META_STANDARD_EVENTS = META_STANDARD_EVENTS;
exports.getMetaBrowserIds = getMetaBrowserIds;
exports.trackMetaEvent = trackMetaEvent;
