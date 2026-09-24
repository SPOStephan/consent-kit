/**
 * Admin-Oberfläche (eine Seite, ohne externe Abhängigkeiten).
 * Alle Daten werden per textContent eingefügt – nie als HTML (Schutz vor XSS).
 */

const CSS = `
:root { color-scheme: light dark; --bg:#f5f6f8; --card:#fff; --text:#1a1a1a; --muted:#555b66; --border:#d5d9e0; --accent:#0b57d0; --accent-text:#fff; --danger:#b3261e; --ok:#146c2e; --code:#f0f2f5; }
@media (prefers-color-scheme: dark) { :root { --bg:#121316; --card:#1e1f22; --text:#eceef1; --muted:#b4b9c2; --border:#3a3d44; --accent:#8ab4f8; --accent-text:#0b1a33; --danger:#f2b8b5; --ok:#8fd9a8; --code:#2a2c31; } }
* { box-sizing: border-box; }
body { margin:0; font: 15px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; background:var(--bg); color:var(--text); }
header { display:flex; flex-wrap:wrap; gap:.5rem 1rem; align-items:center; justify-content:space-between; padding:.75rem 1.25rem; background:var(--card); border-bottom:1px solid var(--border); }
header h1 { font-size:1.1rem; margin:0; }
header .user { color:var(--muted); font-size:.9rem; }
.layout { display:grid; grid-template-columns: 260px 1fr; gap:1.25rem; padding:1.25rem; max-width:1300px; margin:0 auto; }
@media (max-width: 800px) { .layout { grid-template-columns: 1fr; } }
nav, .card { background:var(--card); border:1px solid var(--border); border-radius:12px; padding:1rem; }
nav h2 { font-size:.95rem; margin:.25rem 0 .5rem; }
nav h2.spaced { margin-top:1.5rem; }
nav ul { list-style:none; margin:0 0 .75rem; padding:0; }
nav li button { width:100%; text-align:left; padding:.5rem .6rem; border:0; border-radius:8px; background:none; color:var(--text); font:inherit; cursor:pointer; }
nav li button[aria-current="true"] { background:var(--code); font-weight:600; }
nav li button small { display:block; color:var(--muted); font-weight:400; overflow-wrap:anywhere; }
button, .btn { font:inherit; padding:.5rem .9rem; border-radius:8px; border:1px solid var(--accent); background:var(--accent); color:var(--accent-text); cursor:pointer; font-weight:600; }
button.secondary { background:transparent; color:var(--text); border-color:var(--border); }
button.danger { background:transparent; color:var(--danger); border-color:var(--danger); }
button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible { outline:3px solid var(--accent); outline-offset:2px; }
.tabs { display:flex; flex-wrap:wrap; gap:.25rem; border-bottom:1px solid var(--border); margin-bottom:1rem; }
.tabs button { background:none; color:var(--text); border:0; border-bottom:3px solid transparent; border-radius:0; font-weight:500; }
.tabs button[aria-selected="true"] { border-bottom-color:var(--accent); font-weight:700; }
fieldset { border:1px solid var(--border); border-radius:10px; padding:.75rem 1rem 1rem; margin:0 0 1rem; }
legend { font-weight:700; padding:0 .35rem; }
label { display:block; margin:.6rem 0 .2rem; font-weight:600; }
label.inline { display:flex; gap:.5rem; align-items:center; font-weight:500; margin:.4rem 0; }
input[type=text], input[type=url], textarea, select { width:100%; padding:.5rem .6rem; border:1px solid var(--border); border-radius:8px; background:var(--bg); color:var(--text); font:inherit; }
textarea { min-height:5rem; }
.hint { color:var(--muted); font-size:.88rem; margin:.2rem 0 0; }
.grid2 { display:grid; grid-template-columns:1fr 1fr; gap:0 1rem; }
@media (max-width: 600px) { .grid2 { grid-template-columns:1fr; } }
.service { border-top:1px solid var(--border); padding-top:.5rem; margin-top:.5rem; }
.actions { display:flex; flex-wrap:wrap; gap:.5rem; margin-top:1rem; }
.errors { border:2px solid var(--danger); border-radius:10px; padding:.5rem 1rem; color:var(--danger); }
.success { border:2px solid var(--ok); border-radius:10px; padding:.5rem 1rem; color:var(--ok); }
pre { background:var(--code); border-radius:8px; padding:.75rem; overflow:auto; max-height:420px; font-size:.82rem; white-space:pre-wrap; overflow-wrap:anywhere; }
.snippet { margin-bottom:1.25rem; }
.snippet h3 { font-size:1rem; margin:0 0 .25rem; display:flex; justify-content:space-between; align-items:center; gap:1rem; }
.stats { display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:.75rem; }
.stat { background:var(--code); border-radius:10px; padding:.75rem; }
.stat b { display:block; font-size:1.5rem; }
table { border-collapse:collapse; width:100%; font-size:.88rem; }
th, td { border:1px solid var(--border); padding:.4rem .5rem; text-align:left; vertical-align:top; }
.badge { display:inline-block; padding:.1rem .5rem; border-radius:999px; background:var(--code); font-size:.85rem; }
.muted { color:var(--muted); }
[hidden] { display:none !important; }
`;

