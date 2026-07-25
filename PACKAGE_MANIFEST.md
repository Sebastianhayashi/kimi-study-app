# Repository update package manifest

Target repository: `Sebastianhayashi/lucubro`

Package purpose: effect-first public repository presentation, open-source project infrastructure, focused generation-state repair, and local Agent CLI publication workflow.

The source snapshot was checked against the current GitHub `main` blobs for `README.md`, `package.json`, `public/glue.js`, and `public/generation-preview-product.js`; all four matched before this package applied its changes. The publisher still uses a fresh clone and a non-destructive overlay to protect against newer upstream changes.

## Included change groups

1. Bilingual effect-first README and product positioning.
2. Real Chromium-derived product images, animated workflow, and social preview.
3. Product, workflow, architecture, quality, limitations, roadmap, demo, release, and research documents.
4. Sanitized English and Chinese UX E2E sample reports with SHA-256 checksums.
5. ISC License, security policy, code of conduct, contribution guide, issue templates, PR template, and release workflow.
6. `package.json` metadata and deterministic demo scripts.
7. Terminal generation-state coherence repair in `public/glue.js` and `public/generation-preview-product.js`.
8. Playwright regression coverage in `tests/e2e/generation-state-coherence.spec.js`.
9. Safe branch-and-PR publisher in `scripts/publish-repository-update.sh`.

## Validation performed while building this package

Passed:

- JavaScript syntax checks through `npm run check`.
- Shell syntax check for the publication script.
- YAML parsing for workflows and issue templates.
- Local Markdown link validation.
- PDF checksum verification.
- ZIP/media file-format inspection.
- Runtime `data/courses` removal; only `.gitkeep` remains.

Environment limitation:

- A complete `npm ci` could not finish in the package-building container because the configured package registry was unavailable. An offline install also reported an uncached dependency.
- Running the Node suite without installed dependencies executed all 116 tests; 115 passed and one server-route test failed only because `express` was not installed.
- The local publishing Agent must run `npm ci`, all 116 Node tests, and Chromium E2E before opening the pull request. The publication script enforces this gate and stops on failure.

Historical sample reports are included to demonstrate the evidence standard. They do not replace current CI for the commit that will be published.
