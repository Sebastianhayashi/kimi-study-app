# Instructions for the local publishing agent

You are publishing an effect-first repository update for:

```text
Sebastianhayashi/kimi-study-app
```

The package containing this file is a complete source snapshot. **Do not replace Git history and do not force-push.** Use the current GitHub repository as the source of truth, overlay this package onto a fresh clone, run the release gate, and create a pull request unless the human explicitly requests a direct main update.

## Goal

Make the repository immediately show:

1. what Kimi Study produces;
2. the complete material-to-course workflow;
3. real desktop and mobile product evidence;
4. the engineering quality bar and known limitations;
5. how to start a real Kimi-backed run or a deterministic fixture demo.

The package also contains a focused fix for generation terminal-state coherence and regression coverage. Preserve it unless current upstream code has moved; if conflicts exist, port the behavior and tests rather than blindly overwriting newer logic.

## Non-negotiable rules

- Never commit `.git`, `node_modules`, real `data/courses` content, Kimi credentials, private books, learner data, Playwright reports, or local environment files.
- Do not delete upstream files merely because they are absent from this package without first checking whether they were added after the package was built.
- Do not claim the product is production-ready.
- Do not claim a browser or model path passed unless the current local run produced fresh evidence.
- Do not force-push or rewrite `main`.
- Prefer a branch and pull request.

## Fast path

From the root of this package:

```bash
bash scripts/publish-repository-update.sh
```

The script clones the current repository, overlays this package, validates the result, pushes a branch, and opens a pull request. It is intentionally conservative and stops on failed checks.

## Manual workflow

### 1. Verify access

```bash
gh auth status
gh repo view Sebastianhayashi/kimi-study-app
```

### 2. Clone current main

```bash
workdir="$(mktemp -d)"
git clone https://github.com/Sebastianhayashi/kimi-study-app.git "$workdir/kimi-study-app"
cd "$workdir/kimi-study-app"
git checkout -b repo/effect-first-product-showcase
```

### 3. Overlay the package safely

Run from the package root, replacing the destination path:

```bash
rsync -a ./ "$workdir/kimi-study-app/" \
  --exclude '.git/' \
  --exclude 'node_modules/' \
  --exclude 'data/courses/' \
  --exclude 'tests/.runtime/' \
  --exclude 'tests/.generated/' \
  --exclude 'playwright-report/' \
  --exclude 'test-results/' \
  --exclude 'blob-report/' \
  --exclude 'release/'
```

Do not use `rsync --delete`.

### 4. Review the diff before installing dependencies

```bash
cd "$workdir/kimi-study-app"
git status --short
git diff --stat
git diff -- README.md package.json public/glue.js public/generation-preview-product.js tests/e2e/generation-state-coherence.spec.js
```

Confirm that the update is limited to repository presentation, documentation, community infrastructure, metadata, the focused state fix, and its regression test.

### 5. Run the release gate

```bash
npm ci
npm run check
npm test
npm run fixtures:build
KIMI_STUDY_DATA_DIR=tests/.runtime/courses npm run fixtures:seed -- --clean
npx playwright install --with-deps chromium
npm run test:e2e:ci
```

After tests:

```bash
git status --short -- data/courses
```

This must be empty.

If network restrictions prevent dependency installation, stop and report the blocked command. Do not create a PR claiming validation succeeded. The human may explicitly authorize a documentation-only PR with the limitation recorded in the PR body.

### 6. Commit and publish

```bash
git add -A
git commit -m "docs: present Kimi Study with effect-first evidence"
git push -u origin repo/effect-first-product-showcase
```

Create the pull request:

```bash
gh pr create \
  --repo Sebastianhayashi/kimi-study-app \
  --base main \
  --head repo/effect-first-product-showcase \
  --title "Present Kimi Study with effect-first product evidence" \
  --body-file PUBLISH_PR_BODY.md
```

### 7. Configure repository discovery

After the PR is merged:

```bash
gh repo edit Sebastianhayashi/kimi-study-app \
  --description "Turn books and learning materials into personalized interactive courses powered by Kimi Code." \
  --homepage "https://github.com/Sebastianhayashi/kimi-study-app" \
  --add-topic ai-learning \
  --add-topic education \
  --add-topic kimi \
  --add-topic local-first \
  --add-topic playwright \
  --add-topic study-assistant \
  --add-topic tutoring \
  --add-topic web-app
```

Use `docs/images/social-preview.png` as the repository social preview in GitHub Settings → General → Social preview.

Enable Discussions only after there is a maintainer plan for answering questions. Enable private vulnerability reporting if it is not already enabled.

## Required final response to the human

Return:

- branch and PR URL;
- exact commit SHA;
- validation commands and results;
- any blocked external/model paths;
- repository metadata changes;
- whether the social preview still requires a manual UI action;
- a short list of follow-up work, without silently implementing unrelated product changes.
