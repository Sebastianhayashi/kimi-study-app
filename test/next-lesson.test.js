'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  buildNextLessonPrompt,
  clearNextLessonTransaction,
  captureNextLessonBaseline,
  createGeneratorSessionState,
  generatorSessionIdForRun,
  isStaleGenerationJob,
  normalizeGeneratorSessionState,
  readNextLessonTransaction,
  recoverInterruptedNextLesson,
  writeNextLessonTransaction,
  withTeachSkill,
} = require('../lib/next-lesson');

function fixtureCourse() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kimi-next-lesson-'));
  fs.mkdirSync(path.join(root, 'lessons'));
  fs.mkdirSync(path.join(root, 'assessments'));
  fs.mkdirSync(path.join(root, 'learning-progress'));
  fs.writeFileSync(path.join(root, 'MISSION.md'), '# Mission\n应用到真实场景');
  fs.writeFileSync(path.join(root, 'map.json'), '{"path":["第一课"]}');
  fs.writeFileSync(path.join(root, 'lessons', '0001-intro.html'), '<html>one</html>');
  fs.writeFileSync(path.join(root, 'assessments', '0001-intro.json'), JSON.stringify({
    claims: [{ id: 'claim-1', label: '已掌握目标' }],
    activities: [],
  }));
  fs.writeFileSync(path.join(root, 'learning-progress', '0001-intro.json'), JSON.stringify({
    mastery: { 'claim-1': { claimId: 'claim-1', label: '已掌握目标', mastered: true } },
    attempts: [],
  }));
  fs.writeFileSync(path.join(root, 'notes.json'), JSON.stringify([{
    section: '案例',
    custom: '后续例子优先结合我的增长实验',
    updatedAt: 2,
  }]));
  return root;
}

test('builds a strict incremental prompt with learner context and no course-level regeneration', () => {
  const root = fixtureCourse();
  const baseline = captureNextLessonBaseline(root);
  const prompt = buildNextLessonPrompt(root, baseline, {
    validatorCommand: 'node "/repo/lib/next-lesson-preflight.js"',
  });

  assert.match(prompt, /只允许新增两个文件/);
  assert.match(prompt, /0002-/);
  assert.match(prompt, /assessment\.lessonId 必须逐字等于/);
  assert.match(prompt, /恰好包含 1 个 claim 和 2 个 activities/);
  assert.match(prompt, /"type": "single-choice"/);
  assert.match(prompt, /"type": "short-answer"/);
  assert.match(prompt, /"stage": "independent"/);
  assert.match(prompt, /sourceRefs/);
  assert.match(prompt, /feedback/);
  assert.match(prompt, /hints/);
  assert.match(prompt, /node "\/repo\/lib\/next-lesson-preflight\.js"/);
  assert.match(prompt, /预检成功前结束任务/);
  assert.match(prompt, /不得更新 map\.json/);
  assert.match(prompt, /增长实验/);
  assert.match(prompt, /避免重复已掌握内容/);
  assert.equal(prompt.includes('同时更新 map.json'), false);
});

test('loads the teach skill only on generator-session bootstrap', () => {
  const prompt = 'incremental task';
  assert.match(withTeachSkill(prompt, false), /^\/skill:teach/);
  assert.equal(withTeachSkill(prompt, true), prompt);
});

test('captures immutable baselines and creates a stream-json-first generator session', () => {
  const root = fixtureCourse();
  const baseline = captureNextLessonBaseline(root);
  assert.equal(baseline.lessons.length, 1);
  assert.equal(baseline.assessments.length, 1);
  assert.equal(baseline.expectedLessonNumber, 2);
  assert.match(baseline.protectedFiles['MISSION.md'], /^[0-9a-f]{64}$/);
  assert.match(baseline.protectedFiles['lessons/0001-intro.html'], /^[0-9a-f]{64}$/);

  assert.deepEqual(createGeneratorSessionState(), {
    schemaVersion: 2,
    sessionId: null,
    initialized: false,
    preferredMode: 'stream-json',
  });

  const legacyAlias = normalizeGeneratorSessionState({
    schemaVersion: 1,
    sessionId: 'kimi-study-course1-generator-fixed',
    initialized: false,
    preferredMode: 'stream-json',
  });
  assert.equal(legacyAlias.sessionId, null);
  assert.equal(generatorSessionIdForRun(legacyAlias), null);

  const resumed = normalizeGeneratorSessionState({
    schemaVersion: 1,
    sessionId: 'session_existing123',
    initialized: true,
    preferredMode: 'stream-json',
  });
  assert.equal(generatorSessionIdForRun(resumed), 'session_existing123');
});


