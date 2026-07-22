'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  captureNextLessonBaseline,
  writeNextLessonTransaction,
} = require('../lib/next-lesson');
const { preflightNextLesson } = require('../lib/next-lesson-preflight');

function course() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kimi-next-preflight-'));
  fs.mkdirSync(path.join(root, 'lessons'));
  fs.mkdirSync(path.join(root, 'assessments'));
  fs.writeFileSync(path.join(root, 'MISSION.md'), '# Mission\n应用到真实场景');
  fs.writeFileSync(path.join(root, 'lessons', '0001-intro.html'), '<html>one</html>');
  fs.writeFileSync(path.join(root, 'assessments', '0001-intro.json'), '{}');
  const baseline = captureNextLessonBaseline(root);
  writeNextLessonTransaction(root, baseline);
  return root;
}

function validSpec() {
  return {
    schemaVersion: 1,
    lessonId: '0002-apply',
    title: '应用练习',
    claims: [{
      id: 'claim-1',
      label: '能应用核心方法',
      sourceRefs: ['source:book#chapter-2'],
      mastery: { requiredPassed: 1, requiredStages: ['independent'] },
    }],
    activities: [{
      id: 'guided-1',
      type: 'single-choice',
      claimId: 'claim-1',
      stage: 'guided',
      prompt: '哪个例子符合本课方法？',
      options: [{ id: 'a', label: '例子 A' }, { id: 'b', label: '例子 B' }],
      correctOptionId: 'a',
      sourceRefs: ['source:book#chapter-2'],
      feedback: { correct: '正确', incorrect: '再比较一次' },
      hints: [],
    }, {
      id: 'independent-1',
      type: 'short-answer',
      claimId: 'claim-1',
      stage: 'independent',
      prompt: '把方法应用到你的场景。',
      scoring: { mode: 'completion', minimumLength: 12 },
      sourceRefs: ['source:book#chapter-2'],
      feedback: { correct: '已记录', incorrect: '请补充完整' },
      hints: [],
    }],
  };
}

test('preflight accepts the exact low-latency lesson and assessment contract', () => {
  const root = course();
  fs.writeFileSync(
    path.join(root, 'lessons', '0002-apply.html'),
    '<div data-kimi-activity="guided-1"></div><div data-kimi-activity="independent-1"></div>',
  );
  fs.writeFileSync(
    path.join(root, 'assessments', '0002-apply.json'),
    JSON.stringify(validSpec()),
  );

  const result = preflightNextLesson(root);
  assert.equal(result.ok, true);
  assert.equal(result.newLesson, '0002-apply.html');
  assert.equal(result.newAssessment, '0002-apply.json');
});

test('preflight returns actionable schema and publication errors before the model exits', () => {
  const root = course();
  fs.writeFileSync(
    path.join(root, 'lessons', '0002-apply.html'),
    '<div data-kimi-activity="invented-1"></div>',
  );
  fs.writeFileSync(
    path.join(root, 'assessments', '0002-apply.json'),
    JSON.stringify({
      schemaVersion: 1,
      lessonId: 'wrong-id',
      claims: [{ id: 'claim-1', label: '模糊目标' }],
      activities: [{
        id: 'invented-1',
        type: 'ties',
        claimId: 'claim-1',
        stage: 'application',
        prompt: '尝试一下',
      }],
    }),
  );

  const result = preflightNextLesson(root);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('sourceRefs is required')));
  assert.ok(result.errors.some((error) => error.includes('type is unsupported')));
  assert.ok(result.errors.some((error) => error.includes('stage is unsupported')));
  assert.ok(result.errors.some((error) => error.includes('feedback.correct')));
  assert.ok(result.errors.some((error) => error.includes('hints must be an array')));
  assert.ok(result.errors.some((error) => error.includes('assessment.lessonId must equal 0002-apply')));
  assert.ok(result.errors.some((error) => error.includes('no independent, transfer, or exit-ticket')));
});
