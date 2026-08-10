'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createWorkPlanner } = require('../lib/company/work-planner');

function skill(id, description, { invocationMode = 'model-or-user' } = {}) {
  const [bundleId, name] = id.split(':');
  return {
    id,
    bundleId,
    bundleCommit: bundleId === 'gstack'
      ? '94993f74012782fd94416dd44b8314f6363a13a4'
      : '84fdeffd12f2ee307994d1eb6feb48173b6e0502',
    name,
    description,
    version: null,
    triggers: [],
    allowedTools: [],
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
    skill('gstack:office-hours', 'YC Office Hours.'),
    skill('gstack:design-review', 'Review a product interface and design.'),
    skill('gstack:review', 'Review implementation quality.'),
    skill('gstack:qa', 'Run product QA in a browser.'),
  ];
  const byId = new Map(skills.map((entry) => [entry.id, entry]));
  return createWorkPlanner({
    catalog: {
      list() { return skills.map((entry) => structuredClone(entry)); },
      get(id) { return byId.has(id) ? structuredClone(byId.get(id)) : null; },
    },
    compatibility: {
      resolve(metadata) {
        return {
          host: 'codex',
          skillId: metadata.id,
          bundleId: metadata.bundleId,
          bundleCommit: metadata.bundleCommit,
          status: 'native',
          overlay: null,
          reason: null,
        };
      },
    },
    dependencyResolver: {
      resolve(selectedSkillIds) {
        return {
          skillIds: [...selectedSkillIds],
          files: selectedSkillIds.map((id) => `${id.replace(':', '/')}/SKILL.md`),
          skillRoots: selectedSkillIds.map((id) => id.replace(':', '/')),
          diagnostics: [],
        };
      },
    },
    planner: { plan: plannerImpl },
  });
}

test('unrelated board-memo Work reuses the existing catalog and file-deliverable contract without vertical product code', async () => {
  const intent = "Research Japan's electricity generation mix and produce a source-backed one-page board memo at reports/japan-energy.md.";
  const planner = harness(async ({ intent: receivedIntent, skills }) => {
    assert.equal(receivedIntent, intent);
    assert.equal(skills.length, 8);
    assert.ok(skills.some((entry) => entry.id === 'matt:research'));
    assert.ok(skills.every((entry) => !Object.hasOwn(entry, 'body')));

    return {
      complexity: 'compound',
      durability: 'saved-work',
      projectAction: 'none',
      issueAction: 'none',
      skillSelections: [
        { skillId: 'matt:research', activation: 'model' },
      ],
      staffing: {
        manager: true,
        specialistSubruns: [{ role: 'research', skillIds: ['matt:research'] }],
      },
      evidenceRequired: true,
      deliverable: 'canvas-artifact',
      fileDeliverables: [{
        path: 'reports/japan-energy.md',
        label: 'Japan energy board memo',
        mimeType: 'text/markdown',
        userIntentEvidence: 'reports/japan-energy.md',
      }],
      reasonCodes: ['source-backed-research', 'explicit-file-deliverable'],
    };
  });

  const plan = await planner.plan({ intent });

  assert.deepEqual(plan.skillSelections.map((selection) => selection.skillId), ['matt:research']);
  assert.equal(plan.skillSelections.some((selection) => /japan|energy|memo/i.test(selection.skillId)), false);
  assert.equal(plan.projectAction, 'none');
  assert.equal(plan.issueAction, 'none');
  assert.equal(plan.durability, 'saved-work');
  assert.equal(plan.deliverable, 'canvas-artifact');
  assert.equal(plan.evidenceRequired, true);
  assert.deepEqual(plan.fileDeliverables, [{
    path: 'reports/japan-energy.md',
    label: 'Japan energy board memo',
    mimeType: 'text/markdown',
    userIntentEvidence: 'reports/japan-energy.md',
  }]);
  assert.deepEqual(plan.reasonCodes, ['source-backed-research', 'explicit-file-deliverable']);
});