const SCRIPT = `
(function () {
  'use strict';
  var state = { sites: [], current: null, tab: 'settings', endpoint: '' };
  var content = document.getElementById('content');
  var list = document.getElementById('site-list');

  // ---------- Hilfen
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, String(v));
    });
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c === null || c === undefined || c === false) continue;
      if (Array.isArray(c)) c.forEach(function (x) { if (x) el.appendChild(typeof x === 'string' ? document.createTextNode(x) : x); });
      else el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return el;
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }
  function token() { try { return sessionStorage.getItem('ck-admin-token') || ''; } catch (e) { return ''; } }
  function api(method, path, body) {
    var headers = { 'X-Consent-Kit-Admin': '1' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token()) headers['Authorization'] = 'Bearer ' + token();
    return fetch('/admin/api/' + path, { method: method, headers: headers, body: body === undefined ? undefined : JSON.stringify(body), credentials: 'same-origin' })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (data) { return { status: r.status, data: data }; }); });
  }
  function messages(kind, items) {
    return h('div', { class: kind, role: kind === 'errors' ? 'alert' : 'status' }, h('ul', null, items.map(function (m) { return h('li', { text: m }); })));
  }
  function copyButton(getText, label) {
    var btn = h('button', { type: 'button', class: 'secondary', text: label || 'Kopieren' });
    btn.addEventListener('click', function () {
      navigator.clipboard.writeText(getText()).then(function () { btn.textContent = 'Kopiert ✓'; setTimeout(function () { btn.textContent = label || 'Kopieren'; }, 1500); });
    });
    return btn;
  }
  function field(id, labelText, input, hint) {
    input.id = id;
    return h('div', null, h('label', { for: id, text: labelText }), input, hint ? h('p', { class: 'hint', id: id + '-hint', text: hint }) : null);
  }
  function check(id, labelText, checked) {
    return h('label', { class: 'inline', for: id }, h('input', { type: 'checkbox', id: id, checked: !!checked }), labelText);
  }
  function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }
  function checked(id) { var el = document.getElementById(id); return !!(el && el.checked); }

  // ---------- Start
  function start() {
    api('GET', 'me').then(function (res) {
      if (res.status === 401) return showLogin(res.data);
      document.getElementById('user').textContent = 'Angemeldet: ' + res.data.user;
      state.endpoint = res.data.endpoint;
      document.getElementById('app').hidden = false;
      document.getElementById('login').hidden = true;
      loadSites();
    });
  }

  function showLogin(info) {
    document.getElementById('app').hidden = true;
    var box = document.getElementById('login');
    box.hidden = false;
    document.getElementById('access-hint').hidden = !info.accessConfigured;
  }

  document.getElementById('token-form').addEventListener('submit', function (e) {
    e.preventDefault();
    try { sessionStorage.setItem('ck-admin-token', document.getElementById('token').value.trim()); } catch (err) {}
    start();
  });

  function loadSites(selectId) {
    api('GET', 'sites').then(function (res) {
      state.sites = res.data || [];
      renderList();
      var id = selectId || (state.current && state.current.id) || (state.sites[0] && state.sites[0].id);
      if (id) openSite(id); else renderEmpty();
    });
  }

  function renderList() {
    clear(list);
    state.sites.forEach(function (s) {
      list.appendChild(h('li', null, h('button', { type: 'button', 'aria-current': state.current && state.current.id === s.id ? 'true' : 'false', onclick: function () { state.tab = 'settings'; openSite(s.id); } },
        s.name, h('small', { text: s.domains.join(', ') }))));
    });
  }

  function renderEmpty() {
    state.current = null;
    clear(content);
    content.appendChild(h('div', { class: 'card' }, h('h2', { text: 'Willkommen!' }),
      h('p', { text: 'Legen Sie Ihre erste Website an. Danach erhalten Sie den fertigen Einbau-Code.' }),
      h('button', { type: 'button', onclick: newSite, text: '+ Neue Website' })));
  }

  function openSite(id) {
    api('GET', 'sites/' + encodeURIComponent(id)).then(function (res) {
      if (res.status !== 200) return renderEmpty();
      state.current = res.data;
      renderList();
      renderSite();
    });
  }

  function newSite() {
    state.current = null;
    renderList();
    clear(content);
    content.appendChild(h('div', { class: 'card' }, h('h2', { text: 'Neue Website' }), settingsForm(null)));
  }
  document.getElementById('new-site').addEventListener('click', newSite);

  // ---------- Website-Ansicht
  function renderSite() {
    var site = state.current;
    clear(content);
    var tabs = [['settings', 'Einstellungen'], ['embed', 'Einbau'], ['table', 'Datenschutz-Tabelle'], ['stats', 'Statistik']];
    var tabBar = h('div', { class: 'tabs', role: 'tablist' }, tabs.map(function (t) {
      return h('button', { type: 'button', role: 'tab', 'aria-selected': state.tab === t[0] ? 'true' : 'false', onclick: function () { state.tab = t[0]; renderSite(); }, text: t[1] });
    }));
    var panel = h('div', { role: 'tabpanel' });
    content.appendChild(h('div', { class: 'card' },
      h('h2', null, site.settings.name + ' ', h('span', { class: 'badge', text: 'Version ' + site.version })),
      h('p', { class: 'muted', text: 'Kennung: ' + site.id + ' · zuletzt geändert: ' + new Date(site.updatedAt).toLocaleString('de-DE') }),
      tabBar, panel));
    if (state.tab === 'settings') panel.appendChild(settingsForm(site));
    if (state.tab === 'embed') renderEmbed(panel, site);
    if (state.tab === 'table') renderTable(panel, site);
    if (state.tab === 'stats') renderStats(panel, site);
  }

  function serviceOf(site, type) {
    return site ? (site.settings.services || []).filter(function (s) { return s.type === type; })[0] : null;
  }

  function settingsForm(site) {
    var s = site ? site.settings : { domains: [], links: {}, ui: {}, texts: {}, services: [], logging: true, language: 'de' };
    var gtm = serviceOf(site, 'google-tag-manager');
    var meta = serviceOf(site, 'meta-pixel');
    var tt = serviceOf(site, 'tiktok-pixel');
    var out = h('div', { id: 'form-messages' });
    function mode(svc) { return !svc ? 'off' : svc.loadVia === 'gtm' ? 'gtm' : 'kit'; }
    function modeSelect(id, svc) {
      var sel = h('select', null,
        h('option', { value: 'off', text: 'nicht verwenden' }),
        h('option', { value: 'kit', text: 'über consent-kit laden (empfohlen)' }),
        h('option', { value: 'gtm', text: 'ist in Google Tag Manager eingerichtet' }));
      sel.value = mode(svc);
      return sel;
    }
    var t = s.texts || {};
    var form = h('form', { novalidate: true },
      out,
      h('fieldset', null, h('legend', { text: 'Website' }),
        site ? null : field('f-id', 'Kennung *', h('input', { type: 'text', required: true, placeholder: 'meine-seite', autocomplete: 'off' }), 'Kurzer Name für die Technik: nur Kleinbuchstaben, Ziffern, Bindestrich. Kann später nicht geändert werden.'),
        field('f-name', 'Name *', h('input', { type: 'text', value: s.name || '', required: true, placeholder: 'Meine Seite' })),
        field('f-domains', 'Domains *', h('textarea', { rows: 3, placeholder: 'https://meine-seite.de\\nhttps://www.meine-seite.de', text: (s.domains || []).join('\\n') }), 'Eine Adresse pro Zeile, genau wie in der Adresszeile des Browsers (mit https://, ohne Pfad). Auch Varianten mit/ohne www eintragen.'),
        field('f-owner', 'Betreiber', h('input', { type: 'text', value: s.owner || '', placeholder: 'Muster GmbH' }), 'Wird im Dialog als Anbieter des Einwilligungs-Cookies genannt.'),
        h('div', { class: 'grid2' },
          field('f-imprint', 'Link Impressum *', h('input', { type: 'text', value: (s.links || {}).imprint || '/impressum' })),
          field('f-privacy', 'Link Datenschutzerklärung *', h('input', { type: 'text', value: (s.links || {}).privacy || '/datenschutz' }))),
        h('div', { class: 'grid2' },
          field('f-language', 'Sprache', (function () { var sel = h('select', null, h('option', { value: 'de', text: 'Deutsch' }), h('option', { value: 'en', text: 'Englisch' }), h('option', { value: 'auto', text: 'automatisch (Browser)' })); sel.value = s.language || 'de'; return sel; })()),
          field('f-cookie-domain', 'Cookie-Domain (optional)', h('input', { type: 'text', value: s.cookieDomain || '', placeholder: '.meine-seite.de' }), 'Nur nötig, wenn Subdomains die Einwilligung teilen sollen.'))),
      h('fieldset', null, h('legend', { text: 'Dienste' }),
        h('p', { class: 'hint', text: 'Werden hier Dienste geändert, erhöht sich die Version automatisch und alle Besucher werden erneut gefragt.' }),
        h('div', { class: 'service' },
          check('f-gtm', 'Google Tag Manager verwenden', !!gtm),
          field('f-gtm-id', 'Container-ID', h('input', { type: 'text', value: gtm ? gtm.id : '', placeholder: 'GTM-XXXXXXX' })),
          check('f-gtm-analytics', 'Google Analytics 4 über GTM (Kategorie Statistik)', !gtm || gtm.analytics !== false),
          check('f-gtm-ads', 'Google Ads über GTM (Kategorie Marketing)', !gtm || gtm.ads !== false)),
        h('div', { class: 'service' },
          field('f-meta', 'Meta (Facebook) Pixel', modeSelect('f-meta', meta)),
          field('f-meta-id', 'Pixel-ID', h('input', { type: 'text', value: meta && meta.id ? meta.id : '', placeholder: '123456789012345' }), 'Nur bei „über consent-kit laden“. Nie zusätzlich in GTM einrichten – sonst doppelte Zählung.')),
        h('div', { class: 'service' },
          field('f-tiktok', 'TikTok Pixel', modeSelect('f-tiktok', tt)),
          field('f-tiktok-id', 'Pixel-ID', h('input', { type: 'text', value: tt && tt.id ? tt.id : '', placeholder: 'C1ABCDEFGHIJKLMNOPQR' }), 'Nur bei „über consent-kit laden“. Nie zusätzlich in GTM einrichten.')),
        h('div', { class: 'service' },
          check('f-youtube', 'YouTube-Videos sind eingebettet', !!serviceOf(site, 'youtube')),
          check('f-maps', 'Google Maps ist eingebettet', !!serviceOf(site, 'google-maps')))),
      h('fieldset', null, h('legend', { text: 'Optionen' }),
        check('f-logging', 'Entscheidungen protokollieren (Nachweis, ohne IP-Adresse)', s.logging !== false),
        check('f-gpc', 'Global Privacy Control beachten (kein Marketing bei „Alle akzeptieren“, wenn der Browser GPC sendet)', !!s.respectGpc)),
      h('fieldset', null, h('legend', { text: 'Darstellung' }),
        h('div', { class: 'grid2' },
          field('f-position', 'Position des Banners', (function () { var sel = h('select', null, h('option', { value: 'bottom', text: 'unten' }), h('option', { value: 'center', text: 'mittig' })); sel.value = (s.ui || {}).position || 'bottom'; return sel; })()),
          field('f-scheme', 'Farbschema', (function () { var sel = h('select', null, h('option', { value: 'auto', text: 'automatisch (hell/dunkel)' }), h('option', { value: 'light', text: 'immer hell' }), h('option', { value: 'dark', text: 'immer dunkel' })); sel.value = (s.ui || {}).colorScheme || 'auto'; return sel; })())),
        h('div', { class: 'grid2' },
          field('f-accent', 'Akzentfarbe (Schalter, Links)', h('input', { type: 'text', value: (s.ui || {}).accent || '', placeholder: '#0b57d0' }), 'Leer lassen für Standard. Gilt im hellen Schema.'),
          field('f-radius', 'Eckenradius', h('input', { type: 'text', value: (s.ui || {}).radius || '', placeholder: '12px' }))),
        h('div', { class: 'grid2' },
          field('f-btn-bg', 'Button-Farbe', h('input', { type: 'text', value: (s.ui || {}).buttonBackground || '', placeholder: '#1f2937' }), 'Alle Buttons haben bewusst dieselbe Farbe.'),
          field('f-btn-text', 'Button-Textfarbe', h('input', { type: 'text', value: (s.ui || {}).buttonText || '', placeholder: '#ffffff' })))),
      h('fieldset', null, h('legend', { text: 'Eigene Banner-Texte (optional)' }),
        h('p', { class: 'hint', text: 'Leer lassen = Mustertext von consent-kit. Alle Texte bitte rechtlich prüfen lassen.' }),
        field('f-title-de', 'Überschrift (Deutsch)', h('input', { type: 'text', value: (t.de || {}).bannerTitle || '' })),
        field('f-desc-de', 'Text (Deutsch)', h('textarea', { rows: 4, text: (t.de || {}).bannerDescription || '' })),
        field('f-title-en', 'Überschrift (Englisch)', h('input', { type: 'text', value: (t.en || {}).bannerTitle || '' })),
        field('f-desc-en', 'Text (Englisch)', h('textarea', { rows: 4, text: (t.en || {}).bannerDescription || '' }))),
      h('div', { class: 'actions' },
        h('button', { type: 'submit', text: site ? 'Speichern' : 'Website anlegen' }),
        site ? h('button', { type: 'button', class: 'secondary', onclick: bump, text: 'Alle Besucher erneut fragen' }) : null,
        site ? h('button', { type: 'button', class: 'danger', onclick: remove, text: 'Website löschen' }) : null));

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var services = [];
      if (checked('f-gtm')) services.push({ type: 'google-tag-manager', id: val('f-gtm-id'), analytics: checked('f-gtm-analytics'), ads: checked('f-gtm-ads') });
      [['f-meta', 'meta-pixel'], ['f-tiktok', 'tiktok-pixel']].forEach(function (p) {
        var m = val(p[0]);
        if (m === 'kit') services.push({ type: p[1], id: val(p[0] + '-id'), loadVia: 'kit' });
        if (m === 'gtm') services.push({ type: p[1], loadVia: 'gtm' });
      });
      if (checked('f-youtube')) services.push({ type: 'youtube' });
      if (checked('f-maps')) services.push({ type: 'google-maps' });
      var settings = {
        name: val('f-name'),
        domains: val('f-domains').split(/\\s+/).filter(Boolean),
        owner: val('f-owner'),
        language: val('f-language'),
        links: { imprint: val('f-imprint'), privacy: val('f-privacy') },
        cookieDomain: val('f-cookie-domain'),
        respectGpc: checked('f-gpc'),
        logging: checked('f-logging'),
        services: services,
        texts: { de: { bannerTitle: val('f-title-de'), bannerDescription: val('f-desc-de') }, en: { bannerTitle: val('f-title-en'), bannerDescription: val('f-desc-en') } },
        ui: { position: val('f-position'), colorScheme: val('f-scheme'), accent: val('f-accent'), radius: val('f-radius'), buttonBackground: val('f-btn-bg'), buttonText: val('f-btn-text') }
      };
      var req = site ? api('PUT', 'sites/' + encodeURIComponent(site.id), { settings: settings }) : api('POST', 'sites', { id: val('f-id'), settings: settings });
      req.then(function (res) {
        clear(out);
        if (res.status >= 400) { out.appendChild(messages('errors', res.data.errors || [res.data.error || 'Fehler beim Speichern.'])); out.scrollIntoView({ block: 'center' }); return; }
        var msg = site ? (res.data.bumped ? 'Gespeichert. Die Dienste haben sich geändert – Version ' + res.data.version + ': alle Besucher werden erneut gefragt.' : 'Gespeichert. Die Websites übernehmen die Änderung innerhalb von ca. 1 Minute.') : 'Website angelegt. Den Einbau-Code finden Sie im Reiter „Einbau“.';
        state.current = res.data;
        loadSites(res.data.id);
        setTimeout(function () { var o = document.getElementById('form-messages'); if (o) { clear(o); o.appendChild(messages('success', [msg])); } }, 150);
      });
    });
    return form;
  }

  function bump() {
    if (!confirm('Die Version wird erhöht – alle Besucher sehen das Banner beim nächsten Besuch erneut. Fortfahren?')) return;
    api('POST', 'sites/' + encodeURIComponent(state.current.id) + '/bump').then(function () { loadSites(state.current.id); });
  }

  function remove() {
    var id = state.current.id;
    var answer = prompt('Zum Löschen bitte die Kennung „' + id + '“ eingeben. Websites mit dieser Kennung laden danach nur noch ihre Rückfallebene.');
    if (answer !== id) return;
    api('DELETE', 'sites/' + encodeURIComponent(id)).then(function () { state.current = null; loadSites(); });
  }

  function snippet(title, text, hint) {
    return h('div', { class: 'snippet' }, h('h3', null, h('span', { text: title }), copyButton(function () { return text; })), hint ? h('p', { class: 'hint', text: hint }) : null, h('pre', null, h('code', { text: text })));
  }

  function renderEmbed(panel, site) {
    panel.appendChild(h('p', { text: 'Laden…' }));
    api('GET', 'sites/' + encodeURIComponent(site.id) + '/embed').then(function (res) {
      clear(panel);
      var e = res.data;
      panel.appendChild(h('p', { text: 'Am einfachsten: Kopieren Sie den KI-Prompt in Cursor, Manus oder Claude Code im Projekt dieser Website. Alternativ bauen Sie die Teile 2–7 selbst ein. Paketversion: ' + e.version + '.' }));
      panel.appendChild(snippet('1. KI-Prompt (empfohlen)', e.prompt, 'Enthält alle Schritte inklusive Entfernen alter Tracking-Codes und Prüfung.'));
      panel.appendChild(snippet('2. Paket installieren', e.install));
      panel.appendChild(snippet('3. Datei src/consent.remote.ts', e.remoteFile, 'Enthält nur öffentliche Angaben. Die Rückfallebene wird nur genutzt, wenn das Backend nicht erreichbar ist.'));
      panel.appendChild(snippet('4. src/main.tsx', e.mainTsx));
      panel.appendChild(snippet('5. Seitenwechsel (Router)', e.routeTracking));
      panel.appendChild(snippet('6. Footer-Link', e.footer));
      panel.appendChild(snippet('7. Prüfen nach dem Veröffentlichen', e.check));
    });
  }

  function renderTable(panel, site) {
    api('GET', 'sites/' + encodeURIComponent(site.id) + '/embed').then(function (res) {
      panel.appendChild(h('p', { text: 'Diese Übersicht aller Dienste können Sie in Ihre Datenschutzerklärung übernehmen. Mustertext – rechtlich prüfen lassen.' }));
      panel.appendChild(snippet('HTML', res.data.tableHtml));
      panel.appendChild(snippet('Markdown', res.data.tableMarkdown));
    });
  }

  function renderStats(panel, site) {
    api('GET', 'sites/' + encodeURIComponent(site.id) + '/stats').then(function (res) {
      var d = res.data;
      if (!site.settings.logging) panel.appendChild(h('p', { class: 'muted', text: 'Die Protokollierung ist für diese Website ausgeschaltet.' }));
      panel.appendChild(h('p', { text: 'Protokollierte Entscheidungen der letzten ' + d.days + ' Tage:' }));
      function stat(label, value) { return h('div', { class: 'stat' }, h('b', { text: String(value) }), label); }
      panel.appendChild(h('div', { class: 'stats' },
        stat('Entscheidungen gesamt', d.total),
        stat('„Alle akzeptieren“', d.byAction['accept-all'] || 0),
        stat('„Alle ablehnen“', d.byAction['reject-all'] || 0),
        stat('Eigene Auswahl', d.byAction.custom || 0),
        stat('Einzelne Inhalte geladen', d.byAction.service || 0),
        stat('Statistik erlaubt', d.statisticsRate + ' %'),
        stat('Marketing erlaubt', d.marketingRate + ' %')));
    });
  }

  // ---------- Nachweis-Suche
  document.getElementById('lookup').addEventListener('submit', function (e) {
    e.preventDefault();
    var id = document.getElementById('lookup-id').value.trim();
    api('GET', 'consent/' + encodeURIComponent(id)).then(function (res) {
      state.current = null;
      renderList();
      clear(content);
      var card = h('div', { class: 'card' }, h('h2', { text: 'Nachweis zur Einwilligungs-ID' }), h('p', null, h('code', { text: id })));
      if (res.status !== 200) card.appendChild(messages('errors', [res.data.error || 'Fehler']));
      else if (!res.data.count) card.appendChild(h('p', { text: 'Keine Einträge zu dieser ID gefunden.' }));
      else {
        card.appendChild(h('p', { text: res.data.count + ' Eintrag/Einträge (Zeiten in UTC):' }));
        card.appendChild(h('table', null,
          h('thead', null, h('tr', null, ['Eingang', 'Website', 'Aktion', 'Erlaubte Kategorien', 'Einzelne Dienste', 'Version', 'GPC'].map(function (x) { return h('th', { scope: 'col', text: x }); }))),
          h('tbody', null, res.data.entries.map(function (en) {
            var cats = Object.keys(en.categories).filter(function (k) { return en.categories[k]; }).join(', ');
            var svcs = Object.keys(en.services).map(function (k) { return k + ': ' + (en.services[k] ? 'ja' : 'nein'); }).join(', ') || '–';
            return h('tr', null, h('td', { text: en.receivedAt }), h('td', { text: (en.siteId || '–') + ' (' + en.domain + ')' }), h('td', { text: en.action }), h('td', { text: cats }), h('td', { text: svcs }), h('td', { text: en.configVersion }), h('td', { text: en.gpc ? 'ja' : 'nein' }));
          }))));
        card.appendChild(h('div', { class: 'actions' }, copyButton(function () { return JSON.stringify(res.data, null, 2); }, 'Als JSON kopieren')));
      }
      content.appendChild(card);
    });
  });

  start();
})();
`;

