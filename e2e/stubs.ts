/**
 * Attrappen der echten Tracking-Skripte für die Tests. Sie verhalten sich im
 * Kern wie die Originale: Sie werten Consent-Signale aus, setzen die typischen
 * Cookies und senden Pings (die ebenfalls abgefangen werden).
 */

export const GA_COLLECT = 'google-analytics.com/g/collect';

/** Google Tag Manager mit einem GA4-Tag und einem Google-Ads-Tag, beide mit Consent-Prüfung. */
export const GTM_STUB = `
(function () {
  var dl = window.dataLayer = window.dataLayer || [];
  var consent = {};
  function ping(url) { var i = new Image(); i.src = url; }
  function isArgs(x) { return Object.prototype.toString.call(x) === '[object Arguments]'; }
  function handle(item) {
    if (isArgs(item)) {
      var a = Array.prototype.slice.call(item);
      if (a[0] === 'consent') { for (var k in a[2]) consent[k] = a[2][k]; }
      return;
    }
    if (!item || (item.event !== 'gtm.js' && item.event !== 'virtual_pageview')) return;
    var loc = item.page_location || location.href;
    if (consent.analytics_storage === 'granted') {
      if (!/(^|; )_ga=/.test(document.cookie)) document.cookie = '_ga=GA1.1.111.222; path=/; max-age=63072000';
      ping('https://www.google-analytics.com/g/collect?v=2&tid=G-TEST&en=page_view&dl=' + encodeURIComponent(loc));
    }
    if (consent.ad_storage === 'granted') {
      document.cookie = '_gcl_au=1.1.333; path=/; max-age=7776000';
      ping('https://googleads.g.doubleclick.net/pagead/viewthroughconversion/123/?url=' + encodeURIComponent(loc));
    }
  }
  var queued = dl.slice();
  var push = dl.push;
  dl.push = function () {
    var r = push.apply(dl, arguments);
    for (var i = 0; i < arguments.length; i++) handle(arguments[i]);
    return r;
  };
  for (var j = 0; j < queued.length; j++) handle(queued[j]);
  window.google_tag_manager = { stub: true };
})();
`;

/** Meta Pixel (fbevents.js). */
export const META_STUB = `
(function () {
  var f = window.fbq;
  if (!f) return;
  var pixel = null, granted = true;
  function run(a) {
    if (a[0] === 'consent') { granted = a[1] === 'grant'; return; }
    if (a[0] === 'init') {
      pixel = a[1];
      if (granted && !/(^|; )_fbp=/.test(document.cookie)) document.cookie = '_fbp=fb.1.444.555; path=/; max-age=7776000';
      return;
    }
    if (a[0] === 'track' && granted) {
      var i = new Image();
      i.src = 'https://www.facebook.com/tr/?id=' + pixel + '&ev=' + a[1] + '&dl=' + encodeURIComponent(location.href);
    }
  }
  f.callMethod = function () { run(Array.prototype.slice.call(arguments)); };
  var q = f.queue.slice(); f.queue.length = 0;
  for (var j = 0; j < q.length; j++) run(Array.prototype.slice.call(q[j]));
})();
`;

/** TikTok Pixel (events.js). */
export const TIKTOK_STUB = `
(function () {
  var t = window.ttq;
  if (!t) return;
  var granted = false;
  function run(a) {
    var m = a[0];
    if (m === 'grantConsent') { granted = true; document.cookie = '_ttp=ttp666; path=/; max-age=34190000'; return; }
    if (m === 'revokeConsent') { granted = false; return; }
    if ((m === 'page' || m === 'track') && granted) {
      var i = new Image();
      i.src = 'https://analytics.tiktok.com/api/v2/pixel?event=' + (m === 'page' ? 'Pageview' : a[1]) + '&url=' + encodeURIComponent(location.href);
    }
  }
  var queued = [];
  for (var k = 0; k < t.length; k++) if (Object.prototype.toString.call(t[k]) === '[object Array]') queued.push(t[k]);
  t.length = 0;
  (t.methods || []).forEach(function (m) { t[m] = function () { run([m].concat(Array.prototype.slice.call(arguments))); }; });
  queued.forEach(run);
})();
`;
