import { strict as assert } from 'node:assert';
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { Client } from 'pg';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

// Run only while the local app is stopped, after a filesystem backup.
assert(process.env.CONFIRM_SUPABASE_MIGRATION === '1', 'Explicit migration opt-in required');
const e = process.env;
const target = new Client({
  host: e.SUPABASE_DB_HOST,
  port: Number(e.SUPABASE_DB_PORT),
  user: e.SUPABASE_DB_USER,
  password: e.SUPABASE_DB_PASSWORD,
  database: e.SUPABASE_DB_NAME,
  ssl: { ca: await readFile('config/supabase-ca.crt', 'utf8'), rejectUnauthorized: true },
  connectionTimeoutMillis: 15000,
});
const source = new PGlite('.data/postgres');
const storage = new S3Client({
  region: e.S3_REGION,
  endpoint: e.S3_ENDPOINT,
  forcePathStyle: true,
});
const hash = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const report: Record<string, number> = {};
try {
  await target.connect();
  const bucket = await target.query('SELECT public FROM storage.buckets WHERE id=$1', [
    e.S3_BUCKET,
  ]);
  assert(
    bucket.rows.length === 1 && bucket.rows[0].public === false,
    'A private bucket is required',
  );
  const existing = await target.query("SELECT tablename FROM pg_tables WHERE schemaname='finance'");
  assert(existing.rows.length === 0, 'Target finance schema must be empty; refusing overwrite');
  const docs = await source.query<{ storage_key: string; sha256: string; mime: string }>(
    'SELECT storage_key,hash AS sha256,mime FROM documents',
  );
  for (const doc of docs.rows) {
    assert(/^[a-f0-9-]+\/[a-f0-9-]+$/.test(doc.storage_key));
    const bytes = await readFile('.data/objects/' + doc.storage_key);
    assert.equal(hash(bytes), doc.sha256, 'Local original hash mismatch');
    try {
      await storage.send(
        new PutObjectCommand({
          Bucket: e.S3_BUCKET,
          Key: doc.storage_key,
          Body: bytes,
          ContentType: doc.mime,
          IfNoneMatch: '*',
        }),
      );
    } catch (err: any) {
      if (err.$metadata?.httpStatusCode !== 412) throw err;
    }
    const remote = await storage.send(
      new GetObjectCommand({ Bucket: e.S3_BUCKET, Key: doc.storage_key }),
    );
    assert.equal(
      hash(await remote.Body!.transformToByteArray()),
      doc.sha256,
      'Remote original hash mismatch',
    );
  }
  console.log(`Verified ${docs.rows.length} private originals byte-for-byte`);
  await target.query('BEGIN');
  await target.query('CREATE SCHEMA IF NOT EXISTS finance');
  await target.query('REVOKE ALL ON SCHEMA finance FROM PUBLIC, anon, authenticated');
  await target.query('SET LOCAL search_path TO finance,public');
  const files = (await readdir('database/migrations')).filter((f) => f.endsWith('.sql')).sort();
  const tables: string[] = [];
  await target.query(
    'CREATE TABLE schema_migrations(name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
  );
  for (const file of files) {
    const content = await readFile('database/migrations/' + file, 'utf8');
    for (const m of content.matchAll(/CREATE TABLE (\w+)/g)) tables.push(m[1]);
    for (const statement of content
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean))
      await target.query(statement);
    await target.query('INSERT INTO schema_migrations(name) VALUES($1)', [file]);
  }
  for (const table of tables) {
    assert(/^\w+$/.test(table));
    const { rows } = await source.query(`SELECT * FROM "${table}"`);
    // One insert per table preserves self-referencing foreign keys.
    if (rows.length)
      await target.query(
        `INSERT INTO "${table}" SELECT * FROM json_populate_recordset(NULL::"${table}",$1::json)`,
        [JSON.stringify(rows)],
      );
    const result = await target.query(`SELECT count(*)::int AS count FROM "${table}"`);
    assert.equal(result.rows[0].count, rows.length, table + ' count mismatch');
    await target.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
    report[table] = rows.length;
  }
  await target.query('ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY');
  await target.query('REVOKE ALL ON ALL TABLES IN SCHEMA finance FROM PUBLIC, anon, authenticated');
  await target.query(
    'REVOKE ALL ON ALL FUNCTIONS IN SCHEMA finance FROM PUBLIC, anon, authenticated',
  );
  await target.query('COMMIT');
  await mkdir('.data/migration-reports', { recursive: true });
  await writeFile(
    '.data/migration-reports/supabase.json',
    JSON.stringify(
      {
        verifiedAt: new Date().toISOString(),
        project: e.SUPABASE_PROJECT_REF,
        files: docs.rows.length,
        tables: report,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ status: 'verified', files: docs.rows.length, tables: report }));
} catch (err) {
  await target.query('ROLLBACK').catch(() => {});
  console.error(err instanceof Error ? err.message : 'Migration failed');
  process.exitCode = 1;
} finally {
  await target.end();
  await source.close();
  storage.destroy();
}
