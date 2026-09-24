// Misst die Größe des Core (minifiziert + gzip), so wie er in einer Website landet.
import { build } from 'esbuild';
import { gzipSync } from 'node:zlib';

const cases = {
  'Core (init, acceptAll, … ohne Plugins)': "export { init, acceptAll, rejectAll, setCategories, openSettings, getState, hasConsent, on, notifyRouteChange } from './dist/index.js';",
  'Core + GTM + Meta + TikTok + Embeds': "export * from './dist/index.js';",
  'React-Bindings (consent-kit/react)': "export * from './dist/react.js';",
  'Standard-UI (consent-kit/ui)': "export * from './dist/ui.js';",
};

let failed = false;
for (const [name, contents] of Object.entries(cases)) {
  const result = await build({
    stdin: { contents, resolveDir: process.cwd(), loader: 'js' },
    bundle: true,
    minify: true,
    write: false,
    format: 'esm',
    external: ['react', 'react-dom', 'react/jsx-runtime', 'consent-kit', 'consent-kit/*'],
  });
  const code = result.outputFiles[0].contents;
  const gz = gzipSync(code).length;
  console.log(`${name.padEnd(42)} ${(code.length / 1024).toFixed(1).padStart(6)} kB minifiziert  ${(gz / 1024).toFixed(1).padStart(5)} kB gzip`);
  if (name.startsWith('Core +') && gz > 10 * 1024) failed = true;
}
if (failed) {
  console.error('Core ist größer als 10 kB gzip!');
  process.exit(1);
}
