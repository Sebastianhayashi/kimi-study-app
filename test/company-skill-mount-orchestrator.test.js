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

test('RunOrchestrator passes selected-only Skill mount request to runtime and persists verified receipt event', async () => {
  const runStore = memoryRunStore();
  const observedRequests = [];
  const runtime = {
    async *run(request) {
      observedRequests.push(structuredClone({
        runId: request.runId,
        subrunId: request.subrunId,
        skillMount: request.skillMount,
      }));
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
      yield { type: 'run.completed', summary: 'done' };
    },
  };
  const orchestrator = createRunOrchestrator({
    runStore,
    approvalBroker: { async request() { return 'deny'; } },
    runtimeRegistry: new Map([['codex', runtime]]),
    worktreeManager: {
      async create() { return { cwd: '/work/lucubro', branch: 'fixture/run' }; },
      async inspect() { return { diff: '', changedFiles: [] }; },
    },
    createId: () => 'run_mount_orchestrator',
  });
  const skillMount = {
    root: '/data/company/skill-mounts/run_mount_orchestrator/subrun_research',
    expectedSkills: [{
      skillId: 'mattpocock-skills:research',
      bundleId: 'mattpocock-skills',
      bundleCommit: '84fdeffd12f2ee307994d1eb6feb48173b6e0502',
      name: 'research',
      contentHash: `sha256:${'1'.repeat(64)}`,
      skillPath: '/data/company/skill-mounts/run_mount_orchestrator/subrun_research/research/SKILL.md',
      activation: 'model',
      userIntentEvidence: null,
      overlay: null,
    }],
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
