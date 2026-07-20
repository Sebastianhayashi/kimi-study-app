const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function waitForServer(child, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('server did not start')), timeoutMs);
    const onData = (chunk) => {
      if (String(chunk).includes('Kimi Study')) {
        clearTimeout(timer);
        resolve();
      }
    };
    child.stdout.on('data', onData);
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`server exited early (${code})`));
    });
  });
}

test('lesson resources reuse the course iframe without overlay code or renderer dependencies', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const course = fs.readFileSync(path.join(ROOT, 'public', 'course.html'), 'utf8');
  const glue = fs.readFileSync(path.join(ROOT, 'public', 'glue.js'), 'utf8');

  assert.equal(pkg.dependencies.marked, undefined);
  assert.equal(pkg.dependencies.dompurify, undefined);
  assert.doesNotMatch(server, /\/vendor\/(?:marked|purify)/);
  assert.match(course, /id="lessonResourceSlot"/);
  assert.doesNotMatch(course, /lessonResourceViewer/);
  assert.doesNotMatch(course, /lesson-tools\.(?:css|js)/);
  assert.doesNotMatch(course, /TextDecoder\(\)\.decode|atob\('/);
  assert.match(glue, /function mountResourceTools/);
  assert.match(glue, /lessonFrame\.srcdoc = resourceDocument/);
  assert.match(glue, /lessonFrame\.src = currentLessonUrl/);
  assert.match(glue, /lessonFrame\.src = resource\.href/);
  assert.doesNotMatch(glue, /KimiLessonTools|resourceFrame/);
});

test('server keeps the existing course, lesson, markdown and styled HTML resource routes working', async (t) => {
  const port = 32000 + Math.floor(Math.random() * 1000);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(() => child.kill('SIGTERM'));
  await waitForServer(child);

  const base = `http://127.0.0.1:${port}`;
  const responses = await Promise.all([
    fetch(`${base}/course/mrrxjoe1`),
    fetch(`${base}/glue.js`),
    fetch(`${base}/api/courses/mrrxjoe1/lessons/0001-what-makes-ideas-stick.html`),
    fetch(`${base}/api/courses/mrrxjoe1/RESOURCES.md`),
    fetch(`${base}/api/courses/mrrxjoe1/reference/succes-framework.html`),
  ]);
  responses.forEach((response) => assert.equal(response.status, 200));

  const [courseHtml, , lessonHtml, resourceMarkdown, successHtml] = await Promise.all(
    responses.map((response) => response.text()),
  );
  assert.match(courseHtml, /id="lessonResourceSlot"/);
  assert.doesNotMatch(courseHtml, /lessonResourceViewer/);
  assert.match(lessonHtml, /<base href="\/api\/courses\/mrrxjoe1\/lessons\/">/);
  assert.match(lessonHtml, /<link rel="stylesheet" href="\.\.\/assets\/style\.css">/);
  assert.match(resourceMarkdown, /^# 《让创意更有黏性》学习资源/m);
  assert.match(successHtml, /<link rel="stylesheet" href="\.\.\/assets\/style\.css">/);
});
