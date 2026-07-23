'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('right Tutor is preserved and notes live in the left rail', () => {
  const notes = read('public/course-notes-index.js');
  const scratch = read('public/study-surface.js');
  assert.match(notes, /tabs\.appendChild\(tab\)/);
  assert.match(notes, /tab\.textContent = '笔记'/);
  assert.match(scratch, /course-stage/);
  assert.doesNotMatch(notes + scratch, /replaceChildren\([^)]*assistantPanel/);
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
