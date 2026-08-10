'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createCompanyService } = require('../lib/company/company-service');
const { discoverProjectSources } = require('../lib/company/project-discovery');
const { createProjectStore } = require('../lib/company/project-store');
const { createRunStore } = require('../lib/company/run-store');
const { createWorkStore } = require('../lib/company/work-store');

function tempRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lucubro-project-memory-runtime-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

test('later Work resumes a non-repository Project from durable memory without invoking filesystem discovery', async (t) => {
  const root = tempRoot(t);
  const projectStore = createProjectStore({ rootDir: root });
  const workStore = createWorkStore({ rootDir: root });
  const runStore = createRunStore({ rootDir: root });
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
        summary: 'The sofa is currently being improved rather than replaced.',
        changed: 'A candidate slipcover is under validation.',
        nextAction: 'Check segment measurements.',
      },
      facts: [{ id: 'fact_sofa', text: 'The sofa is a large red modular chaise.' }],
      preferences: [{ id: 'pref_reversible', text: 'Prefer reversible high-ROI changes first.' }],
      decisions: [],
      frontiers: [{
        id: 'frontier_sofa',
        title: 'Sofa visual refresh',
        status: 'active',
        summary: 'Validate the segment-level full-cover route.',
        nextAction: 'Check segment measurements.',
      }],
    },
  });

  let discoveryCalls = 0;
  let capturedStart = null;
  const company = createCompanyService({
    workStore,
    runStore,
    runOrchestrator: {
      async start(input) {
        capturedStart = input;
        return {
          id: 'run_home_followup',
          workId: input.workId,
          employeeId: input.employeeId,
          workerId: input.workerId,
          runtime: input.runtime,
          status: 'running',
        };
      },
      async wait() { return { id: 'run_home_followup', status: 'completed' }; },
    },
    projectStore,
    projectDiscovery(input) {
      discoveryCalls += 1;
      return discoverProjectSources(input);
    },
    defaultWorkerId: 'worker_local',
    createWorkId: () => 'work_home_followup',
  });

  const result = await company.createWork({
    brief: 'I found a new Taobao sofa-cover candidate https://item.taobao.com/item.htm?id=12345. Evaluate it against what we already know.',
    projectId: 'project_home_refresh',
    runtime: 'mock',
  });

  assert.equal(result.work.projectId, 'project_home_refresh');
  assert.equal(result.work.repoDir, null);
  assert.equal(discoveryCalls, 0);
  assert.equal(capturedStart.repoDir, null);
  assert.match(capturedStart.prompt, /Improve the home continuously/);
  assert.match(capturedStart.prompt, /Sofa visual refresh/);
  assert.match(capturedStart.prompt, /Prefer reversible high-ROI changes first/);
  assert.equal(capturedStart.inputEvidence.length, 1);
  assert.equal(capturedStart.inputEvidence[0].kind, 'link');
  assert.equal(capturedStart.inputEvidence[0].source, 'user-input');
  assert.equal(capturedStart.inputEvidence[0].metadata.url, 'https://item.taobao.com/item.htm?id=12345');
  assert.equal(capturedStart.inputEvidence[0].metadata.projectId, 'project_home_refresh');
});
