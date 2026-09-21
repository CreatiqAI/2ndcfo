if (process.env.CONFIRM_ARCHIVED_ACTIVATION !== '1')
  throw new Error('Archived operation: explicit CONFIRM_ARCHIVED_ACTIVATION=1 required');
import fs from 'node:fs';
import { parseEnv } from 'node:util';
const cfg = parseEnv(fs.readFileSync('.data-backups/legacy-config/.env.supabase.local', 'utf8'));
const current = parseEnv(fs.readFileSync('.env.local', 'utf8'));
const u = new URL('postgresql://placeholder');
u.hostname = cfg.SUPABASE_DB_HOST;
u.port = cfg.SUPABASE_DB_PORT;
u.username = cfg.SUPABASE_DB_USER;
u.password = cfg.SUPABASE_DB_PASSWORD;
u.pathname = '/' + cfg.SUPABASE_DB_NAME;
const report = JSON.parse(fs.readFileSync('.data/migration-reports/supabase.json', 'utf8'));
if (report.project !== cfg.SUPABASE_PROJECT_REF) throw Error('Verified migration required');
Object.assign(current, {
  DATABASE_MODE: 'postgres',
  DATABASE_URL: u.toString(),
  DATABASE_SCHEMA: 'finance',
  DATABASE_SSL_CA_FILE: 'config/supabase-ca.crt',
  STORAGE_PROVIDER: 's3',
  S3_BUCKET: cfg.S3_BUCKET,
  S3_REGION: cfg.S3_REGION,
  S3_ENDPOINT: cfg.S3_ENDPOINT,
  AWS_ACCESS_KEY_ID: cfg.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: cfg.AWS_SECRET_ACCESS_KEY,
  APP_ORIGIN: 'http://127.0.0.1:3000',
});
fs.writeFileSync(
  '.env.local',
  Object.entries(current)
    .map(([k, v]) => k + '=' + JSON.stringify(v).replaceAll('$', '\\$'))
    .join('\n') + '\n',
);
console.log('Verified cloud configuration activated; credentials not displayed.');
