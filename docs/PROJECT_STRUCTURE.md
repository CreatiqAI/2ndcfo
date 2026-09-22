# Project structure

All commands run from the repository root. Framework/tool configuration stays there
so Next.js, npm, TypeScript and Vercel discover it normally.

```text
2ndCFO/
  src/
    app/                  Next.js pages, styles and authenticated API routes
    components/           Finance interface, document calendar and document preview
    lib/                  Shared pure UI/data helpers, including invoice month grouping
    server/               Finance services, authentication and integrations
      db/                 Drizzle schema and database adapter
  database/
    migrations/           Ordered, immutable SQL migration history
    README.md             Database ownership and migration procedure
    CHANGELOG.md          Applied database changes and project moves
  config/                 Public TLS CA certificate (not credentials)
  public/                 Logo, favicon, CSV template and PDF viewer assets
  scripts/                Current migration runner, worker and acceptance checks
    archive/              Completed one-off project migration tools
  tests/                  Automated service tests using isolated local databases
  docs/
    architecture/         Technical design
    planning/             Requirements and roadmap
    operations/           Setup and deployment instructions
    records/              Delivery history, changes and skill inventory
  .codex/                 Project-scoped MCP configuration (no OAuth tokens)
```

## Root configuration

- `package.json` / `package-lock.json`: dependencies and commands.
- `next.config.ts`, `next-env.d.ts`, `tsconfig.json`, `vitest.config.ts`,
  `.prettierrc.json`: framework, type, test and formatting settings.
- `AGENTS.md` / `CLAUDE.md`: working agreement and agent entry point.
- `.env.example`: fresh local-preview template.
- `.env.vercel.example`: public production template.
- `.env.local`: private live local runtime config, ignored by Git.
- `.env.vercel.local`: private completed Vercel import file, ignored by Git.

## Private data and generated folders

| Path | Purpose | Handling |
| --- | --- | --- |
| `.data/` | Historical local PostgreSQL, originals and migration reports | Private; retained for recovery, not the active cloud database |
| `.data-backups/` | Table/file backups and old env snapshots | Private; never publish or casually remove |
| `.data-backups/legacy-config/` | Superseded `.env.supabase.local` and `.env.supabase-target.local` | Archived configuration, not runtime inputs |
| `node_modules/` | Installed dependencies | Generated, ignored |
| `.next/` | Next.js build/dev output | Generated, ignored |
| `*.tsbuildinfo` | TypeScript incremental cache | Generated, ignored |
| `test-results/`, `playwright-report/` | Local verification output | Generated, ignored |
| `public/pdfjs/` | PDF.js worker, fonts and CMaps | Recreated by postinstall; existing versioned assets retained |

The active database and originals are in Supabase project `btpolwpgnekvyimpqegu`,
schema `finance`, private bucket `finance-document`. No production database files
belong in `database/`; that directory contains SQL and operational records only.
