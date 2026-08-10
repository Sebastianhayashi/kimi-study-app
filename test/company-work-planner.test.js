'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createWorkPlanner } = require('../lib/company/work-planner');

function skill(id, description, {
  triggers = [],
  allowedTools = [],
  invocationMode = 'model-or-user',
} = {}) {
  const [bundleId, name] = id.split(':');
  return {
    id,
    bundleId,
    bundleCommit: bundleId === 'gstack' ? '94993f74012782fd94416dd44b8314f6363a13a4' : '84fdeffd12f2ee307994d1eb6feb48173b6e0502',
    name,
    description,
    version: null,
    triggers,
    allowedTools,
    invocationPolicy: {
      mode: invocationMode,
      skillFrontmatterAllowsImplicit: invocationMode !== 'user-only',
      codexPolicyAllowsImplicit: invocationMode === 'user-only' ? false : null,
    },
    skillPath: `${name}/SKILL.md`,
    contentHash: `sha256:${name.padEnd(64, '0').slice(0, 64)}`,
  };
}

function harness(plannerImpl) {
  const skills = [
    skill('matt:research', 'Investigate a question against high-trust primary sources.'),
    skill('matt:teach', 'Teach the user a new skill or concept.', { invocationMode: 'user-only' }),
    skill('matt:implement', 'Implement a planned change.'),
    skill('matt:to-spec', 'Turn a clarified engineering request into a specification.'),
    skill('gstack:office-hours', 'YC Office Hours.', { triggers: ['brainstorm this', 'is this worth building'] }),
    skill('gstack:design-review', 'Review a product interface and design.'),
    skill('gstack:review', 'Review implementation quality.'),
    skill('gstack:qa', 'Run product QA in a browser.'),
  ];
  const byId = new Map(skills.map((entry) => [entry.id, entry]));
  const catalog = {
    list() { return skills.map((entry) => structuredClone(entry)); },
    get(id) { return byId.has(id) ? structuredClone(byId.get(id)) : null; },
  };
  const compatibility = {
    resolve(metadata) {
      return {
        host: 'codex',
        skillId: metadata.id,
        bundleId: metadata.bundleId,
        bundleCommit: metadata.bundleCommit,
        status: metadata.id === 'gstack:office-hours' ? 'overlay-required' : 'native',
        overlay: metadata.id === 'gstack:office-hours' ? { id: 'question-bridge', version: 1 } : null,
        reason: null,
      };
    },
  };
  const dependencyResolver = {
    resolve(selectedSkillIds) {
      return {
        skillIds: [...selectedSkillIds],
        files: selectedSkillIds.map((id) => `${id.replace(':', '/')}/SKILL.md`),
        skillRoots: selectedSkillIds.map((id) => id.replace(':', '/')),
        diagnostics: [],
      };
    },
  };
  return createWorkPlanner({
    catalog,
    compatibility,
    dependencyResolver,
    planner: { plan: plannerImpl },
  });
}

test('Coffee planning sees the full catalog and may use research plus user-intent-triggered teach without bespoke Coffee skills', async () => {
  const intent = 'I am a beginner. Teach me what light, medium, and dark coffee roasts mean and how I should buy coffee.';
  const planner = harness(async ({ intent: receivedIntent, skills }) => {
    assert.equal(receivedIntent, intent);
    assert.equal(skills.length, 8);
    assert.ok(skills.some((entry) => entry.id === 'gstack:office-hours'));
    assert.ok(skills.every((entry) => !Object.hasOwn(entry, 'body')));
    return {
      complexity: 'compound',
      durability: 'saved-work',
      projectAction: 'none',
      issueAction: 'none',
      skillSelections: [
        { skillId: 'matt:research', activation: 'model' },
        { skillId: 'matt:teach', activation: 'user-intent', userIntentEvidence: 'Teach me' },
      ],
      staffing: {
        manager: true,
        specialistSubruns: [{ role: 'research', skillIds: ['matt:research'] }],
      },
      evidenceRequired: true,
      deliverable: 'canvas-artifact',
    };
  });

  const plan = await planner.plan({ intent });

  assert.deepEqual(plan.skillSelections.map((selection) => selection.skillId), ['matt:research', 'matt:teach']);
  assert.equal(plan.skillGraph.skillIds.includes('matt:research'), true);
  assert.equal(plan.skillGraph.skillIds.includes('matt:teach'), true);
  assert.equal(plan.projectAction, 'none');
  assert.equal(plan.issueAction, 'none');
  assert.equal(plan.durability, 'saved-work');
  assert.equal(plan.deliverable, 'canvas-artifact');
  assert.equal(plan.skillSelections.some((selection) => /coffee/i.test(selection.skillId)), false);
});

