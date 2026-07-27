'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

function read(relative) {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

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

async function waitForServer(url, child, logs) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode != null) throw new Error(`server exited early (${child.exitCode})\n${logs.join('')}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`server did not become ready\n${logs.join('')}`);
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { response, body: await response.json().catch(() => ({})) };
}

test('first-course generation reuses the published lesson validator without changing legacy reads', () => {
  const server = read('server.js');
  const firstRunCapture = server.indexOf('const firstRunLessons = isNextLesson ? [] : lessonsOf(id);');
  const nextValidation = server.indexOf('validateNextLessonDelta(dirOf(id), baseline)');
  const firstValidation = server.indexOf('validatePublishedLesson(dirOf(id), firstLesson)');
  assert.ok(firstRunCapture >= 0);
  assert.ok(nextValidation > firstRunCapture);
  assert.ok(firstValidation > nextValidation);
  assert.match(server.slice(firstValidation, firstValidation + 380), /第一课未通过发布验证/);
});

test('optional feedback awaits persistence while the primary next action continues directly', () => {
  const glue = read('public/glue.js');
  const collectStart = glue.indexOf('async function collectLessonFeedbackBeforeNext()');
  const feedbackPost = glue.indexOf("fetch(`/api/courses/${encodeURIComponent(courseId)}/activity`", collectStart);
  const adjustStart = glue.indexOf("if (e.target.closest('#adjustNextLessonButton'))", feedbackPost);
  const collectCall = glue.indexOf('collectLessonFeedbackBeforeNext()', adjustStart);
  const adjustedNextCall = glue.indexOf('nextLesson({ feedbackSaveFailed:', collectCall);
  const directStart = glue.indexOf("if (e.target.closest('#nextLessonButton'))", adjustedNextCall);
  const directNextCall = glue.indexOf('nextLesson();', directStart);
  assert.ok(collectStart >= 0 && feedbackPost > collectStart);
  assert.ok(adjustStart > feedbackPost && collectCall > adjustStart && adjustedNextCall > collectCall);
  assert.ok(directStart > adjustedNextCall && directNextCall > directStart);
  assert.doesNotMatch(glue.slice(directStart, directNextCall), /collectLessonFeedbackBeforeNext/);
  assert.match(glue.slice(collectCall, adjustedNextCall), /\.then\(\(result\) =>/);
  assert.match(read('public/course.html'), /id="adjustNextLessonButton"/);
  assert.match(glue, /closeMobileDrawers\(\{ restoreFocus: false \}\)/);
  assert.match(glue, /event\.stopImmediatePropagation\(\)/);
  assert.match(read('public/course-workspace-polish.css'), /prefers-reduced-motion:[\s\S]*\.lesson-feedback-sheet\s*\{\s*animation: none;/);
});

test('lesson-feedback route preserves append-only event shape and server ownership', { timeout: 30_000 }, async (t) => {
  const port = await freePort();
  const runtimeRoot = path.join(ROOT, 'tests', '.runtime', `round6-unit-${process.pid}-${Date.now()}`);
  const courseId = 'feedbackcourse';
  const courseDir = path.join(runtimeRoot, courseId);
  fs.mkdirSync(path.join(courseDir, 'lessons'), { recursive: true });
  fs.writeFileSync(path.join(courseDir, 'lessons', '0001-one.html'), '<html><body>one</body></html>');
  fs.writeFileSync(path.join(courseDir, 'meta.json'), JSON.stringify({ title: 'Feedback test' }));

  const logs = [];
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(port),
      LUCUBRO_DATA_DIR: runtimeRoot,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => logs.push(String(chunk)));
  child.stderr.on('data', (chunk) => logs.push(String(chunk)));
  t.after(async () => {
    if (child.exitCode == null) child.kill('SIGTERM');
    await new Promise((resolve) => {
      if (child.exitCode != null) resolve();
      else child.once('exit', resolve);
    });
    fs.rmSync(runtimeRoot, { recursive: true, force: true });
  });

  const base = `http://127.0.0.1:${port}`;
  await waitForServer(`${base}/api/courses/${courseId}/info`, child, logs);
  const endpoint = `${base}/api/courses/${courseId}/activity`;

  const first = await postJson(endpoint, {
    id: 'client-id-must-be-ignored',
    type: 'lesson-feedback',
    lessonFile: '0001-one.html',
    signal: 'aligned',
    detail: '  keep the concrete example  ',
    timestamp: 1,
  });
  assert.equal(first.response.status, 200);
  assert.match(first.body.event.id, /^[0-9a-f-]{36}$/i);
  assert.notEqual(first.body.event.id, 'client-id-must-be-ignored');
  assert.equal(first.body.event.timestamp > 1, true);
  assert.equal(first.body.event.detail, 'keep the concrete example');

  const second = await postJson(endpoint, {
    type: 'lesson-feedback',
    lessonFile: '0001-one.html',
    signal: 'deeper',
  });
  assert.equal(second.response.status, 200);
  assert.equal(Object.prototype.hasOwnProperty.call(second.body.event, 'detail'), false);

  const invalidSignal = await postJson(endpoint, {
    type: 'lesson-feedback',
    lessonFile: '0001-one.html',
    signal: 'ambient_guess',
  });
  assert.equal(invalidSignal.response.status, 400);

  const tooLong = await postJson(endpoint, {
    type: 'lesson-feedback',
    lessonFile: '0001-one.html',
    signal: 'faster',
    detail: 'x'.repeat(501),
  });
  assert.equal(tooLong.response.status, 400);

  const events = JSON.parse(fs.readFileSync(path.join(courseDir, 'learning-activity.json'), 'utf8'));
  assert.equal(Array.isArray(events), true);
  assert.equal(events.length, 2);
  assert.deepEqual(events.map((event) => event.signal), ['aligned', 'deeper']);
  assert.equal(events.every((event) => event.type === 'lesson-feedback' && event.lessonFile === '0001-one.html'), true);
});
