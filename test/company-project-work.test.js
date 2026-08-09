'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createCompanyService } = require('../lib/company/company-service');
const { createProjectStore } = require('../lib/company/project-store');
const { createWorkStore } = require('../lib/company/work-store');
const { createRunStore } = require('../lib/company/run-store');

function tempRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lucubro-project-work-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

test('Project-bound Work inherits the durable Project repository', async (t) => {
  const root = tempRoot(t);
  const projectStore = createProjectStore({ rootDir: root, now: () => '2026-08-09T08:20:00.000Z' });
  const workStore = createWorkStore({ rootDir: root, now: () => '2026-08-09T08:20:00.000Z' });
  const runStore = createRunStore({ rootDir: root, now: () => '2026-08-09T08:20:00.000Z' });
  const project = projectStore.create({
    id: 'project_fixture',
    name: 'Fixture',
    repoDir: '/workspace/fixture',
    isGitRepository: true,
  });

  let startedRequest = null;
  const runOrchestrator = {
    async start(request) {
      startedRequest = request;
      return runStore.create({
        id: 'run_project_fixture',
        workId: request.workId,
        employeeId: request.employeeId,
        workerId: request.workerId,
        runtime: request.runtime,
        cwd: request.repoDir,
      });
    },
    wait() {
      return new Promise(() => {});
    },
  };

  const company = createCompanyService({
    workStore,
    runStore,
    runOrchestrator,
    projectStore,
    projectDiscovery: ({ repoDir }) => ({ repoDir, isGitRepository: true, sources: [] }),
    projectContextCompiler: () => ({ text: '# Fixture continuation', byteLength: 22, includedSources: [] }),
    defaultWorkerId: 'worker_local',
    createWorkId: () => 'work_project_fixture',
  });

  const result = await company.createCodingWork({
    brief: 'Continue durable project work',
    projectId: project.id,
    runtime: 'mock',
  });

  assert.equal(result.work.projectId, project.id);
  assert.equal(result.work.repoDir, project.repoDir);
  assert.equal(startedRequest.repoDir, project.repoDir);
  assert.match(startedRequest.prompt, /Fixture continuation/);
  assert.equal(runStore.get(result.run.id).workId, result.work.id);
});

test('Unknown Project cannot create Project-bound Work', async (t) => {
  const root = tempRoot(t);
  const projectStore = createProjectStore({ rootDir: root });
  const workStore = createWorkStore({ rootDir: root });
  const runStore = createRunStore({ rootDir: root });
  const company = createCompanyService({
    workStore,
    runStore,
    runOrchestrator: { start() { throw new Error('must not start'); } },
    projectStore,
    projectDiscovery: () => { throw new Error('must not discover'); },
    defaultWorkerId: 'worker_local',
  });

  await assert.rejects(
    company.createCodingWork({ brief: 'Do work', projectId: 'project_missing', runtime: 'mock' }),
    /Project not found: project_missing/,
  );
  assert.equal(workStore.list().length, 0);
});
