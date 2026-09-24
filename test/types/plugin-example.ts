// Automatisch geprüft: Beispiel aus docs/PLUGINS.md (muss fehlerfrei kompilieren)
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
