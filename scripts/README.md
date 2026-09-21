# Scripts

Run from the repository root.

| Script | Entry point | Purpose |
| --- | --- | --- |
| `migrate.ts` | `npm run db:migrate` | Apply pending versioned SQL from `database/migrations/` |
| `worker.ts` | `npm run worker` | Process durable extraction jobs; external PostgreSQL required alongside web process |
| `copy-pdf-assets.mjs` | npm postinstall | Copy installed PDF.js assets to `public/pdfjs/` |
| `http-smoke.ts` | `npm run test:http` | Creates isolated synthetic data through the running API; use mock AI environment |
| `live-ai-smoke.ts` | Explicit `RUN_LIVE_AI_TEST=1` | Paid provider acceptance with synthetic PDFs |
| `archive/` | Not routine commands | Completed historical database/file transfers |

Neither acceptance script is a read-only health check. Use the automated isolated
service suite (`npm test`) for routine verification without modifying cloud data.
