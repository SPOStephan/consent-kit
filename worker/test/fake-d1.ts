import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import type { D1Database } from '../src/db';

/** D1-Nachbau auf Basis von SQLite (D1 ist ebenfalls SQLite) – mit allen Migrationen. */
export function fakeD1(): D1Database & { raw: DatabaseSync } {
  const raw = new DatabaseSync(':memory:');
  const dir = new URL('../migrations/', import.meta.url);
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    raw.exec(readFileSync(new URL(file, dir), 'utf8'));
  }
  return {
    raw,
    prepare(query: string) {
      let values: unknown[] = [];
      const stmt = {
        bind(...v: unknown[]) {
          values = v;
          return stmt;
        },
        async run() {
          raw.prepare(query).run(...(values as never[]));
          return { success: true };
        },
        async all<T>() {
          return { success: true, results: raw.prepare(query).all(...(values as never[])) as T[] };
        },
      };
      return stmt;
    },
  };
}
