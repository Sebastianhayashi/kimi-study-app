'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const audit = read('TASTE-AUDIT-R8.md');
const i18n = read('public/i18n.js');
const coreJourney = read('public/core-journey-polish.css');
const notesHtml = read('public/notes.html');
const notesCss = read('public/notes.css');
const notesJs = read('public/notes.js');
const library = read('public/library-polish.css');
const newCourse = read('public/new-course.html');
const course = read('public/course.html');
const workspace = read('public/course-workspace-polish.css');
const glue = read('public/glue.js');
const lessonTheme = read('public/lesson-content-normalizer.css');
const activity = read('public/activity-runtime.css');
const contextual = read('public/contextual-actions.js');
const marginNotes = read('public/margin-notes.js');

test('Round 8 audit records all five routes, four required scenarios, and all 13 skills', () => {
  const routes = ['landing', 'app', 'notes', 'new-course', 'course'];
  const scenarios = ['desktop-light-en', 'desktop-dark-zh', 'mobile-light-en', 'mobile-dark-zh'];
  for (const route of routes) {
    for (const scenario of scenarios) {
      assert.ok(
        audit.includes(`audit-evidence/r8/before/${route}--${scenario}.png`),
        `missing audit evidence for ${route} ${scenario}`,
      );
    }
  }
  const skills = [
    '`taste-skill` v2', '`taste-skill-v1`', '`redesign-skill`', '`brandkit`',
    '`gpt-tasteskill`', '`minimalist-skill`', '`soft-skill`', '`brutalist-skill`',
    '`stitch-skill`', '`output-skill`', '`image-to-code-skill`',
    '`imagegen-frontend-web`', '`imagegen-frontend-mobile`',
  ];
  for (const skill of skills) assert.ok(audit.includes(skill), `missing skill record: ${skill}`);
  assert.match(audit, /Severity count:\*\* P0 x1, P1 x5, P2 x0/);
});

