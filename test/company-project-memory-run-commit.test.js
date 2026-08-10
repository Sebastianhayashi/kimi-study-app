'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createCompanyService } = require('../lib/company/company-service');
const { createProjectMemoryService } = require('../lib/company/project-memory-service');
const { createProjectRevisionStore } = require('../lib/company/project-revision-store');
const { createProjectStore } = require('../lib/company/project-store');
const { createRunStore } = require('../lib/company/run-store');
const { createWorkStore } = require('../lib/company/work-store');

function tempRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lucubro-project-memory-run-commit-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function fixture(t) {
  const root = tempRoot(t);
  const projectStore = createProjectStore({ rootDir: root });
  const workStore = createWorkStore({ rootDir: root });
  const runStore = createRunStore({ rootDir: root });
  const revisionStore = createProjectRevisionStore({ rootDir: root });
  let revisionCounter = 0;
  const projectMemoryService = createProjectMemoryService({
    projectStore,
    revisionStore,
    createRevisionId: () => `revision_run_${++revisionCounter}`,
  });

  projectStore.create({
    id: 'project_home_refresh',
    name: 'Home refresh',
    kind: 'work-context',
    repoDir: null,
    isGitRepository: false,
    sources: [],
    memory: {
      objective: 'Improve the home continuously as new evidence arrives.',
      report: {
        title: 'Home refresh report',
        summary: 'The sofa is being improved rather than replaced.',
        changed: 'No candidate has been accepted yet.',
        nextAction: 'Evaluate incoming candidates.',
      },
      facts: [{ id: 'fact_sofa', text: 'The sofa is a large red modular chaise.' }],
      preferences: [{ id: 'pref_reversible', text: 'Prefer reversible high-ROI changes first.' }],
      decisions: [],
      frontiers: [{
        id: 'frontier_sofa',
        title: 'Sofa visual refresh',
        status: 'active',
        summary: 'Find a reversible visual intervention.',
        nextAction: 'Evaluate incoming candidates.',
      }],
      sourceWorkIds: ['work_house_setup'],
    },
  });

  workStore.create({
    id: 'work_sofa_candidate',
    brief: 'Evaluate a new Taobao sofa-cover candidate.',
    projectId: 'project_home_refresh',
    assignedEmployeeId: 'ben',
    status: 'in-progress',
    activeRunId: 'run_sofa_candidate',
    runtime: 'mock',
  });
  runStore.create({
    id: 'run_sofa_candidate',
    workId: 'work_sofa_candidate',
    employeeId: 'ben',
    workerId: 'worker_local',
    runtime: 'mock',
    status: 'running',
    delegationEnvelope: { allow: ['workspace.read'], deny: ['external.purchase'] },
  });

  const company = createCompanyService({
    workStore,
    runStore,
    runOrchestrator: {
      async start() { throw new Error('not used'); },
      async wait() { throw new Error('not used'); },
    },
    projectStore,
    projectMemoryService,
  });
  company.observeRun('work_sofa_candidate', 'run_sofa_candidate');

  return { projectStore, workStore, runStore, revisionStore };
}

test('Project Memory proposal stays non-canonical until the owning Run completes', (t) => {
  const state = fixture(t);
  state.runStore.appendEvent('run_sofa_candidate', {
    type: 'project.memory.proposed',
    summary: 'Evaluated the incoming sofa-cover candidate.',
    evidenceRefs: ['evidence_taobao_sofa_cover'],
    mutation: {
      report: {
        changed: 'A Taobao full-cover candidate is now the leading reversible option.',
        nextAction: 'Measure the three sofa segments against the seller size chart.',
      },
      frontiersUpsert: [{
        id: 'frontier_sofa',
        title: 'Sofa visual refresh',
        status: 'active',
        summary: 'Validate the candidate before purchase.',
        nextAction: 'Measure the three sofa segments against the seller size chart.',
        evidenceIds: ['evidence_taobao_sofa_cover'],
      }],
    },
  });

  assert.equal(state.projectStore.get('project_home_refresh').memory.report.changed, 'No candidate has been accepted yet.');
  assert.deepEqual(state.revisionStore.listByProject('project_home_refresh'), []);

  state.runStore.appendEvent('run_sofa_candidate', { type: 'run.completed', summary: 'Candidate evaluation complete.' });

  const project = state.projectStore.get('project_home_refresh');
  assert.match(project.memory.report.changed, /Taobao full-cover candidate/);
  assert.equal(project.memory.frontiers.length, 1);
  assert.equal(project.memory.frontiers[0].id, 'frontier_sofa');
  assert.deepEqual(project.memory.sourceWorkIds, ['work_house_setup', 'work_sofa_candidate']);
  assert.equal(project.memoryRevisionId, 'revision_run_1');
  const revisions = state.revisionStore.listByProject('project_home_refresh');
  assert.equal(revisions.length, 1);
  assert.equal(revisions[0].sourceWorkId, 'work_sofa_candidate');
  assert.equal(revisions[0].sourceRunId, 'run_sofa_candidate');
  assert.deepEqual(revisions[0].evidenceIds, ['evidence_taobao_sofa_cover']);
});

test('failed Run never promotes a Project Memory proposal', (t) => {
  const state = fixture(t);
  state.runStore.appendEvent('run_sofa_candidate', {
    type: 'project.memory.proposed',
    summary: 'This proposal belongs to a failed Run.',
    evidenceRefs: [],
    mutation: { report: { changed: 'Must never become canonical.' } },
  });
  state.runStore.appendEvent('run_sofa_candidate', { type: 'run.failed', error: 'simulated failure' });

  const project = state.projectStore.get('project_home_refresh');
  assert.equal(project.memory.report.changed, 'No candidate has been accepted yet.');
  assert.equal(project.memoryRevisionId, undefined);
  assert.deepEqual(state.revisionStore.listByProject('project_home_refresh'), []);
});
