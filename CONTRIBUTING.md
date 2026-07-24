# Contributing to Kimi Study

Thank you for helping improve Kimi Study. The project is an experimental local-first learning application, so contributions should preserve observable user journeys, explicit state ownership, and reproducible evidence.

## Before opening a change

1. Search existing issues and `docs/stabilization/KNOWN-ISSUES.md`.
2. For behavior changes, describe the user-visible expectation before editing code.
3. Keep production course data out of commits. Use `tests/.runtime/courses` and repository fixtures.
4. Never add real API tokens, session files, copyrighted books, or private learner data.

## Development setup

```bash
npm ci
npm run fixtures:build
KIMI_STUDY_DATA_DIR=tests/.runtime/courses npm run fixtures:seed -- --clean
npm run check
npm test
npx playwright install chromium
npm run test:e2e:ci
```

The fixture server can be inspected with:

```bash
KIMI_STUDY_DATA_DIR=tests/.runtime/courses PORT=3107 npm start
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
