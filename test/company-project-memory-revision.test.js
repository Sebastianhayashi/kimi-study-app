'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createProjectMemoryService } = require('../lib/company/project-memory-service');
const { createProjectRevisionStore } = require('../lib/company/project-revision-store');
const { createProjectStore } = require('../lib/company/project-store');

function tempRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lucubro-project-memory-revision-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function createHomeProject(projectStore) {
  return projectStore.create({
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
        changed: 'No new candidate has been evaluated yet.',
        nextAction: 'Wait for a candidate or measurements.',
      },
      facts: [{ id: 'fact_sofa', text: 'The sofa is a large red modular chaise.' }],
      preferences: [{ id: 'pref_reversible', text: 'Prefer reversible high-ROI changes first.' }],
      decisions: [],
      frontiers: [{
        id: 'frontier_sofa',
        title: 'Sofa visual refresh',
        status: 'active',
        summary: 'Find a reversible way to reduce the large red visual block.',
        nextAction: 'Evaluate candidate covers.',
      }],
      sourceWorkIds: ['work_house_setup'],
    },
  });
}

test('a new product observation revises the same Frontier and creates an immutable Project Revision', (t) => {
  const root = tempRoot(t);
  const projectStore = createProjectStore({ rootDir: root, now: () => '2026-08-10T09:30:00.000Z' });
  createHomeProject(projectStore);
  const revisionStore = createProjectRevisionStore({ rootDir: root, now: () => '2026-08-10T09:31:00.000Z' });
  const memoryService = createProjectMemoryService({
    projectStore,
    revisionStore,
    createRevisionId: () => 'revision_sofa_candidate_1',
  });

  const result = memoryService.commit({
    projectId: 'project_home_refresh',
    sourceWorkId: 'work_sofa_candidate',
    sourceRunId: 'run_sofa_candidate',
    evidenceIds: ['evidence_taobao_sofa_cover'],
    summary: 'Evaluated a Taobao segment-level full-cover candidate.',
    mutation: {
      report: {
        changed: 'A Taobao segment-level full-cover candidate is now the leading reversible option.',
        nextAction: 'Measure the three sofa segments against the seller size chart.',
      },
      frontiersUpsert: [{
        id: 'frontier_sofa',
        title: 'Sofa visual refresh',
        status: 'active',
        summary: 'Validate the segment-level full-cover candidate before purchase.',
        nextAction: 'Measure the three sofa segments against the seller size chart.',
        evidenceIds: ['evidence_taobao_sofa_cover'],
      }],
      sourceWorkIdsAdd: ['work_sofa_candidate'],
    },
  });

  assert.equal(result.project.memory.frontiers.length, 1);
  assert.equal(result.project.memory.frontiers[0].id, 'frontier_sofa');
  assert.match(result.project.memory.frontiers[0].summary, /Validate the segment-level/);
  assert.deepEqual(result.project.memory.sourceWorkIds, ['work_house_setup', 'work_sofa_candidate']);
  assert.equal(result.project.memoryRevisionId, 'revision_sofa_candidate_1');
  assert.equal(result.revision.id, 'revision_sofa_candidate_1');
  assert.equal(result.revision.parentRevisionId, null);
  assert.equal(result.revision.projectId, 'project_home_refresh');
  assert.equal(result.revision.sourceWorkId, 'work_sofa_candidate');
  assert.equal(result.revision.sourceRunId, 'run_sofa_candidate');
  assert.deepEqual(result.revision.evidenceIds, ['evidence_taobao_sofa_cover']);
  assert.match(result.revision.stateDigest, /^sha256:[a-f0-9]{64}$/);
  assert.equal(revisionStore.listByProject('project_home_refresh').length, 1);
});

test('later Project Memory revisions form a parent chain and survive restart', (t) => {
  const root = tempRoot(t);
  let projectStore = createProjectStore({ rootDir: root });
  createHomeProject(projectStore);
  let revisionIndex = 0;
  let revisionStore = createProjectRevisionStore({ rootDir: root });
  let memoryService = createProjectMemoryService({
    projectStore,
    revisionStore,
    createRevisionId: () => `revision_${++revisionIndex}`,
  });

  const first = memoryService.commit({
    projectId: 'project_home_refresh',
    sourceWorkId: 'work_measure',
    summary: 'Recorded segment measurements.',
    mutation: {
      factsUpsert: [{ id: 'fact_sofa_width', text: 'The main sofa segment width is 210 cm.' }],
      frontiersUpsert: [{
        id: 'frontier_sofa',
        title: 'Sofa visual refresh',
        status: 'active',
        summary: 'Measurements are available; verify candidate size fit.',
        nextAction: 'Compare measurements to the seller size chart.',
      }],
    },
  });
  const second = memoryService.commit({
    projectId: 'project_home_refresh',
    sourceWorkId: 'work_fit_check',
    summary: 'Verified the candidate size fit.',
    mutation: {
      decisionsUpsert: [{ id: 'decision_sofa_cover', text: 'Keep this cover as the leading candidate.', status: 'accepted' }],
      frontiersUpsert: [{
        id: 'frontier_sofa',
        title: 'Sofa visual refresh',
        status: 'active',
        summary: 'Size fit is plausible; real buyer photos remain to validate.',
        nextAction: 'Review seated-use buyer photos for slipping and wrinkles.',
      }],
    },
  });

  assert.equal(second.revision.parentRevisionId, first.revision.id);
  assert.equal(projectStore.get('project_home_refresh').memory.frontiers.length, 1);

  projectStore = createProjectStore({ rootDir: root });
  revisionStore = createProjectRevisionStore({ rootDir: root });
  const restored = revisionStore.listByProject('project_home_refresh');
  assert.deepEqual(restored.map((revision) => revision.id), [first.revision.id, second.revision.id]);
  assert.equal(projectStore.get('project_home_refresh').memoryRevisionId, second.revision.id);
});

test('a failed Project commit leaves canonical memory and revision history unchanged', (t) => {
  const root = tempRoot(t);
  const realProjectStore = createProjectStore({ rootDir: root });
  const initial = createHomeProject(realProjectStore);
  const revisionStore = createProjectRevisionStore({ rootDir: root });
  const failingProjectStore = {
    get: (id) => realProjectStore.get(id),
    update() { throw new Error('simulated atomic Project write failure'); },
  };
  const memoryService = createProjectMemoryService({
    projectStore: failingProjectStore,
    revisionStore,
    createRevisionId: () => 'revision_must_rollback',
  });

  assert.throws(() => memoryService.commit({
    projectId: initial.id,
    sourceWorkId: 'work_failed',
    summary: 'This must not commit.',
    mutation: {
      report: { changed: 'This value must never become canonical.' },
    },
  }), /simulated atomic Project write failure/);

  assert.equal(realProjectStore.get(initial.id).memory.report.changed, initial.memory.report.changed);
  assert.equal(realProjectStore.get(initial.id).memoryRevisionId, undefined);
  assert.deepEqual(revisionStore.listByProject(initial.id), []);
});
