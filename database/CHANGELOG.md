# Database change record

## 22 September 2026 — repository organisation

Moved SQL files from `migrations/` to `database/migrations/`. Filenames and SQL bytes
are unchanged; the runtime loader and archived transfer tools now use the new path.
No cloud schema or financial records changed for this folder cleanup.

## 22 September 2026 — Singapore project activated

Copied from `adiaqoqjmjevvqmtdpnn` to `btpolwpgnekvyimpqegu`: all 19 finance tables
and 79 originals. Full table content and file SHA-256 comparisons passed. At cutover:
7 users, 7 companies, 74 invoices, 3 claims, 5 statements, 17 bank rows, 10 allocations.
All 19 tables had RLS enabled and no anon/authenticated schema access. Local app
read checks passed. Old project retained; backup recorded in private
`.data-backups/cloud-move-2026-09-21T19-49-33-297Z`.

## Applied migration inventory

| File | Purpose | Active project |
| --- | --- | --- |
| `0001_foundation.sql` | Core finance tables, relationships and immutable evidence guards | Applied |
| `0002_evidence_guards.sql` | Rejected matching decisions and additional evidence guards | Applied |
| `0003_cancellations.sql` | Immutable invoice cancellation records | Applied |
| `0004_google_login.sql` | Google subject identity field | Applied; provider setup postponed |

The current cloud database records these four versions in `finance.schema_migrations`.
