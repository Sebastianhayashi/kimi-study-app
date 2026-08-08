'use strict';

const { test, expect } = require('@playwright/test');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 3110;
const URL = `http://127.0.0.1:${PORT}`;
let server;

async function waitForServer() {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try { const response = await fetch(`${URL}/api/company/health`); if (response.ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  throw new Error('company-server did not become ready');
}

test.beforeAll(async () => {
  const dataDir = path.join(ROOT, 'tests', '.runtime', 'company');
  fs.rmSync(dataDir, { recursive: true, force: true });
  server = spawn(process.execPath, [path.join(ROOT, 'company-server.js')], {
    cwd: ROOT,
    env: { ...process.env, NODE_ENV: 'test', PORT: String(PORT), LUCUBRO_COMPANY_DATA_DIR: dataDir, LUCUBRO_COMPANY_MOCK_RUNTIME: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await waitForServer();
});

test.afterAll(async () => { if (server && !server.killed) server.kill('SIGTERM'); });

test('CEO request becomes visible Work, reaches review, and can be accepted', async ({ page }) => {
  await page.goto(`${URL}/company`);
  await expect(page.getByText('What should we move forward?')).toBeVisible();
  await page.locator('#repo-dir').fill('/tmp/lucubro-fixture-repo');
  await page.locator('#runtime').selectOption('mock');
  await page.locator('#work-brief').fill('Fix the session refresh bug');
  await page.locator('#send-work').click();
  await expect(page.locator('.work-object-title strong')).toContainText('Fix the session refresh bug');
  await expect(page.getByText('Ben · mock')).toBeVisible();
  await expect(page.getByText('Ready for review')).toBeVisible();
  await expect(page.getByText('Code changes · 1 file')).toBeVisible();
  await page.getByRole('button', { name: 'Accept' }).click();
  await expect(page.getByText('Accepted. I recorded this Work as complete.')).toBeVisible();
  await expect(page.getByText('Accepted', { exact: true })).toBeVisible();
});

test('out-of-envelope runtime request becomes Needs You and resumes after scoped approval', async ({ page }) => {
  await page.goto(`${URL}/company`);
  await page.locator('#repo-dir').fill('/tmp/lucubro-fixture-repo');
  await page.locator('#runtime').selectOption('mock');
  await page.locator('#work-brief').fill('Fix auth needs-approval');
  await page.locator('#send-work').click();
  await expect(page.locator('[data-testid="needs-you-card"]')).toBeVisible();
  await expect(page.getByText('network.access')).toBeVisible();
  await page.locator('[data-testid="needs-you-card"] .primary-action').click();
  await expect(page.getByText('Approved. Ben can continue within that one decision.')).toBeVisible();
  await expect(page.getByText('Ready for review')).toBeVisible();
});
