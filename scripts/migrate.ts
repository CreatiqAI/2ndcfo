import { getDb, migrate } from '../src/server/db';
await migrate(await getDb());
console.log('Database migrations applied.');
process.exit(0);
