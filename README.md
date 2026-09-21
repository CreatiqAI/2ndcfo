# AI Finance & Budgeting System / 2ndCFO

Functional implementation of build-order **Stages 1–5**. Read the complete source requirement before implementation; the architecture and roadmap were written first. This is a production-oriented foundation with locally verified workflows, **not the complete Phase 1 MVP or a production-certified release**.

## Project navigation

- [Folder map](docs/PROJECT_STRUCTURE.md)
- [Documentation index](docs/README.md)
- [Database operations and migration history](database/README.md)
- [Vercel deployment guide](docs/operations/VERCEL_SETUP.md)
- [Project change record](docs/records/CHANGELOG.md)

## Design documents

- [System architecture](docs/architecture/SYSTEM_ARCHITECTURE.md)
- [Database architecture](docs/architecture/DATABASE_ARCHITECTURE.md)
- [Implementation roadmap and all 60 requirement mappings](docs/planning/IMPLEMENTATION_ROADMAP.md)
- [Full original requirements](docs/planning/REQUIREMENTS.md)
- [Delivery status, verification and remaining gates](docs/records/DELIVERY_STATUS.md)

## Current deployment state

The active local app uses Supabase project `btpolwpgnekvyimpqegu` in Singapore,
schema `finance` and private bucket `finance-document`. The completed cloud move
verified all 19 tables and 79 originals. `.env.local` is the private local runtime
configuration; `.env.vercel.local` is the private Vercel import file. The old project
and backups are retained. Vercel deployment remains user-managed; the current API
upload/download path needs adaptation to preserve 20 MB files under Vercel limits.

## Run a fresh local preview

Requires Node.js 24+ and npm. No Docker or installed database is needed for the local preview.

```powershell
npm ci
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
npm run dev
```

Open **http://127.0.0.1:3000**. Create your own account/workspace, or choose **Explore a demo workspace**. Each demo opens its own company with clearly labelled generated evidence and recorded fixture approvals. Demo accounts have random internal credentials and no universal/default password. Real workspaces start empty.

Local PostgreSQL (PGlite) and original documents persist under `.data/`. Keep this directory private and backed up. Use only one web process with this local database. Local migrations run when the database first opens. Stop the preview before opening the same local database through another process. A separate worker requires external PostgreSQL; the local browser drains the durable queue through the web process.

If this Windows machine uses an enterprise root CA, install packages with the OS trust store enabled (`$env:NODE_USE_SYSTEM_CA='1'`). TLS verification stays enabled.

## Implemented workflows

1. **Accounts and companies:** registration, login/logout, expiring hashed sessions, company switch/create, Admin-assigned roles and departments for registered users. Employees see their own claims; Managers see their department; Accountant access is read/export-only.
2. **Documents:** up to 200 files per batch, drag/drop, per-file results/retry, private original storage, hashes, durable extraction jobs, preserved provider responses, PDF page provenance and manual page splitting/download.
3. **Invoices:** Money In / Money Out / Transactions, editable review, categories, confidence, duplicate flags, approve/reject/needs review, optimistic concurrency, locked approvals, audit history, separate unpaid/partial/paid/overdue status. Unpaid invoices can be cancelled via an immutable cancellation event; originals remain intact.
4. **Claims:** employee/admin claim creation, batch receipts, exact receipt totals/category breakdown, claimed-vs-receipt differences, duplicate checks, request receipt/reject item/adjust claim, Manager then Finance approval, explicit exception reasons, bank-settled payout status.
5. **Bank reconciliation:** PDF/CSV/XLSX drafts; row correction and balance validation; human-confirmed import; source and transaction duplicate review; explainable suggestions; bounded split/combine suggestions; manual many-to-many allocations; direct bank-only categorisation; rejection history; month/status filters and progress; CSV exports.

The current Dashboard is an operational overview. Full financial metrics, AR/AP ageing, budgeting/burn/runway, closing/reports and chat are scheduled in Stages 6–9. This prevents displaying fabricated KPIs or generic chat as implemented finance intelligence.

## AI configuration

