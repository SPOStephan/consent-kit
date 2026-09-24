import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^consent-kit\/react$/, replacement: r('./src/react/index.tsx') },
      { find: /^consent-kit\/ui$/, replacement: r('./src/ui/index.tsx') },
      { find: /^consent-kit\/table$/, replacement: r('./src/table/index.ts') },
      { find: /^consent-kit\/remote$/, replacement: r('./src/remote/index.ts') },
      { find: /^consent-kit$/, replacement: r('./src/index.ts') },
    ],
  },
  test: {
    include: ['test/**/*.test.{ts,tsx}', 'worker/test/**/*.test.ts'],
    environment: 'jsdom',
    environmentOptions: { jsdom: { url: 'https://www.example.de/' } },
    restoreMocks: true,
  },
});
