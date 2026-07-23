'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { auditAssessmentQuality } = require('../lib/assessment-quality-gate');

function assessment(overrides = {}) {
  return {
    activities: [
      {
        id: 'hinge-1', type: 'single-choice', stage: 'independent', prompt: '在一个新的例子中，哪项解释最符合本课机制？',
        options: [
          { id: 'a', label: '它改变了关键限制，因此产生新的动作空间' },
          { id: 'b', label: '它只是增加奖励，所以体验一定更好', misconceptionId: 'reward' },
          { id: 'c', label: '它消除了全部规则，所以参与更自由', misconceptionId: 'no-rules' },
          { id: 'd', label: '它只改变情绪，所以机制本身没有变化', misconceptionId: 'mood' },
        ],
        correctOptionId: 'a',
        misconceptions: [
          { id: 'reward' }, { id: 'no-rules' }, { id: 'mood' },
        ],
      },
      { id: 'transfer-1', type: 'short-answer', stage: 'transfer', scoring: { mode: 'completion', minimumLength: 40 } },
    ],
    ...overrides,
  };
}

test('diagnostic hinge plus transfer evidence passes', () => {
  const result = auditAssessmentQuality(assessment());
  assert.equal(result.ok, true, result.blockers.join('\n'));
});

test('random distractors are blocked', () => {
  const spec = assessment();
  delete spec.activities[0].options[1].misconceptionId;
  const result = auditAssessmentQuality(spec);
  assert.equal(result.ok, false);
  assert.match(result.blockers.join('\n'), /misconceptionId/);
});
