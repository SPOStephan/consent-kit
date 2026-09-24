import { getServiceRows } from 'consent-kit/table';
import { useConsentConfig } from 'consent-kit/react';

export function Privacy() {
  // Aktive Konfiguration – funktioniert mit consent.config.ts und mit Einstellungen aus dem Backend.
  const config = useConsentConfig();
  const rows = config ? getServiceRows(config, { owner: config.owner ?? 'Muster GmbH (Demo)' }) : [];
  return (
    <article>
      <h1>Datenschutzerklärung</h1>
      <p>
        <strong>Mustertext – rechtlich prüfen lassen.</strong> Diese Seite bleibt auch bei sichtbarem Banner vollständig
        nutzbar.
      </p>
      <h2>Übersicht der eingesetzten Dienste</h2>
      <p>
        Diese Tabelle wird automatisch aus der <code>consent.config.ts</code> erzeugt (alternativ per{' '}
        <code>npx consent-kit table</code> als Markdown/HTML).
      </p>
      <div className="table-wrap">
        <table className="services">
          <thead>
            <tr>
              <th scope="col">Dienst</th>
              <th scope="col">Kategorie</th>
              <th scope="col">Anbieter</th>
              <th scope="col">Zweck</th>
              <th scope="col">Cookies (Speicherdauer)</th>
              <th scope="col">Drittland</th>
              <th scope="col">Datenschutz</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <th scope="row">{r.name}</th>
                <td>{r.category}</td>
                <td>{r.provider}</td>
                <td>{r.purpose}</td>
                <td>
                  {r.cookies.length ? (
                    <ul>
                      {r.cookies.map((c) => (
                        <li key={c.name}>
                          <code>{c.name}</code> ({c.duration})
                        </li>
                      ))}
                    </ul>
                  ) : (
                    'Keine'
                  )}
                </td>
                <td>{r.thirdCountry}</td>
                <td>
                  <a href={r.privacyPolicyUrl} rel="noopener noreferrer">
                    Link
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}
