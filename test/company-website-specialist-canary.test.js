'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createRunOrchestrator } = require('../lib/company/run-orchestrator');
const { createRunStore } = require('../lib/company/run-store');
const { createSpecialistSubrunOrchestrator } = require('../lib/company/specialist-subrun-orchestrator');
const { createSpecialistSubrunScheduler } = require('../lib/company/specialist-subrun-scheduler');
const { createWorkStore } = require('../lib/company/work-store');

function tempRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lucubro-website-specialists-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

const skillIds = [
  'gstack:office-hours',
  'mattpocock-skills:to-spec',
  'gstack:design-review',
  'mattpocock-skills:implement',
  'gstack:review',
  'gstack:qa',
];

function selection(skillId) {
  return {
    skillId,
    activation: 'model',
    userIntentEvidence: null,
    compatibilityStatus: skillId === 'gstack:office-hours' ? 'overlay-required' : 'native',
    overlay: skillId === 'gstack:office-hours' ? { id: 'question-bridge', version: 1 } : null,
  };
}

function websitePlan(schedule) {
  return {
    complexity: 'complex',
    durability: 'saved-work',
    projectAction: 'consider-after-frontier',
    issueAction: 'none',
    skillSelections: skillIds.map(selection),
    skillGraph: { skillIds: [...skillIds], files: [], skillRoots: [], diagnostics: [] },
    staffing: {
      manager: true,
      specialistSubruns: schedule.map(({ id, role, skillIds: selected, dependsOn }) => ({
        id,
        role,
        skillIds: [...selected],
        dependsOn: [...dependsOn],
      })),
    },
    evidenceRequired: true,
    deliverable: 'canvas-artifact',
    reasonCodes: ['multi-stage-build'],
  };
}

function schedule() {
  return [
    { id: 'discovery', role: 'discovery', objective: 'Challenge the product website idea and define the narrowest useful outcome.', skillIds: ['gstack:office-hours'], dependsOn: [] },
    { id: 'spec', role: 'spec', objective: 'Turn the accepted website outcome into an implementation-ready specification.', skillIds: ['mattpocock-skills:to-spec'], dependsOn: ['discovery'] },
    { id: 'design', role: 'design', objective: 'Review and sharpen the website interaction and visual direction.', skillIds: ['gstack:design-review'], dependsOn: ['spec'] },
    { id: 'implement', role: 'implementation', objective: 'Implement the approved website specification.', skillIds: ['mattpocock-skills:implement'], dependsOn: ['design'] },
    { id: 'review', role: 'review', objective: 'Review the implementation for correctness and maintainability.', skillIds: ['gstack:review'], dependsOn: ['implement'] },
    { id: 'qa', role: 'qa', objective: 'Verify the implemented website behavior in the browser.', skillIds: ['gstack:qa'], dependsOn: ['implement'] },
  ];
}

test('Website Build composes existing specialist Skills without a website-specific Skill or temporary Employees', async (t) => {
  const root = tempRoot(t);
  const workStore = createWorkStore({ rootDir: root, now: () => '2026-08-09T11:10:00.000Z' });
  const runStore = createRunStore({ rootDir: root, now: () => '2026-08-09T11:10:00.000Z' });
  const specialistSchedule = schedule();
  const work = workStore.create({
    id: 'work_website',
    brief: 'Help me decide whether this product website is worth building, design it, implement it, and verify it works.',
    assignedEmployeeId: 'ben',
    runtime: 'mock',
    plan: websitePlan(specialistSchedule),
  });
  const parentRun = runStore.create({
    id: 'run_website_manager',
    workId: work.id,
    employeeId: 'ben',
    workerId: 'worker_local',
    runtime: 'mock',
    status: 'running',
    delegationEnvelope: {
      allow: ['workspace.read', 'workspace.write', 'shell.execute'],
      deny: ['git.push', 'network.access'],
    },
  });

  const runtimeRequests = [];
  const mountBuilds = [];
  let runCounter = 0;
  let subrunCounter = 0;
  const runOrchestrator = createRunOrchestrator({
    runStore,
    approvalBroker: { async request() { return 'deny'; } },
    runtimeRegistry: new Map([['mock', {
      async *run(request) {
        runtimeRequests.push(structuredClone({
          runId: request.runId,
          subrunId: request.subrunId,
          employeeId: request.employeeId,
          prompt: request.prompt,
          skillIds: request.skillMount.expectedSkills.map((skill) => skill.skillId),
          delegationEnvelope: request.delegationEnvelope,
        }));
        yield { type: 'skill.mounted', receipt: { verified: true, runId: request.runId, subrunId: request.subrunId, skills: request.skillMount.expectedSkills } };
        yield { type: 'run.completed', summary: `${request.subrunId} complete` };
      },
    }]]),
    workspaceManager: {
      async create({ runId }) { return { kind: 'scratch', cwd: path.join(root, 'execution-workspaces', runId), branch: null }; },
      async inspect() { return { diff: '', changedFiles: [] }; },
    },
    skillMountBuilder: {
      build(input) {
        mountBuilds.push(structuredClone(input));
        return {
          root: path.join(root, 'skill-mounts', input.runId, input.subrunId),
          expectedSkills: input.selections.map((item) => ({ skillId: item.skillId, name: item.skillId.split(':')[1] })),
        };
      },
    },
    createId: () => `run_website_specialist_${++runCounter}`,
  });
  const specialists = createSpecialistSubrunOrchestrator({
    workStore,
    runStore,
    runOrchestrator,
    createSubrunId: () => `subrun_website_${++subrunCounter}`,
  });
  const scheduler = createSpecialistSubrunScheduler({ specialistOrchestrator: specialists });

  const result = await scheduler.run({
    parentRunId: parentRun.id,
    subruns: specialistSchedule.map((item) => ({
      ...item,
      delegationEnvelope: { allow: ['workspace.read'], deny: ['workspace.write', 'shell.execute'] },
    })),
  });

  assert.equal(result.status, 'completed');
  assert.equal(result.subruns.length, 6);
  assert.equal(runtimeRequests.length, 6);
  assert.equal(mountBuilds.length, 6);
  assert.ok(runtimeRequests.every((request) => request.employeeId === null));
  assert.ok(runtimeRequests.every((request) => request.skillIds.length === 1));
  assert.deepEqual(new Set(runtimeRequests.flatMap((request) => request.skillIds)), new Set(skillIds));
  assert.equal(skillIds.some((skillId) => /website/i.test(skillId)), false);
  assert.match(work.brief, /product website/i);
  assert.equal(/office-hours|to-spec|design-review|implement|gstack/i.test(work.brief), false);

  const childRuns = runStore.list().filter((run) => run.parentRunId === parentRun.id);
  assert.equal(childRuns.length, 6);
  assert.ok(childRuns.every((run) => run.employeeId === null));
  assert.ok(childRuns.every((run) => run.delegationEnvelope.allow.length === 1 && run.delegationEnvelope.allow[0] === 'workspace.read'));

  const parentEvents = runStore.readEvents(parentRun.id);
  assert.equal(parentEvents.filter((event) => event.type === 'subrun.started').length, 6);
  assert.equal(parentEvents.filter((event) => event.type === 'subrun.completed').length, 6);
  assert.deepEqual(workStore.get(work.id).plan.skillSelections.map((item) => item.skillId), skillIds);
});
