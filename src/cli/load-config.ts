import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ConsentConfig } from 'consent-kit';

export const DEFAULT_CONFIG_PATHS = [
  'src/consent.config.ts',
  'consent.config.ts',
  'src/consent.config.js',
  'consent.config.js',
  'src/consent.config.mjs',
  'consent.config.mjs',
];

function looksLikeConfig(value: unknown): value is ConsentConfig {
  return !!value && typeof value === 'object' && Array.isArray((value as ConsentConfig).services) && !!(value as ConsentConfig).links;
}

function pickConfig(mod: Record<string, unknown>): ConsentConfig {
  const candidates = [mod.default, mod.consentConfig, mod.config, ...Object.values(mod)];
  const found = candidates.find(looksLikeConfig);
  if (!found) {
    throw new Error('In der Datei wurde keine Konfiguration gefunden. Bitte `export default defineConfig({...})` oder `export const consentConfig = ...` verwenden.');
  }
  return found;
}

/** Lädt consent.config.ts/.js – TypeScript wird über esbuild (aus Vite) oder tsx übersetzt. */
export async function loadConfig(path: string | undefined, cwd = process.cwd()): Promise<{ config: ConsentConfig; file: string }> {
  const file = path ? resolve(cwd, path) : DEFAULT_CONFIG_PATHS.map((p) => join(cwd, p)).find((p) => existsSync(p));
  if (!file || !existsSync(file)) {
    throw new Error(`Konfigurationsdatei nicht gefunden${path ? `: ${path}` : ` (gesucht: ${DEFAULT_CONFIG_PATHS.join(', ')})`}.`);
  }
  if (!/\.[cm]?tsx?$/.test(file)) {
    return { config: pickConfig(await import(pathToFileURL(file).href)), file };
  }

  const require = createRequire(join(cwd, 'package.json'));
  const errors: string[] = [];

  // 1. esbuild (ist in Vite-Projekten bis Vite 7 fast immer vorhanden)
  try {
    const esbuild = (await import(pathToFileURL(require.resolve('esbuild')).href)) as typeof import('esbuild');
    const build = esbuild.build ?? (esbuild as unknown as { default: typeof import('esbuild') }).default.build;
    const out = await build({
      entryPoints: [file],
      bundle: true,
      write: false,
      format: 'esm',
      platform: 'node',
      packages: 'external',
      logLevel: 'silent',
    });
    const tmp = join(dirname(file), `.consent-kit-config-${process.pid}.mjs`);
    writeFileSync(tmp, out.outputFiles[0]!.text);
    try {
      return { config: pickConfig(await import(pathToFileURL(tmp).href)), file };
    } finally {
      unlinkSync(tmp);
    }
  } catch (error) {
    errors.push(`esbuild: ${(error as Error).message.split('\n')[0]}`);
  }

  // 2. tsx
  try {
    const tsx = (await import(pathToFileURL(require.resolve('tsx/esm/api')).href)) as {
      tsImport(specifier: string, parent: string): Promise<Record<string, unknown>>;
    };
    return { config: pickConfig(await tsx.tsImport(pathToFileURL(file).href, import.meta.url)), file };
  } catch (error) {
    errors.push(`tsx: ${(error as Error).message.split('\n')[0]}`);
  }

  // 3. Node.js mit eingebauter TypeScript-Unterstützung (ab Node 22.18 / 23.6)
  try {
    return { config: pickConfig(await import(pathToFileURL(file).href)), file };
  } catch (error) {
    errors.push(`node: ${(error as Error).message.split('\n')[0]}`);
  }

  throw new Error(
    'Die TypeScript-Konfiguration konnte nicht geladen werden. Installieren Sie z. B. tsx (npm i -D tsx) ' +
      'oder verwenden Sie Node.js 22.18 oder neuer.\n  ' +
      errors.join('\n  '),
  );
}
