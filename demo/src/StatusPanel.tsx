import { useEffect, useState } from 'react';
import { useConsent } from 'consent-kit/react';

/** Zeigt in der Demo live an, was gerade erlaubt ist und welche Skripte geladen wurden. */
export function StatusPanel() {
  const { state, ready } = useConsent();
  const [scripts, setScripts] = useState<string[]>([]);

  useEffect(() => {
    const update = () =>
      setScripts(Array.from(document.querySelectorAll<HTMLScriptElement>('script[data-consent-kit]'), (s) => new URL(s.src).host + new URL(s.src).pathname));
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.head, { childList: true });
    return () => observer.disconnect();
  }, []);

  if (!ready) return null;
  return (
    <aside className="status" aria-label="Status der Einwilligung (nur Demo)">
      <h2>Status (nur in der Demo sichtbar)</h2>
      <dl>
        <dt>Entschieden</dt>
        <dd data-testid="status-decided">{state.decided ? 'ja' : 'nein'}</dd>
        <dt>Kategorien</dt>
        <dd data-testid="status-categories">
          {Object.entries(state.categories)
            .filter(([, v]) => v)
            .map(([k]) => k)
            .join(', ')}
        </dd>
        <dt>Einzelne Dienste</dt>
        <dd>{Object.entries(state.services).map(([k, v]) => `${k}: ${v ? 'erlaubt' : 'abgelehnt'}`).join(', ') || '–'}</dd>
        <dt>Consent-ID</dt>
        <dd>
          <code>{state.consentId || '–'}</code>
        </dd>
        <dt>Geladene Skripte</dt>
        <dd data-testid="status-scripts">{scripts.length ? scripts.join(', ') : 'keine'}</dd>
      </dl>
    </aside>
  );
}