export function adminPage(): Response {
  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
  const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>consent-kit Verwaltung</title>
<style nonce="${nonce}">${CSS}</style>
</head>
<body>
<header><h1>consent-kit Verwaltung</h1><span class="user" id="user"></span></header>
<div id="login" class="layout" hidden>
  <div class="card">
    <h2>Anmeldung</h2>
    <p id="access-hint" hidden>Diese Oberfläche ist mit Cloudflare Access geschützt. Wenn Sie hier landen, sind Sie nicht (mehr) angemeldet – bitte die Seite neu laden.</p>
    <p>Notfall-Zugang mit dem Admin-Token:</p>
    <form id="token-form">
      <label for="token">Admin-Token</label>
      <input type="text" id="token" autocomplete="off" spellcheck="false">
      <div class="actions"><button type="submit">Anmelden</button></div>
    </form>
  </div>
</div>
<div id="app" class="layout" hidden>
  <nav aria-label="Websites">
    <h2>Websites</h2>
    <ul id="site-list"></ul>
    <button type="button" id="new-site">+ Neue Website</button>
    <h2 class="spaced">Nachweis suchen</h2>
    <form id="lookup">
      <label for="lookup-id">Einwilligungs-ID</label>
      <input type="text" id="lookup-id" placeholder="z. B. 46afb41e-…" autocomplete="off" spellcheck="false" required>
      <div class="actions"><button type="submit" class="secondary">Suchen</button></div>
    </form>
  </nav>
  <main id="content" aria-live="polite"></main>
</div>
<script nonce="${nonce}">${SCRIPT}</script>
</body>
</html>`;
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; img-src 'self' data:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`,
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  });
}
