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
        child.stdout.off('data', onData);
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

test('lesson resource tools are scoped to the middle course module', () => {
  const course = fs.readFileSync(path.join(ROOT, 'public', 'course.html'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'public', 'lesson-tools.css'), 'utf8');
  const js = fs.readFileSync(path.join(ROOT, 'public', 'lesson-tools.js'), 'utf8');

  assert.match(course, /id="lessonResourceSlot"/);
  assert.match(course, /id="lessonResourceViewer"/);
  assert.match(course, /id="lessonResourceViewerFrame"/);
  assert.match(course, /sandbox="allow-popups allow-popups-to-escape-sandbox"/);

  assert.match(css, /\.course-stage\s*\{[^}]*position:\s*relative/s);
  assert.match(css, /\.lesson-resource-viewer\s*\{[^}]*position:\s*absolute[^}]*inset:\s*10px/s);
  assert.doesNotMatch(css, /position:\s*fixed/);

  // The lesson iframe is read to discover links, but its srcdoc and DOM are never rewritten.
  assert.match(js, /lessonFrame\.contentDocument/);
  assert.doesNotMatch(js, /lessonFrame\.srcdoc\s*=/);
  assert.doesNotMatch(js, /sourceRow\.(?:hidden|style|remove)/);
  assert.match(js, /resourceFrame\.srcdoc\s*=/);
  assert.match(js, /function htmlDocument/);
  assert.match(js, /function markdownDocument/);
});

test('server exposes renderer dependencies and keeps generated lesson HTML styled', async (t) => {
  const port = 32000 + Math.floor(Math.random() * 1000);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(() => child.kill('SIGTERM'));
  await waitForServer(child);

  const base = `http://127.0.0.1:${port}`;
  const [course, toolsCss, toolsJs, marked, purify, lesson, resources, success] = await Promise.all([
    fetch(`${base}/course/mrrxjoe1`),
    fetch(`${base}/lesson-tools.css`),
    fetch(`${base}/lesson-tools.js`),
    fetch(`${base}/vendor/marked.umd.js`),
    fetch(`${base}/vendor/purify.min.js`),
    fetch(`${base}/api/courses/mrrxjoe1/lessons/0001-what-makes-ideas-stick.html`),
    fetch(`${base}/api/courses/mrrxjoe1/RESOURCES.md`),
    fetch(`${base}/api/courses/mrrxjoe1/reference/succes-framework.html`),
  ]);

  for (const response of [course, toolsCss, toolsJs, marked, purify, lesson, resources, success]) {
    assert.equal(response.status, 200);
  }

  const courseHtml = await course.text();
  const lessonHtml = await lesson.text();
  const resourceMarkdown = await resources.text();
  const successHtml = await success.text();

  assert.match(courseHtml, /\/lesson-tools\.css/);
  assert.match(courseHtml, /\/vendor\/marked\.umd\.js/);
  assert.match(courseHtml, /\/vendor\/purify\.min\.js/);
  assert.match(courseHtml, /\/lesson-tools\.js/);

  assert.match(lessonHtml, /<base href="\/api\/courses\/mrrxjoe1\/lessons\/">/);
  assert.match(lessonHtml, /<link rel="stylesheet" href="\.\.\/assets\/style\.css">/);
  assert.match(lessonHtml, /<h1>第一课：创意黏性入门<\/h1>/);
  assert.match(resourceMarkdown, /^# 《让创意更有黏性》学习资源/m);
  assert.match(successHtml, /<link rel="stylesheet" href="\.\.\/assets\/style\.css">/);
  assert.match(successHtml, /<h1>SUCCESs 框架速查表<\/h1>/);
});