Default `AI_PROVIDER=mock` is deliberately safe: arbitrary uploaded documents yield missing fields with zero confidence and **Needs Review**. It never invents invoice or bank data. The isolated demo uses known fixture results labelled `demo-fixture`.

To enable the live adapter, set these **server-side** values and restart:

```dotenv
AI_PROVIDER=openai
OPENAI_API_KEY=your-server-side-key
OPENAI_MODEL=gpt-5-mini
```

The adapter sends PDF/image evidence to the Responses API using strict JSON schemas, `store:false`, a timeout and no action tools. Model choice is configurable. Verify your provider access and document-processing policy before using real company documents. Live extraction was verified with synthetic evidence using the previously configured model; the current selected model is `gpt-5-mini`, with no temperature or reasoning overrides. A new live GPT-5 mini acceptance run has not been performed. See [official file inputs](https://developers.openai.com/api/docs/guides/file-inputs) and [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

Multi-document PDFs are segmented by the configured provider into source-page ranges. With no provider, the whole file stays an unknown candidate and Finance can manually split it. Each segment can be downloaded separately while preserving the original.

## Structured bank imports

CSV header (or single XLSX sheet):

```csv
date,description,reference,money_in,money_out,balance
2026-09-04,Example supplier,INV-001,0,100.00,9900.00
```

`date`, `description`, `money_in`, `money_out` are required. Reference and running balance are optional. Dates must be ISO `YYYY-MM-DD`, amounts decimal strings with at most two places and no thousands separators. Exactly one of money in/out must be positive. No date or sign guessing; formula cells are rejected. Correct unsupported layouts in the review screen or convert to the canonical format. Opening/closing/running-balance inconsistencies block import. PDF parsing requires the configured AI adapter or manual entry in the review screen.

Supported currencies in this increment: MYR, USD, SGD, EUR, GBP, AUD, CAD, HKD. No FX conversion or cross-currency settlement. Aggregate financial displays state their currency. This is an explicit constraint pending the FX and rounding policy, not silent rounding.

## Commands and verification

```powershell
npm run typecheck
npm test
npm run build
# With the local preview running; creates an isolated test workspace:
npm run test:http
```

Service tests use a fresh temporary persisted PostgreSQL database; they do not modify the preview's `.data/`. The HTTP acceptance test uploads 50 actual PDF files through the authenticated endpoint, drains extraction, approves a test invoice, imports a bank CSV and confirms a partial settlement. It also checks tenant isolation, CSRF, download access, export and logout. Test-created documents remain retained in the isolated test company, consistent with the no-silent-deletion requirement.

## External PostgreSQL / production topology

Inject configuration rather than committing secrets:

- `DATABASE_MODE=postgres`, `DATABASE_URL` to a private PostgreSQL server with TLS and a restricted application role.
- `APP_ORIGIN` set to the public HTTPS origin; terminate TLS at a trusted reverse proxy and bind the Next server privately. Configure a 21 MB HTTP body limit, request timeouts and signup/abuse rate limits at the proxy.
- `STORAGE_PROVIDER=s3`, `S3_BUCKET`, `S3_REGION`, optional `S3_ENDPOINT`, and restricted IAM credentials through the runtime's credential chain. Private buckets and encryption are required.
- `ALLOW_SIGNUP=false` after account provisioning if open registration is not desired.

Run migrations once before starting production replicas:

```powershell
npm run db:migrate
npm run build
npm start
# In a separate process using the same external PostgreSQL environment:
npm run worker
```

Scripts load `.env`/`.env.local` when present; injected environment values take precedence. Never carry local `.env.local` into a production deployment. Production startup does not auto-migrate or seed demo users. Schema changes are additive checked-in migrations, including immutable evidence triggers. UI modules have no database or provider credentials.

Before real financial use, complete the release gates in `docs/records/DELIVERY_STATUS.md`: external PostgreSQL/S3/live-provider integration testing, malware scanning/quarantine, password recovery/email verification/MFA policy, proxy rate/body controls, backup restoration, multi-worker soak/load testing and independent security/accessibility review. Full Stage 10 remains scheduled.
