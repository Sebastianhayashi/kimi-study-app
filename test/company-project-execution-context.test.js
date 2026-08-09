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
const { discoverProjectSources } = require('../lib/company/project-discovery');

function tempRoot(t, prefix = 'lucubro-project-execution-context-') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function createFixture(t) {
  const dataDir = tempRoot(t, 'lucubro-project-execution-data-');
  const repoDir = tempRoot(t, 'lucubro-project-execution-repo-');
  fs.mkdirSync(path.join(repoDir, '.git'));
  fs.writeFileSync(path.join(repoDir, 'CONTEXT.md'), '# Context\nProject continuity is source-backed.\n');

  const projectStore = createProjectStore({ rootDir: dataDir });
  const workStore = createWorkStore({ rootDir: dataDir });
  const runStore = createRunStore({ rootDir: dataDir });
  let startedRequest = null;
  const runOrchestrator = {
    async start(request) {
      startedRequest = request;
      return runStore.create({
        id: 'run_execution_context',
        workId: request.workId,
        employeeId: request.employeeId,
        workerId: request.workerId,
        runtime: request.runtime,
      });
    },
    wait() { return new Promise(() => {}); },
  };
  const company = createCompanyService({
    workStore,
    runStore,
    runOrchestrator,
    projectStore,
    projectDiscovery: discoverProjectSources,
    defaultWorkerId: 'worker_local',
    createProjectId: () => 'project_execution_context',
    createWorkId: () => 'work_execution_context',
  });
  const project = company.adoptProject({ repoDir, name: 'Execution context fixture' });
  return { company, project, repoDir, getStartedRequest: () => startedRequest };
}

test('Fresh Project-bound Work injects bounded canonical continuation context into a new Run prompt', async (t) => {
  const fixture = createFixture(t);
  fixture.company.checkpointProject({
    projectId: fixture.project.id,
    checkpoint: {
      status: 'active',
      nextSafeAction: 'continue source-backed implementation',
      doNotRepeat: ['do not ask for the previous transcript'],
    },
  });

  const result = await fixture.company.createCodingWork({
    brief: 'Implement the next persistence slice',
    projectId: fixture.project.id,
    runtime: 'mock',
    delegationEnvelope: { allow: ['workspace.read', 'workspace.write'], deny: ['git.push'] },
  });

  const request = fixture.getStartedRequest();
  assert.equal(result.work.projectId, fixture.project.id);
  assert.equal(request.repoDir, fixture.repoDir);
  assert.match(request.prompt, /^Implement the next persistence slice/);
  assert.match(request.prompt, /# Lucubro Project Continuation/);
  assert.match(request.prompt, /Project continuity is source-backed\./);
  assert.match(request.prompt, /Next safe action: continue source-backed implementation/);
  assert.match(request.prompt, /do not ask for the previous transcript/);
  assert.match(request.prompt, /Authority deny: git\.push/);
});

test('Stale Project-bound Work receives current sources but not the obsolete checkpoint next action', async (t) => {
  const fixture = createFixture(t);
  fixture.company.checkpointProject({
    projectId: fixture.project.id,
    checkpoint: {
      status: 'active',
      nextSafeAction: 'OBSOLETE ACTION MUST NOT RUN',
    },
  });
  fs.writeFileSync(path.join(fixture.repoDir, 'CONTEXT.md'), '# Context\nCurrent direction supersedes the checkpoint.\n');

  await fixture.company.createCodingWork({
    brief: 'Continue after source drift',
    projectId: fixture.project.id,
    runtime: 'mock',
  });

  const request = fixture.getStartedRequest();
  assert.match(request.prompt, /Checkpoint freshness: stale/);
  assert.match(request.prompt, /Current direction supersedes the checkpoint\./);
  assert.doesNotMatch(request.prompt, /OBSOLETE ACTION MUST NOT RUN/);
});
