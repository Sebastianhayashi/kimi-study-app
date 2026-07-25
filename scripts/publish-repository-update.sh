#!/usr/bin/env bash
set -euo pipefail

REPO="Sebastianhayashi/lucubro"
BRANCH="repo/effect-first-product-showcase"
DRY_RUN=0
KEEP_WORKDIR=0

usage() {
  cat <<'USAGE'
Usage: scripts/publish-repository-update.sh [options]

Safely overlays this package onto a fresh clone, runs the full release gate,
pushes a branch, and creates a pull request.

Options:
  --repo OWNER/NAME    Target repository (default: Sebastianhayashi/lucubro)
  --branch NAME        Branch name (default: repo/effect-first-product-showcase)
  --dry-run            Validate and show the diff without pushing or opening a PR
  --keep-workdir       Preserve the temporary clone after success
  -h, --help           Show this help
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      REPO="${2:?missing value for --repo}"
      shift 2
      ;;
    --branch)
      BRANCH="${2:?missing value for --branch}"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --keep-workdir)
      KEEP_WORKDIR=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      printf 'Unknown argument: %s\n' "$1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

for cmd in gh git rsync npm npx node; do
  command -v "$cmd" >/dev/null 2>&1 || {
    printf 'Required command not found: %s\n' "$cmd" >&2
    exit 1
  }
done

PACKAGE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKDIR="$(mktemp -d "${TMPDIR:-/tmp}/lucubro-publish.XXXXXX")"
CLONE_DIR="$WORKDIR/lucubro"
LOG_DIR="$WORKDIR/validation-logs"
mkdir -p "$LOG_DIR"

cleanup() {
  status=$?
  if [[ $status -ne 0 || $KEEP_WORKDIR -eq 1 ]]; then
    printf '\nWorking directory preserved at: %s\n' "$WORKDIR" >&2
  else
    rm -rf "$WORKDIR"
  fi
  exit "$status"
}
trap cleanup EXIT

printf 'Package root: %s\n' "$PACKAGE_ROOT"
printf 'Target repo:  %s\n' "$REPO"
printf 'Branch:       %s\n' "$BRANCH"

gh auth status
gh repo view "$REPO" --json nameWithOwner,defaultBranchRef,url >/dev/null

git clone "https://github.com/${REPO}.git" "$CLONE_DIR"
cd "$CLONE_DIR"

default_branch="$(gh repo view "$REPO" --json defaultBranchRef --jq '.defaultBranchRef.name')"
git checkout "$default_branch"
git pull --ff-only origin "$default_branch"

if git ls-remote --exit-code --heads origin "$BRANCH" >/dev/null 2>&1; then
  suffix="$(date -u +%Y%m%d-%H%M%S)"
  BRANCH="${BRANCH}-${suffix}"
  printf 'Remote branch already exists; using %s\n' "$BRANCH"
fi

git checkout -b "$BRANCH"

rsync -a "$PACKAGE_ROOT/" "$CLONE_DIR/" \
  --exclude '.git/' \
  --exclude 'node_modules/' \
  --exclude 'data/courses/' \
  --exclude 'tests/.runtime/' \
  --exclude 'tests/.generated/' \
  --exclude 'playwright-report/' \
  --exclude 'test-results/' \
  --exclude 'blob-report/' \
  --exclude 'release/'

mkdir -p data/courses
touch data/courses/.gitkeep

if find data/courses -mindepth 1 -maxdepth 1 ! -name '.gitkeep' -print -quit | grep -q .; then
  echo 'Refusing to publish: data/courses contains runtime course data.' >&2
  exit 1
fi

printf '\nChanged files:\n'
git status --short
printf '\nDiff summary:\n'
git diff --stat

git diff --check

before_courses="$WORKDIR/data-courses-before.txt"
after_courses="$WORKDIR/data-courses-after.txt"
git status --porcelain --untracked-files=all -- data/courses > "$before_courses"

