'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');

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

function writeMissionCourse(dataDir) {
  const id = 'missioneditcourse';
  const dir = path.join(dataDir, id);
  fs.mkdirSync(path.join(dir, 'lessons'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ title: 'Mission edit course' }, null, 2));
  fs.writeFileSync(path.join(dir, 'job.json'), JSON.stringify({ stage: 'idle', currentMessage: '', updatedAt: new Date().toISOString() }, null, 2));
  fs.writeFileSync(path.join(dir, 'MISSION.md'), [
    '# Mission: Original mission',
    '',
    '## Why',
    'The current answer lacks a clear conclusion.',
    '',
    '## Success looks like',
    '- Write a publishable Zhihu answer.',
    '- State the conclusion in the first two sentences.',
    '',
    '## Constraints',
    '- Use evidence from the source.',
    '',
    '## Out of scope',
    '- Rewriting the entire book.',
    '',
  ].join('\n'));
  fs.writeFileSync(path.join(dir, 'onboarding.json'), JSON.stringify({
    version: 1,
    state: 'mission_ready',
    courseId: id,
    createdAt: '2026-07-27T00:00:00.000Z',
    updatedAt: '2026-07-27T00:00:00.000Z',
    profile: { mode: 'goal', locale: 'zh-CN' },
    source: {
      originalFilename: 'pyramid.txt', storedFilename: 'book.txt', mimeType: 'text/plain', sizeBytes: 10,
      format: 'text', extension: '.txt', sha256: 'fixture',
    },
    inspection: { status: 'complete', format: 'text', inspectedAt: '2026-07-27T00:00:00.000Z', errorCode: null, errorMessage: null },
    mission: {
      version: 1, mode: 'standard', status: 'ready', question: null, options: [],
      summary: 'Original mission summary', materialSummary: 'Pyramid principle', turns: 2,
      errorCode: null, errorMessage: null, outcome: null, learningStyle: null, sessionLength: null,
      completedAt: '2026-07-27T00:00:00.000Z', confirmedAt: null,
    },
    generation: { attempts: 0, activeRunId: null, startedAt: null, readyAt: null, failedAt: null, errorCode: null, errorMessage: null },
  }, null, 2));
  return { id, dir };
}

async function startServer(t, dataDir) {
  const port = await freePort();
  const logs = [];
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, NODE_ENV: 'test', PORT: String(port), LUCUBRO_DATA_DIR: dataDir },
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
    if (child.exitCode != null) throw new Error(`server exited early\n${logs.join('')}`);
    try {
      const response = await fetch(`${base}/api/courses`);
      if (response.ok) return base;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`server did not become ready\n${logs.join('')}`);
}

test('Mission edit API atomically rewrites canonical fields and leaves confirmation pending', { timeout: 30_000 }, async (t) => {
  const runtime = path.join(ROOT, 'tests', '.runtime', `round13-mission-${process.pid}-${Date.now()}`);
  fs.mkdirSync(runtime, { recursive: true });
  t.after(() => fs.rmSync(runtime, { recursive: true, force: true }));
  const { id, dir } = writeMissionCourse(runtime);
  const base = await startServer(t, runtime);

  const before = await fetch(`${base}/api/courses/${id}/onboarding`).then((r) => r.json());
  assert.equal(before.onboarding.mission.editable.topic, 'Original mission');

  const payload = {
    topic: 'Pyramid principle for a Zhihu answer',
    problemStatement: 'Readers cannot identify the conclusion or the action after reading the draft.',
    expectedOutput: 'Write a publishable 1200-word Zhihu answer with the conclusion first.',
    successEvidence: ['The first two sentences state the conclusion', 'Three reasons stay at one abstraction level'],
    constraints: ['Use source evidence for every major claim'],
    outOfScope: ['Covering every chapter in the source'],
  };
  const response = await fetch(`${base}/api/courses/${id}/mission`, {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
  });
  assert.equal(response.status, 200);
  const value = await response.json();
  assert.equal(value.onboarding.state, 'mission_ready');
  assert.equal(value.onboarding.mission.status, 'ready');
  assert.equal(value.onboarding.mission.confirmedAt, null);
  assert.deepEqual(value.onboarding.mission.editable.successEvidence, payload.successEvidence);
  const markdown = fs.readFileSync(path.join(dir, 'MISSION.md'), 'utf8');
  assert.match(markdown, /^# Mission: Pyramid principle for a Zhihu answer$/m);
  assert.match(markdown, /Write a publishable 1200-word Zhihu answer/);
  assert.match(markdown, /Three reasons stay at one abstraction level/);
});
