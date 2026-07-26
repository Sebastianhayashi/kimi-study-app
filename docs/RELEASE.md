# Release evidence checklist

A release is evidence-backed only when a reviewer can locate the tested scope and confirm that the repository promise still matches the product.

## Repository presentation

- [ ] GitHub About description states the same user outcome as the first README promise.
- [ ] Topics describe local-first learning, course generation, source-grounded study, and accessibility without claiming unsupported SaaS capabilities.
- [ ] Homepage points to the maintained product or documentation location.
- [ ] The social preview uses `docs/media/readme/en/social-preview.png` or an explicitly reviewed replacement.
- [ ] README hero, sample command, current limits, and product screenshots match the released behavior.

## Product and media evidence

- [ ] `node scripts/verify-readme-media.js` passes for en, zh-CN, and ja.
- [ ] `node scripts/verify-readme-parity.js` passes.
- [ ] Visual changes include sanitized before/after evidence at desktop and 390px, light and dark where applicable.
- [ ] The release notes identify the fixture, locale, theme, viewport, browser engine, and capture command.

## Quality evidence

- [ ] `npm run check` passes.
- [ ] `npm test` passes with the reported total.
- [ ] `npx playwright test` passes with the reported total, or an infrastructure blocker is stated without deleting or skipping tests.
- [ ] The release notes link the CI run and Playwright artifact or trace.
- [ ] Tested browser scope is explicit. Chromium automation does not imply Safari, Firefox, screen-reader, zoom, or real-touch coverage.
- [ ] Production `data/` is unchanged and no private material is included.

## Stop conditions

Stop the release when a P0 or P1 defect is open, a critical route cannot complete by keyboard, a terminal state is inconsistent, README media is stale, or a data/API change lacks explicit approval and rollback evidence.
