# Project change record

## 23 September 2026 — remove conflicting match suggestions

- Main suggestions now select highest-confidence pairs without reusing a bank row
  or invoice/claim. Rejection filtering precedes selection so alternatives remain
  available; deterministic tie ordering prevents changes due to query order.
- Added the two-equal-Daily-Holidays-invoices regression scenario and checks for
  rejected alternatives and repeated candidate inputs. No allocations or evidence
  were changed; manual and split/combine matching remain available.

## 23 September 2026 — upload and match salary payslips

- Added Money Out → Upload payslip and a Payslip document type. AI extracts net
  pay, employee and salary period; candidates use Payroll and omit invoice payment
  terms. Review/approval is required before matching outgoing bank payments.
- Reuses preserved originals, duplicate review, month/currency/direction checks,
  allocations and Money Out totals. Generating a Salary slip alone still does not
  create another expense. Expanded checks with migration 0011; verified live schema.
- All 73 tests and production build passed. Synthetic GPT-5.6 Luna payslip extracted
  RM3230 net from RM3330 gross and September 2026 correctly. Tested approval, matching
  and repeated-payment rejection in the isolated test database.

## 23 September 2026 — bank fees and no-receipt expenses

- Added a Bank handling fee / No receipt action to unallocated outgoing statement
  rows, using the existing category/audit service and requiring an explanation.
- Money Out now lists categorised outgoing bank expenses with statement links and
  includes them in total and monthly expenses once, as paid items. Calendar counts
  include them. Outstanding/overdue totals are unaffected.
- Existing categorisation, role, period and allocation guards are retained. No
  financial records were changed for testing and no schema migration is needed.
- Verified total/paid increments, unchanged outstanding/overdue and prevention of
  repeated categorisation/invoice allocation. All 72 tests and build passed.

## 23 September 2026 — monthly revenue and expense views

- Added Money In/Out month calendars; invoice/bill tables and claim bundles appear
  after selecting a month. Search/status/Approve all stay inside that selection.
- Renamed total cards to Total Revenue/Expenses and replaced cash-matched cards
  with Monthly Revenue/Expenses based on approved document amounts. Outstanding
  and Overdue also follow the selected month. Currency and claim counting rules
  follow the existing summary logic; total cards retain all-date financial totals.
- Hid calculated due-date messages on fully settled/matched rows. Original fields
  and allocations are unchanged. TypeScript and production build passed.

## 23 September 2026 — restrict manual invoice matching by statement month

- Restricted invoice choices in statement review and Manual / split / combine to
  the selected bank statement's month and year. Changing the selected bank payment
  clears the prior invoice choice. Currency/direction filters remain in effect.
- Enforced the same rule in the allocation service, including atomic batch rollback
  if any invoice belongs to another period. Existing allocations are unchanged.
- Verified wrong-month and same-month/wrong-year rejection, batch rollback and a
  successful same-period match. No database migration required.

## 23 September 2026 — manual matching in statement review

- Added per-imported-row payment selection to Review again, mapped by immutable
  statement ID and source row index. Fully matched/categorised rows show their state.
- Selected payments each have an invoice/claim picker and editable amount, with
  reference, party, invoice number, date and outstanding amount visible. Confirm
  uses the existing audited allocation service and refreshes payment statuses.
- No live allocations or schema changes were made. All 71 tests and production
  build passed, including separate matching of two RM444 incoming payments and
  prevention of repeated use of the same payments.

## 23 September 2026 — GPT-5.6 Luna and statement history

- Changed extraction default, public templates and ignored local/Vercel env files
  to `gpt-5.6-luna`, keeping existing keys and request settings. Model access was
  verified with the configured API account; synthetic PDF invoice and bank-statement
  extraction passed through the app's structured-output provider. Settings shows
  the configured model. Existing extraction evidence is unchanged.
- Added all-month bank statement history with file/account search, month filter,
  upload date, status, row count and reopen actions. Finance/Admin can record
  repeat reviews of imported statements with an append-only audit note. Pending
  statements retain correction/import controls; read-only roles cannot edit.
