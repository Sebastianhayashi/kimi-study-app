'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createSpecialistSubrunScheduler } = require('../lib/company/specialist-subrun-scheduler');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function nextTurn() {
  return new Promise((resolve) => setImmediate(resolve));
}

function harness() {
  const starts = [];
  const waits = new Map();
  const specialistOrchestrator = {
    async start(input) {
      starts.push(structuredClone(input));
      const runId = `run_${input.role}`;
      if (!waits.has(runId)) waits.set(runId, deferred());
      return {
        subrunId: `subrun_${input.role}`,
        run: {
          id: runId,
          parentRunId: input.parentRunId,
          workId: 'work_fixture',
          employeeId: null,
          status: 'queued',
        },
      };
    },
    wait(runId) {
      if (!waits.has(runId)) waits.set(runId, deferred());
      return waits.get(runId).promise;
    },
  };
  return {
    starts,
    waits,
    scheduler: createSpecialistSubrunScheduler({ specialistOrchestrator }),
  };
}

function node(id, role, dependsOn = []) {
  return {
    id,
    role,
    objective: `${role} objective`,
    skillIds: [`bundle:${role}`],
    dependsOn,
    delegationEnvelope: { allow: ['workspace.read'], deny: ['git.push'] },
  };
}

test('dependent specialist starts as soon as its own prerequisites finish without waiting for unrelated work', async () => {
  const fixture = harness();
  const execution = fixture.scheduler.run({
    parentRunId: 'run_manager',
    subruns: [
      node('research', 'research'),
      node('comparisons', 'comparisons'),
      node('teach', 'teach', ['research']),
    ],
  });

  await nextTurn();
  assert.deepEqual(fixture.starts.map((item) => item.role).sort(), ['comparisons', 'research']);
  assert.equal(fixture.starts.some((item) => item.role === 'teach'), false);

  fixture.waits.get('run_research').resolve({ id: 'run_research', status: 'completed', summary: 'research done' });
  await nextTurn();
  assert.equal(fixture.starts.filter((item) => item.role === 'teach').length, 1);
  assert.equal(fixture.waits.get('run_comparisons').promise instanceof Promise, true);

  fixture.waits.get('run_teach').resolve({ id: 'run_teach', status: 'completed', summary: 'teaching done' });
  await nextTurn();
  fixture.waits.get('run_comparisons').resolve({ id: 'run_comparisons', status: 'completed', summary: 'comparison done' });
  const result = await execution;

  assert.equal(result.status, 'completed');
  assert.deepEqual(result.subruns.map((item) => [item.id, item.status]), [
    ['research', 'completed'],
    ['comparisons', 'completed'],
    ['teach', 'completed'],
  ]);
});

test('failed prerequisite blocks dependent specialist work instead of starting it', async () => {
  const fixture = harness();
  const execution = fixture.scheduler.run({
    parentRunId: 'run_manager',
    subruns: [
      node('research', 'research'),
      node('teach', 'teach', ['research']),
    ],
  });

  await nextTurn();
  fixture.waits.get('run_research').resolve({ id: 'run_research', status: 'failed', error: 'source unavailable' });
  const result = await execution;

  assert.deepEqual(fixture.starts.map((item) => item.role), ['research']);
  assert.equal(result.status, 'failed');
  assert.deepEqual(result.subruns.map((item) => [item.id, item.status]), [
    ['research', 'failed'],
    ['teach', 'blocked'],
  ]);
  assert.match(result.subruns.find((item) => item.id === 'teach').reason, /research/);
});

test('dependency cycles are rejected before any specialist Run is created', async () => {
  const fixture = harness();

  await assert.rejects(
    fixture.scheduler.run({
      parentRunId: 'run_manager',
      subruns: [
        node('research', 'research', ['teach']),
        node('teach', 'teach', ['research']),
      ],
    }),
    /Specialist subrun dependency cycle/,
  );
  assert.deepEqual(fixture.starts, []);
});

test('unknown dependencies and duplicate schedule ids fail before execution', async () => {
  const fixture = harness();

  await assert.rejects(
    fixture.scheduler.run({
      parentRunId: 'run_manager',
      subruns: [node('teach', 'teach', ['missing'])],
    }),
    /Unknown specialist dependency: missing/,
  );
  await assert.rejects(
    fixture.scheduler.run({
      parentRunId: 'run_manager',
      subruns: [node('research', 'research'), node('research', 'comparisons')],
    }),
    /Duplicate specialist schedule id: research/,
  );
  assert.deepEqual(fixture.starts, []);
});
