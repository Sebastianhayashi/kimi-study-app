'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createEvidenceStore } = require('../lib/company/evidence-store');

function tempRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lucubro-evidence-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

test('Evidence metadata and bytes survive store recreation without exposing storage paths', (t) => {
  const root = tempRoot(t);
  const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
  const first = createEvidenceStore({
    rootDir: root,
    now: () => '2026-08-09T05:50:00.000Z',
    createId: () => 'evidence_fixture',
  });

  const created = first.create({
    runId: 'run_fixture',
    workId: 'work_fixture',
    workerId: 'worker_fixture',
    kind: 'screenshot',
    label: 'Browser milestone',
    mimeType: 'image/png',
    source: 'deterministic-mock',
    metadata: { deterministic: true, url: 'https://fixture.invalid/company' },
    content: bytes,
  });

  assert.deepEqual(created, {
    id: 'evidence_fixture',
    runId: 'run_fixture',
    workId: 'work_fixture',
    workerId: 'worker_fixture',
    kind: 'screenshot',
    label: 'Browser milestone',
    mimeType: 'image/png',
    source: 'deterministic-mock',
    metadata: { deterministic: true, url: 'https://fixture.invalid/company' },
    byteLength: bytes.length,
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    createdAt: '2026-08-09T05:50:00.000Z',
  });
  assert.equal(Object.hasOwn(created, 'path'), false);
  assert.equal(Object.hasOwn(created, 'content'), false);

  const second = createEvidenceStore({ rootDir: root });
  assert.deepEqual(second.get('evidence_fixture'), created);
  assert.deepEqual(second.listByRun('run_fixture'), [created]);
  assert.deepEqual(second.listByWork('work_fixture'), [created]);
  assert.deepEqual(second.readContent('evidence_fixture'), bytes);
});

test('Work Evidence aggregates across specialist Runs without crossing Work boundaries', (t) => {
  const root = tempRoot(t);
  let counter = 0;
  const store = createEvidenceStore({
    rootDir: root,
    createId: () => `evidence_work_${++counter}`,
    now: () => `2026-08-09T05:5${counter}:00.000Z`,
  });
  const research = store.create({
    runId: 'run_research',
    workId: 'work_coffee',
    workerId: 'worker_fixture',
    kind: 'source-page',
    label: 'Research source',
    mimeType: 'text/plain',
    source: 'web',
    content: 'source',
  });
  const teaching = store.create({
    runId: 'run_teach',
    workId: 'work_coffee',
    workerId: 'worker_fixture',
    kind: 'teaching-note',
    label: 'Teaching evidence',
    mimeType: 'text/plain',
    source: 'skill-output',
    content: 'teaching',
  });
  store.create({
    runId: 'run_other',
    workId: 'work_other',
    workerId: 'worker_fixture',
    kind: 'source-page',
    label: 'Other Work source',
    mimeType: 'text/plain',
    source: 'web',
    content: 'other',
  });

  assert.deepEqual(store.listByWork('work_coffee').map((item) => item.id), [research.id, teaching.id]);
  assert.deepEqual(store.listByRun('run_research').map((item) => item.id), [research.id]);
});

test('Evidence ids and content size are bounded by the store contract', (t) => {
  const root = tempRoot(t);
  const store = createEvidenceStore({ rootDir: root, maxBytes: 8, createId: () => 'evidence_safe' });

  assert.throws(() => store.create({
    runId: '../run', workId: 'work', workerId: 'worker', kind: 'log', label: 'Bad', mimeType: 'text/plain', content: 'x',
  }), /Invalid Run id/);

  assert.throws(() => store.create({
    runId: 'run', workId: 'work', workerId: 'worker', kind: 'log', label: 'Too big', mimeType: 'text/plain', content: '123456789',
  }), /exceeds/);
});