run_logged() {
  local name="$1"
  shift
  printf '\n==> %s\n' "$name"
  "$@" 2>&1 | tee "$LOG_DIR/${name}.log"
}

run_logged npm-ci npm ci
run_logged static-check npm run check
run_logged node-tests npm test
run_logged fixture-build npm run fixtures:build
run_logged fixture-seed env LUCUBRO_DATA_DIR=tests/.runtime/courses npm run fixtures:seed -- --clean
run_logged playwright-install npx playwright install --with-deps chromium
run_logged browser-e2e npm run test:e2e:ci

git status --porcelain --untracked-files=all -- data/courses > "$after_courses"
if ! cmp -s "$before_courses" "$after_courses"; then
  echo 'Production data/courses changed during validation:' >&2
  diff -u "$before_courses" "$after_courses" >&2 || true
  exit 1
fi

# Runtime outputs must never enter the publication commit.
rm -rf tests/.runtime tests/.generated playwright-report test-results blob-report release

git diff --check

if [[ $DRY_RUN -eq 1 ]]; then
  printf '\nDry run complete. No branch was pushed and no PR was created.\n'
  printf 'Validated clone: %s\n' "$CLONE_DIR"
  KEEP_WORKDIR=1
  exit 0
fi

cat > "$WORKDIR/pr-body.md" <<EOF_BODY
## Why

The repository previously explained how to start Lucubro but did not let a visitor quickly understand the learning outcome, complete workflow, product surfaces, or engineering evidence.

## What this changes

- adds an effect-first bilingual README with a real product hero, animated demo, workflow, desktop/mobile screenshots, and clear positioning;
- adds product, architecture, quality, limitations, demo, roadmap, and repository-research documentation;
- publishes sanitized Chinese and English UX E2E sample reports;
- adds contribution, security, issue, pull-request, and release infrastructure;
- improves package metadata and deterministic fixture commands;
- applies a focused generation-state coherence repair and adds browser regression coverage.

## Verification

- \`npm ci\`: PASS
- \`npm run check\`: PASS
- \`npm test\`: PASS
- fixture build and isolated seed: PASS
- Chromium installation: PASS
- \`npm run test:e2e:ci\`: PASS
- production \`data/courses\` remained unchanged: PASS

Validation logs were produced locally in the publishing agent's temporary workspace and are not committed.

## Known boundaries

- Real course generation requires a locally installed and authenticated Kimi CLI.
- Model output remains non-deterministic and is governed by structural and quality gates.
- This is an experimental local-first prototype, not a hardened multi-tenant SaaS.
- The public UX audit reports describe a specific source snapshot; current CI is the source of truth for this PR.
EOF_BODY

git add -A
if git diff --cached --quiet; then
  echo 'No changes to publish.'
  exit 0
fi

git commit -m "docs: present Lucubro with effect-first evidence"
git push -u origin "$BRANCH"

pr_url="$(gh pr create \
  --repo "$REPO" \
  --base "$default_branch" \
  --head "$BRANCH" \
  --title "Present Lucubro with effect-first product evidence" \
  --body-file "$WORKDIR/pr-body.md")"

gh repo edit "$REPO" \
  --description "Turn books and learning materials into personalized interactive courses powered by Kimi Code." \
  --homepage "https://github.com/${REPO}" \
  --add-topic ai-learning \
  --add-topic education \
  --add-topic kimi \
  --add-topic local-first \
  --add-topic playwright \
  --add-topic study-assistant \
  --add-topic tutoring \
  --add-topic web-app

commit_sha="$(git rev-parse HEAD)"
printf '\nPublication prepared successfully.\n'
printf 'PR:      %s\n' "$pr_url"
printf 'Branch:  %s\n' "$BRANCH"
printf 'Commit:  %s\n' "$commit_sha"
printf 'Manual follow-up: set docs/images/social-preview.png as the GitHub social preview after merge.\n'
