'use strict';

const { test, expect } = require('@playwright/test');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 3112;
const URL = `http://127.0.0.1:${PORT}`;
const DATA_DIR = path.join(ROOT, 'tests', '.runtime', 'company-worker');
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
      LUCUBRO_WORKER_ID: 'worker_test',
      LUCUBRO_WORKER_NAME: 'Test Worker',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await waitForServer();
});

test.afterAll(async () => {
  await stopServer();
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
});

test('Worker is a durable execution host while provider/runtime remains secondary', async ({ page }) => {
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
  expect(initial.workers[0].capabilities.runtimes).toContain('mock');

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
