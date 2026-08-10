'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { compileProjectContinuationContext } = require('../lib/company/project-context');
const { evaluateProjectPromotion } = require('../lib/company/project-promotion-policy');
const { createProjectStore } = require('../lib/company/project-store');
const { createWorkContextProjectPromotionService } = require('../lib/company/work-context-project-promotion');
const { createWorkStore } = require('../lib/company/work-store');

function tempRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lucubro-project-memory-v1-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

test('non-repository Project Memory survives restart with stable Frontier identity', (t) => {
  const root = tempRoot(t);
  let store = createProjectStore({ rootDir: root, now: () => '2026-08-10T09:00:00.000Z' });
  store.create({
    id: 'project_home_refresh',
    name: 'Home refresh',
    kind: 'work-context',
    repoDir: null,
    isGitRepository: false,
    sources: [],
    memory: {
      objective: 'Make the home easier to live in while improving visual calm.',
      report: {
        title: 'Home refresh report',
        summary: 'Keep the current sofa and improve it before replacing large furniture.',
        changed: 'A Taobao sofa-cover candidate is now the leading reversible option.',
        nextAction: 'Measure the three sofa segments against the seller size chart.',
      },
      facts: [
        { id: 'fact_sofa_shape', text: 'The living-room sofa is a large red modular chaise sofa.' },
      ],
      preferences: [
        { id: 'preference_reversible', text: 'Prefer low-cost reversible interventions before replacing large furniture.' },
      ],
      decisions: [],
      frontiers: [
        {
          id: 'frontier_sofa',
          title: 'Sofa visual refresh',
          status: 'active',
          summary: 'Validate a segment-level full-cover slipcover rather than replacing the sofa.',
          nextAction: 'Measure each major segment and verify tuck depth.',
        },
      ],
    },
  });

  store = createProjectStore({ rootDir: root });
  const restored = store.get('project_home_refresh');

  assert.equal(restored.repoDir, null);
  assert.equal(restored.kind, 'work-context');
  assert.equal(restored.memory.objective, 'Make the home easier to live in while improving visual calm.');
  assert.equal(restored.memory.frontiers.length, 1);
  assert.equal(restored.memory.frontiers[0].id, 'frontier_sofa');
  assert.equal(restored.memory.report.nextAction, 'Measure the three sofa segments against the seller size chart.');
});

test('non-repository Project continuation compiles from Project Memory without fake filesystem sources', () => {
  const project = {
    id: 'project_board_research',
    name: 'Japan energy board memo',
    kind: 'work-context',
    repoDir: null,
    isGitRepository: false,
    sources: [],
    memory: {
      objective: 'Maintain an evidence-backed board view of Japan energy policy.',
      report: {
        title: 'Board memo',
        summary: 'Current synthesis remains provisional while the latest policy source is reviewed.',
        changed: 'Added a new source requiring validation.',
        nextAction: 'Validate the source and update the policy-risk frontier.',
      },
      facts: [{ id: 'fact_scope', text: 'The memo is for a board audience.' }],
      preferences: [],
      decisions: [{ id: 'decision_tone', text: 'Keep the memo decision-oriented rather than encyclopedic.' }],
      frontiers: [{
        id: 'frontier_policy_risk',
        title: 'Policy-risk synthesis',
        status: 'active',
        summary: 'Reconcile the new policy source with the current risk section.',
        nextAction: 'Verify the source provenance.',
      }],
    },
  };

  const context = compileProjectContinuationContext({
    project,
    objective: 'Assess a newly supplied source.',
    currentSources: [],
    checkpoint: null,
    reconciliation: { status: 'current', changed: [], missing: [], added: [] },
    delegationEnvelope: { allow: ['workspace.read'], deny: ['external.publish'] },
  });

  assert.match(context.text, /Japan energy board memo/);
  assert.match(context.text, /Maintain an evidence-backed board view/);
  assert.match(context.text, /Policy-risk synthesis/);
  assert.match(context.text, /Verify the source provenance/);
  assert.deepEqual(context.includedSources, []);
});

test('work-context Project promotion seeds durable memory from the persistent objective and frontier', (t) => {
  const root = tempRoot(t);
  const workStore = createWorkStore({ rootDir: root, now: () => '2026-08-10T09:10:00.000Z' });
  const projectStore = createProjectStore({ rootDir: root, now: () => '2026-08-10T09:10:00.000Z' });
  const work = workStore.create({
    id: 'work_home_refresh',
    brief: 'Help me keep improving the house over time.',
    projectId: null,
    assignedEmployeeId: 'ben',
    status: 'accepted',
    runtime: 'mock',
  });
  const policy = evaluateProjectPromotion({
    anchorWorkId: work.id,
    persistentObjective: true,
    frontier: 'Keep resolving the highest-ROI home problems as new photos and products arrive.',
    multiStage: true,
  });
  const promotions = createWorkContextProjectPromotionService({
    workStore,
    projectStore,
    createProjectId: () => 'project_home_refresh',
  });

  const applied = promotions.apply({ name: 'Home refresh', policyDecision: policy });

  assert.equal(applied.project.memory.objective, work.brief);
  assert.equal(applied.project.memory.frontiers.length, 1);
  assert.equal(applied.project.memory.frontiers[0].id, 'frontier_primary');
  assert.equal(
    applied.project.memory.frontiers[0].summary,
    'Keep resolving the highest-ROI home problems as new photos and products arrive.',
  );
  assert.deepEqual(applied.project.memory.sourceWorkIds, [work.id]);
});
