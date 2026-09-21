# Historical transfer tools

These tools document completed transfers. Run from the repository root only when
deliberately reproducing a transfer with matching source/destination checks.

- `migrate-supabase.ts`: historical PGlite-to-Seoul transfer. Its environment must
  be supplied separately; it requires an empty target schema and explicit opt-in.
- `activate-supabase.mjs`: historical activation using the archived Seoul input file.
  Requires `CONFIRM_ARCHIVED_ACTIVATION=1`; do not use it for the active Singapore project.
- `migrate-cloud-project.mjs`: completed Seoul-to-Singapore transfer. Requires the
  old source in `.env.local`, destination in `.env.vercel.local`, stopped writers,
  an empty destination schema and `CONFIRM_CLOUD_MIGRATION=1`. It correctly refuses
  to run now that `.env.local` points to the destination.

Use `npm run db:migrate` for all normal schema changes. Retain migration reports and
credentials privately under `.data/` / `.data-backups/`; do not commit them here.
