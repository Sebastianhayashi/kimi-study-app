'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createCompanyService } = require('../lib/company/company-service');
const { createExecutionWorkspaceManager } = require('../lib/company/execution-workspace-manager');
const { createRunOrchestrator } = require('../lib/company/run-orchestrator');
const { createRunStore } = require('../lib/company/run-store');
const { createWorkStore } = require('../lib/company/work-store');

function tempRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lucubro-general-work-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function plan() {
  return {
    complexity: 'simple',
    durability: 'saved-work',
    projectAction: 'none',
    issueAction: 'none',
    skillSelections: [],
    skillGraph: { skillIds: [], files: [], skillRoots: [], diagnostics: [] },
    staffing: { manager: true, specialistSubruns: [] },
    evidenceRequired: false,
    deliverable: 'canvas-artifact',
    reasonCodes: [],
  };
}

test('ordinary Work can execute in Lucubro scratch space without a repository', async (t) => {
  const root = tempRoot(t);
  const workStore = createWorkStore({ rootDir: root, now: () => '2026-08-09T10:40:00.000Z' });
  const runStore = createRunStore({ rootDir: root, now: () => '2026-08-09T10:40:00.000Z' });
  const workspaceManager = createExecutionWorkspaceManager({ rootDir: root });
  const runtimeRequests = [];
  const runOrchestrator = createRunOrchestrator({
    runStore,
    approvalBroker: { async request() { return 'deny'; } },
    runtimeRegistry: new Map([['mock', {
      async *run(request) {
        runtimeRequests.push(structuredClone({ cwd: request.cwd, workId: request.workId }));
        yield { type: 'run.started', providerSessionId: 'session_general' };
        yield { type: 'run.completed', summary: 'done' };
      },
    }]]),
    workspaceManager,
    createId: () => 'run_general_work',
  });
  const company = createCompanyService({
    workStore,
    runStore,
    runOrchestrator,
    workPlanner: { async plan() { return plan(); } },
    defaultWorkerId: 'worker_local',
    createWorkId: () => 'work_general',
  });

  const result = await company.createWork({
    brief: 'Explain coffee roast levels for a beginner.',
    runtime: 'mock',
  });
  const finalRun = await runOrchestrator.wait(result.run.id);

  assert.equal(result.work.repoDir, null);
  assert.deepEqual(result.work.plan, plan());
  assert.equal(finalRun.status, 'completed');
  assert.deepEqual(runtimeRequests, [{
    cwd: path.join(root, 'execution-workspaces', 'run_general_work'),
    workId: 'work_general',
  }]);
  assert.equal(fs.statSync(runtimeRequests[0].cwd).isDirectory(), true);
  assert.deepEqual(workStore.get('work_general').plan, plan());
});

test('createCodingWork still requires repoDir when no Project provides one', async (t) => {
  const root = tempRoot(t);
  const workStore = createWorkStore({ rootDir: root });
  const runStore = createRunStore({ rootDir: root });
  const company = createCompanyService({
    workStore,
    runStore,
    runOrchestrator: {
      async start() { throw new Error('must not start'); },
      wait() { return Promise.resolve(null); },
    },
    defaultWorkerId: 'worker_local',
  });

  await assert.rejects(
    company.createCodingWork({ brief: 'Fix code', runtime: 'mock' }),
    /repoDir is required/,
  );
});
