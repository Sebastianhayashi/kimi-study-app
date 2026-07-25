'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const { writeOperation } = require('../../lib/operation-state');

const ROOT = path.resolve(__dirname, '..', '..');
const RUNTIME_COURSES = path.join(ROOT, 'tests', '.runtime', 'courses');

function cloneCourse(sourceId, targetId, root = RUNTIME_COURSES) {
  const source = path.join(RUNTIME_COURSES, sourceId);
  const target = path.join(root, targetId);
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(root, { recursive: true });
  fs.cpSync(source, target, { recursive: true });
  return target;
}

function writeJob(courseDir, value, mtime = new Date()) {
  const file = path.join(courseDir, 'job.json');
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
  fs.utimesSync(file, mtime, mtime);
}

function runningNextLesson(courseDir, operationId, now = new Date()) {
  writeJob(courseDir, {
    stage: 'generating',
    runId: operationId,
    kind: 'next-lesson',
    phase: 'assembling',
    baselineLessons: 1,
    baselineAssessments: 1,
    startedAt: now.toISOString(),
    updatedAt: now.toISOString(),
  }, now);
  return writeOperation(courseDir, {
    operationId,
    kind: 'next-lesson',
    state: 'running',
    phase: 'assembling',
    progressEvidence: { lessons: 1 },
    publishedArtifact: 1,
    currentMessageKey: 'next-lesson.assembling',
    retryable: false,
    startedAt: now.toISOString(),
  }, { now });
}

async function attachScreenshot(page, testInfo, name) {
  const file = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  await testInfo.attach(name, { path: file, contentType: 'image/png' });
}

