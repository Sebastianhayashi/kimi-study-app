'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createRunOrchestrator } = require('../lib/company/run-orchestrator');

function memoryRunStore() {
  const runs = new Map();
  const events = new Map();
  return {
    create(input) {
      const run = { ...input, status: 'queued', providerSessionId: null };
      runs.set(run.id, run);
      events.set(run.id, []);
      return { ...run };
    },
    get(id) { return runs.has(id) ? { ...runs.get(id) } : null; },
    update(id, patch) {
      const next = { ...runs.get(id), ...patch };
      runs.set(id, next);
      return { ...next };
    },
    appendEvent(id, event) { events.get(id).push(structuredClone(event)); },
    readEvents(id) { return (events.get(id) || []).map((event) => structuredClone(event)); },
  };
}

function fixtureRuntime(observedRequests) {
  return {
    async *run(request) {
      observedRequests.push(structuredClone({
        runId: request.runId,
        subrunId: request.subrunId,
        skillMount: request.skillMount,
      }));
      if (request.skillMount) {
        yield {
          type: 'skill.mounted',
          receipt: {
            kind: 'codex-skill-mount-receipt',
            verified: true,
            runId: request.runId,
            subrunId: request.subrunId,
            mountRoot: request.skillMount.root,
            method: 'skills/extraRoots/set+skills/list',
            skills: request.skillMount.expectedSkills,
          },
        };
      }
      yield { type: 'run.completed', summary: 'done' };
    },
  };
}

function worktreeManager() {
  return {
    async create() { return { cwd: '/work/lucubro', branch: 'fixture/run' }; },
    async inspect() { return { diff: '', changedFiles: [] }; },
  };
}

const selectedResearch = {
  skillId: 'mattpocock-skills:research',
  activation: 'model',
  userIntentEvidence: null,
  compatibilityStatus: 'native',
  overlay: null,
};

const expectedResearch = {
  skillId: 'mattpocock-skills:research',
  bundleId: 'mattpocock-skills',
  bundleCommit: '84fdeffd12f2ee307994d1eb6feb48173b6e0502',
  name: 'research',
  contentHash: `sha256:${'1'.repeat(64)}`,
  skillPath: '/data/company/skill-mounts/run_mount_orchestrator/subrun_research/research/SKILL.md',
  activation: 'model',
  userIntentEvidence: null,
  overlay: null,
};

test('RunOrchestrator passes selected-only Skill mount request to runtime and persists verified receipt event', async () => {
  const runStore = memoryRunStore();
  const observedRequests = [];
  const orchestrator = createRunOrchestrator({
    runStore,
    approvalBroker: { async request() { return 'deny'; } },
    runtimeRegistry: new Map([['codex', fixtureRuntime(observedRequests)]]),
    worktreeManager: worktreeManager(),
    createId: () => 'run_mount_orchestrator',
  });
  const skillMount = {
    root: '/data/company/skill-mounts/run_mount_orchestrator/subrun_research',
    expectedSkills: [expectedResearch],
  };

  const run = await orchestrator.start({
    workId: 'work_mount_orchestrator',
    employeeId: 'employee_alex',
    workerId: 'worker_local',
    runtime: 'codex',
    repoDir: '/repo',
    prompt: 'Research coffee.',
    model: 'luna-runtime-id',
    subrunId: 'subrun_research',
    skillMount,
    delegationEnvelope: { allow: ['workspace.read'], deny: [] },
  });
  await orchestrator.wait(run.id);

  assert.deepEqual(observedRequests, [{
    runId: 'run_mount_orchestrator',
    subrunId: 'subrun_research',
    skillMount,
  }]);
  const receiptEvent = runStore.readEvents(run.id).find((event) => event.type === 'skill.mounted');
  assert.ok(receiptEvent);
  assert.equal(receiptEvent.receipt.verified, true);
  assert.equal(receiptEvent.receipt.runId, run.id);
  assert.equal(receiptEvent.receipt.subrunId, 'subrun_research');
  assert.equal(receiptEvent.receipt.skills[0].skillId, 'mattpocock-skills:research');
});

test('RunOrchestrator builds a mount view from planned Skill selections using the real Run id', async () => {
  const runStore = memoryRunStore();
  const observedRequests = [];
  const buildCalls = [];
  const builtMount = {
    root: '/data/company/skill-mounts/run_planned_mount/manager',
    expectedSkills: [{ ...expectedResearch, skillPath: '/data/company/skill-mounts/run_planned_mount/manager/research/SKILL.md' }],
  };
  const orchestrator = createRunOrchestrator({
    runStore,
    approvalBroker: { async request() { return 'deny'; } },
    runtimeRegistry: new Map([['codex', fixtureRuntime(observedRequests)]]),
    worktreeManager: worktreeManager(),
    skillMountBuilder: {
      build(input) {
        buildCalls.push(structuredClone(input));
        return structuredClone(builtMount);
      },
    },
    createId: () => 'run_planned_mount',
  });

  const run = await orchestrator.start({
    workId: 'work_planned_mount',
    employeeId: 'employee_alex',
    workerId: 'worker_local',
    runtime: 'codex',
    repoDir: '/repo',
    prompt: 'Research coffee.',
    model: 'luna-runtime-id',
    skillSelections: [selectedResearch],
    delegationEnvelope: { allow: ['workspace.read'], deny: [] },
  });
  await orchestrator.wait(run.id);

  assert.deepEqual(buildCalls, [{
    runId: 'run_planned_mount',
    subrunId: null,
    selections: [selectedResearch],
  }]);
  assert.deepEqual(observedRequests[0].skillMount, builtMount);
  const receiptEvent = runStore.readEvents(run.id).find((event) => event.type === 'skill.mounted');
  assert.ok(receiptEvent);
  assert.equal(receiptEvent.receipt.runId, 'run_planned_mount');
});

test('RunOrchestrator fails closed when planned Skills exist but no mount builder is configured', async () => {
  const runStore = memoryRunStore();
  const observedRequests = [];
  const orchestrator = createRunOrchestrator({
    runStore,
    approvalBroker: { async request() { return 'deny'; } },
    runtimeRegistry: new Map([['codex', fixtureRuntime(observedRequests)]]),
    worktreeManager: worktreeManager(),
    createId: () => 'run_missing_mount_builder',
  });

  const run = await orchestrator.start({
    workId: 'work_missing_mount_builder',
    employeeId: 'employee_alex',
    workerId: 'worker_local',
    runtime: 'codex',
    repoDir: '/repo',
    prompt: 'Research coffee.',
    skillSelections: [selectedResearch],
    delegationEnvelope: { allow: ['workspace.read'], deny: [] },
  });
  const finalRun = await orchestrator.wait(run.id);

  assert.equal(finalRun.status, 'failed');
  assert.match(finalRun.error, /Skill mount builder is required when Work planning selected Skills/);
  assert.equal(observedRequests.length, 0);
});