test('workspace cleanup preserves runtime data and removes only current-run additions', () => {
  const root = fixtureCourse();
  fs.writeFileSync(path.join(root, 'job.json'), '{"stage":"ready"}');
  const baseline = captureNextLessonBaseline(root);

  assert.equal(Object.prototype.hasOwnProperty.call(baseline.workspaceFiles, 'job.json'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(baseline.workspaceFiles, 'notes.json'), false);
  assert.equal(
    Object.prototype.hasOwnProperty.call(baseline.workspaceFiles, 'learning-progress/0001-intro.json'),
    false,
  );

  fs.writeFileSync(path.join(root, 'job.json'), '{"stage":"generating"}');
  fs.writeFileSync(path.join(root, 'notes.json'), '[{"custom":"new note"}]');
  fs.writeFileSync(path.join(root, 'unexpected.md'), 'remove me');
  fs.writeFileSync(path.join(root, 'lessons', '0002-temp.html'), 'remove me');

  const { removeNewWorkspaceFiles } = require('../lib/next-lesson');
  const removed = removeNewWorkspaceFiles(root, baseline);
  assert.deepEqual(removed, ['lessons/0002-temp.html', 'unexpected.md']);
  assert.equal(fs.existsSync(path.join(root, 'job.json')), true);
  assert.equal(fs.existsSync(path.join(root, 'notes.json')), true);
  assert.equal(fs.existsSync(path.join(root, 'lessons', '0001-intro.html')), true);
});


test('persists a private transaction baseline outside the workspace snapshot', () => {
  const root = fixtureCourse();
  const baseline = captureNextLessonBaseline(root);
  writeNextLessonTransaction(root, baseline);

  assert.deepEqual(readNextLessonTransaction(root).baseline, baseline);
  assert.equal(
    Object.prototype.hasOwnProperty.call(captureNextLessonBaseline(root).workspaceFiles, 'next-lesson-transaction.json'),
    false,
  );
  clearNextLessonTransaction(root);
  assert.equal(readNextLessonTransaction(root), null);
});

test('recovers an interrupted next lesson by removing current-run files and preserving old content', () => {
  const root = fixtureCourse();
  const baseline = captureNextLessonBaseline(root);
  writeNextLessonTransaction(root, baseline);
  fs.writeFileSync(path.join(root, 'lessons', '0002-temp.html'), 'partial');
  fs.writeFileSync(path.join(root, 'assessments', '0002-temp.json'), '{}');
  fs.writeFileSync(path.join(root, 'extra.tmp'), 'partial');

  const recovered = recoverInterruptedNextLesson(root, {
    stage: 'generating',
    kind: 'next-lesson',
    runId: 'run-1',
  }, { now: new Date('2026-07-21T12:00:00.000Z') });

  assert.equal(recovered.stage, 'failed');
  assert.equal(recovered.repairRequired, false);
  assert.deepEqual(recovered.cleanupRemoved, [
    'assessments/0002-temp.json',
    'extra.tmp',
    'lessons/0002-temp.html',
  ]);
  assert.equal(fs.existsSync(path.join(root, 'lessons', '0001-intro.html')), true);
  assert.equal(fs.existsSync(path.join(root, 'assessments', '0001-intro.json')), true);
  assert.equal(readNextLessonTransaction(root), null);
});

test('stale detection is deterministic and missing or changed baselines block retry', () => {
  assert.equal(isStaleGenerationJob(
    { stage: 'generating' },
    { busy: false, mtimeMs: 1_000, now: 62_000, staleAfterMs: 60_000 },
  ), true);
  assert.equal(isStaleGenerationJob(
    { stage: 'generating' },
    { busy: true, mtimeMs: 1_000, now: 62_000, staleAfterMs: 60_000 },
  ), false);

  const missing = fixtureCourse();
  const missingResult = recoverInterruptedNextLesson(missing, {
    stage: 'generating',
    kind: 'next-lesson',
  });
  assert.equal(missingResult.repairRequired, true);
  assert.deepEqual(missingResult.changedExisting, ['next-lesson transaction baseline missing']);

  const changed = fixtureCourse();
  const baseline = captureNextLessonBaseline(changed);
  writeNextLessonTransaction(changed, baseline);
  fs.writeFileSync(path.join(changed, 'map.json'), '{"path":["changed"]}');
  const changedResult = recoverInterruptedNextLesson(changed, {
    stage: 'generating',
    kind: 'next-lesson',
  });
  assert.equal(changedResult.repairRequired, true);
  assert.deepEqual(changedResult.changedExisting, ['map.json']);
});
