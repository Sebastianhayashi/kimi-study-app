'use strict';

const { test, expect } = require('@playwright/test');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 3111;
const URL = `http://127.0.0.1:${PORT}`;
const DATA_DIR = path.join(ROOT, 'tests', '.runtime', 'company-workspace-pages');
const WORKSPACE_ROOT = path.join(ROOT, 'tests', '.runtime', 'workspace-host');
const PROJECTS_DIR = path.join(WORKSPACE_ROOT, 'Projects');
const FIXTURE_REPO = path.join(PROJECTS_DIR, 'lucubro-fixture-repo');
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

test.beforeAll(async () => {
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
  fs.rmSync(WORKSPACE_ROOT, { recursive: true, force: true });
  fs.mkdirSync(path.join(FIXTURE_REPO, '.git'), { recursive: true });
  fs.mkdirSync(path.join(PROJECTS_DIR, 'another-project'), { recursive: true });
  fs.mkdirSync(path.join(WORKSPACE_ROOT, 'Documents'), { recursive: true });

  server = spawn(process.execPath, [path.join(ROOT, 'company-server.js')], {
    cwd: ROOT,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(PORT),
      LUCUBRO_COMPANY_PORT: String(PORT),
      LUCUBRO_COMPANY_DATA_DIR: DATA_DIR,
      LUCUBRO_COMPANY_MOCK_RUNTIME: '1',
      LUCUBRO_WORKSPACE_ROOT: WORKSPACE_ROOT,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await waitForServer();
});

test.afterAll(async () => {
  if (server && !server.killed) server.kill('SIGTERM');
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
  fs.rmSync(WORKSPACE_ROOT, { recursive: true, force: true });
});

test('workspace path line wakes to Klein blue whenever the input is focused', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${URL}/company`);
  await page.locator('#run-settings > summary').click();

  const input = page.locator('#repo-dir');
  const activeLine = page.locator('.repo-path-line-active');
  const baseLine = page.locator('.repo-path-line');

  await expect(page.locator('#workspace-picker')).toHaveAttribute('data-controller', 'ready');
  await input.fill(FIXTURE_REPO);
  await expect(page.locator('#repo-path-control')).toHaveAttribute('data-state', 'received');
  await page.locator('#runtime-choice-label').click();
  await page.waitForTimeout(220);

  const unfocusedWidth = await activeLine.evaluate((node) => node.getBoundingClientRect().width);
  const baseWidth = await baseLine.evaluate((node) => node.getBoundingClientRect().width);
  expect(unfocusedWidth).toBeLessThan(baseWidth * 0.2);

  await input.focus();
  await page.waitForTimeout(220);
  const focusedWidth = await activeLine.evaluate((node) => node.getBoundingClientRect().width);
  expect(focusedWidth).toBeGreaterThan(baseWidth * 0.9);
});

test('workspace picker expands a host tree, autocompletes paths, and creates folders', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 820 });
  await page.goto(`${URL}/company`);
  await page.locator('#run-settings > summary').click();
  await expect(page.locator('#workspace-picker')).toHaveAttribute('data-controller', 'ready');
  await expect(page.locator('#workspace-tree-toggle')).toBeVisible();

  await page.locator('#workspace-tree-toggle').click();
  await expect(page.locator('#workspace-tree-panel')).toBeVisible();
  await expect(page.locator('#workspace-root-label')).toContainText('execution host');

  const projectsName = page.locator('.workspace-node-name').filter({ hasText: 'Projects' }).first();
  await expect(projectsName).toBeVisible();
  const projectsRow = projectsName.locator('..');
  await projectsRow.locator('.workspace-node-toggle').click();

  const repoName = page.locator('.workspace-node-name').filter({ hasText: 'lucubro-fixture-repo' }).first();
  await expect(repoName).toBeVisible();
  await repoName.click();
  await expect(page.locator('#repo-dir')).toHaveValue(FIXTURE_REPO);
  await expect(page.locator('#repo-path-control')).toHaveAttribute('data-state', 'received');
  await expect(page.locator('#repo-path-receipt')).toHaveText('Repository found');

  const repoInput = page.locator('#repo-dir');
  await repoInput.fill(path.join(WORKSPACE_ROOT, 'Pro'));
  await expect(page.locator('#workspace-suggestions')).toBeVisible();
  await expect(page.locator('.workspace-suggestion').first()).toContainText('Projects');
  await page.locator('.workspace-suggestion').first().click();
  await expect(repoInput).toHaveValue(PROJECTS_DIR);
  await expect(page.locator('#repo-path-receipt')).toHaveText('Folder found');

  await page.locator('#workspace-new-folder').click();
  await page.locator('#workspace-create-name').fill('new-workspace');
  await page.locator('#workspace-create-form').getByRole('button', { name: 'Create' }).click();
  await expect(repoInput).toHaveValue(path.join(PROJECTS_DIR, 'new-workspace'));
  await expect(page.locator('#repo-path-receipt')).toHaveText('Folder created');
});

test('Manager is a conversation-driven live canvas whose Work object grows with real events', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 820 });
  await page.goto(`${URL}/company`);
  await expect(page.locator('body')).toHaveAttribute('data-canvas-state', 'quiet');

  await page.locator('#run-settings > summary').click();
  await page.locator('[data-runtime-id="mock"]').click();
  await page.locator('#repo-dir').fill(FIXTURE_REPO);
  await expect(page.locator('#repo-path-control')).toHaveAttribute('data-state', 'received');

  await page.locator('#work-brief').fill('Turn the canvas into a live product surface');
  await page.getByRole('button', { name: 'Send to Alex' }).click();

  const intent = page.locator('[data-canvas-intent]').filter({ hasText: 'Turn the canvas into a live product surface' });
  await expect(intent).toBeVisible();

  const work = page.locator('[data-canvas-object="work"]').filter({ hasText: 'Turn the canvas into a live product surface' });
  await expect(work).toBeVisible();
  await expect(work.locator('.canvas-live-state')).toBeVisible();
  await expect(work.locator('.canvas-event-history .canvas-event')).not.toHaveCount(0);
  await expect(work.locator('.artifact:not(.run-detail)')).toBeVisible();
  await expect(work.locator('.status')).toHaveText('Ready for review');
  await expect(work.locator('.canvas-live-label')).toHaveText('Evidence ready');
  await expect(page.locator('body')).toHaveAttribute('data-canvas-state', 'review');

  await page.screenshot({ path: path.join(ROOT, 'test-results', 'company-live-canvas.png') });
});

test('workspace tree remains contained and touchable on a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${URL}/company`);
  await page.locator('#run-settings > summary').click();
  await expect(page.locator('#workspace-picker')).toHaveAttribute('data-controller', 'ready');
  await page.locator('#workspace-tree-toggle').click();
  await expect(page.locator('#workspace-tree-panel')).toBeVisible();
  await expect(page.locator('.workspace-node-name').filter({ hasText: 'Projects' }).first()).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  await page.screenshot({ path: path.join(ROOT, 'test-results', 'company-mobile-workspace-tree.png') });
});