async function waitForServer(url, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const ok = await new Promise((resolve) => {
      const request = http.get(url, (response) => {
        response.resume();
        resolve(response.statusCode < 500);
      });
      request.on('error', () => resolve(false));
      request.setTimeout(500, () => { request.destroy(); resolve(false); });
    });
    if (ok) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Server did not become ready: ${url}`);
}

function startServer(port, dataDir, logFile, { operationState = '1' } = {}) {
  const stream = fs.createWriteStream(logFile, { flags: 'a' });
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(port),
      LUCUBRO_E2E_PORT: String(port),
      LUCUBRO_DATA_DIR: dataDir,
      LUCUBRO_OPERATION_STATE: operationState,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.pipe(stream);
  child.stderr.pipe(stream);
  child.once('close', () => stream.end());
  return child;
}

async function stopServer(child) {
  if (!child || child.exitCode != null) return;
  child.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => child.once('close', resolve)),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
  if (child.exitCode == null) child.kill('SIGKILL');
}

test('operation refresh keeps the same canonical snapshot and published learning surfaces usable', async ({ page }, testInfo) => {
  const courseDir = cloneCourse('readycourse', 'operationrefresh');
  runningNextLesson(courseDir, 'refresh-run');

  await page.goto('/course/operationrefresh');
  await expect(page.locator('.ks-generation-preview')).toBeHidden();
  await expect(page.locator('[role="progressbar"]:visible')).toHaveCount(1);
  await expect(page.frameLocator('#lessonFrame').getByRole('heading', { name: '稳定化测试课节' })).toBeVisible();
  await expect(page.locator('#assistantPanel')).toBeVisible();

  const before = await page.request.get('/api/courses/operationrefresh/operation').then((response) => response.json());
  expect(before.operationId).toBe('refresh-run');
  expect(before.state).toBe('running');

  await page.reload();
  const after = await page.request.get('/api/courses/operationrefresh/operation').then((response) => response.json());
  expect(after.operationId).toBe(before.operationId);
  expect(after.state).toBe(before.state);
  expect(after.updatedAt).toBe(before.updatedAt);
  await expect(page.frameLocator('#lessonFrame').getByRole('heading', { name: '稳定化测试课节' })).toBeVisible();
  await attachScreenshot(page, testInfo, 'operation-refresh');
});

test('operation process restart recovers the disk snapshot as interrupted in a real Chromium journey', async ({ page }, testInfo) => {
  const port = 32000 + (process.pid % 1000);
  const dataDir = path.join(ROOT, 'tests', '.runtime', `restart-courses-${process.pid}`);
  fs.rmSync(dataDir, { recursive: true, force: true });
  const courseDir = cloneCourse('readycourse', 'operationrestart', dataDir);
  runningNextLesson(courseDir, 'restart-run');
  const serverLog = testInfo.outputPath('restart-server.log');
  let child = startServer(port, dataDir, serverLog);
  const baseURL = `http://127.0.0.1:${port}`;

  try {
    await waitForServer(`${baseURL}/app`);
    await page.goto(`${baseURL}/course/operationrestart`);
    const running = await page.request.get(`${baseURL}/api/courses/operationrestart/operation`).then((response) => response.json());
    expect(running.state).toBe('running');
    await stopServer(child);

    const stale = new Date(Date.now() - 120000);
    fs.utimesSync(path.join(courseDir, 'job.json'), stale, stale);
    child = startServer(port, dataDir, serverLog);
    await waitForServer(`${baseURL}/app`);
    await page.reload();

    const recovered = await page.request.get(`${baseURL}/api/courses/operationrestart/operation`).then((response) => response.json());
    expect(recovered.operationId).toBe('restart-run');
    expect(recovered.state).toBe('interrupted');
    expect(recovered.retryable).toBe(true);
    await expect(page.locator('.ks-generation-preview')).toBeHidden();
    await expect(page.frameLocator('#lessonFrame').getByRole('heading', { name: '稳定化测试课节' })).toBeVisible();
    await attachScreenshot(page, testInfo, 'operation-process-restart');
  } finally {
    await stopServer(child);
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test('operation cancel reaches a terminal snapshot without removing published content', async ({ page }, testInfo) => {
  const courseDir = cloneCourse('readycourse', 'operationcancel');
  runningNextLesson(courseDir, 'cancel-run');

  await page.goto('/course/operationcancel');
  const response = await page.request.post('/api/courses/operationcancel/operation/cancel');
  expect(response.ok()).toBe(true);
  const cancelled = await response.json();
  expect(cancelled.operationId).toBe('cancel-run');
  expect(cancelled.state).toBe('cancelled');
  expect(cancelled.retryable).toBe(true);

  await page.reload();
  await expect(page.locator('.ks-generation-preview')).toBeHidden();
  await expect(page.locator('#left-overview .record-list')).toContainText('已取消');
  await expect(page.frameLocator('#lessonFrame').getByRole('heading', { name: '稳定化测试课节' })).toBeVisible();
  await attachScreenshot(page, testInfo, 'operation-cancel');
});

test('operation retry replaces a failed run and all surfaces converge on the new operation id', async ({ page }, testInfo) => {
  const courseDir = cloneCourse('readycourse', 'operationretry');
  const failedAt = new Date();
  writeJob(courseDir, {
    stage: 'failed',
    runId: 'failed-run',
    kind: 'next-lesson',
    phase: 'assembling',
    currentMessage: '下一课生成没有完成，请重试',
    updatedAt: failedAt.toISOString(),
    failedAt: failedAt.toISOString(),
  }, failedAt);
  writeOperation(courseDir, {
    operationId: 'failed-run',
    kind: 'next-lesson',
    state: 'failed',
    phase: 'assembling',
    progressEvidence: { lessons: 1 },
    publishedArtifact: 1,
    currentMessageKey: 'next-lesson.failed',
    retryable: true,
  }, { now: failedAt });

  await page.goto('/course/operationretry');
  await expect(page.locator('.ks-generation-preview')).toBeHidden();

  const retryAt = new Date(Date.now() + 10);
  runningNextLesson(courseDir, 'retry-run', retryAt);
  await page.reload();
  const retried = await page.request.get('/api/courses/operationretry/operation').then((response) => response.json());
  expect(retried.operationId).toBe('retry-run');
  expect(retried.state).toBe('running');
  await expect(page.locator('.ks-generation-preview')).toBeHidden();
  await expect(page.locator('.current-lesson')).toContainText('正在生成下一课');
  await expect(page.frameLocator('#lessonFrame').getByRole('heading', { name: '稳定化测试课节' })).toBeVisible();
  await attachScreenshot(page, testInfo, 'operation-retry');
});

test('LUCUBRO_OPERATION_STATE=0 falls back to the legacy status path without breaking the course shell', async ({ page }, testInfo) => {
  const port = 33000 + (process.pid % 1000);
  const dataDir = path.join(ROOT, 'tests', '.runtime', `rollback-courses-${process.pid}`);
  fs.rmSync(dataDir, { recursive: true, force: true });
  cloneCourse('readycourse', 'operationrollback', dataDir);
  const serverLog = testInfo.outputPath('rollback-server.log');
  const child = startServer(port, dataDir, serverLog, { operationState: '0' });
  const baseURL = `http://127.0.0.1:${port}`;

  try {
    await waitForServer(`${baseURL}/app`);
    const operationResponse = await page.request.get(`${baseURL}/api/courses/operationrollback/operation`);
    expect(operationResponse.status()).toBe(404);
    const legacyStatus = await page.request.get(`${baseURL}/api/courses/operationrollback/status`);
    expect(legacyStatus.ok()).toBe(true);
    expect(await legacyStatus.json()).toMatchObject({ stage: 'ready', lessons: 1 });

    await page.goto(`${baseURL}/course/operationrollback`);
    await expect(page.locator('.ks-generation-preview')).toBeHidden();
    await expect(page.frameLocator('#lessonFrame').getByRole('heading', { name: '稳定化测试课节' })).toBeVisible();
    await attachScreenshot(page, testInfo, 'operation-rollback-switch');
  } finally {
    await stopServer(child);
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
