'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(ROOT, file));

function assertContains(file, values) {
  const source = read(file);
  for (const value of values) assert.match(source, value, `${file} should contain ${value}`);
}

test('P1-01 defines semantic motion aliases and static-first reveal ownership', () => {
  assertContains('public/design-system.css', [
    /--ds-motion-control:/,
    /--ds-motion-dismiss:/,
    /--ds-motion-reveal:/,
    /--ds-motion-panel:/,
    /--ds-motion-milestone:/,
    /--ds-motion-distance-sm:/,
    /--ds-motion-distance-md:/,
    /--ds-motion-scale-soft:/,
    /\.motion-ready \[data-reveal\]:not\(\.is-visible\)/,
  ]);
  assertContains('public/landing-scroll.js', [/IntersectionObserver/, /unobserve/, /motion-ready/]);
  assertContains('public/index.html', [/data-reveal/, /class="button button-primary"/]);
});

test('P1-02 binds learning feedback and artifact reveal to real state', () => {
  assertContains('public/activity-runtime.js', [
    /lucubro:learning-evidence/,
    /delete root\.dataset\.motionState/,
    /void root\.offsetWidth/,
    /window\.location\.origin/,
  ]);
  assertContains('public/activity-runtime.css', [/--ds-motion-control/, /--ds-motion-reveal/, /prefers-reduced-motion/]);
  assertContains('public/generation-preview-product.js', [/is-artifact-reveal/]);
  assertContains('public/generation-preview-product.css', [/is-artifact-reveal/, /--ds-motion-reveal/]);
});

test('P1-03 documents and tests the five-route accessibility contract', () => {
  assertContains('docs/QUALITY.md', [/关键路由可访问性契约/, /44px/, /prefers-reduced-motion/, /screen reader/i]);
  assert(exists('tests/e2e/round5-experience.spec.js'));
});

test('P1-04 governs reproducible three-locale README media', () => {
  for (const locale of ['en', 'zh-CN', 'ja']) {
    assert(exists(`docs/media/readme/${locale}`));
  }
  assertContains('docs/media/readme/manifest.json', [/hero-workspace\.webp/, /journey-storyboard\.webp/, /social-preview\.png/, /byteBudget/]);
  assertContains('scripts/capture-readme-media.js', [/@playwright\/test/, /LUCUBRO_CAPTURE_EXECUTABLE/, /prefers-color-scheme|colorScheme/, /reducedMotion:\s*['\"]reduce['\"]/, /domcontentloaded/, /encodeWebp/, /options\.initialWaitFor/, /applyMediaFixture/]);
  assert.doesNotMatch(read('scripts/capture-readme-media.js'), /waitUntil:\s*['\"]networkidle['\"]/, 'long-lived course event streams must not block capture readiness');
  assertContains('scripts/capture-readme-media.js', [/Promise\.race/, /addEventListener\(['\"]error['\"]/]);
  assertContains('scripts/verify-readme-media.js', [/byteBudget/, /manifest\.json/]);
});

test('P1-05 freezes legacy localized README parity after the Company Workbench pivot', () => {
  assertContains('README.md', [
    /A local-first AI company workbench for a single CEO/,
    /docs\/company-workbench\/SPEC\.md/,
    /AGENTS\.md/,
    /Frozen legacy/,
  ]);
  for (const file of ['README.zh-CN.md', 'README.ja.md']) {
    assertContains(file, [
      /<!-- section:hero -->/,
      /<!-- section:journey -->/,
      /<!-- section:sample -->/,
      /<!-- section:limits -->/,
      /docs\/media\/readme\//,
    ]);
  }
  assertContains('AGENTS.md', [/previous learning-workspace product is frozen legacy/i]);
  assertContains('scripts/verify-readme-parity.js', [/section:/, /README\.zh-CN\.md/, /README\.ja\.md/]);
});

test('P1-06 offers a sample journey without hard-coding a course id', () => {
  assertContains('public/index.html', [/href="\/app\?sample=1"/, /data-sample-journey/]);
  const glue = read('public/glue.js');
  assert.match(glue, /URLSearchParams\(location\.search\)\.get\(['"]sample['"]\)/);
  assert.doesNotMatch(glue, /sample.*\/course\/readycourse/s);
});

test('P1-07 projects current objective, one action, evidence and exact resume', () => {
  assertContains('public/course.html', [/currentLearningStrip/, /role="status"/, /currentLearningAction/]);
  assertContains('public/glue.js', [
    /updateCurrentLearningStrip/,
    /\/api\/activity/,
    /\/progress/,
    /latestAttempt\.passed/,
    /lucubro:learning-evidence/,
    /event\.origin !== window\.location\.origin/,
    /notes-changed/,
  ]);
  assertContains('public/course-workspace-polish.css', [/current-learning-strip/, /--ds-motion-reveal/]);
  assertContains('public/i18n.js', [/Current objective/, /Latest evidence/, /Resume point/]);
});

test('P1-08 keeps the plan preview disposable and read-only', () => {
  assert(exists('research/prototypes/plan-preview/prototype.html'));
  assert(exists('research/prototypes/plan-preview/WALKTHROUGH.md'));
  const prototype = read('research/prototypes/plan-preview/plan-preview.js');
  assert.doesNotMatch(prototype, /fetch\(['"]\/api|localStorage|indexedDB|POST|PUT|PATCH|DELETE/);
  assertContains('research/prototypes/plan-preview/WALKTHROUGH.md', [/Walkthrough 1/, /Walkthrough 5/, /approval boundary/i]);
  const context = { window: {} };
  vm.runInNewContext(read('research/prototypes/plan-preview/plan-preview-data.js'), context);
  const plan = context.window.LUCUBRO_PLAN_PREVIEW;
  const visiblePlanCopy = [
    plan.sourceDigest,
    plan.mission,
    ...plan.lessons.flatMap((lesson) => [lesson.title, lesson.objective, lesson.coverage, lesson.practice]),
  ];
  const i18n = read('public/i18n.js');
  for (const value of visiblePlanCopy) assert.ok(i18n.includes(`['${value}'`), `phraseEntries should localize prototype text: ${value}`);
});

test('P2-09 records a dependency-free read-only performance baseline', () => {
  assertContains('scripts/report-route-assets.js', [/node:perf_hooks/, /LUCUBRO_DATA_DIR/, /BASELINE/]);
  assertContains('docs/BASELINE.md', [/event-loop/i, /route/i, /sync/i, /read-only/i]);
  assert(exists('test/server-characterization.test.js'));
});

test('P2-12 assigns media ownership and release evidence', () => {
  assertContains('.github/PULL_REQUEST_TEMPLATE.md', [/Media impact/, /i18n impact/i, /Data\/API impact/, /Playwright/]);
  assertContains('CONTRIBUTING.md', [/README media owner/, /docs\/media\/readme/]);
  assertContains('docs/RELEASE.md', [/social preview/i, /About/, /topics/i, /Playwright artifact/i]);
});
