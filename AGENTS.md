# Project working agreement

The user authorised the following standing workflow on 22 September 2026:

- Apply database changes required by requested work directly to the active Supabase
  project `btpolwpgnekvyimpqegu`, then verify them. Routine changes do not need
  repeated permission. This does not authorise unrelated changes or deletion of
  financial evidence; preserve records and prepare a recovery path for migrations.
- Commit and push each completed, verified change to `origin/main`. Do not force
  push or include secrets, local data, original documents or backups. Report the
  commit and any remaining blockers. Respect any later user override.
- Keep the folder map, operating guides and change record current. See
  `docs/README.md`, `docs/PROJECT_STRUCTURE.md`, `database/README.md` and
  `docs/records/CHANGELOG.md` before reorganising files or changing persistence.
- Production schema changes belong in new numbered SQL files under
  `database/migrations/` and must match `src/server/db/schema.ts`. Do not rewrite
  previously applied migrations. Record applied changes and verification in
  `database/CHANGELOG.md`.
- Active private config: `.env.local` (local runtime) and `.env.vercel.local`
  (Vercel import). Only `.env.example` and `.env.vercel.example` are public templates.
  Historical migration tools are under `scripts/archive/`; do not rerun them as
  routine migrations. Run commands from the repository root.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
