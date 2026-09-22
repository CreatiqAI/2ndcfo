# Project change record

## 22 September 2026 — employee links and Delete

- Added one-time employee claim links with Copy link and Open email draft.
  Links expire after 7 days; atomic redemption creates a 24-hour claim-only cookie
  session, which ends on submission. Tokens are hashed, isolated from finance
  sessions, and never included in audit records.
- Added a dedicated employee claim page/API for description, multiple receipts,
  automatic scoped extraction and submission. It exposes only the linked claim.
- Added Delete with reason/confirmation and Deleted records → Restore for Finance
  and Admin. Removes active list entries while retaining financial totals, original
  evidence, allocations and audit history; this does not reverse accounting entries.
- Applied/verified migration 0007. All 64 tests, typecheck and production build
  passed, including one-time concurrent redemption, expiry, scoped access,
  deletion/restore and retained posted totals. No real employee links were sent.

## 22 September 2026 — claim bundles and employees

- Added automatic receipt-total mode for new claims, preserving existing declared
  totals. Group receipts under employee claim rows in Documents and Money Out;
  finance-approved claim totals/payments enter Money Out exactly once.
- New claims open multi-file receipt upload; Done returns to claim details.
- Added Admin-only employee login creation from Claims with existing password
  hashing, Employee membership, tenant checks and credential-free audit records.
  Existing accounts cannot have passwords changed through this action.
- Applied migration 0006; verified column/default and ledger in active Supabase.
  Added tests for bundles through approval, totals, obligations and employee access.
  All 62 tests and production build passed. No live financial test records created.
- Operating guide: `docs/operations/CLAIMS.md`.

## 22 September 2026 — upload payment-terms selector

- Added batch payment-day choices beside document upload. Persisted each file's
  default with its audit record so asynchronous extraction and retries retain it.
- Apply only to sales/supplier invoices without their own terms or due date.
  Each invoice's date drives its due date; existing records are unchanged.
- Applied and verified migration 0005 on active Supabase. Recovery instructions
  and verification are in `database/CHANGELOG.md`.
- All 60 tests, typecheck and production build passed. Covered stored upload
  defaults and precedence over fallback terms. No live invoices were uploaded or approved for testing.

## 22 September 2026 — payment terms due-date fallback

- Calculate an effective due date from clear calendar-day payment terms when the
  original due date is blank. Explicit due dates take priority; ambiguous terms
  remain unresolved. Source fields and approved evidence are preserved.
- Use the effective date consistently for payment status, overdue filter and
  overdue totals. Show the calculated date and its source in invoice rows.
- Added date parsing, leap/year boundary and service-level overdue regressions.
  Existing records benefit immediately; no database migration is required.
- Verified against M-Plan's active database record using a read-only query:
  effective due date 11 August 2026, outstanding RM1,764. All 59 tests,
  typecheck and production build passed.

## 22 September 2026 — approve all and overdue explanations

- Money In/Out now offer bulk approval of the current filtered list for Finance
  and Admin. A review dialog captures the list, reuses individual approval checks,
  and reports each success/failure without overriding duplicate warnings.
- Added overdue due-date/balance explanations. Unified summary and filter logic
  so partially paid invoices past due also appear in the Overdue filter.
- Confirmed the reported overdue amount against the active database in read-only
  queries. Approval and payment remain separate; no financial data was changed.
- Added regression coverage for overdue partial balances and full settlement.
  No schema changes. Guide: `docs/operations/INVOICE_APPROVAL.md`.
- Verification: 44 tests, typecheck and production build passed. Browser was at
  the sign-in screen, so the authenticated bulk-approval dialog was not exercised
  against live financial records.

## 22 September 2026 — statement month and automatic matching

- Require an explicit month/year choice for each statement upload, with an
  explanation of the matching period. Upload opens Bank Matching at the stored
  statement month and clears unrelated search/status filters.
- Automatic single, split and combined suggestions use the same calendar month
  and year as the bank rows. Existing import validation blocks out-of-month rows.
- Preserve manual allocations across periods for late payments. Human confirmation
  remains required before recording any payment.
- Added month/year boundary, invalid date, split/combine and statement validation
  regressions. Uses existing fields; no database migration is required.
- Operating guide: `docs/operations/BANK_MATCHING.md`.
- Verification: 43 tests passed, typecheck and production build passed. An isolated
  browser preview server was blocked by automatic command approval, so this
  change has not received a browser walkthrough.

## 22 September 2026 — Documents month calendar

- Added a responsive 12-month calendar, year navigation, invoice counts and dated
  sections in Documents. All months are visible by default; select a month to filter.
- Grouping uses the existing extracted/reviewed `invoiceDate`, never upload date.
  Late uploads appear in their evidenced month/year. Date corrections regroup
  immediately after the normal save/refresh; no extra AI call or database migration.
- Missing/invalid dates remain in Date needed. Originals retains unprocessed files,
  bank statements and source downloads. Search and status filters affect calendar counts.
- Added regression coverage for upload-date independence, different years, invalid
  and leap-year dates, missing dates and correction-driven regrouping.

## 22 September 2026 — folder organisation and ongoing workflow

- Recorded the user's standing permission for requested database updates and
  automatic Git pushes after completed changes in root `AGENTS.md`.
- Grouped docs under architecture, planning, operations and records; added a folder
  map and documentation index.
- Grouped versioned SQL under `database/migrations/` and updated migration paths.
  Existing SQL content and applied version names are unchanged.
- Archived completed one-off transfer tools under `scripts/archive/`.
- Moved superseded private Supabase input files into ignored backup storage.
  Active `.env.local` and `.env.vercel.local` remain in the root.
- Refreshed README deployment/model status. Vercel large-file transport remains
  outstanding; this cleanup does not reduce the original 20 MB requirement.

Validation for this entry: automated service tests, type checking, production build,
relative documentation link checks and migration file integrity checks. See the Git
commit history for the pushed revision; do not put credentials in this record.

Calendar verification: 34 tests passed, typecheck and production build passed.
An isolated local demo confirmed September 2026 grouping, month selection and the
empty October state in the browser. Cloud runtime restored after the check; no
calendar test records were added to Supabase.
