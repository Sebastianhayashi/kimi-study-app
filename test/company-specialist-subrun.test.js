'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createExecutionWorkspaceManager } = require('../lib/company/execution-workspace-manager');
const { createRunOrchestrator } = require('../lib/company/run-orchestrator');
const { createRunStore } = require('../lib/company/run-store');
const { createSpecialistSubrunOrchestrator } = require('../lib/company/specialist-subrun-orchestrator');
const { createWorkStore } = require('../lib/company/work-store');

function tempRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lucubro-specialist-subrun-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

const researchSelection = {
  skillId: 'mattpocock-skills:research',
  activation: 'model',
  userIntentEvidence: null,
  compatibilityStatus: 'native',
  overlay: null,
};

function workPlan() {
  return {
    complexity: 'compound',
    durability: 'saved-work',
    projectAction: 'none',
    issueAction: 'none',
    skillSelections: [
      researchSelection,
      {
        skillId: 'mattpocock-skills:teach',
        activation: 'user-intent',
        userIntentEvidence: 'Teach me',
        compatibilityStatus: 'native',
        overlay: null,
      },
    ],
    skillGraph: {
      skillIds: ['mattpocock-skills:research', 'mattpocock-skills:teach'],
      files: [],
      skillRoots: [],
      diagnostics: [],
    },
    staffing: {
      manager: true,
      specialistSubruns: [{ role: 'research', skillIds: ['mattpocock-skills:research'] }],
    },
    evidenceRequired: true,
    deliverable: 'canvas-artifact',
    reasonCodes: ['external-facts'],
  };
}

function setup(t) {
  const root = tempRoot(t);
  const workStore = createWorkStore({ rootDir: root, now: () => '2026-08-09T10:50:00.000Z' });
  const runStore = createRunStore({ rootDir: root, now: () => '2026-08-09T10:50:00.000Z' });
  const work = workStore.create({
    id: 'work_coffee',
    brief: 'Teach me about coffee roasts.',
    assignedEmployeeId: 'ben',
    runtime: 'mock',
    plan: workPlan(),
  });
  const parentRun = runStore.create({
    id: 'run_manager',
    workId: work.id,
    employeeId: 'ben',
    workerId: 'worker_local',
    runtime: 'mock',
    status: 'running',
    delegationEnvelope: {
      allow: ['workspace.read', 'workspace.write'],
      deny: ['network.access', 'git.push'],
    },
  });
  const runtimeRequests = [];
  const mountBuilds = [];
  const runOrchestrator = createRunOrchestrator({
    runStore,
    approvalBroker: { async request() { return 'deny'; } },
    runtimeRegistry: new Map([['mock', {
      async *run(request) {
        runtimeRequests.push(structuredClone({
          runId: request.runId,
          subrunId: request.subrunId,
          workId: request.workId,
          employeeId: request.employeeId,
          cwd: request.cwd,
          prompt: request.prompt,
          skillMount: request.skillMount,
          delegationEnvelope: request.delegationEnvelope,
        }));
        yield {
          type: 'skill.mounted',
          receipt: {
            verified: true,
            runId: request.runId,
            subrunId: request.subrunId,
            skills: request.skillMount.expectedSkills,
          },
        };
        yield { type: 'run.completed', summary: 'Research complete' };
      },
    }]]),
    workspaceManager: createExecutionWorkspaceManager({ rootDir: root }),
    skillMountBuilder: {
      build(input) {
        mountBuilds.push(structuredClone(input));
        return {
          root: path.join(root, 'skill-mounts', input.runId, input.subrunId),
          expectedSkills: input.selections.map((selection) => ({
            skillId: selection.skillId,
            name: selection.skillId.split(':')[1],
          })),
        };
      },
    },
    createId: () => 'run_specialist_research',
  });
  const specialists = createSpecialistSubrunOrchestrator({
    workStore,
    runStore,
    runOrchestrator,
    createSubrunId: () => 'subrun_research',
  });
  return { root, workStore, runStore, work, parentRun, runtimeRequests, mountBuilds, runOrchestrator, specialists };
}

