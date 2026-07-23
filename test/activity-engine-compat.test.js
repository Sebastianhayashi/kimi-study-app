'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeLessonSpecShape, validateLessonSpec } = require('../lib/activity-engine');

function validClaim(id = 'claim-1') {
  return { id, label: '能解释核心概念', sourceRefs: ['chapter-1'], mastery: { requiredPassed: 1 } };
}

function validActivity(id = 'activity-1', claimId = 'claim-1') {
  return {
    id,
    type: 'single-choice',
    claimId,
    stage: 'guided',
    prompt: '哪个解释更准确？',
    sourceRefs: ['chapter-1'],
    feedback: { correct: '正确', incorrect: '再看一次材料' },
    hints: [],
    options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
    correctOptionId: 'a',
  };
}

test('normalizes keyed claim and activity maps without changing scoring fields', () => {
  const raw = {
    schemaVersion: 1,
    lessonId: 'lesson-1',
    claims: { 'claim-1': { ...validClaim(), id: undefined } },
    activities: { 'activity-1': { ...validActivity(), id: undefined } },
  };
  const normalized = normalizeLessonSpecShape(raw);
  assert.equal(Array.isArray(normalized.claims), true);
  assert.equal(Array.isArray(normalized.activities), true);
  assert.equal(normalized.claims[0].id, 'claim-1');
  assert.equal(normalized.activities[0].id, 'activity-1');
  assert.equal(normalized.activities[0].correctOptionId, 'a');
  assert.deepEqual(validateLessonSpec(normalized), { ok: true, errors: [] });
});

test('malformed collection shapes return validation errors instead of throwing', () => {
  assert.doesNotThrow(() => validateLessonSpec({ schemaVersion: 1, lessonId: 'lesson-1', claims: 'bad', activities: 42 }));
  const result = validateLessonSpec({ schemaVersion: 1, lessonId: 'lesson-1', claims: 'bad', activities: 42 });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /claims must be a non-empty array/);
  assert.match(result.errors.join('\n'), /activities must be a non-empty array/);
});
