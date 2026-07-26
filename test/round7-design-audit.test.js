'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const landing = read('public/index.html');
const landingCss = read('public/landing.css');
const design = read('public/design-system.css');
const library = read('public/library-polish.css');
const workspace = read('public/course-workspace-polish.css');
const study = read('public/study-surface.css');
const generation = read('public/generation-preview-product.css');
const app = read('public/app.html');
const notes = read('public/notes.html');
const newCourse = read('public/new-course.html');
const course = read('public/course.html');
const i18n = read('public/i18n.js');
const glue = read('public/glue.js');

test('Round 7 primary actions use one brand foreground token in both schemes', () => {
  assert.match(design, /--ds-brand-on:\s*#ffffff/);
  assert.match(design, /@media \(prefers-color-scheme: dark\)[\s\S]*--ds-brand-on:\s*#0b1c3f/);
  for (const source of [landingCss, library, workspace, study, generation, app]) {
    assert.match(source, /var\(--ds-brand-on\)/);
  }
  assert.doesNotMatch(library, /\.ks-continue-action[\s\S]{0,180}color:\s*#fff/);
  assert.doesNotMatch(workspace, /\.current-learning-action[\s\S]{0,180}background:\s*#0b57d0/);
});

test('Round 7 landing keeps one CTA label per intent and removes decorative clutter', () => {
  assert.equal((landing.match(/>Create course(?:\s|<)/g) || []).length, 4);
  assert.equal((landing.match(/>Open library(?:\s|<)/g) || []).length, 2);
  assert.equal((landing.match(/class="section-index"/g) || []).length, 2);
  assert.doesNotMatch(landing, /hero-facts/);
  assert.doesNotMatch(landing, /landing-avatar|appbar-avatar/);
  assert.match(landing, /<details class="mobile-nav">/);
  assert.match(landing, /Sample course interface shown in Chinese/);
  assert.doesNotMatch(i18n, /Start with my material|Open course library|Create my first course|Your course library|Inside the learning workspace/);
});

test('Round 7 visible copy has no em dash and route metadata is localized', () => {
  for (const source of [landing, app, notes, newCourse, course]) {
    assert.doesNotMatch(source, /[—–]/);
  }
  const phraseSection = i18n.slice(i18n.indexOf('const phraseEntries'), i18n.indexOf('const messages'));
  assert.doesNotMatch(phraseSection, /[—–]/);
  assert.match(i18n, /function applyMetadata\(\)/);
  for (const route of ["pathname === '/'", "pathname === '/app'", "pathname === '/notes'", "pathname === '/new-course'", "pathname.startsWith('/course/')"]) {
    assert.ok(i18n.includes(route), `metadata route missing: ${route}`);
  }
});

test('Round 7 stalled course recovery stays client-side and uses existing endpoints', () => {
  assert.match(glue, /STALLED_COURSE_MS = 10 \* 60 \* 1000/);
  assert.match(glue, /response\.status !== 404/);
  assert.match(glue, /\/retry`, \{ method: 'POST' \}/);
  assert.match(glue, /method: 'DELETE'/);
  assert.match(glue, /course-error-actions/);
  assert.match(glue, /courseMenu\.hidden = failed/);
  assert.match(glue, /el\.removeAttribute\('role'\)/);
  assert.match(glue, /el\.tabIndex = -1/);
  assert.match(i18n, /\['Creation stalled', '创建已停滞', '作成が停止しています'\]/);
});

test('Round 7 preserves the single inverse evidence block and muted disabled actions', () => {
  assert.equal((landingCss.match(/\.evidence-primary\s*\{/g) || []).length, 3);
  assert.match(landingCss, /\.evidence-primary\s*\{[\s\S]{0,180}background:\s*#111c2f/);
  assert.match(landingCss, /@media \(prefers-color-scheme: dark\)[\s\S]*\.evidence-primary\s*\{[\s\S]{0,80}background:\s*#0a101b/);
  assert.match(design, /button\.primary-button[\s\S]*:disabled[\s\S]*background:\s*var\(--ds-surface-muted\)/);
  assert.match(newCourse, /\.primary-button:disabled[\s\S]{0,180}background:\s*var\(--ds-surface-muted\)/);
});