test('Manager can start a bounded specialist child Run from planned Skills without creating Employee state', async (t) => {
  const fixture = setup(t);

  const started = await fixture.specialists.start({
    parentRunId: fixture.parentRun.id,
    role: 'research',
    objective: 'Research reliable facts about coffee roast levels.',
    skillIds: ['mattpocock-skills:research'],
    delegationEnvelope: { allow: ['workspace.read'], deny: ['workspace.write'] },
  });
  const finalRun = await fixture.specialists.wait(started.run.id);

  assert.equal(started.subrunId, 'subrun_research');
  assert.equal(started.run.parentRunId, fixture.parentRun.id);
  assert.equal(started.run.subrunId, 'subrun_research');
  assert.equal(started.run.role, 'research');
  assert.equal(started.run.workId, fixture.work.id);
  assert.equal(started.run.employeeId, null);
  assert.deepEqual(started.run.delegationEnvelope, {
    allow: ['workspace.read'],
    deny: ['network.access', 'git.push', 'workspace.write'],
  });
  assert.equal(finalRun.status, 'completed');
  assert.equal(finalRun.summary, 'Research complete');

  assert.deepEqual(fixture.mountBuilds, [{
    runId: 'run_specialist_research',
    subrunId: 'subrun_research',
    selections: [researchSelection],
  }]);
  assert.equal(fixture.runtimeRequests.length, 1);
  assert.equal(fixture.runtimeRequests[0].employeeId, null);
  assert.equal(fixture.runtimeRequests[0].prompt, 'Research reliable facts about coffee roast levels.');
  assert.equal(fixture.runtimeRequests[0].skillMount.expectedSkills[0].skillId, 'mattpocock-skills:research');
  assert.deepEqual(fixture.runtimeRequests[0].delegationEnvelope, {
    allow: ['workspace.read'],
    deny: ['network.access', 'git.push', 'workspace.write'],
  });

  const parentEvents = fixture.runStore.readEvents(fixture.parentRun.id);
  assert.equal(parentEvents.some((event) => event.type === 'subrun.started' && event.subrunId === 'subrun_research'), true);
  assert.equal(parentEvents.some((event) => event.type === 'subrun.completed' && event.childRunId === finalRun.id), true);
  assert.deepEqual(fixture.workStore.get(fixture.work.id).plan, workPlan());
});

test('Specialist cannot mount a Skill that was not selected by the owning Work plan', async (t) => {
  const fixture = setup(t);

  await assert.rejects(
    fixture.specialists.start({
      parentRunId: fixture.parentRun.id,
      role: 'browser-qa',
      objective: 'Run browser QA.',
      skillIds: ['gstack:qa'],
      delegationEnvelope: { allow: ['workspace.read'], deny: [] },
    }),
    /Specialist Skill is not selected by the owning Work plan: gstack:qa/,
  );

  assert.equal(fixture.runStore.get('run_specialist_research'), null);
  assert.equal(fixture.runtimeRequests.length, 0);
  assert.equal(fixture.mountBuilds.length, 0);
});

test('Specialist cannot expand authority beyond the parent Run Delegation Envelope', async (t) => {
  const fixture = setup(t);

  await assert.rejects(
    fixture.specialists.start({
      parentRunId: fixture.parentRun.id,
      role: 'research',
      objective: 'Research using the network.',
      skillIds: ['mattpocock-skills:research'],
      delegationEnvelope: { allow: ['workspace.read', 'network.access'], deny: [] },
    }),
    /Specialist Delegation Envelope expands parent authority: network.access/,
  );

  assert.equal(fixture.runStore.get('run_specialist_research'), null);
  assert.equal(fixture.runtimeRequests.length, 0);
  assert.equal(fixture.mountBuilds.length, 0);
});
