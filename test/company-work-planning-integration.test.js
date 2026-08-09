'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createCompanyService } = require('../lib/company/company-service');
const { createWorkStore } = require('../lib/company/work-store');
const { createRunStore } = require('../lib/company/run-store');

function tempRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lucubro-work-planning-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function coffeePlan() {
  return {
    complexity: 'compound',
    durability: 'saved-work',
    projectAction: 'none',
    issueAction: 'none',
    skillSelections: [
      {
        skillId: 'mattpocock-skills:research',
        activation: 'model',
        userIntentEvidence: null,
        compatibilityStatus: 'native',
        overlay: null,
      },
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
    reasonCodes: ['external-facts', 'explicit-learning-intent'],
  };
}

test('WorkStore persists validated public planning state across store recreation', (t) => {
  const root = tempRoot(t);
  const first = createWorkStore({ rootDir: root, now: () => '2026-08-09T10:30:00.000Z' });
  const plan = coffeePlan();

  const created = first.create({
    id: 'work_planned_fixture',
    brief: 'Teach me about coffee roasting.',
    repoDir: '/workspace/fixture',
    runtime: 'mock',
    plan,
  });

  assert.deepEqual(created.plan, plan);
  const second = createWorkStore({ rootDir: root, now: () => '2026-08-09T10:31:00.000Z' });
  assert.deepEqual(second.get(created.id).plan, plan);
});

test('CompanyService plans before starting Run, persists the plan, and passes selected Skills to orchestration', async (t) => {
  const root = tempRoot(t);
  const workStore = createWorkStore({ rootDir: root, now: () => '2026-08-09T10:32:00.000Z' });
  const runStore = createRunStore({ rootDir: root, now: () => '2026-08-09T10:32:00.000Z' });
  const plan = coffeePlan();
  const plannerCalls = [];
  const workPlanner = {
    async plan(input) {
      plannerCalls.push(structuredClone(input));
      return structuredClone(plan);
    },
  };
  let startedRequest = null;
  const runOrchestrator = {
    async start(request) {
      startedRequest = structuredClone(request);
      return runStore.create({
        id: 'run_planned_fixture',
        workId: request.workId,
        employeeId: request.employeeId,
        workerId: request.workerId,
        runtime: request.runtime,
        cwd: request.repoDir,
      });
    },
    wait() { return new Promise(() => {}); },
  };
  const company = createCompanyService({
    workStore,
    runStore,
    runOrchestrator,
    workPlanner,
    defaultWorkerId: 'worker_local',
    createWorkId: () => 'work_planned_fixture',
  });

  const result = await company.createCodingWork({
    brief: 'Teach me about coffee roasting.',
    repoDir: '/workspace/fixture',
    runtime: 'mock',
  });

  assert.equal(plannerCalls.length, 1);
  assert.equal(plannerCalls[0].intent, 'Teach me about coffee roasting.');
  assert.deepEqual(plannerCalls[0].relatedWork, []);
  assert.equal(plannerCalls[0].project, null);
  assert.deepEqual(result.work.plan, plan);
  assert.deepEqual(workStore.get(result.work.id).plan, plan);
  assert.deepEqual(startedRequest.skillSelections, plan.skillSelections);
  assert.equal(Object.hasOwn(startedRequest, 'skillMount'), false);
});

test('CompanyService does not persist a Work or start a Run when planning fails', async (t) => {
  const root = tempRoot(t);
  const workStore = createWorkStore({ rootDir: root });
  const runStore = createRunStore({ rootDir: root });
  let started = false;
  const company = createCompanyService({
    workStore,
    runStore,
    runOrchestrator: {
      async start() { started = true; throw new Error('must not start'); },
      wait() { return Promise.resolve(null); },
    },
    workPlanner: {
      async plan() { throw new Error('planner rejected invalid Skill activation'); },
    },
    defaultWorkerId: 'worker_local',
    createWorkId: () => 'work_must_not_exist',
  });

  await assert.rejects(
    company.createCodingWork({ brief: 'Do a task', repoDir: '/workspace/fixture', runtime: 'mock' }),
    /planner rejected invalid Skill activation/,
  );
  assert.equal(started, false);
  assert.equal(workStore.get('work_must_not_exist'), null);
});
