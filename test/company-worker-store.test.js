'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createWorkerStore } = require('../lib/company/worker-store');
const { createRunStore } = require('../lib/company/run-store');

function tempRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lucubro-worker-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

test('Worker identity is durable while mutable metadata can be refreshed', (t) => {
  const root = tempRoot(t);
  let tick = 0;
  const now = () => `2026-08-09T04:40:0${tick++}.000Z`;

  const firstStore = createWorkerStore({ rootDir: root, now });
  const created = firstStore.upsert({
    id: 'worker_local',
    name: 'Studio NixOS',
    kind: 'self-hosted',
  });

  assert.equal(created.id, 'worker_local');
  assert.equal(created.name, 'Studio NixOS');
  assert.equal(created.kind, 'self-hosted');
  assert.equal(created.createdAt, '2026-08-09T04:40:00.000Z');

  const secondStore = createWorkerStore({ rootDir: root, now });
  const refreshed = secondStore.upsert({
    id: 'worker_local',
    name: 'Studio Worker',
    kind: 'self-hosted',
  });

  assert.equal(refreshed.id, created.id);
  assert.equal(refreshed.createdAt, created.createdAt);
  assert.equal(refreshed.name, 'Studio Worker');
  assert.equal(refreshed.updatedAt, '2026-08-09T04:40:01.000Z');
  assert.deepEqual(secondStore.list().map((worker) => worker.id), ['worker_local']);
});

test('Run records the Worker that executed the attempt', (t) => {
  const root = tempRoot(t);
  const runStore = createRunStore({ rootDir: root, now: () => '2026-08-09T04:41:00.000Z' });

  const run = runStore.create({
    id: 'run_worker_contract',
    workId: 'work_worker_contract',
    employeeId: 'ben',
    workerId: 'worker_local',
    runtime: 'mock',
  });

  assert.equal(run.employeeId, 'ben');
  assert.equal(run.workerId, 'worker_local');
  assert.equal(run.runtime, 'mock');
  assert.equal(runStore.get(run.id).workerId, 'worker_local');
});
