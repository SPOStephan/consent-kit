import { defineConfig, googleMaps, googleTagManager, metaPixel, tiktokPixel, youtube } from 'consent-kit';

/**
 * Beispiel-Konfiguration der Demo-Seite – mit Dummy-IDs.
 * In Ihren Websites liegt diese Datei als src/consent.config.ts.
 */

// Nur für die automatischen Tests: erlaubt, die Konfig-Version zu erhöhen.
const testVersion = (globalThis as { __DEMO_CONFIG_VERSION__?: number }).__DEMO_CONFIG_VERSION__;
const testPosition = (globalThis as { __DEMO_POSITION__?: 'bottom' | 'center' }).__DEMO_POSITION__;

export const consentConfig = defineConfig({
  version: testVersion ?? 1,
  language: 'de',
  links: {
    imprint: '/impressum',
    privacy: '/datenschutz',
  },
  services: [
    googleTagManager({ id: 'GTM-TEST123' }),
    metaPixel({ id: '123456789012345' }),
    tiktokPixel({ id: 'CTEST00000000000000' }),
    youtube(),
    googleMaps(),
  ],
  respectGpc: true,
  ui: {
    position: testPosition ?? 'bottom',
    theme: { accent: '#0b57d0' },
  },
  debug: true,
});
