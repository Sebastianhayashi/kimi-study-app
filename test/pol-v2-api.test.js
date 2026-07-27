'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { changedExistingWorkspaceFiles } = require('../lib/next-lesson');

const ROOT = path.resolve(__dirname, '..');

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

function writeCourse(coursesDir, courseId = 'polcourse') {
  const dir = path.join(coursesDir, courseId);
  fs.mkdirSync(path.join(dir, 'lessons'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'assessments'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ title: 'Flag A source course', createdAt: new Date().toISOString() }, null, 2));
  fs.writeFileSync(path.join(dir, 'job.json'), JSON.stringify({ stage: 'ready', currentMessage: 'Ready', updatedAt: new Date().toISOString() }, null, 2));
  fs.writeFileSync(path.join(dir, 'MISSION.md'), [
    '# Mission: Publish a source-grounded Zhihu answer',
    '',
    '## Why',
    'The draft lacks a source-grounded causal explanation.',
    '',
    '## Success looks like',
    '- Produce a publishable Zhihu answer for product managers.',
    '- The central causal claim cites the source mechanism.',
    '',
    '## Constraints',
    '- Keep the answer under 1500 words.',
    '',
    '## Out of scope',
    '- Rewriting the source book.',
    '',
  ].join('\n'));
  fs.writeFileSync(path.join(dir, 'lessons', '0001-intro.html'), '<!doctype html><html><body><h1>First lesson</h1><div data-kimi-activity="hinge-1"></div><div data-kimi-activity="transfer-1"></div></body></html>');
  fs.writeFileSync(path.join(dir, 'assessments', '0001-intro.json'), JSON.stringify({
    schemaVersion: 1,
    lessonId: '0001-intro',
    title: 'First lesson',
    claims: [{ id: 'claim-1', label: 'Explain the mechanism', description: 'Supports the output', sourceRefs: ['book.txt#1'], mastery: { requiredPassed: 2, requiredStages: ['independent', 'transfer'] } }],
    activities: [],
  }, null, 2));
  return dir;
}

function writeFakeKimi(binDir) {
  fs.mkdirSync(binDir, { recursive: true });
  const file = path.join(binDir, 'kimi');
  fs.writeFileSync(file, `#!/usr/bin/env node
const critique = {gaps:[{rubricItemId:'r_claim',summary:'The causal bridge is not supported.',severity:'high',evidence:'The draft asserts causality without a source-backed mechanism.',anchor:{exact:'Evidence anchor sentence.'},sourceRefs:['book.txt#mechanism']}]};
process.stdout.write(JSON.stringify({role:'assistant',content:JSON.stringify(critique)}) + '\\n');
`);
  fs.chmodSync(file, 0o755);
}

async function startServer(t, { enabled, runtimeRoot }) {
  const port = await freePort();
  const coursesDir = path.join(runtimeRoot, 'courses');
  const binDir = path.join(runtimeRoot, 'bin');
  fs.mkdirSync(coursesDir, { recursive: true });
  writeFakeKimi(binDir);
  const logs = [];
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(port),
      LUCUBRO_DATA_DIR: coursesDir,
      LUCUBRO_POL_V2: enabled ? '1' : '0',
      PATH: `${binDir}${path.delimiter}${process.env.PATH || ''}`,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => logs.push(String(chunk)));
  child.stderr.on('data', (chunk) => logs.push(String(chunk)));
  t.after(async () => {
    if (child.exitCode == null) child.kill('SIGTERM');
    await new Promise((resolve) => child.exitCode == null ? child.once('exit', resolve) : resolve());
  });
  const base = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child.exitCode != null) throw new Error(`server exited early (${child.exitCode})\n${logs.join('')}`);
    try {
      const response = await fetch(`${base}/api/courses`);
      if (response.ok) return { base, coursesDir, logs, child };
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`server did not become ready\n${logs.join('')}`);
}

