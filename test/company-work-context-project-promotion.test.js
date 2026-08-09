'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createProjectStore } = require('../lib/company/project-store');
const { evaluateProjectPromotion } = require('../lib/company/project-promotion-policy');
const { createWorkContextProjectPromotionService } = require('../lib/company/work-context-project-promotion');
const { createWorkStore } = require('../lib/company/work-store');

function tempRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lucubro-work-context-project-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

test('multi-stage Website Work can be promoted into durable non-repository Project context without changing Work identity', (t) => {
  const root = tempRoot(t);
  const workStore = createWorkStore({ rootDir: root, now: () => '2026-08-09T13:30:00.000Z' });
  const projectStore = createProjectStore({ rootDir: root, now: () => '2026-08-09T13:30:00.000Z' });
  const work = workStore.create({
    id: 'work_website_growth',
    brief: 'Build and launch the new website.',
    projectId: null,
    assignedEmployeeId: 'ben',
    status: 'in-progress',
    runtime: 'mock',
    plan: {
      skillSelections: [
        { skillId: 'gstack:office-hours' },
        { skillId: 'matt:implement' },
        { skillId: 'gstack:qa' },
      ],
    },
  });
  const policy = evaluateProjectPromotion({
    anchorWorkId: work.id,
    persistentObjective: true,
    frontier: 'Complete launch review and post-launch fixes.',
    multiStage: true,
  });
  const promotions = createWorkContextProjectPromotionService({
    workStore,
    projectStore,
    createProjectId: () => 'project_website_growth',
  });

  const applied = promotions.apply({
    name: 'Website Launch',
    policyDecision: policy,
  });

  assert.equal(applied.project.id, 'project_website_growth');
  assert.equal(applied.project.name, 'Website Launch');
  assert.equal(applied.project.kind, 'work-context');
  assert.equal(applied.project.repoDir, null);
  assert.equal(applied.project.isGitRepository, false);
  assert.deepEqual(applied.project.sources, []);
  assert.deepEqual(applied.workIds, [work.id]);
  assert.equal(workStore.get(work.id).id, work.id);
  assert.equal(workStore.get(work.id).projectId, applied.project.id);
  assert.equal(JSON.stringify(applied.project).includes('gstack:'), false);
  assert.equal(JSON.stringify(applied.project).includes('matt:'), false);
});

test('work-context Project promotion survives restart and Undo restores the original lightweight Work', (t) => {
  const root = tempRoot(t);
  let workStore = createWorkStore({ rootDir: root, now: () => '2026-08-09T13:31:00.000Z' });
  let projectStore = createProjectStore({ rootDir: root, now: () => '2026-08-09T13:31:00.000Z' });
  workStore.create({
    id: 'work_coffee_growth',
    brief: 'Continue the coffee learning plan.',
    projectId: null,
    assignedEmployeeId: 'ben',
    status: 'accepted',
    runtime: 'mock',
  });
  workStore.create({
    id: 'work_coffee_prior_growth',
    brief: 'Learn coffee roast levels.',
    projectId: null,
    assignedEmployeeId: 'ben',
    status: 'accepted',
    runtime: 'mock',
  });
  const policy = evaluateProjectPromotion({
    anchorWorkId: 'work_coffee_growth',
    relatedWorkIds: ['work_coffee_prior_growth'],
    persistentObjective: true,
    frontier: 'Choose beans, brew them, and compare results over time.',
  });
  let promotions = createWorkContextProjectPromotionService({
    workStore,
    projectStore,
    createProjectId: () => 'project_coffee_growth',
  });
  const applied = promotions.apply({ name: 'Coffee Learning', policyDecision: policy });
  assert.deepEqual(applied.workIds, ['work_coffee_growth', 'work_coffee_prior_growth']);

  workStore = createWorkStore({ rootDir: root });
  projectStore = createProjectStore({ rootDir: root });
  promotions = createWorkContextProjectPromotionService({ workStore, projectStore });

  assert.equal(projectStore.get('project_coffee_growth').kind, 'work-context');
  assert.equal(workStore.get('work_coffee_growth').projectId, 'project_coffee_growth');
  assert.equal(workStore.get('work_coffee_prior_growth').projectId, 'project_coffee_growth');

  const undone = promotions.undo({ projectId: 'project_coffee_growth' });
  assert.deepEqual(undone.workIds.sort(), ['work_coffee_growth', 'work_coffee_prior_growth']);
  assert.equal(projectStore.get('project_coffee_growth'), null);
  assert.equal(workStore.get('work_coffee_growth').projectId, null);
  assert.equal(workStore.get('work_coffee_prior_growth').projectId, null);
});

test('Project application rejects ineligible policy decisions and cannot steal Work from another Project', (t) => {
  const root = tempRoot(t);
  const workStore = createWorkStore({ rootDir: root });
  const projectStore = createProjectStore({ rootDir: root });
  workStore.create({
    id: 'work_lightweight',
    brief: 'One small question.',
    projectId: null,
    assignedEmployeeId: 'ben',
    status: 'accepted',
    runtime: 'mock',
  });
  const promotions = createWorkContextProjectPromotionService({
    workStore,
    projectStore,
    createProjectId: () => 'project_should_not_exist',
  });
  const stayWork = evaluateProjectPromotion({
    anchorWorkId: 'work_lightweight',
    artifactReferenceCount: 5,
    persistentObjective: false,
  });

  assert.throws(() => promotions.apply({ name: 'Nope', policyDecision: stayWork }), /not eligible/i);
  assert.equal(projectStore.get('project_should_not_exist'), null);
  assert.equal(workStore.get('work_lightweight').projectId, null);

  projectStore.create({
    id: 'project_existing_repo',
    name: 'Existing Repo',
    repoDir: '/tmp/existing-repo',
    isGitRepository: true,
    sources: [],
  });
  workStore.update('work_lightweight', { projectId: 'project_existing_repo' });
  const eligible = evaluateProjectPromotion({
    anchorWorkId: 'work_lightweight',
    persistentObjective: true,
    frontier: 'Continue a long-running effort.',
    multiStage: true,
  });
  assert.throws(() => promotions.apply({ name: 'Cannot steal', policyDecision: eligible }), /already belongs to Project/i);
  assert.equal(workStore.get('work_lightweight').projectId, 'project_existing_repo');
});
