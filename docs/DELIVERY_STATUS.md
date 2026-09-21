# Delivery status — Stages 1–5

The original 60-section requirement is retained in REQUIREMENTS.md. Architecture/database/roadmap were documented before feature code. No later requirement is claimed complete merely because its navigation item exists.

## Implemented

| Stage | Implemented components | Verification |
|---|---|---|
| 1 | Next.js/React/TypeScript, Drizzle PostgreSQL schema and migrations, scrypt auth, expiring hashed sessions, companies, membership roles/department scopes, audit foundation | Service and HTTP tests for CSRF, tenant boundaries, employee scopes, role enforcement, logout |
| 2 | Immutable private originals; local/S3 adapter; bounded uploads; 200-file batch cap; extraction jobs with leases/retries; safe mock + live multimodal adapter; confidence/category policy; raw results; PDF page ranges/manual split; duplicate detection | Real 50-file HTTP batch completed; original byte preservation; no-AI unknown values; retry idempotency; PDF pages; malformed content validation |
| 3 | Money In/Out/register; review/correction/approval/rejection; immutable approved records; separate settlement status; source/extraction view; cancellation events; search and CSV export | Approval never changes cash; stale edits blocked; cancellation preserves original and blocks settlement; browser approval flow passed |
| 4 | Claim drafts, batch receipts, category totals, missing/difference/duplicate flags, correction/request/rejection, Manager→Finance approval, self-approval restrictions and reasoned Admin override | Exact RM1,058.50 receipt total vs RM1,100 claim; RM41.50 difference; own-claim isolation; approval sequence; bank-paid status; browser claim creation |
| 5 | Bank account and statement draft import; CSV/XLSX/PDF adapters; signed-flow/date/balance validation; duplicate checks; multi-signal and grouped suggestions; manual partial/split/combine; direct categorisation; progress and exception filters | Exact/partial/combined/split settlement; simultaneous over-allocation; wrong direction/currency/tenant; closed month; repeat source/import prevention; browser match confirmation |

## Verification recorded

- Service/integration suite: **27 passing tests** in the final run, including malformed-provider response preservation, safe aggregate arithmetic, cancellation, and grouped matching.
- HTTP acceptance: 50-file batch passed through the real authenticated HTTP endpoints, not direct database insertion. Provider intentionally unconfigured, so all 50 extracted candidates retained missing values until human entry.
- Browser: isolated demo opens, invoice review/approval updates the queue, bank confirmation updates match/progress, claim creation shows missing evidence, mobile 390-pixel layout uses contained table scrolling.
- Production build and strict TypeScript checks pass. Dependency audit has zero known vulnerabilities after the compatible UUID override used by ExcelJS. This is a dependency scan, not a comprehensive security certification.

## Explicit limitations and remaining work

1. **Live AI, external PostgreSQL and S3 are adapters, not verified external deployments.** No credentials or provisioned services were supplied. Local use is persisted single-process PGlite + private filesystem originals. Live OCR accuracy, provider failures, encrypted/private bucket access, production driver concurrency and backups need environment-specific testing.
2. **No AI does not mean fake AI.** Real uploads show unknown fields and remain reviewable. Only the isolated demo has fixture extraction results. PDF automatic segmentation requires the live provider; manual page ranges are supported offline.
3. **Reconciliation confidence is an explainable heuristic score, not a statistically calibrated probability.** No automatic finalisation. Grouped suggestions search up to 20 relevant candidates and 2–4 rows per group to avoid combinatorial cost; manual allocation supports up to 100 lines. Broader model-assisted matching can extend this interface later.
4. **Bank formats:** canonical CSV/single-sheet XLSX and provider-assisted PDF. No bank-specific ambiguous column/date/sign guessing. Formula cells are rejected. Invalid structured/PDF parses retain an original and a correction draft.
5. **Currencies:** only the listed two-decimal currencies; no FX settlement. Aggregate integer overflow fails explicitly. Tax values are extracted/reviewed, not statutory advice or filing logic.
6. **Claim missing evidence:** flags differences and missing fields, not invented receipt identities. Without itemised claim-form data, the system cannot identify which specific unprovided purchase is missing. Finance may request evidence or approve a documented exception.
7. **Corrections after finalisation:** approved originals remain immutable. Unpaid standalone invoices can be cancelled with a separate event. Paid-record reversals, period reopening and amendments are Stage 8 work; the current system blocks those changes instead of silently editing history.
8. **Exports/search:** operational CSV and structured text search are implemented. The full CSV/XLSX/PDF export matrix, report formats, organisational dimensions and natural-language search remain mapped in the roadmap.
9. **Scale:** current reads build a tenant-scoped workspace snapshot. Large historical datasets need paginated endpoints and SQL aggregation before production scale. File requests are bounded; extraction is durable and worker-compatible. Full 200-file live-OCR load/soak tests remain a release gate.
10. **Production security/operations:** reverse-proxy body/abuse limits, malware scanning/quarantine, password recovery, verified email/MFA policies, RLS/least-privilege review, recovery drills, monitoring/alerting and independent accessibility/security tests remain Stage 10 gates. Prototype CSP permits inline Next.js scripts and dev evaluation; production requires a nonce-based CSP and removing development allowances.

