'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  SCHEMA_VERSION,
  operationStateEnabled,
  readOperation,
  writeOperation,
  projectOperation,
} = require('../lib/operation-state');

function tempCourse(name = 'course1') {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'lucubro-operation-'));
  const root = path.join(parent, name);
  fs.mkdirSync(root, { recursive: true });
  return root;
}

function writeJson(root, name, value) {
  fs.writeFileSync(path.join(root, name), `${JSON.stringify(value, null, 2)}\n`);
}

test('writes and reads a versioned operation snapshot atomically', () => {
  const root = tempCourse();
  const now = new Date('2026-07-26T01:00:00.000Z');
  const written = writeOperation(root, {
    operationId: 'operation-1',
    kind: 'first-course',
    state: 'running',
    phase: 'claims',
    progressEvidence: { units: 3, claims: 2, lessons: 0 },
    currentMessageKey: 'first-course.claims',
    retryable: false,
  }, { now });

  assert.equal(written.schemaVersion, SCHEMA_VERSION);
  assert.equal(written.operationId, 'operation-1');
  assert.equal(written.courseId, 'course1');
  assert.equal(written.updatedAt, now.toISOString());
  assert.deepEqual(readOperation(root), written);
  assert.equal(fs.existsSync(path.join(root, 'operation.json.lock')), false);
  assert.deepEqual(
    fs.readdirSync(root).filter((name) => name.includes('.tmp')),
    [],
  );
});

test('migrates a legacy operation schema on the next write', () => {
  const root = tempCourse('legacycourse');
  writeJson(root, 'operation.json', {
    schemaVersion: 0,
    runId: 'legacy-run',
    operationKind: 'next-lesson',
    status: 'active',
    phase: 'assembling',
    metrics: { lessons: 1, candidates: 4 },
    time: '2026-07-26T02:00:00.000Z',
  });

  const migrated = writeOperation(root, {
    state: 'ready',
    phase: 'complete',
    publishedArtifact: 2,
  }, { now: new Date('2026-07-26T02:01:00.000Z') });

  assert.equal(migrated.schemaVersion, 1);
  assert.equal(migrated.operationId, 'legacy-run');
  assert.equal(migrated.kind, 'next-lesson');
  assert.equal(migrated.state, 'ready');
  assert.equal(migrated.progressEvidence.candidates, 4);
  assert.equal(migrated.progressEvidence.lessons, 1);
  assert.equal(migrated.publishedArtifact, 2);
  assert.equal(migrated.finishedAt, '2026-07-26T02:01:00.000Z');
});

test('lazily derives a snapshot from job.json and generation events without persisting it', () => {
  const root = tempCourse('legacyjob');
  fs.mkdirSync(path.join(root, 'lessons'));
  fs.mkdirSync(path.join(root, 'assessments'));
  fs.writeFileSync(path.join(root, 'book.txt'), 'fixture');
  fs.writeFileSync(path.join(root, 'RESOURCES.md'), '# resources');
  writeJson(root, 'job.json', {
    stage: 'generating',
    runId: 'run-legacy-job',
    kind: 'course-generation',
    phase: 'profiling',
    startedAt: '2026-07-26T03:00:00.000Z',
    updatedAt: '2026-07-26T03:00:05.000Z',
  });
  fs.writeFileSync(path.join(root, 'generation-events.jsonl'), `${JSON.stringify({
    id: 1,
    time: '2026-07-26T03:00:05.000Z',
    runId: 'run-legacy-job',
    phase: 'profiling',
    state: 'active',
  })}\n`);

  const snapshot = readOperation(root);
  assert.equal(snapshot.operationId, 'run-legacy-job');
  assert.equal(snapshot.kind, 'first-course');
  assert.equal(snapshot.state, 'running');
  assert.equal(snapshot.phase, 'profiling');
  assert.equal(snapshot.progressEvidence.lessons, 0);
  assert.equal(fs.existsSync(path.join(root, 'operation.json')), false);
});

test('projects one canonical snapshot into the shared frontend shape', () => {
  const root = tempCourse('projection');
  const snapshot = writeOperation(root, {
    operationId: 'next-2',
    kind: 'next-lesson',
    state: 'running',
    phase: 'validating',
    progressEvidence: { lessons: 1 },
    publishedArtifact: 1,
  }, { now: new Date('2026-07-26T04:00:00.000Z') });

  const projection = projectOperation(snapshot, { courseDir: root, lessons: 1, assessments: 1, busy: true });
  assert.equal(projection.schemaVersion, 1);
  assert.equal(projection.state, 'running');
  assert.equal(projection.stage, 'generating');
  assert.equal(projection.progress, 96);
  assert.equal(projection.phase, 'validating');
  assert.equal(projection.busy, true);
  assert.equal(projection.lessons, 1);
  assert.match(projection.currentMessage, /检查新增课节/);
  assert.equal(projection.history.filter((item) => item.state === 'active').length, 1);
});

test('keeps updatedAt monotonic for same-time writes from competing windows', () => {
  const root = tempCourse('monotonic');
  const now = new Date('2026-07-26T05:00:00.000Z');
  const first = writeOperation(root, { operationId: 'same-run', state: 'running', phase: 'extracting' }, { now });
  const second = writeOperation(root, { operationId: 'same-run', state: 'running', phase: 'profiling' }, { now });
  assert.ok(Date.parse(second.updatedAt) > Date.parse(first.updatedAt));
});


test('terminal snapshots reject same-run late active writes', () => {
  const root = tempCourse('terminal-race');
  const finishedAt = new Date('2026-07-26T06:00:00.000Z');
  writeOperation(root, {
    operationId: 'terminal-run',
    kind: 'next-lesson',
    state: 'cancelled',
    phase: 'assembling',
    retryable: true,
  }, { now: finishedAt });

  const result = writeOperation(root, {
    operationId: 'terminal-run',
    state: 'running',
    phase: 'validating',
  }, { now: new Date('2026-07-26T06:00:01.000Z') });

  assert.equal(result.state, 'cancelled');
  assert.equal(result.phase, 'assembling');
  assert.deepEqual(readOperation(root), result);
});

test('a new explicit start replaces a terminal run while late callbacks from the old run are ignored', () => {
  const root = tempCourse('retry-race');
  writeOperation(root, {
    operationId: 'old-run',
    kind: 'next-lesson',
    state: 'failed',
    phase: 'assembling',
    retryable: true,
  }, { now: new Date('2026-07-26T07:00:00.000Z') });

  const retry = writeOperation(root, {
    operationId: 'new-run',
    kind: 'next-lesson',
    state: 'running',
    phase: 'extracting',
    startedAt: '2026-07-26T07:00:01.000Z',
    retryable: false,
  }, { now: new Date('2026-07-26T07:00:01.000Z') });
  assert.equal(retry.operationId, 'new-run');
  assert.equal(retry.state, 'running');

  const lateOldFailure = writeOperation(root, {
    operationId: 'old-run',
    kind: 'next-lesson',
    state: 'failed',
    phase: 'validating',
    retryable: true,
  }, { now: new Date('2026-07-26T07:00:02.000Z') });
  assert.equal(lateOldFailure.operationId, 'new-run');
  assert.equal(lateOldFailure.state, 'running');
  assert.deepEqual(readOperation(root), lateOldFailure);
});

test('LUCUBRO_OPERATION_STATE=0 disables the canonical path', () => {
  assert.equal(operationStateEnabled({ LUCUBRO_OPERATION_STATE: '0' }), false);
  assert.equal(operationStateEnabled({ LUCUBRO_OPERATION_STATE: '1' }), true);
  assert.equal(operationStateEnabled({}), true);
});