test('Website planning reuses the same full catalog and composes existing discovery/spec/design/implementation/review/QA skills', async () => {
  const intent = 'Help me figure out whether this product website is worth building, design it, implement it, and verify it works.';
  const planner = harness(async ({ skills }) => {
    assert.equal(skills.length, 8);
    return {
      complexity: 'complex',
      durability: 'saved-work',
      projectAction: 'consider-after-frontier',
      issueAction: 'none',
      skillSelections: [
        { skillId: 'gstack:office-hours', activation: 'model' },
        { skillId: 'matt:to-spec', activation: 'model' },
        { skillId: 'gstack:design-review', activation: 'model' },
        { skillId: 'matt:implement', activation: 'model' },
        { skillId: 'gstack:review', activation: 'model' },
        { skillId: 'gstack:qa', activation: 'model' },
      ],
      staffing: { manager: true, specialistSubruns: [] },
      evidenceRequired: true,
      deliverable: 'canvas-artifact',
    };
  });

  const plan = await planner.plan({ intent });

  assert.deepEqual(plan.skillSelections.map((selection) => selection.skillId), [
    'gstack:office-hours',
    'matt:to-spec',
    'gstack:design-review',
    'matt:implement',
    'gstack:review',
    'gstack:qa',
  ]);
  assert.equal(plan.skillSelections.some((selection) => /website/i.test(selection.skillId)), false);
});

test('model activation cannot select a user-only upstream Skill', async () => {
  const planner = harness(async () => ({
    complexity: 'simple',
    durability: 'saved-work',
    projectAction: 'none',
    issueAction: 'none',
    skillSelections: [{ skillId: 'matt:teach', activation: 'model' }],
    staffing: { manager: true, specialistSubruns: [] },
    evidenceRequired: false,
    deliverable: 'canvas-artifact',
  }));

  await assert.rejects(
    planner.plan({ intent: 'Explain coffee roasting.' }),
    /user-only Skill cannot be model-activated: matt:teach/,
  );
});

test('user-intent activation requires evidence copied from the current user intent', async () => {
  const planner = harness(async () => ({
    complexity: 'simple',
    durability: 'saved-work',
    projectAction: 'none',
    issueAction: 'none',
    skillSelections: [{ skillId: 'matt:teach', activation: 'user-intent', userIntentEvidence: 'please teach me' }],
    staffing: { manager: true, specialistSubruns: [] },
    evidenceRequired: false,
    deliverable: 'canvas-artifact',
  }));

  await assert.rejects(
    planner.plan({ intent: 'Explain coffee roasting.' }),
    /userIntentEvidence must be an exact substring of the current user intent/,
  );
});

test('planner proposal cannot fabricate runtime attestation or mounted Skill evidence', async () => {
  const planner = harness(async () => ({
    complexity: 'simple',
    durability: 'saved-work',
    projectAction: 'none',
    issueAction: 'none',
    skillSelections: [{ skillId: 'matt:research', activation: 'model' }],
    staffing: { manager: true, specialistSubruns: [] },
    evidenceRequired: true,
    deliverable: 'canvas-artifact',
    mountedSkillIds: ['matt:research'],
    runtimeAttestation: { admitted: true },
  }));

  await assert.rejects(
    planner.plan({ intent: 'Research coffee.' }),
    /Planner proposal cannot contain runtime or mount attestation/,
  );
});
