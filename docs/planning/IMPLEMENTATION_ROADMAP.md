# Implementation roadmap and requirement coverage

This document is written before feature implementation. Stage numbers refer to section 59; MVP Phase 1 in section 51 spans all ten stages. This delivery begins and implements Stages 1–5; later features remain explicitly scheduled.

| Stage | Deliverables | Exit checks |
|---|---|---|
| 1 | Architecture, schema/migrations, auth, companies, membership RBAC, audit foundation | Signup/login/logout; company isolation; employee/manager scopes; forbidden mutation tests |
| 2 | Private object storage, 200-file batches, durable jobs, provider abstraction, OCR/extraction, PDF page provenance, original responses | Mixed batch errors isolated; retry; originals downloadable only by authorised users; unconfigured provider returns Unknown |
| 3 | Money In/Out, transaction register, editable draft review, category/confidence, approval/correction audit | Invoice approval creates no cash; approved record edits rejected; low confidence/duplicates require review |
| 4 | Claim drafts, batch receipts, exact totals, missing evidence and duplicate detection, manager/finance approval | Claimed/receipt difference; self approval rules; duplicate exception reason; only bank settlement marks paid |
| 5 | PDF/CSV/XLSX statement drafts, parser validation, imports, multi-signal suggestions, manual many-to-many allocation | Partial/exact/split/combine; currency/direction/tenant checks; concurrent over-allocation prevention; no auto-confirm |
| 6 | Full financial Dashboard, AR/AP ageing, P&L/cash calculations, founder advance liability | Formula fixtures; as-of/currency separation; no double-counting claims or loan repayments |
| 7 | Monthly budgets, variance, configurable burn/runway | Zero/negative burn handling; locked versions; budget basis documented |
| 8 | Month-end checklist/closing/reopen amendments, monthly AI report | Critical blockers; snapshot reproducibility; audit of historical amendments; citations |
| 9 | Finance chat using scoped query tools and internal citations | Company-data answers; no fabricated numbers; prompt injection isolation |
| 10 | Full integration/E2E/security/load/accessibility and UI polish | 50 supplier + 30 sales + claims + statement acceptance journey, backup restore and production release gates |

Tests for financial invariants, security and error handling start in Stage 1, not only Stage 10.

## Every numbered requirement mapped

| Sections | Delivery allocation |
|---|---|
| 1–2 | Product language/navigation throughout; all 11 navigation destinations retained with honest upcoming-state labels |
| 3 | Stage 6 dashboard; budget/AI panels Stages 7–9; Stage 1–5 operational overview only |
| 4–7 | Stages 2–3 uploads, extraction, categorisation and review |
| 8 | Stage 3 lifecycle; Stage 5 cash settlement |
| 9–13 | Stage 5 statements, reconciliation, filters and monthly progress |
| 14 | Stage 8 closing UI; lock/audit foundations earlier |
| 15–20 | Stage 4 claims, totals, missing/duplicate receipts, two-step approval |
| 21 | Stage 5 claim settlement |
| 22–25 | Stage 3 Money In/Out and outstanding balances; formal ageing and alerts Stage 6 |
| 26 | Phase 2 recurring expenses |
| 27–29 | Stage 7 budgeting and variance |
| 30 | Phase 2 forecasts: 30/60/90 days and 6/12 months |
| 31–32 | Stage 7 burn/runway formulas and history |
| 33 | Phase 2 Conservative/Base/Growth and editable scenario assumptions |
| 34 | Stage 9 scoped AI chat |
| 35 | Stage 8 monthly report, subsequent Phase 2 richer recurring analysis |
| 36–37 | Phase 2 budget recommendations and anomaly detection |
| 38–39 | Stages 2–4 duplicate signals, provenance, authorised document search/download |
| 40 | Stage 3 transaction register; organisational dimensions extended Phase 2 |
| 41 | Phase 2 project/client/product/cost-centre profitability |
| 42 | Stage 6 founder advances with liability and repayment model |
| 43 | Phase 2 in-app notifications, then email/WhatsApp |
| 44–46 | Stage 1 roles/audit; Stages 3–5 structured search; natural-language search Stage 9 |
| 47–48 | Operational CSV exports Stage 3–5; full report/XLSX/PDF export matrix Stages 6–10; statutory reports Phase 3 |
| 49–50 | Consistent SaaS design and exception-led flow; full month-end journey completes Stage 9 |
| 51 | Full MVP across Stages 1–10, not claimed complete after Stage 5 |
| 52 | Phase 2 includes recurring revenue/expenses, MRR, bank auto-import, forecasts, scenarios, profitability, department budgets, anomalies, recommendations and integrations/alerts |
| 53 | Phase 3 bank/payment/accounting/CRM/payroll/sales integrations, collections, supplier payments, balance sheet/ledger/tax |
| 54–57 | Cross-cutting architecture, immutable evidence, review-only AI, accrual/cash separation in every stage |
| 58 | Full MVP acceptance test at Stage 10; Stage 1–5 covers steps 1–13 and audit foundations |
| 59–60 | Required build order, functional persistence and explicit mock provider followed |

## Deliberate limitations and reasons

- No database server or Docker is preinstalled here. Local development uses persisted PGlite, a PostgreSQL WASM runtime supported by Drizzle. Production remains external PostgreSQL; local mode is single-process only.
- No live AI credentials supplied. A live provider adapter and safe unconfigured/mock adapter are implemented. Fixture demo extraction is explicitly labelled; arbitrary documents return missing fields for human entry until configured.
- PDF statement layouts vary; provider extraction returns review drafts, never silently accepted rows. CSV/XLSX support a documented canonical mapping; unsupported/ambiguous layouts produce visible errors rather than guessed signs or dates.
- Currency conversion and non-two-decimal currencies are deferred until a reviewed FX/rounding policy exists. No mixed-currency allocation is permitted.
- Image/OCR similarity and historical-pattern matching are advisory signals; neither can finalise financial records.
- This is a production-oriented implementation foundation, not a claim of production certification. Remaining deployment, security and load gates are listed in SYSTEM_ARCHITECTURE.md and must be completed before real company use.
