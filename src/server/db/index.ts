import { PGlite } from '@electric-sql/pglite';
import { drizzle as localDrizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import { drizzle as pgDrizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { readFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import * as schema from './schema';
export type DB = PgliteDatabase<typeof schema>;
const globalDb = globalThis as unknown as { financeDb?: Promise<DB> };
export const localMode = () =>
  process.env.DATABASE_MODE === 'local' ||
  (!process.env.DATABASE_URL && process.env.NODE_ENV !== 'production');
export async function migrate(db: DB) {
  await db.execute(
    sql`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`,
  );
  const dir = path.join(process.cwd(), 'database', 'migrations');
  for (const file of (await readdir(dir)).filter((x) => x.endsWith('.sql')).sort()) {
    const applied = await db.execute(sql`SELECT name FROM schema_migrations WHERE name = ${file}`);
    if (applied.rows.length) continue;
    const content = await readFile(path.join(dir, file), 'utf8');
    await db.transaction(async (tx) => {
      for (const statement of content
        .split('--> statement-breakpoint')
        .map((x) => x.trim())
        .filter(Boolean))
        await tx.execute(sql.raw(statement));
      await tx.execute(sql`INSERT INTO schema_migrations (name) VALUES (${file})`);
    });
  }
}
export function getDb(): Promise<DB> {
  globalDb.financeDb ??= (async () => {
    if (localMode()) {
      const root = path.resolve(/* turbopackIgnore: true */ process.env.LOCAL_DATA_DIR || '.data');
      await mkdir(root, { recursive: true });
      const db = localDrizzle(new PGlite(path.join(root, 'postgres')), { schema });
      await migrate(db);
      return db;
    }
    if (!process.env.DATABASE_URL)
      throw new Error(
        'Production requires DATABASE_URL. Local preview requires DATABASE_MODE=local.',
      );
    // Both adapters implement the same PostgreSQL query/transaction API. Driver type is isolated here.
    const schemaName = process.env.DATABASE_SCHEMA || 'public';
    if (!/^[a-z_][a-z0-9_]*$/.test(schemaName)) throw new Error('Invalid DATABASE_SCHEMA.');
    const ca = process.env.DATABASE_SSL_CA_FILE
      ? await readFile(path.resolve(process.env.DATABASE_SSL_CA_FILE), 'utf8')
      : undefined;
    return pgDrizzle(
      new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 10,
        options: `-c search_path=${schemaName},public`,
        ...(ca ? { ssl: { ca, rejectUnauthorized: true } } : {}),
      }),
      {
        schema,
      },
    ) as unknown as DB;
  })();
  return globalDb.financeDb;
}
