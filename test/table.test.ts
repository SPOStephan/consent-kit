import { describe, expect, it } from 'vitest';
import { googleTagManager, metaPixel, youtube, type ConsentConfig } from 'consent-kit';
import { getServiceRows, toHtml, toMarkdown } from 'consent-kit/table';

const config: ConsentConfig = {
  version: 1,
  links: { imprint: '/impressum', privacy: '/datenschutz' },
  services: [googleTagManager({ id: 'GTM-X', ads: false }), metaPixel({ id: '1' }), youtube({ meta: { name: 'Video <b>|' } })],
};

describe('Datenschutz-Tabelle', () => {
  it('enthält alle Dienste plus den eigenen Einwilligungs-Cookie', () => {
    const rows = getServiceRows(config, { owner: 'Muster GmbH' });
    expect(rows.map((r) => r.name)).toEqual([
      'Einwilligungs-Speicher (consent-kit)',
      'Google Tag Manager (Google Analytics 4)',
      'Meta Pixel',
      'Video <b>|',
    ]);
    expect(rows[0]).toMatchObject({ provider: 'Muster GmbH', category: 'Notwendig', cookies: [{ name: 'consent_kit', duration: '12 Monate' }] });
    expect(rows[1]).toMatchObject({ category: 'Statistik', thirdCountry: expect.stringContaining('USA') });
  });

  it('Markdown ist escaped und gekennzeichnet', () => {
    const md = toMarkdown(config);
    expect(md).toContain('Mustertext – rechtlich prüfen lassen');
    expect(md).toContain('Video &lt;b&gt;\\|');
    expect(md.split('\n').filter((l) => l.startsWith('| ')).length).toBe(6);
  });

  it('HTML ist escaped und auf Englisch verfügbar', () => {
    const html = toHtml(config, { language: 'en' });
    expect(html).toContain('Video &lt;b&gt;|');
    expect(html).toContain('<th scope="col">Service</th>');
    expect(html).toContain('Statistics');
  });
});
