# Project change record

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
