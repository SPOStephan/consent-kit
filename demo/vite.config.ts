import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Die Demo nutzt das lokale Paket:
// - `npm run demo` (Entwicklung): direkt die Quelltexte aus src/ (mit Hot Reload)
// - `npm run demo:build` (Tests): das gebaute Paket aus dist/ – so wie Ihre Websites
export default defineConfig(({ command }) => {
  const dev = command === 'serve';
  return {
    root: r('.'),
    plugins: [react()],
    resolve: {
      alias: [
        { find: /^consent-kit\/ui\.css$/, replacement: dev ? r('../src/ui/ui.css') : r('../dist/ui.css') },
        { find: /^consent-kit\/react$/, replacement: dev ? r('../src/react/index.tsx') : r('../dist/react.js') },
        { find: /^consent-kit\/ui$/, replacement: dev ? r('../src/ui/index.tsx') : r('../dist/ui.js') },
        { find: /^consent-kit\/table$/, replacement: dev ? r('../src/table/index.ts') : r('../dist/table.js') },
        { find: /^consent-kit\/remote$/, replacement: dev ? r('../src/remote/index.ts') : r('../dist/remote.js') },
        { find: /^consent-kit$/, replacement: dev ? r('../src/index.ts') : r('../dist/index.js') },
      ],
    },
    build: { outDir: r('./dist'), emptyOutDir: true },
    server: { port: 5173 },
    preview: { port: 4173, strictPort: true },
  };
});