test('Round 8 mobile course keeps materials and notes reachable as 44px controls', () => {
  assert.match(coreJourney, /#lessonResourceSlot \.ks-materials-trigger,[\s\S]*#lessonResourceSlot > \.kn-notes-toggle/);
  assert.match(coreJourney, /width:\s*44px !important/);
  assert.match(coreJourney, /height:\s*44px !important/);
  assert.match(coreJourney, /#lessonResourceSlot \.ks-materials-menu-list \.lesson-resource-tool[\s\S]*display:\s*flex !important[\s\S]*min-height:\s*48px !important/);
  assert.match(coreJourney, /#lessonResourceSlot \.ks-materials-menu-list \.lesson-resource-tool-label[\s\S]*position:\s*static[\s\S]*display:\s*inline[\s\S]*clip-path:\s*none/);
  assert.match(glue, /materialsTrigger\.className = 'pill lesson-resource-tool ks-materials-trigger'/);
  assert.match(workspace, /@media \(max-width: 700px\)[\s\S]*\.ks-course-more-trigger[\s\S]*min-width:\s*44px/);
});

test('Round 8 activity heatmap uses 24px cells and one roving keyboard tab stop', () => {
  assert.match(notesHtml, /class="activity-scroll" tabindex="-1" aria-describedby="activityScrollHint"/);
  assert.match(notesHtml, /id="activityGrid" role="grid" aria-label="Learning activity by day"/);
  assert.match(notesHtml, /Scroll horizontally to review the full year\. Use arrow keys to move between days\./);
  assert.match(notesCss, /--activity-cell:\s*24px/);
  assert.match(notesCss, /\.activity-day\s*\{[\s\S]*width:\s*var\(--activity-cell\)[\s\S]*height:\s*var\(--activity-cell\)/);
  assert.match(notesJs, /cell\.tabIndex = -1/);
  assert.match(notesJs, /cells\.forEach\(\(cell\) => \{ cell\.tabIndex = cell === next \? 0 : -1; \}\)/);
  for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End']) {
    assert.ok(notesJs.includes(`event.key === '${key}'`), `missing heatmap key: ${key}`);
  }
  assert.match(notesJs, /aria-rowcount/);
  assert.match(notesJs, /aria-colcount/);
  assert.match(i18n, /\['Scroll horizontally to review the full year\. Use arrow keys to move between days\.',\s*'横向滚动可查看全年记录。使用方向键在日期之间移动。',\s*'横にスクロールすると1年分を確認できます。矢印キーで日付間を移動できます。'\]/);
});

test('Round 8 small-phone library uses a complete filter grid and one course column', () => {
  assert.match(library, /@media \(max-width: 520px\)[\s\S]*\.tabs\s*\{[\s\S]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(library, /@media \(max-width: 520px\)[\s\S]*\.course-grid\s*\{[\s\S]*grid-template-columns:\s*1fr/);
  assert.match(library, /@media \(max-width: 520px\)[\s\S]*\.course-error-actions button\s*\{[\s\S]*min-height:\s*44px/);
});

test('Round 8 mobile course creation keeps localized step labels visible', () => {
  const mobile = newCourse.slice(newCourse.indexOf('@media (max-width: 820px)'));
  assert.match(mobile, /\.top-progress\s*\{[\s\S]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(mobile, /\.top-step-copy\s*\{[\s\S]*position:\s*static[\s\S]*clip-path:\s*none[\s\S]*white-space:\s*normal/);
  assert.match(mobile, /\.top-step-state\s*\{[\s\S]*clip-path:\s*inset\(50%\)/);
  for (const label of ['Upload material', 'Set goal', 'Create course']) {
    assert.ok(i18n.includes(`['${label}'`), `missing i18n step label: ${label}`);
  }
});

test('Round 8 reader theme is paper-first, persistent, localized, and mobile reachable', () => {
  assert.match(course, /const READER_THEME_KEY = 'lucubro:reader-theme'/);
  assert.match(course, /let readerTheme = 'paper'/);
  assert.match(course, /localStorage\.getItem\(READER_THEME_KEY\) === 'dark' \? 'dark' : 'paper'/);
  assert.match(course, /localStorage\.setItem\(READER_THEME_KEY, readerTheme\)/);
  assert.match(course, /lucubro:readerthemechange/);
  assert.match(course, /window\.addEventListener\('lucubro:localechange', applyReaderTheme\)/);
  assert.match(glue, /button\.dataset\.action = actionName/);
  assert.match(glue, /'reader-theme'/);
  assert.match(glue, /readerTheme\.click\(\)/);
  assert.match(glue, /lucubro:readerthemechange/);
  assert.match(i18n, /\['Use dark reading theme', '使用深色阅读主题', 'ダーク読書テーマを使う'\]/);
  assert.match(i18n, /\['Use paper reading theme', '使用纸张阅读主题', 'ペーパー読書テーマを使う'\]/);
});

test('Round 8 dark reader projects source-viewer tokens through generated lesson and activity surfaces', () => {
  for (const [name, value] of [
    ['--ks-reader-bg', '#17181a'],
    ['--ks-reader-surface', '#202124'],
    ['--ks-reader-border', '#3c4043'],
    ['--ks-reader-text', '#e8eaed'],
    ['--ks-reader-link', '#8ab4f8'],
  ]) {
    assert.ok(lessonTheme.includes(`${name}: ${value}`), `missing reader token ${name}`);
  }
  assert.match(workspace, /\.course-panel\.reader-dark \.course-stage\s*\{\s*background:\s*#17181a/);
  assert.match(activity, /html\.ks-reader-dark \.kimi-activity\s*\{[\s\S]*background:\s*var\(--ks-reader-surface\)/);
  assert.match(activity, /html\.ks-reader-dark \.kimi-activity__option/);
  assert.match(activity, /html\.ks-reader-dark \.kimi-activity__feedback\[data-state="passed"\]/);
  assert.match(activity, /html\.ks-reader-dark \.kimi-activity-error/);
});

test('Round 8 scroll handlers use cancellable requestAnimationFrame throttles', () => {
  assert.match(contextual, /let scrollFrame = 0/);
  assert.match(contextual, /scrollFrame = window\.requestAnimationFrame/);
  assert.match(contextual, /window\.cancelAnimationFrame\(scrollFrame\)/);
  assert.match(marginNotes, /this\.scrollFrame = 0/);
  assert.match(marginNotes, /this\.scrollFrame = window\.requestAnimationFrame/);
  assert.match(marginNotes, /window\.cancelAnimationFrame\(this\.scrollFrame\)/);
});
