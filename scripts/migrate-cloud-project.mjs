// Cloud-to-cloud migration. Stop every app/worker writing to the source first.
// Run: CONFIRM_CLOUD_MIGRATION=1 node scripts/migrate-cloud-project.mjs
import assert from 'node:assert/strict';
import { readFile, readdir, mkdir, writeFile, copyFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { createHash } from 'node:crypto';
import { Client } from 'pg';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

assert.equal(process.env.CONFIRM_CLOUD_MIGRATION, '1', 'Explicit migration opt-in required');
const sourceEnv = parseEnv(await readFile('.env.local', 'utf8'));
const targetRef = 'btpolwpgnekvyimpqegu';
// The private Vercel import file is now the single destination configuration.
const deployment = parseEnv(await readFile('.env.vercel.local', 'utf8'));
assert(
  deployment.DATABASE_URL && !deployment.DATABASE_URL.includes('REPLACE_WITH_'),
  'Fill DATABASE_URL in .env.vercel.local first',
);
const destinationUrl = new URL(deployment.DATABASE_URL);
const targetEnv = {
  ...deployment,
  SUPABASE_PROJECT_REF: targetRef,
  SUPABASE_DB_HOST: destinationUrl.hostname,
  SUPABASE_DB_PORT: destinationUrl.port || '5432',
  SUPABASE_DB_USER: decodeURIComponent(destinationUrl.username),
  SUPABASE_DB_PASSWORD: decodeURIComponent(destinationUrl.password),
  SUPABASE_DB_NAME: destinationUrl.pathname.slice(1),
};
assert.equal(targetEnv.SUPABASE_PROJECT_REF, targetRef);
assert.equal(sourceEnv.DATABASE_SCHEMA, 'finance');
assert.equal(new URL(sourceEnv.DATABASE_URL).username, 'postgres.adiaqoqjmjevvqmtdpnn');
assert.equal(targetEnv.SUPABASE_DB_USER, `postgres.${targetRef}`);
assert.equal(new URL(targetEnv.S3_ENDPOINT).hostname, `${targetRef}.storage.supabase.co`);
for (const key of ['SUPABASE_DB_PASSWORD', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'])
  assert(targetEnv[key], `Fill destination ${key} before migration`);
let running = false;
try {
  await fetch('http://127.0.0.1:3000', { signal: AbortSignal.timeout(2000) });
  running = true;
} catch {}
assert(!running, 'Stop the local application and all workers before migrating');
const ca = await readFile(sourceEnv.DATABASE_SSL_CA_FILE, 'utf8');
const source = new Client({
  connectionString: sourceEnv.DATABASE_URL,
  ssl: { ca, rejectUnauthorized: true },
  connectionTimeoutMillis: 15000,
});
const target = new Client({
  host: targetEnv.SUPABASE_DB_HOST,
  port: Number(targetEnv.SUPABASE_DB_PORT),
  user: targetEnv.SUPABASE_DB_USER,
  password: targetEnv.SUPABASE_DB_PASSWORD,
  database: targetEnv.SUPABASE_DB_NAME,
  ssl: { ca, rejectUnauthorized: true },
  connectionTimeoutMillis: 15000,
});
const storage = (env) =>
  new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: true,
    credentials: { accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY },
  });
const oldStorage = storage(sourceEnv),
  newStorage = storage(targetEnv);
const hash = (value) => createHash('sha256').update(value).digest('hex');
const backup = `.data-backups/cloud-move-${new Date().toISOString().replace(/[:.]/g, '-')}`;
const quote = (name) => {
  assert(/^[a-z_]+$/.test(name));
  return `"${name}"`;
};
const canonical = async (db, table) =>
  (
    await db.query(
      `SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text), '[]'::jsonb)::text AS data FROM finance.${quote(table)} t`,
    )
  ).rows[0].data;
try {
  await source.connect();
  await target.connect();
  for (const db of [source, target]) await db.query("SET TIME ZONE 'UTC'");
  assert.equal(
    (await target.query("SELECT count(*)::int n FROM pg_tables WHERE schemaname='finance'")).rows[0]
      .n,
    0,
    'Destination finance schema must be empty; refusing overwrite',
  );
  const bucket = await target.query('SELECT public FROM storage.buckets WHERE id=$1', [
    targetEnv.S3_BUCKET,
  ]);
  assert.equal(bucket.rows.length, 1, 'Create destination bucket first');
  assert.equal(bucket.rows[0].public, false, 'Destination bucket must be private');
  const files = (await readdir('migrations')).filter((f) => f.endsWith('.sql')).sort();
  const sqlFiles = await Promise.all(
    files.map(async (name) => ({ name, sql: await readFile(`migrations/${name}`, 'utf8') })),
  );
  const tables = sqlFiles.flatMap(({ sql }) =>
    [...sql.matchAll(/CREATE TABLE (\w+)/g)].map((m) => m[1]),
  );
  const allTables = [...tables, 'schema_migrations'];
  const actual = (
    await source.query("SELECT tablename FROM pg_tables WHERE schemaname='finance'")
  ).rows
    .map((r) => r.tablename)
    .sort();
  assert.deepEqual(
    actual,
    [...allTables].sort(),
    'Unexpected source tables; migration must include them',
  );
  await source.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
  await source.query("SET LOCAL lock_timeout='10s'");
  await source.query(
    `LOCK TABLE ${allTables.map((t) => `finance.${quote(t)}`).join(',')} IN SHARE MODE`,
  );
  const versions = (
    await source.query('SELECT name FROM finance.schema_migrations ORDER BY name')
  ).rows.map((r) => r.name);
  assert.deepEqual(versions, files, 'Source schema differs from checked-in migrations');
  await mkdir(`${backup}/tables`, { recursive: true });
  await copyFile('.env.local', `${backup}/env.local`);
  const snapshots = {};
  for (const table of allTables) {
    snapshots[table] = await canonical(source, table);
    await writeFile(`${backup}/tables/${table}.json`, snapshots[table], { flag: 'wx' });
  }
  const docs = (await source.query('SELECT storage_key,hash,mime FROM finance.documents')).rows;
  let verified = 0;
  for (const doc of docs) {
    assert(/^[a-f0-9-]+\/[a-f0-9-]+$/.test(doc.storage_key));
    const original = await oldStorage.send(
      new GetObjectCommand({ Bucket: sourceEnv.S3_BUCKET, Key: doc.storage_key }),
    );
    const bytes = Buffer.from(await original.Body.transformToByteArray());
    assert.equal(hash(bytes), doc.hash, 'Source document checksum mismatch');
    const folder = `${backup}/objects/${doc.storage_key.split('/')[0]}`;
    await mkdir(folder, { recursive: true });
    await writeFile(`${backup}/objects/${doc.storage_key}`, bytes, { flag: 'wx' });
    try {
      await newStorage.send(
        new PutObjectCommand({
          Bucket: targetEnv.S3_BUCKET,
          Key: doc.storage_key,
          Body: bytes,
          ContentType: doc.mime,
          IfNoneMatch: '*',
        }),
      );
    } catch (error) {
      if (error.$metadata?.httpStatusCode !== 412) throw error;
    }
    const copied = await newStorage.send(
      new GetObjectCommand({ Bucket: targetEnv.S3_BUCKET, Key: doc.storage_key }),
    );
    assert.equal(
      hash(await copied.Body.transformToByteArray()),
      doc.hash,
      'Destination document checksum mismatch',
    );
    if (++verified % 10 === 0) console.log(`Verified ${verified}/${docs.length} originals`);
  }
  await target.query('BEGIN');
  await target.query('CREATE SCHEMA IF NOT EXISTS finance');
  await target.query('REVOKE ALL ON SCHEMA finance FROM PUBLIC, anon, authenticated');
  await target.query('SET LOCAL search_path TO finance,public');
  await target.query(
    'CREATE TABLE schema_migrations(name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
  );
  for (const { sql } of sqlFiles)
    for (const statement of sql
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean))
      await target.query(statement);
  const counts = {};
  for (const table of allTables) {
    await target.query(
      `INSERT INTO ${quote(table)} SELECT * FROM json_populate_recordset(NULL::${quote(table)},$1::json)`,
      [snapshots[table]],
    );
    assert.equal(await canonical(target, table), snapshots[table], `${table} content mismatch`);
    counts[table] = (await target.query(`SELECT count(*)::int n FROM ${quote(table)}`)).rows[0].n;
    await target.query(`ALTER TABLE ${quote(table)} ENABLE ROW LEVEL SECURITY`);
  }
  await target.query('REVOKE ALL ON ALL TABLES IN SCHEMA finance FROM PUBLIC, anon, authenticated');
  await target.query(
    'REVOKE ALL ON ALL FUNCTIONS IN SCHEMA finance FROM PUBLIC, anon, authenticated',
  );
  await target.query('COMMIT');
  await source.query('COMMIT');
  const report = {
    verifiedAt: new Date().toISOString(),
    source: 'adiaqoqjmjevvqmtdpnn',
    target: targetRef,
    backup,
    files: docs.length,
    tables: counts,
    hashes: Object.fromEntries(allTables.map((t) => [t, hash(snapshots[t])])),
  };
  await writeFile(`${backup}/verified.json`, JSON.stringify(report, null, 2));
  await mkdir('.data/migration-reports', { recursive: true });
  await writeFile('.data/migration-reports/cloud-move.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: 'verified', ...report }));
  console.log('App connection is unchanged. Verify report before activating destination.');
} catch (error) {
  await target.query('ROLLBACK').catch(() => {});
  await source.query('ROLLBACK').catch(() => {});
  console.error(error instanceof Error ? error.message : 'Migration failed');
  process.exitCode = 1;
} finally {
  await source.end();
  await target.end();
  oldStorage.destroy();
  newStorage.destroy();
}
