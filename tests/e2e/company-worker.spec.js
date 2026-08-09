'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { startCompanyTestServer, stopCompanyTestServer } = require('../support/company-test-server');

const ROOT = path.resolve(__dirname, '..', '..');
let URL;
const DATA_DIR = path.join(ROOT, 'tests', '.runtime', 'company-worker');
let server;

test.beforeAll(async () => {
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
  server = await startCompanyTestServer({
    rootDir: ROOT,
    dataDir: DATA_DIR,
    env: {
      LUCUBRO_WORKER_ID: 'worker_test',
      LUCUBRO_WORKER_NAME: 'Test Worker',
    },
  });
  URL = server.url;
});

test.afterAll(async () => {
  await stopCompanyTestServer(server);
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
});

test('Worker is a durable execution host while real provider runtimes remain explicitly paused', async ({ page }) => {
  await page.goto(`${URL}/company`);
  await expect(page.locator('#company-operating-map')).toHaveAttribute('data-controller', 'ready');

  const initial = await page.evaluate(async () => {
    const response = await fetch('/api/company/bootstrap');
    return response.json();
  });
  expect(initial.workers).toHaveLength(1);
  expect(initial.workers[0]).toMatchObject({
    id: 'worker_test',
    name: 'Test Worker',
    kind: 'self-hosted',
    status: 'online',
    transport: 'in-process',
  });
  expect(initial.workers[0].capabilities.runtimes).toEqual(['mock']);
  expect(initial.runtimes.find((runtime) => runtime.id === 'codex')).toMatchObject({ available: false, paused: true });
  expect(initial.runtimes.find((runtime) => runtime.id === 'claude-code')).toMatchObject({ available: false, paused: true });
  expect(initial.runtimes.find((runtime) => runtime.id === 'mock')).toMatchObject({ available: true });

  await page.locator('#run-settings > summary').click();
  await expect(page.locator('[data-runtime-id="codex"]')).toBeDisabled();
  await expect(page.locator('[data-runtime-id="codex"]')).toHaveAttribute('aria-label', 'Codex, not ready');
  await expect(page.locator('[data-runtime-id="claude-code"]')).toBeDisabled();
  await expect(page.locator('[data-runtime-id="claude-code"]')).toHaveAttribute('aria-label', 'Claude Code, not ready');
  await expect(page.locator('[data-runtime-id="mock"]')).toBeEnabled();
  await page.locator('#close-run-settings').click();

  const created = await page.evaluate(async () => {
    const response = await fetch('/api/company/works', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brief: 'Verify Worker assignment',
        repoDir: '/tmp/lucubro-worker-fixture',
        runtime: 'mock',
      }),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  });

  expect(created.run.workerId).toBe('worker_test');

  await page.reload();
  await expect(page.locator('#company-operating-map')).toHaveAttribute('data-controller', 'ready');
  const mapNode = page.getByTestId('operating-work-node').filter({ hasText: 'Verify Worker assignment' });
  await expect(mapNode).toBeVisible();
  await expect(mapNode).toContainText('Test Worker');
  await expect(mapNode).not.toContainText('Runtime mock');

  const runPayload = await page.evaluate(async (runId) => {
    const response = await fetch(`/api/company/runs/${encodeURIComponent(runId)}`);
    return response.json();
  }, created.run.id);
  expect(runPayload.run.workerId).toBe('worker_test');
  expect(runPayload.worker).toMatchObject({ id: 'worker_test', name: 'Test Worker' });
});
