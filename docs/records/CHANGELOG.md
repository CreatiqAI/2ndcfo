# Project change record

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
