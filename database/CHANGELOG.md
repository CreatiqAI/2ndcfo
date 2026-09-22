# Database change record

## 22 September 2026 — automatic claim bundles

Applied and verified `0006_claim_auto_totals.sql` on active `finance` schema.
Added `claims.auto_total` boolean, non-null, default false. Existing claims keep
their declared totals. New automatic claims derive draft totals from receipts;
submission/approval persists the total using existing audit and locking rules.
Recovery: revert application code while retaining this additive column and all
stored evidence. No destructive rollback is needed.

## 22 September 2026 — upload payment terms

Applied `0005_upload_payment_terms.sql` to `btpolwpgnekvyimpqegu`, schema `finance`.
Added nullable `documents.default_payment_term_days` with a 0–365 day check.
Verified column type/nullability, constraint and migration ledger after applying.
Existing evidence is unchanged; new uploads record the choice in the upload audit.
Recovery: roll back the application commit and retain the additive nullable column
and its values. No destructive rollback or record rewrite is required.

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
| `0005_upload_payment_terms.sql` | Durable default payment days per upload | Applied |
| `0006_claim_auto_totals.sql` | Optional automatic receipt totals for claims | Applied |

The current cloud database records these six versions in `finance.schema_migrations`.
