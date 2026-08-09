'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { evaluateProjectPromotion } = require('../lib/company/project-promotion-policy');

test('one lightweight Work never becomes Project-eligible solely because it has an Artifact', () => {
  const decision = evaluateProjectPromotion({
    anchorWorkId: 'work_coffee_once',
    relatedWorkIds: [],
    artifactReferenceCount: 3,
    persistentObjective: false,
    frontier: null,
    multiStage: false,
    longRunning: false,
  });

  assert.equal(decision.decision, 'stay-work');
  assert.equal(decision.projectAction, 'none');
  assert.equal(decision.reversible, true);
  assert.deepEqual(decision.workIds, ['work_coffee_once']);
  assert.equal(decision.reasonCodes.includes('artifact-reuse-present'), true);
  assert.equal(decision.reasonCodes.includes('single-lightweight-work'), true);
  assert.equal(decision.reasonCodes.includes('no-persistent-objective'), true);
  assert.equal(decision.reasonCodes.includes('no-unresolved-frontier'), true);
});

test('repeated Related Work with a persistent objective and unresolved frontier becomes eligible but is not auto-promoted', () => {
  const decision = evaluateProjectPromotion({
    anchorWorkId: 'work_coffee_followup',
    relatedWorkIds: ['work_coffee_prior'],
    artifactReferenceCount: 1,
    persistentObjective: true,
    frontier: 'Choose beans and a brewing routine to continue learning coffee.',
  });

  assert.equal(decision.decision, 'eligible');
  assert.equal(decision.projectAction, 'propose');
  assert.equal(decision.reversible, true);
  assert.deepEqual(decision.workIds, ['work_coffee_followup', 'work_coffee_prior']);
  assert.equal(decision.signals.relatedWorkCount, 1);
  assert.equal(decision.signals.persistentObjective, true);
  assert.equal(decision.signals.frontierPresent, true);
  assert.equal(decision.reasonCodes.includes('repeated-related-work'), true);
  assert.equal(decision.reasonCodes.includes('persistent-objective'), true);
  assert.equal(decision.reasonCodes.includes('unresolved-frontier'), true);
  assert.deepEqual(decision.preserves, { workIds: true, artifactIds: true });
});

test('frontier or repeated Work alone is insufficient without a persistent objective', () => {
  const noObjective = evaluateProjectPromotion({
    anchorWorkId: 'work_a',
    relatedWorkIds: ['work_b', 'work_c'],
    persistentObjective: false,
    frontier: 'There is still something to do.',
  });
  assert.equal(noObjective.decision, 'stay-work');
  assert.equal(noObjective.reasonCodes.includes('no-persistent-objective'), true);

  const noFrontier = evaluateProjectPromotion({
    anchorWorkId: 'work_a',
    relatedWorkIds: ['work_b'],
    persistentObjective: true,
    frontier: '   ',
  });
  assert.equal(noFrontier.decision, 'stay-work');
  assert.equal(noFrontier.reasonCodes.includes('no-unresolved-frontier'), true);
});

test('one genuinely multi-stage Website Work may become eligible independently from whichever Skills executed it', () => {
  const decision = evaluateProjectPromotion({
    anchorWorkId: 'work_website_build',
    relatedWorkIds: [],
    persistentObjective: true,
    frontier: 'Complete deployment, launch review, and post-launch fixes.',
    multiStage: true,
    skillIds: ['gstack:office-hours', 'matt:implement', 'gstack:qa'],
  });

  assert.equal(decision.decision, 'eligible');
  assert.equal(decision.projectAction, 'propose');
  assert.equal(decision.reasonCodes.includes('multi-stage-work'), true);
  assert.equal(Object.hasOwn(decision, 'skillIds'), false);
  assert.equal(JSON.stringify(decision).includes('gstack:'), false);
});

test('explicit ongoing intent can establish persistent objective but still requires a real frontier and continuity signal', () => {
  const eligible = evaluateProjectPromotion({
    anchorWorkId: 'work_learning_two',
    relatedWorkIds: ['work_learning_one'],
    explicitOngoingIntent: true,
    frontier: 'Continue the learning plan next week.',
  });
  assert.equal(eligible.decision, 'eligible');
  assert.equal(eligible.reasonCodes.includes('explicit-ongoing-intent'), true);

  const stillLightweight = evaluateProjectPromotion({
    anchorWorkId: 'work_one_off',
    relatedWorkIds: [],
    explicitOngoingIntent: true,
    frontier: 'Maybe revisit this later.',
    multiStage: false,
    longRunning: false,
  });
  assert.equal(stillLightweight.decision, 'stay-work');
  assert.equal(stillLightweight.reasonCodes.includes('single-lightweight-work'), true);
});
