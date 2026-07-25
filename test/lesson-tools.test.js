const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const COURSE_ID = 'mrrxjoe1';
// Deterministic in-test fixtures: the routes under test must not depend on
// private learner data under data/courses, which is not part of the repo.
const COURSE_FIXTURE_FILES = {
  'RESOURCES.md': '# 《让创意更有黏性》学习资源\n\n- 确定性测试夹具，用于验证 Markdown 资源路由。\n',
  'lessons/0001-what-makes-ideas-stick.html': [
    '<!DOCTYPE html>',
    '<html lang="zh-CN">',
    '<head>',
    '  <meta charset="UTF-8">',
    '  <title>第一课：创意黏性入门</title>',
    '  <link rel="stylesheet" href="../assets/style.css">',
    '</head>',
    '<body>',
    '<div class="container"><h1>创意黏性入门</h1><p>确定性测试课节内容。</p></div>',
    '</body>',
    '</html>',
    '',
  ].join('\n'),
  'reference/succes-framework.html': [
    '<!DOCTYPE html>',
    '<html lang="zh-CN">',
    '<head>',
    '  <meta charset="UTF-8">',
    '  <title>SUCCESs 框架速查表</title>',
    '  <link rel="stylesheet" href="../assets/style.css">',
    '</head>',
    '<body>',
    '<div class="container"><h1>SUCCESs 框架速查表</h1><p>确定性测试参考页。</p></div>',
    '</body>',
    '</html>',
    '',
  ].join('\n'),
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close((error) => {
        if (error) reject(error);
        else resolve(address.port);
      });
    });
  });
}

function createIsolatedCourseData(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lucubro-lesson-tools-'));
  const dataDir = path.join(root, 'courses');
  const courseDir = path.join(dataDir, COURSE_ID);

  for (const [relative, content] of Object.entries(COURSE_FIXTURE_FILES)) {
    const target = path.join(courseDir, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }

  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return dataDir;
}

async function stopChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;

  let exited = once(child, 'exit');
  child.kill('SIGTERM');
  await Promise.race([exited, sleep(2000)]);

  if (child.exitCode === null && child.signalCode === null) {
    exited = once(child, 'exit');
    child.kill('SIGKILL');
    await Promise.race([exited, sleep(1000)]);
  }
}

async function waitForHttp(child, url, diagnostics, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;

  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(
        `server exited before HTTP readiness: exitCode=${child.exitCode} signalCode=${child.signalCode}\n${diagnostics()}`,
      );
    }

    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(500) });
      await response.body?.cancel();
      if (response.ok) return;
      lastError = new Error(`readiness endpoint returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await sleep(50);
  }

  throw new Error(`server did not become HTTP-ready: ${lastError?.message || 'unknown error'}\n${diagnostics()}`);
}

async function fetchRoute(child, url, diagnostics) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
    assert.equal(response.status, 200, `${url} returned ${response.status}\n${diagnostics()}`);
    return response;
  } catch (error) {
    throw new Error(
      `fetch failed for ${url}: exitCode=${child.exitCode} signalCode=${child.signalCode}\n${diagnostics()}`,
      { cause: error },
    );
  }
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
  const port = await reservePort();
  const dataDir = createIsolatedCourseData(t);
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(port),
    KIMI_STUDY_DATA_DIR: dataDir,
  };
  delete env.KIMI_STUDY_E2E_PORT;
  delete env.KIMI_STUDY_FIXTURE_DIR;

  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const diagnostics = () => `stdout:\n${stdout}\nstderr:\n${stderr}`;

  t.after(async () => stopChild(child));

  const base = `http://127.0.0.1:${port}`;
  await waitForHttp(child, `${base}/glue.js`, diagnostics);

  const urls = [
    `${base}/course/${COURSE_ID}`,
    `${base}/glue.js`,
    `${base}/api/courses/${COURSE_ID}/lessons/0001-what-makes-ideas-stick.html`,
    `${base}/api/courses/${COURSE_ID}/RESOURCES.md`,
    `${base}/api/courses/${COURSE_ID}/reference/succes-framework.html`,
  ];
  const responses = [];
  for (const url of urls) responses.push(await fetchRoute(child, url, diagnostics));

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
