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
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(PORT),
      LUCUBRO_COMPANY_PORT: String(PORT),
      LUCUBRO_COMPANY_DATA_DIR: dataDir,
      LUCUBRO_COMPANY_MOCK_RUNTIME: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await waitForServer();
});

test.afterAll(async () => { if (server && !server.killed) server.kill('SIGTERM'); });

test('front door presents Alex first and keeps execution setup secondary', async ({ page }) => {
  await page.goto(`${URL}/company`);
  await expect(page.getByRole('heading', { name: 'What should we move forward?' })).toBeVisible();
  await expect(page.getByLabel('Alex, Primary Manager')).toBeVisible();
  await expect(page.locator('#run-settings')).not.toHaveAttribute('open', '');
  await expect(page.getByRole('button', { name: 'Send to Alex' })).toBeEnabled();
  await expect(page.locator('#runtime-note')).toContainText('Ready: mock');
});

test('CEO request becomes durable Work, reaches review, and can be accepted', async ({ page }) => {
  await page.goto(`${URL}/company`);
  await page.locator('#run-settings').evaluate((element) => { element.open = true; });
  await page.locator('#repo-dir').fill('/tmp/lucubro-fixture-repo');
  await page.locator('#runtime').selectOption('mock');
  await page.locator('#work-brief').fill('Fix the session refresh bug');
  await page.getByRole('button', { name: 'Send to Alex' }).click();
  await expect(page.locator('#run-settings')).not.toHaveAttribute('open', '');
  await expect(page.locator('.work-object-title strong')).toContainText('Fix the session refresh bug');
  await expect(page.getByText('Ben · Software Engineer')).toBeVisible();
  await expect(page.getByText('Ready for review')).toBeVisible();
  await expect(page.getByText('Code changes · 1 file')).toBeVisible();
  await page.screenshot({ path: path.join(ROOT, 'test-results', 'company-desktop-review.png'), fullPage: true });
  await page.getByRole('button', { name: 'Accept' }).click();
  await expect(page.getByText('Accepted. I recorded this Work as complete.')).toBeVisible();
  await expect(page.getByText('Accepted', { exact: true })).toBeVisible();
});

test('out-of-envelope request becomes a scoped Needs You decision and Escape dismisses the panel', async ({ page }) => {
  await page.goto(`${URL}/company`);
  await page.locator('#run-settings').evaluate((element) => { element.open = true; });
  await page.locator('#repo-dir').fill('/tmp/lucubro-fixture-repo');
  await page.locator('#runtime').selectOption('mock');
  await page.locator('#work-brief').fill('Fix auth needs-approval');
  await page.getByRole('button', { name: 'Send to Alex' }).click();
  await expect(page.locator('[data-testid="needs-you-card"]')).toBeVisible();
  await expect(page.getByText('network.access')).toBeVisible();
  await expect(page.locator('#needs-you-button')).toHaveAttribute('data-active', 'true');
  await page.screenshot({ path: path.join(ROOT, 'test-results', 'company-needs-you.png'), fullPage: true });
  await page.keyboard.press('Escape');
  await expect(page.locator('#needs-you-panel')).toBeHidden();
  await page.locator('#needs-you-button').click();
  await page.locator('[data-testid="needs-you-card"] .primary-action').click();
  await expect(page.getByText('Approved for that one decision. Ben can continue.')).toBeVisible();
  await expect(page.getByText('Ready for review')).toBeVisible();
});

test('keyboard shortcut submits Work without exposing runtime mechanics in the main thread', async ({ page }) => {
  await page.goto(`${URL}/company`);
  await page.locator('#run-settings').evaluate((element) => { element.open = true; });
  await page.locator('#repo-dir').fill('/tmp/lucubro-fixture-repo');
  await page.locator('#runtime').selectOption('mock');
  await page.locator('#work-brief').fill('Fix keyboard submission');
  await page.locator('#work-brief').press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter');
  await expect(page.locator('.work-object-title strong')).toContainText('Fix keyboard submission');
  await expect(page.getByText('Runtime: mock')).toBeHidden();
});

test('mobile keeps the relationship, composer, and work surface inside the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${URL}/company`);
  await expect(page.getByLabel('Alex, Primary Manager')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send to Alex' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.screenshot({ path: path.join(ROOT, 'test-results', 'company-mobile-empty.png'), fullPage: true });
});

test('reduced motion preserves the product state without animation dependency', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${URL}/company`);
  await expect(page.getByRole('heading', { name: 'What should we move forward?' })).toBeVisible();
  const reduced = await page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  expect(reduced).toBe(true);
  await expect(page.getByRole('button', { name: 'Send to Alex' })).toBeEnabled();
});
