'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  buildNextLessonPrompt,
  captureNextLessonBaseline,
  createGeneratorSessionState,
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
  const prompt = buildNextLessonPrompt(root, baseline);

  assert.match(prompt, /只允许新增两个文件/);
  assert.match(prompt, /0002-/);
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

  assert.deepEqual(createGeneratorSessionState('course1', 'fixed'), {
    schemaVersion: 1,
    sessionId: 'kimi-study-course1-generator-fixed',
    initialized: false,
    preferredMode: 'stream-json',
  });
});