- All 70 tests and production build passed. Re-review tests verify tenant/role
  access and unchanged bank transactions/allocations. No schema migration required.

## 23 September 2026 — dark landscape payslip

- Replaced the default for future salary statements with the new reference layout:
  charcoal panels, uppercase heading, side-by-side earnings/deductions tables and
  prominent net pay. Added optional bank name/account fields to salary generation.
- Versioned template JSON keeps previously issued statements on their original
  portrait renderer. Existing workspace logos/text are preserved; unversioned
  workspace defaults adopt the dark palette. No schema migration is required.
- All 70 tests and production build passed, including new landscape and legacy
  portrait dimensions. Rendered and visually inspected the logo/bank-panel sample.

## 23 September 2026 — payslip template popup

- Replaced the expanded Settings editor with a Payslips card and Payslip template
  button. Controls and PDF preview now open in the existing accessible modal.
- Kept template saving and Finance/Admin access unchanged; improved field spacing
  inside the popup. No database changes. Production build and TypeScript passed.

## 23 September 2026 — editable payslip template and logo

- Added Settings → Payslip template for Admin/Finance, including title, accent/page
  colours, footer, signature visibility, logo upload/removal/size, reset and actual
  PDF preview. Preview uses sample data and never creates a salary record.
- Server validates PNG/JPEG size/type/pixels and normalises logos to bounded PNGs.
  Saves are tenant-scoped and audited. New payslips snapshot the template/logo;
  existing statements retain their saved design, including legacy monochrome PDFs.
- Applied and verified migration 0010. All 70 tests, typecheck and production build
  passed. Rendered and inspected a custom blue payslip with the supplied Creatiq logo.

## 23 September 2026 — Salary sidebar and payslip PDFs

- Added Finance/Admin Salary page with employee/month selection, five earning
  fields, manual deductions, automatic gross/net totals and saved PDF downloads.
- Created an A4 monochrome template matching the supplied reference, with saved
  employee/company details, signature line and Chinese-name font support.
- Applied migration 0009; salary snapshots are immutable and unique per employee
  and month. Generation does not calculate statutory deductions or post payments.
- All 69 tests, typecheck and production build passed. Tests cover totals,
  invalid deductions, duplicate months, tenant/role access and PDF generation
  including Chinese names. Rendered a sample PDF and visually checked the layout.

## 23 September 2026 — default MYR and foreign-currency conversion

- Added currency choice to upload and its persistent audit metadata. Missing
  invoice currency defaults to MYR; explicit foreign selection applies to the batch.
- Foreign invoices show original amounts plus automatically calculated MYR
  reference equivalents, with rate/date/source. Rates use Frankfurter's ECB feed
  and a durable cache; amounts/currencies remain intact for financial matching.
- Missing currency no longer creates a missing-currency explanation for existing
  invoices; the default is persisted through normal review/approval checks.
- Applied/verified migration 0008 and a live reference-rate request/cache. All
  68 tests, typecheck and production build passed, including currency precedence,
  exact rounding, rate caching and original-amount preservation.

## 23 September 2026 — upload progress on invoice pages

- Upload immediately closes the picker. The parent page owns the transfer queue,
  so unmounting the popup does not interrupt file uploads.
- Money In, Money Out and Documents keep their current page; dashboard uploads
  open Documents. Claim receipt uploads open Claims. No completion navigation.
- Loading documents shows each file's queued/uploading/extracting/failed state
  and retry controls. Completed extraction replaces progress with invoice records.
- Preserved batch payment terms and claim attachment IDs. Background upload
  refreshes cannot switch the user back to a previously selected workspace.
- Typecheck and production build passed. No persistence changes.

## 22 September 2026 — Deleted records sidebar page

- Moved Deleted records from the Claims/Money In/Money Out toolbar buttons and
  modal to a dedicated sidebar page, with an empty state and existing Restore actions.
- Finance/Admin access and evidence retention are unchanged. No database changes.
- Verification: typecheck and production build passed; removed old modal/button references.

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
