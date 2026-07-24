# Start here

This package is ready to be published as an update to:

```text
Sebastianhayashi/kimi-study-app
```

## Give this instruction to the local Agent CLI

```text
Open AGENT_PUBLISH_INSTRUCTIONS.md and execute it exactly.
Use a fresh clone of Sebastianhayashi/kimi-study-app, overlay this package without deleting newer upstream files, run the full release gate, push a branch, and create a pull request. Do not force-push or write directly to main. Return the PR URL, commit SHA, exact validation results, blocked paths, and any manual GitHub settings still required.
```

Or run the conservative publisher directly:

```bash
bash scripts/publish-repository-update.sh
```

To inspect everything without pushing:

```bash
bash scripts/publish-repository-update.sh --dry-run --keep-workdir
```

## What the package changes

- replaces the minimal README with an effect-first Chinese and English product presentation;
- adds real browser screenshots, a short GIF, a workflow visual, and a GitHub social-preview asset;
- explains the learner problem, durable course artifacts, architecture, quality gates, limitations, and roadmap;
- adds deterministic fixture-demo instructions;
- publishes sanitized Chinese and English UX E2E sample reports;
- adds license, contribution, security, issue, pull-request, CI, and release infrastructure;
- applies the focused terminal-generation state fix and its Playwright regression coverage.

## Manual GitHub action after merge

Set `docs/images/social-preview.png` as the repository social preview in GitHub Settings. The publishing script configures the description and repository topics but cannot safely perform this image-setting step through the standard CLI.