test('context lenses change focus without replacing the Company Canvas shell', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${URL}/company`);

  await expect(page.locator('.manager-presence')).toBeVisible();
  await expect(page.locator('.composer-dock')).toBeVisible();
  await expect(page.locator('#canvas-lens-trigger')).toBeVisible();
  await page.evaluate(() => { window.__lucubroCanvasShellProbe = 'alive'; });

  await page.locator('#canvas-lens-trigger').click();
  await page.locator('[data-canvas-lens-target="work"]').click();
  await expect(page).toHaveURL(`${URL}/company/work`);
  await expect(page.getByRole('heading', { name: 'Work', exact: true })).toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-canvas-lens', 'work');
  await expect(page.locator('.manager-presence')).toBeVisible();
  await expect(page.locator('.composer-dock')).toBeVisible();
  await expect(page.locator('#canvas-lens-trigger')).toBeFocused();
  expect(await page.evaluate(() => window.__lucubroCanvasShellProbe)).toBe('alive');

  await page.locator('#canvas-lens-trigger').click();
  await page.locator('[data-canvas-lens-target="employees"]').click();
  await expect(page).toHaveURL(`${URL}/company/employees`);
  await expect(page.getByRole('heading', { name: 'Employees', exact: true })).toBeVisible();
  await expect(page.locator('#employee-page-list')).toContainText('Alex');
  await expect(page.locator('#employee-page-list')).toContainText('Ben');
  expect(await page.evaluate(() => window.__lucubroCanvasShellProbe)).toBe('alive');

  await page.locator('#canvas-lens-trigger').click();
  await page.locator('[data-canvas-lens-target="settings"]').click();
  await expect(page).toHaveURL(`${URL}/company/settings`);
  await expect(page.getByRole('heading', { name: 'Execution settings', exact: true })).toBeVisible();
  await expect(page.locator('#settings-runtime-list')).toContainText('mock');
  await expect(page.locator('#settings-workspace-root')).toHaveText(WORKSPACE_ROOT);
  await expect(page.locator('.composer-dock')).toBeVisible();
  expect(await page.evaluate(() => window.__lucubroCanvasShellProbe)).toBe('alive');

  await page.goBack();
  await expect(page).toHaveURL(`${URL}/company/employees`);
  await expect(page.locator('body')).toHaveAttribute('data-canvas-lens', 'employees');
  expect(await page.evaluate(() => window.__lucubroCanvasShellProbe)).toBe('alive');

  await page.goBack();
  await expect(page).toHaveURL(`${URL}/company/work`);
  await expect(page.locator('body')).toHaveAttribute('data-canvas-lens', 'work');

  await page.locator('#canvas-lens-trigger').click();
  await page.locator('[data-canvas-lens-target="manager"]').click();
  await expect(page).toHaveURL(`${URL}/company`);
  await expect(page.getByRole('heading', { name: 'What should we move forward?' })).toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-canvas-lens', 'manager');
  await expect(page.locator('.composer-dock')).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('persistent composer returns focus to Manager canvas when it creates new Work', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 820 });
  await page.goto(`${URL}/company`);
  await page.evaluate(() => { window.__lucubroCanvasShellProbe = 'alive'; });

  await page.locator('#run-settings > summary').click();
  await page.locator('[data-runtime-id="mock"]').click();
  await page.locator('#repo-dir').fill(FIXTURE_REPO);
  await expect(page.locator('#repo-path-control')).toHaveAttribute('data-state', 'received');
  await page.locator('#run-settings > summary').click();

  await page.locator('#canvas-lens-trigger').click();
  await page.locator('[data-canvas-lens-target="work"]').click();
  await expect(page.locator('body')).toHaveAttribute('data-canvas-lens', 'work');

  const instruction = 'Start new Work from a focused lens';
  await page.locator('#work-brief').fill(instruction);
  await page.getByRole('button', { name: 'Send to Alex' }).click();

  await expect(page).toHaveURL(`${URL}/company`);
  await expect(page.locator('body')).toHaveAttribute('data-canvas-lens', 'manager');
  await expect(page.locator('[data-canvas-intent]').filter({ hasText: instruction })).toBeVisible();
  await expect(page.locator('[data-canvas-object="work"]').filter({ hasText: instruction })).toBeVisible();
  expect(await page.evaluate(() => window.__lucubroCanvasShellProbe)).toBe('alive');
});
