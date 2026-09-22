# Database change record

## 23 September 2026 — salary statements

Applied `0009_salary_slips.sql` to `btpolwpgnekvyimpqegu`, schema `finance`.
Added `salary_slips` with employee/company references, saved details, integer-cent
gross/deduction/net amounts and one statement per company/employee/month.
Verified the migration ledger, enabled RLS and immutable update/delete trigger.
No live salary records were created during verification. Recovery: revert the
application while retaining this additive table and all saved payroll evidence.

## 23 September 2026 — invoice currency defaults and FX cache

Applied `0008_invoice_currency.sql` to active `finance` schema. Added immutable
upload metadata `documents.upload_currency` (MYR default, supported currency check)
and `fx_rates` for published invoice-date MYR reference rates. FX table has RLS;
no public access policies. Existing approved invoice amounts/currencies are unchanged.
Verified migration ledger and RLS, and fetched/cached a live USD/MYR reference rate.
Recovery: revert application changes while retaining additive column/table values.

## 22 September 2026 — one-time claim links and recoverable deletion

Applied `0007_claim_links_and_trash.sql` to active project schema `finance`.
Added `claim_links` (hashed single-use tokens and scoped expiring sessions) and
`record_trash` (reversible per-invoice/claim list visibility). Both tables have RLS;
verified anon/authenticated have no schema usage. Composite foreign keys enforce
company scope. Financial evidence tables, approvals and allocations are unchanged.
Verified applied migration ledger and table RLS after migration.
Recovery: revert application code and retain both additive tables; do not drop
financial evidence or erase link/trash audit history.

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
| `0007_claim_links_and_trash.sql` | Claim-only links and recoverable record deletion | Applied |
| `0008_invoice_currency.sql` | Upload currency defaults and published MYR FX cache | Applied |

The current cloud database records these eight versions in `finance.schema_migrations`.