## Later requirements retained

Stage 6: financial dashboard, formal AR/AP ageing, accrual/cash calculations, founder advances. Stage 7: budgets, budget variance, burn/runway. Stage 8: month close, amendments, monthly AI report. Stage 9: scoped/cited finance chat. Stage 10: full acceptance, security, operational validation and polish. Phases 2–3 retain recurrence, forecasts, scenarios, profitability, anomaly detection, notifications/integrations and future accounting features. See the full requirement map in IMPLEMENTATION_ROADMAP.md.

## Live AI verification — 22 September 2026

The local server now uses OpenAI extraction with a server-only credential in ignored `.env.local`. A live HTTP acceptance run passed using three synthetic PDFs: a sales invoice, a supplier invoice, and a bank statement. The run verified extraction, review/approval, statement balances/import, and both incoming and outgoing allocations reaching Paid/Matched. No real financial documents were used for this test. The 27 automated tests and production build also passed. User-facing Bank Reconciliation is now named Bank Matching.

Repeat the paid live test explicitly with `$env:RUN_LIVE_AI_TEST='1'; node --import tsx scripts/live-ai-smoke.ts` against the running local server. Each run creates a separate synthetic test workspace. It does not change existing company records. This verifies the supplied synthetic cases, not every bank layout or invoice format; human review remains required.

## Supabase active — 22 September 2026

- Project: adiaqoqjmjevvqmtdpnn; region ap-northeast-2 (Seoul).
- Database: Supabase PostgreSQL through session pooler, schema `finance`. TLS CA and hostname verification enabled using `config/supabase-ca.crt` downloaded from the project's official dashboard certificate link.
- Storage: private `finance-document` bucket through S3. Supabase does not implement AWS SSE headers; its at-rest encryption is managed by the provider.
- Migrated 18 business tables and 74 original files. Every table count was verified; every original was downloaded again and verified by SHA-256 before switching the application. Schema migration metadata is the 19th protected table.
- RLS enabled on all application tables; anon/authenticated roles cannot use the finance schema. Access remains through the application's authenticated server routes and company checks. Supabase Auth was not substituted for the existing login system.
- Local backup: `.data-backups/pre-supabase-20260922-024631` contains the stopped database, original files, and prior local environment configuration. Original `.data` also retained. These local copies are retained for recovery and still occupy disk space.
- Active secrets are in ignored `.env.local`. Pending connection inputs remain in ignored `.env.supabase.local`; do not commit either.
- Verified after cutover: existing browser session and records; three new synthetic PDF uploads through the app with live OpenAI extraction; invoice approval; bank statement import and incoming/outgoing matching; private file public URL rejection; schema privilege checks; 27 automated tests; production build.
- Browser app remains at http://127.0.0.1:3000/ and requires the local dev server plus internet. The web application itself has not been deployed publicly.
- Rollback is not a blind environment-file swap: stop writers and reconcile any cloud changes made since cutover before restoring the earlier database. Keep the backup until an explicit retention decision.
- Supabase table editor: select the `finance` schema to view application tables. Documents are under Storage > finance-document.
- Current server connects using the supplied database owner credential, stored server-side. A dedicated runtime role with narrower privileges, operational cloud backups and recovery validation remain production hardening work.

## Google login implementation — setup pending

Login now includes Continue with Google; Settings includes explicit same-email Google account linking for existing password users. Migration 0004 was applied to Supabase. The Supabase provider is still disabled because a Google OAuth client has not been created. No real Google login success is claimed. 31 automated tests, negative OAuth HTTP checks and production build passed. Follow docs/GOOGLE_LOGIN_SETUP.md to configure the provider and complete an actual user sign-in test.
