/**
 * Typ-Tests (werden von `npm run typecheck` geprüft): Tippfehler in der
 * Konfiguration müssen sofort auffallen.
 */
import { defineConfig, googleTagManager, metaPixel, tiktokPixel } from 'consent-kit';

defineConfig({
  version: 1,
  links: { imprint: '/impressum', privacy: '/datenschutz' },
  services: [
    // @ts-expect-error – GTM-ID muss mit "GTM-" beginnen
    googleTagManager({ id: 'ABC-123' }),
    // @ts-expect-error – Meta Pixel ohne ID nur mit loadVia: 'gtm'
    metaPixel({}),
    tiktokPixel({ loadVia: 'gtm' }),
  ],
  // @ts-expect-error – Tippfehler im Optionsnamen
  respectGcp: true,
});

defineConfig({
  version: 1,
  links: { imprint: '/impressum', privacy: '/datenschutz' },
  services: [],
  // @ts-expect-error – ungültige Position
  ui: { position: 'top' },
});

// @ts-expect-error – links fehlen
defineConfig({ version: 1, services: [] });
