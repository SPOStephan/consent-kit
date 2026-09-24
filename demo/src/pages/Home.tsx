export function Home() {
  return (
    <article>
      <h1>Willkommen auf der Demo-Seite</h1>
      <p>
        Diese Seite zeigt, wie <strong>consent-kit</strong> funktioniert. Öffnen Sie die Entwicklertools Ihres Browsers
        (Taste F12) und dort den Reiter „Netzwerk“: Solange Sie nicht zustimmen, geht keine einzige Anfrage an Google,
        Meta oder TikTok.
      </p>
      <h2>So probieren Sie es aus</h2>
      <ol>
        <li>Klicken Sie im Banner auf „Alle ablehnen“ – im Status unten bleibt „Geladene Skripte: keine“.</li>
        <li>Öffnen Sie im Footer „Cookie-Einstellungen“ und erlauben Sie nur „Statistik“ – jetzt wird nur der Google Tag Manager geladen.</li>
        <li>Wählen Sie „Alle akzeptieren“ – jetzt laden auch Meta und TikTok.</li>
        <li>Wechseln Sie zwischen den Seiten oben – jeder Dienst erhält genau einen Seitenaufruf.</li>
        <li>Widerrufen Sie über „Cookie-Einstellungen“ → „Alle ablehnen“ – die Seite lädt neu, Cookies der Dienste sind gelöscht.</li>
      </ol>
      <p>Die Demo verwendet Dummy-IDs (z. B. GTM-TEST123); die Dienste liefern daher keine echten Daten.</p>
    </article>
  );
}
