# Contributing to Lucubro

Thank you for helping improve Lucubro. The project is an experimental local-first learning application, so contributions should preserve observable user journeys, explicit state ownership, and reproducible evidence.

## Before opening a change

1. Search existing issues and `docs/stabilization/KNOWN-ISSUES.md`.
2. For behavior changes, describe the user-visible expectation before editing code.
3. Keep production course data out of commits. Use `tests/.runtime/courses` and repository fixtures.
4. Never add real API tokens, session files, copyrighted books, or private learner data.

## Development setup

```bash
npm ci
npm run fixtures:build
LUCUBRO_DATA_DIR=tests/.runtime/courses npm run fixtures:seed -- --clean
npm run check
npm test
npx playwright install chromium
npm run test:e2e:ci
```

The fixture server can be inspected with:

```bash
LUCUBRO_DATA_DIR=tests/.runtime/courses PORT=3107 npm start
```

Then open `http://localhost:3107/app`.

## Change requirements

### Product and UI changes

- Define the affected user journey and expected behavior.
- Add or update a Playwright assertion for visible behavior.
- Keep status text, progress, loading affordances, and terminal states coherent across regions.
- Verify desktop and mobile behavior when the control exists in both layouts.
- Preserve keyboard focus and accessible names.

### State and generation changes

- Prefer one canonical state owner and derived view models.
- Do not let independent callbacks write competing lifecycle states to the same UI.
- A terminal state must atomically clear stale busy, skeleton, timer, and progress signals.
- Late events from an old generation run must not mutate the current run.

### Server and file-system changes

- Validate paths before reading or writing.
- Keep test data isolated from `data/courses`.
- Preserve the original source material and generated artifacts unless the operation is explicitly destructive.
- Report unsupported external dependencies as blocked instead of silently substituting production behavior.

## Pull request checklist

- [ ] The problem and intended behavior are described.
- [ ] The change is narrowly scoped.
- [ ] `npm run check` passes.
- [ ] `npm test` passes.
- [ ] Relevant Playwright journeys pass.
- [ ] New UI states have screenshots or trace evidence when useful.
- [ ] Documentation is updated.
- [ ] No secrets, private data, generated reports, or production course files are included.

## Commit and PR style

Use imperative, specific commits, for example:

```text
fix: close generation chrome on terminal failure
feat: add anchored source notes
 docs: explain deterministic fixture demo
```

A PR should explain:

- the user problem;
- the root cause;
- the changed files;
- verification commands and results;
- remaining limitations or blocked paths.

## Ownership and evidence

### README media owner

The maintainer changing a visible product surface owns the matching files under `docs/media/readme/`. A visual change must declare its media impact in the pull request and either recapture all three locales or explain why the existing evidence remains accurate.

Use the fixed fixture and manifest workflow:

```bash
node scripts/capture-readme-media.js
node scripts/verify-readme-media.js
node scripts/verify-readme-parity.js
```

Review en, zh-CN, and ja together. Do not add hand-painted product copy, private course data, or temporary capture files. Keep the route, fixture, viewport, theme, stable condition, dimensions, and byte budget in `docs/media/readme/manifest.json`.

### Surface owners

- UI and interaction: the maintainer changing the route or component also owns its Playwright journey and accessibility contract.
- Generation state: changes require one canonical state owner, terminal-state recovery evidence, and generation journey tests.
- Course data schema: changes require explicit maintainer approval, compatibility and rollback documentation, and fixture migration coverage.
- README media: the UI change owner produces the synchronized three-locale evidence.

### Dependency rhythm

Dependency updates are reviewed deliberately, grouped by purpose, and validated through the full quality gates. The repository does not enable an update bot by default. A maintainer may add automation only through a separately approved governance change.
