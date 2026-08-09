'use strict';

const { test, expect } = require('@playwright/test');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 3113;
const URL = `http://127.0.0.1:${PORT}`;
const DATA_DIR = path.join(ROOT, 'tests', '.runtime', 'company-evidence');
let server;

async function waitForServer() {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${URL}/api/company/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  throw new Error('company-server did not become ready');
}

async function waitForCompletedRun(runId) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const response = await fetch(`${URL}/api/company/runs/${encodeURIComponent(runId)}`);
    if (response.ok) {
      const payload = await response.json();
      if (payload.run.status === 'completed') return payload;
    }
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
  throw new Error(`Run did not complete: ${runId}`);
}

async function stopServer() {
  if (!server || server.exitCode !== null) return;
  await new Promise((resolve) => {
    const forceTimer = setTimeout(() => {
      if (server.exitCode === null) server.kill('SIGKILL');
    }, 2_000);
    server.once('exit', () => {
      clearTimeout(forceTimer);
      resolve();
    });
    server.kill('SIGTERM');
  });
}

test.beforeAll(async () => {
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
  server = spawn(process.execPath, [path.join(ROOT, 'company-server.js')], {
    cwd: ROOT,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(PORT),
      LUCUBRO_COMPANY_PORT: String(PORT),
      LUCUBRO_COMPANY_DATA_DIR: DATA_DIR,
      LUCUBRO_COMPANY_MOCK_RUNTIME: '1',
      LUCUBRO_WORKER_ID: 'worker_evidence',
      LUCUBRO_WORKER_NAME: 'Evidence Worker',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await waitForServer();
});

test.afterAll(async () => {
  await stopServer();
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
});

test('browser-style Work returns durable typed evidence that survives reload', async ({ page }) => {
  await page.goto(`${URL}/company`);
  await expect(page.locator('#company-operating-map')).toHaveAttribute('data-controller', 'ready');

  const created = await page.evaluate(async () => {
    const response = await fetch('/api/company/works', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brief: 'Test the latest UI in the browser and capture a screenshot',
        repoDir: '/tmp/lucubro-evidence-fixture',
        runtime: 'mock',
      }),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  });

  const payload = await waitForCompletedRun(created.run.id);
  const screenshot = payload.evidence.find((item) => item.kind === 'screenshot');
  const diff = payload.evidence.find((item) => item.kind === 'diff');

  expect(screenshot).toMatchObject({
    runId: created.run.id,
    workId: created.work.id,
    workerId: 'worker_evidence',
    mimeType: 'image/png',
    source: 'deterministic-mock',
  });
  expect(screenshot.metadata.deterministic).toBe(true);
  expect(diff).toMatchObject({ kind: 'diff', source: 'worktree' });
  expect(payload.events.some((event) => Object.hasOwn(event, 'contentBase64'))).toBe(false);

  const content = await fetch(`${URL}/api/company/evidence/${encodeURIComponent(screenshot.id)}/content`);
  expect(content.ok).toBe(true);
  expect(content.headers.get('content-type')).toContain('image/png');
  const bytes = Buffer.from(await content.arrayBuffer());
  expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);

  await page.reload();
  await expect(page.locator('#company-operating-map')).toHaveAttribute('data-controller', 'ready');
  const mapNode = page.getByTestId('operating-work-node').filter({ hasText: 'Test the latest UI in the browser' });
  await expect(mapNode).toContainText('2 evidence');
  await mapNode.click();

  const detail = page.locator('#durable-work-detail');
  await expect(detail).toBeVisible();
  const evidenceShelf = detail.locator('[data-testid="run-evidence"]');
  await expect(evidenceShelf).toContainText('Run evidence');
  await expect(evidenceShelf).toContainText('Deterministic browser screenshot');
  const image = evidenceShelf.locator('img').first();
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((node) => node.naturalWidth)).toBeGreaterThan(0);
});

test('Run evidence materializes inside the live Work object as the event arrives', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 820 });
  await page.goto(`${URL}/company`);
  await expect(page.locator('#workspace-picker')).toHaveAttribute('data-controller', 'ready');
  await expect(page.locator('#company-operating-map')).toHaveAttribute('data-controller', 'ready');

  await page.locator('#run-settings > summary').click();
  await page.locator('[data-runtime-id="mock"]').click();
  await page.locator('#repo-dir').fill('/tmp/lucubro-live-evidence-fixture');
  await expect(page.locator('#repo-path-control')).toHaveAttribute('data-state', 'received');

  const brief = 'Preview the latest browser UI and capture a screenshot for review';
  await page.locator('#work-brief').fill(brief);
  await page.getByRole('button', { name: 'Send to Alex' }).click();

  const work = page.locator('[data-canvas-object="work"]').filter({ hasText: brief });
  await expect(work).toBeVisible();
  const shelf = work.locator('[data-testid="run-evidence"]');
  await expect(shelf).toContainText('Deterministic browser screenshot');
  await expect(work.locator('.canvas-event-history')).toContainText('Evidence captured');
  const image = shelf.locator('img').first();
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((node) => node.naturalWidth)).toBeGreaterThan(0);
  await expect(work.locator('.status')).toHaveText('Ready for review');

  await page.screenshot({ path: path.join(ROOT, 'test-results', 'company-evidence-live.png') });
});
