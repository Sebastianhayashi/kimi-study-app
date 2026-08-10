'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createCompanyServer } = require('../company-server');
const { createProjectStore } = require('../lib/company/project-store');

function tempRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lucubro-general-work-api-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

async function withServer(options, run) {
  const { app } = createCompanyServer(options);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address();
  try {
    return await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

function coffeePlan() {
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
    reasonCodes: ['ordinary-work'],
  };
}

function mockRuntime(observed) {
  return {
    async available() { return { available: true, mode: 'fixture' }; },
    async *run(request) {
      observed.push({ cwd: request.cwd, workId: request.workId });
      yield { type: 'run.started', providerSessionId: 'session_general_api' };
      yield { type: 'run.completed', summary: 'done' };
    },
  };
}

async function readCompletedRun(baseUrl, runId) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await fetch(`${baseUrl}/api/company/runs/${runId}`);
    assert.equal(response.status, 200);
    const body = await response.json();
    if (body.run.status === 'completed') return body;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Run did not complete: ${runId}`);
}

test('ordinary Work HTTP request needs no repository and persists its public plan', async (t) => {
  const dataDir = tempRoot(t);
  const observed = [];
  const plan = coffeePlan();

  await withServer({
    dataDir,
    runtimes: new Map([['mock', mockRuntime(observed)]]),
    workPlanner: { async plan() { return structuredClone(plan); } },
  }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/company/works`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        brief: 'Explain coffee roast levels for a beginner.',
        runtime: 'mock',
      }),
    });

    assert.equal(response.status, 201);
    const created = await response.json();
    assert.equal(created.work.repoDir, null);
    assert.deepEqual(created.work.plan, plan);

    const runState = await readCompletedRun(baseUrl, created.run.id);
    assert.equal(runState.run.workspaceKind, 'scratch');
    assert.equal(path.isAbsolute(runState.run.cwd), true);
    assert.ok(runState.run.cwd.startsWith(path.join(dataDir, 'execution-workspaces')));
    assert.deepEqual(observed, [{ cwd: runState.run.cwd, workId: created.work.id }]);

    const bootstrapResponse = await fetch(`${baseUrl}/api/company/bootstrap`);
    assert.equal(bootstrapResponse.status, 200);
    const bootstrap = await bootstrapResponse.json();
    const restored = bootstrap.works.find((work) => work.id === created.work.id);
    assert.ok(restored);
    assert.deepEqual(restored.plan, plan);
    assert.equal(restored.projectId, null);
  });
});

test('HTTP Work can continue a durable non-repository Project without a host workspace path', async (t) => {
  const dataDir = tempRoot(t);
  const projectStore = createProjectStore({ rootDir: dataDir });
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
        summary: 'Keep the current sofa and validate reversible improvements first.',
        changed: 'A cover candidate is ready for evaluation.',
        nextAction: 'Compare it with existing sofa facts.',
      },
      facts: [{ id: 'fact_sofa', text: 'The sofa is a large red modular chaise.' }],
      preferences: [{ id: 'pref_reversible', text: 'Prefer reversible high-ROI changes first.' }],
      decisions: [],
      frontiers: [{
        id: 'frontier_sofa',
        title: 'Sofa visual refresh',
        status: 'active',
        summary: 'Validate a segment-level cover.',
        nextAction: 'Compare the candidate against known dimensions.',
      }],
    },
  });
  const observed = [];

  await withServer({
    dataDir,
    runtimes: new Map([['mock', mockRuntime(observed)]]),
  }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/company/works`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        brief: 'Evaluate this new Taobao sofa-cover candidate.',
        projectId: 'project_home_refresh',
        runtime: 'mock',
      }),
    });

    assert.equal(response.status, 201);
    const created = await response.json();
    assert.equal(created.work.projectId, 'project_home_refresh');
    assert.equal(created.work.repoDir, null);

    const runState = await readCompletedRun(baseUrl, created.run.id);
    assert.equal(runState.run.workspaceKind, 'scratch');
    assert.equal(runState.run.branch, null);
    assert.equal(observed.length, 1);
  });
});
