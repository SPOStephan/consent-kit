const pending = new Map<string, Promise<void>>();

/**
 * Fügt ein externes Skript dynamisch per <script>-Element ein.
 * Dasselbe Skript (gleiche src) wird nie doppelt eingefügt – auch nicht nach
 * Hot Reload oder mehrfachem init().
 */
export function loadScript(src: string, attributes: Record<string, string> = {}): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve();
  const known = pending.get(src);
  if (known) return known;

  const existing = Array.from(document.scripts).find((s) => s.getAttribute('src') === src);
  if (existing) {
    const done = Promise.resolve();
    pending.set(src, done);
    return done;
  }

  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.async = true;
    script.src = src;
    script.setAttribute('data-consent-kit', '');
    for (const [key, value] of Object.entries(attributes)) script.setAttribute(key, value);
    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () => {
      pending.delete(src);
      reject(new Error(`consent-kit: Skript konnte nicht geladen werden: ${src}`));
    });
    (document.head || document.documentElement).appendChild(script);
  });
  // Unbehandelte Ablehnungen vermeiden (Adblocker blockieren Tracking-Skripte häufig).
  promise.catch(() => undefined);
  pending.set(src, promise);
  return promise;
}

/** Nur für Tests. */
export function resetScriptRegistry(): void {
  pending.clear();
}
