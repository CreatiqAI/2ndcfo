# Finance development skills

Installed 2026-09-22 into `C:/Users/Steven/.codex/skills`. Available to Codex on the next turn; these are agent guidance, not application runtime plugins or completed product features.

| Skill | Source | Intended use in 2ndCFO |
| --- | --- | --- |
| reconciliation | anthropics/knowledge-work-plugins, finance/skills/reconciliation | Bank Matching: discrepancies, supporting evidence, aging, review controls |
| financial-statements | anthropics/knowledge-work-plugins, finance/skills/financial-statements | Stage 6/8: financial report structure, comparison periods, required source data |
| variance-analysis | anthropics/knowledge-work-plugins, finance/skills/variance-analysis | Stage 7/8: actual versus budget, explained differences and reconciled totals |
| close-management | anthropics/knowledge-work-plugins, finance/skills/close-management | Stage 8: month-end checklist, dependencies, approval and period locking |
| security-best-practices | openai/skills, skills/.curated/security-best-practices | Explicit security reviews: Next.js/React/TypeScript, tenant access and server secrets |

## Provenance

- Finance source: https://github.com/anthropics/knowledge-work-plugins/tree/67e216dbe5621470581dd3d944df22d1cc8231ce/finance/skills
- Security source: https://github.com/openai/skills/tree/49f948faa9258a0c61caceaf225e179651397431/skills/.curated/security-best-practices
- Installed using the bundled skill-installer script with pinned commits.
- Preserved finance/LICENSE in each finance skill directory.
- Copied finance/CONNECTORS.md into financial-statements and adjusted its relative link for standalone Codex installation. This is the only local change to upstream skill text.
- Finance skills contain Markdown guidance, not executable installers. The security package contains Markdown references and agent metadata; no additional service was connected.

## Application boundaries

Use these as implementation and review references when relevant. Existing requirements and architecture remain authoritative. Installation does not connect an ERP, send company data, create journal entries, or implement unfinished stages.

- Do not equate invoice-to-payment matching with a complete general-ledger reconciliation: the current product does not yet have a full double-entry ledger.
- Preserve integer minor-unit arithmetic, tenant scoping, audit history and human approval. Never introduce floating-point settlement or automatic posting based on skill examples.
- Upstream dollar thresholds and US GAAP examples are illustrative, not company policy or Malaysian statutory rules. Confirm the applicable reporting framework and source requirements when implementing formal reports.
- Validate all analytical formulas with independent examples; handle zero denominators and reconcile component totals. Do not copy illustrative variance decompositions without checking interaction terms.
- Use real available evidence; mark unavailable ledger/ERP inputs as missing. No invented balances, classifications, explanations or connected services.
- Existing PDF and spreadsheet skills already cover document generation; no duplicate packages were installed.
