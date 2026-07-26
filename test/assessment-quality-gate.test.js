'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { auditAssessmentQuality } = require('../lib/assessment-quality-gate');

function assessment(overrides = {}) {
  return {
    claims: [{
      id: 'claim-1',
      label: '能诊断关键限制',
      description: '帮助用户修订方案中的关键判断，并形成可提交的决策说明。',
      mastery: { requiredPassed: 2, requiredStages: ['independent', 'transfer'] },
    }],
    activities: [
      {
        id: 'hinge-1', claimId: 'claim-1', type: 'single-choice', stage: 'independent', prompt: '在一个新的例子中，哪项解释最符合本课机制？',
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
      { id: 'transfer-1', claimId: 'claim-1', type: 'short-answer', stage: 'transfer', prompt: '修订你的方案片段并解释关键判断。', scoring: { mode: 'completion', minimumLength: 40 } },
    ],
    ...overrides,
  };
}

test('diagnostic hinge plus transfer evidence passes', () => {
  const result = auditAssessmentQuality(assessment());
  assert.equal(result.ok, true, result.blockers.join('\n'));
});

test('object-shaped collections are normalized before the quality gate', () => {
  const spec = assessment();
  spec.claims = { 'claim-1': spec.claims[0] };
  spec.activities = { hinge: spec.activities[0], transfer: spec.activities[1] };
  spec.activities.hinge.options = Object.fromEntries(spec.activities.hinge.options.map((item) => [item.id, item]));
  spec.activities.hinge.misconceptions = Object.fromEntries(spec.activities.hinge.misconceptions.map((item) => [item.id, item]));
  const result = auditAssessmentQuality(spec);
  assert.equal(result.ok, true, result.blockers.join('\n'));
});

test('random distractors are blocked', () => {
  const spec = assessment();
  delete spec.activities[0].options[1].misconceptionId;
  const result = auditAssessmentQuality(spec);
  assert.equal(result.ok, false);
  assert.match(result.blockers.join('\n'), /misconceptionId/);
});

test('a three-option hinge is blocked', () => {
  const spec = assessment();
  spec.activities[0].options.pop();
  const result = auditAssessmentQuality(spec);
  assert.equal(result.ok, false);
  assert.match(result.blockers.join('\n'), /exactly 4 options/);
});

test('an assessment without the hinge question is blocked', () => {
  const spec = assessment();
  spec.activities = [spec.activities[1]];
  const result = auditAssessmentQuality(spec);
  assert.equal(result.ok, false);
  assert.match(result.blockers.join('\n'), /independent single-choice hinge question/);
});

test('an assessment without transfer evidence is blocked', () => {
  const spec = assessment();
  spec.activities = [spec.activities[0]];
  const result = auditAssessmentQuality(spec);
  assert.equal(result.ok, false);
  assert.match(result.blockers.join('\n'), /transfer short-answer/);
});

test('transfer explanations shorter than 40 characters are blocked', () => {
  const spec = assessment();
  spec.activities[1].scoring.minimumLength = 20;
  const result = auditAssessmentQuality(spec);
  assert.equal(result.ok, false);
  assert.match(result.blockers.join('\n'), /minimumLength must be at least 40/);
});

test('claim mastery must require both independent and transfer evidence', () => {
  const spec = assessment();
  spec.claims[0].mastery = { requiredPassed: 1, requiredStages: ['independent'] };
  const result = auditAssessmentQuality(spec);
  assert.equal(result.ok, false);
  assert.match(result.blockers.join('\n'), /require transfer evidence/);
  assert.match(result.blockers.join('\n'), /requiredPassed must be at least 2/);
});

test('Mission alignment checks are warnings and never semantic blockers', () => {
  const spec = assessment();
  spec.claims[0].description = spec.claims[0].label;
  spec.activities[1].prompt = '把概念用到一个新情境，并写满要求字数。';
  const result = auditAssessmentQuality(spec);
  assert.equal(result.ok, true, result.blockers.join('\n'));
  assert.match(result.warnings.join('\n'), /claim\.description only repeats/);
  assert.match(result.warnings.join('\n'), /transfer does not visibly advance/);
});

test('feedback response checks remain observable warnings', () => {
  const faster = auditAssessmentQuality(assessment(), { latestFeedback: { signal: 'faster' }, curiosityPresent: true });
  assert.equal(faster.ok, true);
  assert.match(faster.warnings.join('\n'), /faster feedback/);

  const deeperSpec = assessment();
  deeperSpec.activities[1].prompt = '修订你的方案片段并解释判断。';
  const deeper = auditAssessmentQuality(deeperSpec, { latestFeedback: { signal: 'deeper' } });
  assert.equal(deeper.ok, true);
  assert.match(deeper.warnings.join('\n'), /deeper transfer stricter/);

  const skipped = auditAssessmentQuality(assessment(), {
    latestFeedback: { signal: 'skip_irrelevant' },
    repeatsSkippedNeighborhood: true,
  });
  assert.equal(skipped.ok, true);
  assert.match(skipped.warnings.join('\n'), /same claim or source neighborhood/);
});
