## Why

The repository previously explained how to start Kimi Study but did not let a visitor quickly understand the learning outcome, full workflow, product surfaces, or engineering evidence.

## What this changes

- adds an effect-first bilingual README with a real product hero, animated demo, workflow, desktop/mobile screenshots, and clear positioning;
- adds product, architecture, quality, limitations, demo, roadmap, and repository-research documentation;
- publishes sanitized Chinese and English UX E2E sample reports;
- adds contribution, security, issue, pull-request, and release infrastructure;
- improves package metadata and deterministic fixture commands;
- applies a focused generation-state coherence repair and adds browser regression coverage.

## Verification

All commands below were run locally on this exact branch (overlay of the package onto current `main` at `2da1588`), macOS, Node with `engines: >=22`:

- `npm ci`: PASS (clean install from the updated lockfile)
- `npm run check`: PASS (all `node --check` targets compile)
- `npm test`: PASS — 116/116 node:test tests, 0 failures
- `npm run fixtures:build`: PASS — deterministic fixtures built at `tests/.generated/fixtures`
- isolated fixture seed: PASS — `KIMI_STUDY_DATA_DIR=tests/.runtime/courses npm run fixtures:seed -- --clean` seeded only the isolated directory
- `npx playwright install --with-deps chromium`: PASS
- `npm run test:e2e:ci`: PASS — 45/45 Chromium tests, 0 failures (53.4s), including the new failure-terminal-state regression
- production `data/courses` remained unchanged: PASS — no tracked modifications and no new files written by any gate step (verified via `git status --porcelain -- data/courses` and mtime comparison against the pre-gate marker)

## Known boundaries

- Real course generation requires a locally installed and authenticated Kimi CLI.
- Model output remains non-deterministic and is governed by structural and quality gates.
- This is an experimental local-first prototype, not a hardened multi-tenant SaaS.
- The public UX audit reports describe a specific source snapshot; current CI is the source of truth for this PR.