async function json(base, pathname, { method = 'GET', body } = {}) {
  const response = await fetch(`${base}${pathname}`, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { response, value: await response.json().catch(() => ({})) };
}

function artifactInput(contentStorage = 'local-body') {
  return {
    taskType: 'zhihu-answer',
    title: 'Why causal explanations fail',
    audience: 'Product managers reviewing experiments',
    contentStorage,
    rubric: [
      { id: 'r_claim', label: 'Central claim', minimum: 'State one falsifiable causal claim', source: 'user' },
      { id: 'r_evidence', label: 'Evidence', minimum: 'Cite the source for every mechanism', source: 'user' },
      { id: 'r_action', label: 'Actionability', minimum: 'Give the reader a usable decision rule', source: 'user' },
    ],
  };
}

test('Flag-A routes and APIs are absent when LUCUBRO_POL_V2 is off', { timeout: 30_000 }, async (t) => {
  const runtimeRoot = path.join(ROOT, 'tests', '.runtime', `pol-off-${process.pid}-${Date.now()}`);
  t.after(() => fs.rmSync(runtimeRoot, { recursive: true, force: true }));
  const { base, coursesDir } = await startServer(t, { enabled: false, runtimeRoot });
  writeCourse(coursesDir);
  const api = await fetch(`${base}/api/artifacts`);
  const page = await fetch(`${base}/artifact/new`);
  const app = await fetch(`${base}/app`);
  assert.equal(api.status, 404);
  assert.equal(page.status, 404);
  assert.equal(app.status, 200);
  assert.doesNotMatch(await app.text(), /__LUCUBRO_FEATURES__/);
});

test('Flag-A artifact API preserves privacy, append-only events, critique decisions, and pre-baseline gap focus', { timeout: 60_000 }, async (t) => {
  const runtimeRoot = path.join(ROOT, 'tests', '.runtime', `pol-on-${process.pid}-${Date.now()}`);
  t.after(() => fs.rmSync(runtimeRoot, { recursive: true, force: true }));
  const coursesDir = path.join(runtimeRoot, 'courses');
  const courseDir = writeCourse(coursesDir);
  const { base } = await startServer(t, { enabled: true, runtimeRoot });

  const created = await json(base, '/api/artifacts', { method: 'POST', body: artifactInput() });
  assert.equal(created.response.status, 201);
  assert.equal(created.value.artifact.status, 'waiting_for_source');
  assert.equal(created.value.artifact.corpusConsent, false);
  const artifactId = created.value.artifact.id;
  const artifactDir = path.join(runtimeRoot, 'artifacts', artifactId);
  assert.equal(fs.existsSync(path.join(artifactDir, 'draft.md')), true);

  const linked = await json(base, `/api/artifacts/${artifactId}/link-course`, { method: 'POST', body: { courseId: 'polcourse' } });
  assert.equal(linked.response.status, 200);
  assert.equal(linked.value.artifact.primaryCourseId, 'polcourse');
  assert.equal(linked.value.artifact.status, 'draft');

  const saved = await json(base, `/api/artifacts/${artifactId}/draft`, {
    method: 'PUT',
    body: { expectedDraftVersion: 0, body: 'Opening claim. Evidence anchor sentence. Closing action.' },
  });
  assert.equal(saved.response.status, 200);
  assert.equal(saved.value.draftVersion, 1);
  const conflict = await json(base, `/api/artifacts/${artifactId}/draft`, {
    method: 'PUT',
    body: { expectedDraftVersion: 0, body: 'stale write' },
  });
  assert.equal(conflict.response.status, 409);
  assert.equal(conflict.value.code, 'ARTIFACT_VERSION_CONFLICT');

  const checkpoint = await json(base, `/api/artifacts/${artifactId}/checkpoints`, {
    method: 'POST',
    body: { expectedDraftVersion: 1, trigger: 'manual' },
  });
  assert.equal(checkpoint.response.status, 201);
  const revisionId = checkpoint.value.revisionId;
  assert.match(revisionId, /^rev_/);
  assert.equal(fs.existsSync(path.join(artifactDir, 'revisions', `${revisionId}.md`)), true);

  const critique = await json(base, `/api/artifacts/${artifactId}/critique`, {
    method: 'POST',
    body: { revisionId, rubricItemIds: ['r_claim'] },
  });
  assert.equal(critique.response.status, 201, JSON.stringify(critique.value));
  assert.equal(critique.value.gaps.length, 1);
  assert.equal(critique.value.gaps[0].rubricItemId, 'r_claim');
  assert.equal(critique.value.gaps[0].anchor.exact, 'Evidence anchor sentence.');
  const critiqueId = critique.value.critiqueId;
  const gapId = critique.value.gaps[0].id;

  const decision = await json(base, `/api/artifacts/${artifactId}/critiques/${critiqueId}/decisions`, {
    method: 'POST',
    body: { gapId, action: 'accepted', reason: 'This is the next revision target.' },
  });
  assert.equal(decision.response.status, 200);
  assert.equal(decision.value.artifact.gaps[0].status, 'accepted');

  const focus = await json(base, `/api/artifacts/${artifactId}/gaps/${gapId}/next-lesson`, {
    method: 'POST',
    body: { revisionId },
  });
  assert.equal(focus.response.status, 202, JSON.stringify(focus.value));
  const activities = JSON.parse(fs.readFileSync(path.join(courseDir, 'learning-activity.json'), 'utf8'));
  assert.deepEqual(activities.map((event) => event.type), [
    'artifact-revision',
    'artifact-critique',
    'artifact-critique',
    'artifact-gap-focus',
  ]);
  assert.equal(activities.every((event) => typeof event.id === 'string' && Number.isFinite(event.timestamp)), true);
  const transaction = JSON.parse(fs.readFileSync(path.join(courseDir, 'next-lesson-transaction.json'), 'utf8'));
  assert.deepEqual(changedExistingWorkspaceFiles(courseDir, transaction.baseline), []);

  const globalActivity = await json(base, '/api/activity');
  assert.equal(globalActivity.response.status, 200);
  assert.equal(globalActivity.value.events.some((event) => String(event.type).startsWith('artifact-')), false);

  const protectedDelete = await json(base, '/api/courses/polcourse', { method: 'DELETE' });
  assert.equal(protectedDelete.response.status, 409);
  assert.equal(protectedDelete.value.code, 'COURSE_LINKED_TO_ARTIFACT');

  const structure = await json(base, '/api/artifacts', { method: 'POST', body: artifactInput('structure-only') });
  assert.equal(structure.response.status, 201);
  const structureId = structure.value.artifact.id;
  const structureDir = path.join(runtimeRoot, 'artifacts', structureId);
  const structureCheckpoint = await json(base, `/api/artifacts/${structureId}/checkpoints`, {
    method: 'POST',
    body: { trigger: 'manual', bodySha256: `sha256:${'a'.repeat(64)}`, externalRevisionLabel: 'External draft 1' },
  });
  assert.equal(structureCheckpoint.response.status, 201);
  const badStructureCheckpoint = await json(base, `/api/artifacts/${structureId}/checkpoints`, {
    method: 'POST',
    body: { trigger: 'manual', bodySha256: 'not-a-digest', externalRevisionLabel: 'Invalid external draft' },
  });
  assert.equal(badStructureCheckpoint.response.status, 422);
  assert.equal(badStructureCheckpoint.value.code, 'ARTIFACT_SHA256_INVALID');
  assert.equal(fs.existsSync(path.join(structureDir, 'draft.md')), false);
  assert.equal(fs.existsSync(path.join(structureDir, 'revisions')), false);
  const persistedText = fs.readdirSync(structureDir).map((name) => fs.readFileSync(path.join(structureDir, name), 'utf8')).join('\n');
  assert.doesNotMatch(persistedText, /Evidence anchor sentence/);
});
