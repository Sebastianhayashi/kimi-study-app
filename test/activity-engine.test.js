'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  validateLessonSpec,
  scoreActivity,
  computeClaimProgress,
  toPublicLessonSpec,
} = require('../lib/activity-engine');

function fixture() {
  return {
    schemaVersion: 1,
    lessonId: '0001-example',
    claims: [{
      id: 'claim-1',
      label: '能识别并应用原则',
      sourceRefs: ['source:book#1'],
      mastery: { requiredPassed: 2, requiredStages: ['independent'] },
    }],
    activities: [
      {
        id: 'q1', type: 'single-choice', claimId: 'claim-1', stage: 'guided', prompt: '选择正确项',
        options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B', misconceptionId: 'm1' }],
        correctOptionId: 'a',
        misconceptions: [{ id: 'm1', feedback: '你混淆了相邻概念。' }],
        feedback: { correct: '正确', incorrect: '不正确' }, hints: [], sourceRefs: ['source:book#1'],
      },
      {
        id: 'q2', type: 'fill-blank', claimId: 'claim-1', stage: 'independent', prompt: '填空',
        acceptedAnswers: ['Class'], feedback: { correct: '正确', incorrect: '不正确' }, hints: [], sourceRefs: ['source:book#1'],
      },
    ],
  };
}

test('validates supported lesson specs', () => {
  assert.deepEqual(validateLessonSpec(fixture()), { ok: true, errors: [] });
  const invalid = fixture();
  invalid.activities[0].sourceRefs = [];
  assert.equal(validateLessonSpec(invalid).ok, false);
});

test('scores misconceptions and normalized blanks', () => {
  const spec = fixture();
  assert.deepEqual(scoreActivity(spec.activities[0], 'b'), {
    passed: false,
    correct: false,
    feedback: '你混淆了相邻概念。',
    misconceptionId: 'm1',
  });
  assert.equal(scoreActivity(spec.activities[1], '  class  ').passed, true);
});

test('computes claim mastery from the latest activity attempts', () => {
  const spec = fixture();
  const mastery = computeClaimProgress(spec, [
    { activityId: 'q1', attemptNumber: 1, passed: true },
    { activityId: 'q2', attemptNumber: 1, passed: false },
    { activityId: 'q2', attemptNumber: 2, passed: true },
  ]);
  assert.equal(mastery['claim-1'].mastered, true);
  assert.equal(mastery['claim-1'].passed, 2);
});

test('does not expose answer keys to the browser', () => {
  const publicSpec = toPublicLessonSpec(fixture());
  assert.equal(publicSpec.activities[0].correctOptionId, undefined);
  assert.equal(publicSpec.activities[1].acceptedAnswers, undefined);
  assert.deepEqual(publicSpec.activities[0].options, [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }]);
});
