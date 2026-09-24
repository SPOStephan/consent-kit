import { defineConfig } from 'tsup';
import { chmodSync, copyFileSync, existsSync } from 'node:fs';

const external = ['react', 'react-dom', 'react/jsx-runtime', 'consent-kit', /^consent-kit\//, 'playwright'];

const entries: Record<string, string> = { index: 'src/index.ts' };
if (existsSync('src/react/index.tsx')) entries.react = 'src/react/index.tsx';
if (existsSync('src/ui/index.tsx')) entries.ui = 'src/ui/index.tsx';
if (existsSync('src/table/index.ts')) entries.table = 'src/table/index.ts';
if (existsSync('src/remote/index.ts')) entries.remote = 'src/remote/index.ts';

export default defineConfig([
  {
    entry: entries,
    format: ['esm', 'cjs'],
    dts: true,
    clean: false,
    sourcemap: false,
    minify: false,
    treeshake: true,
    target: 'es2020',
    platform: 'browser',
    external,
    async onSuccess() {
      if (existsSync('src/ui/ui.css')) copyFileSync('src/ui/ui.css', 'dist/ui.css');
    },
  },
  ...(existsSync('src/cli/index.ts')
    ? [
        {
          entry: { cli: 'src/cli/index.ts' },
          format: ['esm' as const],
          dts: false,
          clean: false,
          target: 'node18',
          platform: 'node' as const,
          external,
          banner: { js: '#!/usr/bin/env node' },
          async onSuccess() {
            chmodSync('dist/cli.js', 0o755);
          },
        },
      ]
    : []),
]);
