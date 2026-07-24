# Release process

## Release gate

A release candidate should satisfy:

```bash
npm ci
npm run check
npm test
npm run fixtures:build
KIMI_STUDY_DATA_DIR=tests/.runtime/courses npm run fixtures:seed -- --clean
npx playwright install chromium
npm run test:e2e:ci
```

Also confirm:

- the README hero and demo assets render on GitHub;
- no production `data/courses` content, private books, credentials, or test reports are tracked;
- the deterministic fixture demo starts successfully;
- the changelog describes user-visible changes;
- known blocked paths are disclosed;
- the version in `package.json` matches the planned tag.

## Tag and publish

```bash
npm version <major|minor|patch> --no-git-tag-version
git add package.json package-lock.json CHANGELOG.md
git commit -m "chore: prepare vX.Y.Z"
git tag -s vX.Y.Z -m "Kimi Study vX.Y.Z"
git push origin main --follow-tags
```

The release workflow validates the project, creates a source archive, writes checksums, and creates or updates the GitHub Release.

## Release notes

Lead with:

1. the learner-visible outcome;
2. screenshots or a short demonstration;
3. important fixes and migration notes;
4. verification evidence;
5. known limitations.
