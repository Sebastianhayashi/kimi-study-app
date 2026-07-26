## User problem

<!-- What observable learner or maintainer problem does this change address? -->

## Expected behavior

<!-- Describe the behavior contract before implementation details. -->

## Implementation

<!-- List the important files, state ownership, data flow, and trade-offs. -->

## Impact declaration

### Media impact

- [ ] No README media slot changes.
- [ ] README media was recaptured for en, zh-CN, and ja with `node scripts/capture-readme-media.js`.
- [ ] `node scripts/verify-readme-media.js` passed and byte budgets remain within the manifest.

### i18n impact

- [ ] No new or changed UI copy.
- [ ] Every new UI string has an en, zh-CN, and ja `phraseEntries` entry and live locale switching was checked.

### Data/API impact

- [ ] No API contract or course data-format change.
- [ ] Any approved contract or migration is documented with compatibility, rollback, and fixture evidence.

## Verification

```text
npm run check:
npm test:
npx playwright test:
npm run verify:readme:
manual light/dark and 390px evidence:
```

## Evidence

<!-- Link sanitized before/after screenshots, the Playwright artifact or trace, and the tested browser scope. -->

## Risks and limitations

<!-- External dependencies, non-deterministic model behavior, migration concerns, or blocked paths. -->

## Checklist

- [ ] Tests cover the changed behavior and no existing test is deleted or skipped.
- [ ] Terminal states clear stale loading and progress signals.
- [ ] Keyboard, reduced motion, light/dark, and mobile behavior were considered.
- [ ] Production course data and private materials were not committed.
- [ ] Documentation and release evidence were updated when needed.
