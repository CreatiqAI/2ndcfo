# Database

Active project: `btpolwpgnekvyimpqegu` (Singapore). App schema: `finance`.
Private original files: Storage bucket `finance-document`. Previous project
`adiaqoqjmjevvqmtdpnn` is retained for rollback, not active application writes.

## Authoritative definitions

- [migrations/](migrations/): SQL applied in filename order.
- [../src/server/db/schema.ts](../src/server/db/schema.ts): matching Drizzle models.
- [../src/server/db/index.ts](../src/server/db/index.ts): adapters and migration runner.
- [CHANGELOG.md](CHANGELOG.md): database deployment history.
- [Architecture](../docs/architecture/DATABASE_ARCHITECTURE.md): table relationships and invariants.

## Apply a change

1. Add the next numbered SQL file; preserve all existing migration filenames
   and contents because `finance.schema_migrations` identifies them by filename.
2. Update the Drizzle schema where needed. Verify with `npm test` and `npm run typecheck`.
3. Confirm the configured target, retain a recovery backup for data-affecting work,
   and run `npm run db:migrate`. The user has authorised applying requested changes
   directly; no routine approval step is required.
4. Check the resulting schema/data, record the applied version and validation here,
   then commit and push the related source/docs changes.

New tables must preserve tenant boundaries, enable RLS, and deny direct access to
`anon`/`authenticated` unless the requested design explicitly calls for it. Keep
immutable original documents, audit events and accounting evidence intact.
Never run schema reset/push as a substitute for versioned production migrations.

The local preview auto-applies migrations only in local PGlite mode. Production
startup does not migrate automatically. One-off historical transfer tools live in
[scripts/archive](../scripts/archive/README.md); they are not the schema deployment command.
Secrets and backup data stay outside this directory and outside Git.
