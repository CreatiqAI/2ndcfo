import { processOne } from '../src/server/extraction/worker';
if (!process.env.DATABASE_URL)
  throw new Error(
    'A separate worker requires external PostgreSQL. Local preview drains jobs through the web process.',
  );
let running = true;
process.on('SIGINT', () => {
  running = false;
});
process.on('SIGTERM', () => {
  running = false;
});
while (running) {
  if (!(await processOne())) await new Promise((r) => setTimeout(r, 2000));
}
process.exit(0);
