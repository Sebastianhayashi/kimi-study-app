'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createProjectStore } = require('../lib/company/project-store');
const { discoverProjectSources } = require('../lib/company/project-discovery');
const { createWorkStore } = require('../lib/company/work-store');
const { createRunStore } = require('../lib/company/run-store');
const { createCompanyService } = require('../lib/company/company-service');
const {
  captureSourceSnapshot,
  reconcileProjectSources,
} = require('../lib/company/project-continuation');

function tempRoot(t, prefix = 'lucubro-project-continuation-') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function writeSource(repo, relativePath, content) {
  const file = path.join(repo, relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function companyFor(t, repo) {
  const data = tempRoot(t, 'lucubro-project-continuation-data-');
  const projectStore = createProjectStore({ rootDir: data });
  const workStore = createWorkStore({ rootDir: data });
  const runStore = createRunStore({ rootDir: data });
  const company = createCompanyService({
    workStore,
    runStore,
    runOrchestrator: { start() { throw new Error('not used'); } },
    projectStore,
    projectDiscovery: discoverProjectSources,
    defaultWorkerId: 'worker_local',
    createProjectId: () => 'project_continuation',
  });
  const project = company.adoptProject({ repoDir: repo, name: 'Continuation fixture' });
  return { company, projectStore, project };
}

test('Project discovery fingerprints canonical sources without copying source content', (t) => {
  const repo = tempRoot(t);
  fs.mkdirSync(path.join(repo, '.git'));
  writeSource(repo, 'CONTEXT.md', '# Context\nsettled term\n');

  const first = discoverProjectSources({ repoDir: repo });
  assert.equal(first.sources.length, 1);
  assert.equal(first.sources[0].path, 'CONTEXT.md');
  assert.match(first.sources[0].fingerprint, /^sha256:[a-f0-9]{64}$/);
  assert.equal(first.sources[0].bytes, Buffer.byteLength('# Context\nsettled term\n'));
  assert.equal(Object.hasOwn(first.sources[0], 'content'), false);

  writeSource(repo, 'CONTEXT.md', '# Context\nchanged term\n');
  const second = discoverProjectSources({ repoDir: repo });
  assert.notEqual(second.sources[0].fingerprint, first.sources[0].fingerprint);
});

test('Continuation checkpoint keeps a source snapshot separate from current Project sources', (t) => {
  const root = tempRoot(t);
  const store = createProjectStore({ rootDir: root, now: () => '2026-08-09T08:30:00.000Z' });
  const project = store.create({
    id: 'project_checkpoint',
    name: 'Checkpoint',
    repoDir: '/workspace/checkpoint',
    sources: [{ kind: 'context', path: 'CONTEXT.md', fingerprint: 'sha256:aaa', bytes: 12 }],
  });

  store.updateCheckpoint(project.id, {
    status: 'active',
    nextSafeAction: 'continue',
    sourceSnapshot: captureSourceSnapshot(project.sources),
  });

  const restored = store.get(project.id);
  assert.deepEqual(restored.checkpoint.sourceSnapshot, [
    { kind: 'context', path: 'CONTEXT.md', fingerprint: 'sha256:aaa' },
  ]);
  assert.equal(restored.sources[0].bytes, 12);
});

test('Reconciliation reports fresh when canonical sources still match the checkpoint', () => {
  const snapshot = [
    { kind: 'context', path: 'CONTEXT.md', fingerprint: 'sha256:a' },
    { kind: 'decision', path: 'docs/adr/0001.md', fingerprint: 'sha256:b' },
  ];

  const result = reconcileProjectSources({ checkpointSnapshot: snapshot, currentSources: snapshot });
  assert.equal(result.status, 'fresh');
  assert.equal(result.stale, false);
  assert.deepEqual(result.changed, []);
  assert.deepEqual(result.missing, []);
  assert.deepEqual(result.added, []);
});

test('Reconciliation reports changed, missing, and added canonical sources without rewriting the checkpoint', () => {
  const checkpointSnapshot = [
    { kind: 'context', path: 'CONTEXT.md', fingerprint: 'sha256:old' },
    { kind: 'decision', path: 'docs/adr/0001.md', fingerprint: 'sha256:decision' },
  ];
  const currentSources = [
    { kind: 'context', path: 'CONTEXT.md', fingerprint: 'sha256:new' },
    { kind: 'spec', path: 'docs/specs/current.md', fingerprint: 'sha256:spec' },
  ];

  const result = reconcileProjectSources({ checkpointSnapshot, currentSources });
  assert.equal(result.status, 'stale');
  assert.equal(result.stale, true);
  assert.deepEqual(result.changed, [{
    kind: 'context',
    path: 'CONTEXT.md',
    checkpointFingerprint: 'sha256:old',
    currentFingerprint: 'sha256:new',
  }]);
  assert.deepEqual(result.missing, [
    { kind: 'decision', path: 'docs/adr/0001.md', checkpointFingerprint: 'sha256:decision' },
  ]);
  assert.deepEqual(result.added, [
    { kind: 'spec', path: 'docs/specs/current.md', currentFingerprint: 'sha256:spec' },
  ]);
  assert.equal(checkpointSnapshot[0].fingerprint, 'sha256:old');
});

test('Reconciliation distinguishes a Project that has never checkpointed sources', () => {
  const result = reconcileProjectSources({
    checkpointSnapshot: null,
    currentSources: [{ kind: 'context', path: 'CONTEXT.md', fingerprint: 'sha256:a' }],
  });
  assert.equal(result.status, 'uncheckpointed');
  assert.equal(result.stale, false);
});

test('Company checkpoint captures current canonical fingerprints and later reports source drift', (t) => {
  const repo = tempRoot(t, 'lucubro-project-continuation-repo-');
  fs.mkdirSync(path.join(repo, '.git'));
  writeSource(repo, 'CONTEXT.md', '# Context\nfirst\n');
  const { company, projectStore, project } = companyFor(t, repo);

  const checkpointed = company.checkpointProject({
    projectId: project.id,
    checkpoint: {
      status: 'active',
      scope: 'Persistence v1',
      nextSafeAction: 'implement continuation compiler',
    },
  });
  assert.equal(checkpointed.checkpoint.sourceSnapshot.length, 1);

  const fresh = company.inspectProjectContinuation(project.id);
  assert.equal(fresh.reconciliation.status, 'fresh');

  const checkpointFingerprint = checkpointed.checkpoint.sourceSnapshot[0].fingerprint;
  writeSource(repo, 'CONTEXT.md', '# Context\nsecond\n');

  const stale = company.inspectProjectContinuation(project.id);
  assert.equal(stale.reconciliation.status, 'stale');
  assert.equal(stale.reconciliation.changed[0].path, 'CONTEXT.md');
  assert.equal(stale.reconciliation.changed[0].checkpointFingerprint, checkpointFingerprint);
  assert.notEqual(stale.reconciliation.changed[0].currentFingerprint, checkpointFingerprint);
  assert.equal(projectStore.get(project.id).checkpoint.sourceSnapshot[0].fingerprint, checkpointFingerprint);
});
