'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('right Tutor is preserved while notes use the lesson panel and global notebook', () => {
  const notes = read('public/course-notes-index.js');
  const marginNotes = read('public/margin-notes.js');
  const server = read('server.js');
  const scratch = read('public/study-surface.js');
  const index = read('public/index.html');
  const landingCss = read('public/landing.css');
  const landingScroll = read('public/landing-scroll.js');
  const glue = read('public/glue.js');
  const i18n = read('public/i18n.js');
  const marginCss = read('public/margin-notes.css');
  assert.match(notes, /type: 'focus-note'/);
  assert.match(marginNotes, /className = 'kn-notes-panel'/);
  assert.match(marginNotes, /this\.layout\.addCard\(card\.el\)/);
  assert.match(server, /app\.get\('\/notes'/);
  assert.doesNotMatch(notes, /tabs\.appendChild\(tab\)/);
  assert.match(scratch, /course-stage/);
  assert.doesNotMatch(notes + marginNotes + scratch, /replaceChildren\([^)]*assistantPanel/);

  assert.match(index, /class="hero-title-line hero-title-accent"/);
  assert.doesNotMatch(index, /class="[^"]*(?:appbar-avatar|landing-avatar)/);
  assert.match(index, /src="\/vendor\/lenis\/lenis\.min\.js"/);
  assert.match(index, /src="\/landing-scroll\.js"/);
  assert.doesNotMatch(index + landingCss, /live-dot/);
  assert.match(index, /class="library-preview"/);
  assert.doesNotMatch(index, /course-library\.webp/);
  assert.doesNotMatch(index, /class="step-number"/);
  assert.doesNotMatch(index, />0[1-4] · /);
  assert.doesNotMatch(landingCss, /story-step-course[\s\S]{0,180}background:\s*#0b57d0/);
  assert.match(i18n, /if \(rootNode\.matches\?\.\('textarea'\)\) return/);
  assert.match(i18n, /Shopping mall floor tile example/);
  assert.match(i18n, /Remove quote/);
  assert.match(scratch, /\? '收起学习草稿' : '展开学习草稿'/);
  assert.doesNotMatch(scratch, /缩小学习草稿/);
  assert.match(landingCss, /\.hero-title-line[\s\S]*white-space:\s*nowrap/);
  assert.match(landingScroll, /prefers-reduced-motion:\s*reduce/);
  assert.match(landingScroll, /landing-native-scroll/);
  assert.doesNotMatch(landingScroll, /new window\.Lenis/);
  assert.doesNotMatch(landingScroll, /window\.scrollTo\s*=/);
  assert.match(glue, /function stripLessonNumberPrefix/);
  assert.match(glue, /function formatLessonLabel/);
  assert.doesNotMatch(glue, /Lesson \$\{lessonIndex \+ 1\} · \$\{title\}/);
  assert.match(marginNotes, /Core\.chooseRailMode/);
  assert.match(marginNotes, /syncContentReservation\(reserveRight && !this\.collapsed/);
  assert.match(marginCss, /\.kn-content-reserved/);
  assert.ok(i18n.indexOf("['Note', '笔记', 'ノート']") < i18n.indexOf("['Notes', '笔记', 'ノート']"));
});

test('contextual menu is selection-driven, capped, and keeps stable action nodes', () => {
  const client = read('public/contextual-actions.js');
  const router = read('lib/learning-action-router.js');
  assert.match(client, /window\.getSelection/);
  assert.match(client, /learning-actions/);
  assert.match(router, /slice\(0, 3\)/);
  assert.match(client, /Array\.from\(\{ length: 3 \}/);
  assert.match(client, /pointerdown/);
  assert.match(client, /pendingRender/);
  assert.doesNotMatch(client, /toolbar\.replaceChildren/);
  assert.doesNotMatch(client, /toolbar\.innerHTML/);
});

test('curiosity is inline and optional, not a replacement panel', () => {
  const runtime = read('public/curiosity-runtime.js');
  assert.match(runtime, /insertAdjacentElement\('afterend'/);
  assert.match(runtime, /cards: \[\]/);
  assert.doesNotMatch(runtime, /assistantPanel/);
});


test('scratch persistence binds immutable lesson snapshots and surfaces save failures', () => {
  const scratch = read('public/study-surface.js');
  const server = read('server.js');
  assert.match(scratch, /pendingSave/);
  assert.match(scratch, /lessonFile: file/);
  assert.match(scratch, /flushPendingSave/);
  assert.match(scratch, /if \(!response\.ok\)/);
  assert.match(scratch, /data-action="retry-save"/);
  assert.match(server, /express\.json\(\{ limit: '1mb' \}\)/);
  assert.match(server, /inspectStudySurfaceState\(req\.body\)/);
  assert.match(server, /STUDY_SURFACE_TOO_LARGE/);
});
