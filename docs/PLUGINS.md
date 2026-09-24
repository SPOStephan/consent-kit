# Eigene Dienste (Plugins)

Jeder Dienst ist ein kleines Objekt mit Anbieterinformationen und optionalen „Hooks“.
consent-kit ruft die Hooks zum richtigen Zeitpunkt auf.

```ts
interface ConsentPlugin {
  id: string;                                  // eindeutig, z. B. 'linkedin-insight'
  category: string | string[];                 // 'statistics', 'marketing' oder eigene
  meta: {                                      // für Dialog und Datenschutz-Tabelle
    name: string;
    provider: string;
    purpose: { de: string; en: string };
    cookies: Array<{ name: string; duration: { de: string; en: string } }>;
    thirdCountryTransfer: { de: string; en: string } | null;
    privacyPolicyUrl: string;
  };
  cookiePatterns?: (string | RegExp)[];        // werden beim Widerruf gelöscht ('li_*' = Präfix)
  onInit?(ctx): void;       // immer beim Start – darf NICHTS laden, KEINE Requests!
  onConsent?(ctx): void;    // bei jeder Zustandsänderung (auch beim Start)
  onGrant?(ctx): void;      // einmal pro Seitenaufruf, sobald eingewilligt → Skript laden
  onRevoke?(ctx): void;     // beim Widerruf → Revoke-Signal senden
  onRouteChange?(ctx, route): void; // bei SPA-Seitenwechsel, nur wenn aktiv → PageView
}
```

`ctx.loadScript(src)` fügt ein Skript ein – nie doppelt. `ctx.hasConsent('marketing')` prüft
eine Kategorie oder einen Dienst. Dienste mit `onGrant` gelten als „geladen“: wird ihre
Einwilligung widerrufen, lädt consent-kit die Seite neu.

## Beispiel: LinkedIn Insight Tag

```ts
// src/consent-plugins/linkedin.ts
import { definePlugin } from 'consent-kit';

type Win = Window & { _linkedin_data_partner_ids?: string[]; lintrk?: ((...a: unknown[]) => void) & { q?: unknown[] } };

export function linkedinInsight(partnerId: string) {
  return definePlugin({
    id: 'linkedin-insight',
    category: 'marketing',
    meta: {
      name: 'LinkedIn Insight Tag',
      provider: 'LinkedIn Ireland Unlimited Company, Wilton Place, Dublin 2, Irland',
      purpose: {
        de: 'Conversion-Messung und Zielgruppen für Werbung auf LinkedIn.',
        en: 'Conversion measurement and audiences for advertising on LinkedIn.',
      },
      cookies: [
        { name: 'li_fat_id', duration: { de: '30 Tage', en: '30 days' } },
        { name: 'li_sugr', duration: { de: '3 Monate', en: '3 months' } },
      ],
      thirdCountryTransfer: { de: 'USA (Standardvertragsklauseln)', en: 'USA (standard contractual clauses)' },
      privacyPolicyUrl: 'https://www.linkedin.com/legal/privacy-policy',
    },
    cookiePatterns: ['li_*', 'lidc', 'bcookie', 'UserMatchHistory', 'AnalyticsSyncHistory'],
    onGrant(ctx) {
      const w = window as Win;
      w._linkedin_data_partner_ids = [...(w._linkedin_data_partner_ids ?? []), partnerId];
      if (!w.lintrk) {
        const q: unknown[] = [];
        w.lintrk = Object.assign((...args: unknown[]) => q.push(args), { q });
      }
      void ctx.loadScript('https://snap.licdn.com/li.lms-analytics/insight.min.js');
    },
    onRouteChange() {
      (window as Win).lintrk?.('track');
    },
  });
}
```

```ts
// src/consent.config.ts
import { linkedinInsight } from './consent-plugins/linkedin';
// …
services: [googleTagManager({ id: 'GTM-…' }), linkedinInsight('1234567')],
```

> Mustertext – die Angaben zu Cookies und Speicherdauer bitte beim Anbieter prüfen.

## Eigene Kategorie, z. B. „Externe Medien“

```ts
defineConfig({
  // …
  categories: [
    {
      id: 'media',
      label: { de: 'Externe Medien', en: 'External media' },
      description: {
        de: 'Inhalte von Videoplattformen und Kartendiensten.',
        en: 'Content from video platforms and map services.',
      },
    },
  ],
  services: [youtube({ category: 'media' }), googleMaps({ category: 'media' })],
});
```

## Tipps

- **Nie** in `onInit` Skripte laden oder `fetch`/`Image` verwenden – das wäre ein Request vor
  der Einwilligung. Die automatischen Tests (`npm test`) prüfen das für die mitgelieferten
  Plugins; ergänzen Sie neue Tracking-Domains in `src/cli/trackers.ts`.
- Neue Dienste → `version` in der Konfiguration erhöhen.
