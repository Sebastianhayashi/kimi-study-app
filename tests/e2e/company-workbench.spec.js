'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { startCompanyTestServer, stopCompanyTestServer } = require('../support/company-test-server');

const ROOT = path.resolve(__dirname, '..', '..');
let URL;
let server;

async function waitForCompanyControllers(page) {
  await expect(page.locator('#workspace-picker')).toHaveAttribute('data-controller', 'ready');
  await expect(page.locator('#company-operating-map')).toHaveAttribute('data-controller', 'ready');
}

async function openExecutionSetup(page) {
  const settings = page.locator('#run-settings');
  if ((await settings.getAttribute('open')) === null) await settings.locator('summary').click();
  await expect(settings).toHaveAttribute('open', '');
  return settings;
}

async function configureMockWork(page, brief) {
  await waitForCompanyControllers(page);
  await openExecutionSetup(page);
  await page.locator('[data-runtime-id="mock"]').click();
  await page.locator('#repo-dir').fill('/tmp/lucubro-fixture-repo');
  await expect(page.locator('#repo-path-control')).toHaveAttribute('data-state', 'received');
  await page.locator('#work-brief').fill(brief);
  await page.getByRole('button', { name: 'Send to Alex' }).click();
}

async function useDesktopViewport(page) {
  await page.setViewportSize({ width: 1440, height: 900 });
}

test.beforeAll(async () => {
  const dataDir = path.join(ROOT, 'tests', '.runtime', 'company');
  fs.rmSync(dataDir, { recursive: true, force: true });
  server = await startCompanyTestServer({ rootDir: ROOT, dataDir });
  URL = server.url;
});

test.afterAll(async () => {
  await stopCompanyTestServer(server);
});

test('front door explains the company operating model before asking for another chat turn', async ({ page }) => {
  await useDesktopViewport(page);
  await page.goto(`${URL}/company`);
  await waitForCompanyControllers(page);

  const map = page.locator('#company-operating-map');
  await expect(map).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your company, in motion.' })).toBeVisible();
  await expect(map).toContainText('Durable Work across AI Employees, Runs, evidence, and decisions.');
  await expect(map.getByTestId('operating-manager')).toContainText('Alex');
  await expect(map.getByTestId('operating-employee-row').filter({ hasText: 'Ben' })).toBeVisible();
  await expect(map).toContainText('No durable Work yet.');

  await expect(page.getByLabel('Alex, Primary Manager')).toBeVisible();
  await expect(page.getByLabel('Company canvas focus')).toBeVisible();
  await expect(page.locator('#canvas-lens-current')).toHaveText('Manager canvas');
  await expect(page.getByLabel('Current company context')).toHaveAttribute('data-state', 'quiet');
  await expect(page.locator('#run-settings')).not.toHaveAttribute('open', '');
  await expect(page.getByRole('button', { name: 'Send to Alex' })).toBeEnabled();
  await expect(page.locator('#runtime-note')).toContainText('Ready: mock');
  await expect(page.locator('body')).toHaveAttribute('data-company-has-work', 'false');
  await expect(page.locator('.composer-dock')).toHaveCSS('position', 'relative');

  const primary = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--brand-primary').trim());
  expect(primary).toBe('#002fa7');
  await expect(page.locator('#send-work')).toHaveCSS('background-color', 'rgb(0, 47, 167)');
  await page.screenshot({ path: path.join(ROOT, 'test-results', 'company-blue-desktop-empty.png') });
});

test('execution setup exposes kinetic runtime choices and a line-based repository receipt', async ({ page }) => {
  await useDesktopViewport(page);
  await page.goto(`${URL}/company`);
  await waitForCompanyControllers(page);
  await openExecutionSetup(page);

  const choices = page.locator('#runtime-choice');
  await expect(choices).toBeVisible();
  await expect(choices).toHaveAttribute('role', 'radiogroup');
  await expect(page.locator('[data-runtime-id="claude-code"]')).toBeVisible();
  await expect(page.locator('[data-runtime-id="codex"]')).toBeVisible();
  await expect(page.locator('[data-runtime-id="mock"]')).toBeVisible();
  await expect(page.locator('[data-runtime-id="mock"]')).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('[data-runtime-id="mock"]')).toHaveAttribute('data-selected', 'true');

  const repoControl = page.locator('#repo-path-control');
  const repoInput = page.locator('#repo-dir');
  await repoInput.focus();
  await expect(repoInput).toBeFocused();
  await expect(repoControl).toHaveAttribute('data-state', 'focused');
  await repoInput.fill('/tmp/lucubro-fixture-repo');
  await expect(repoControl).toHaveAttribute('data-state', 'received');
  await expect(page.locator('#repo-path-receipt')).toContainText('Path received');
  await expect(page.locator('#repo-path-receipt')).toBeVisible();

  await page.locator('#close-run-settings').click();
  await expect(page.locator('#run-settings')).not.toHaveAttribute('open', '');
  await expect(page.locator('#settings-summary-value')).toContainText('lucubro-fixture-repo');
  await expect(page.locator('#settings-summary-value')).toContainText('mock');
  await page.screenshot({ path: path.join(ROOT, 'test-results', 'company-kinetic-execution.png') });
});

test('durable Work appears under its Employee, survives reload, and opens evidence from the map', async ({ page }) => {
  await useDesktopViewport(page);
  await page.goto(`${URL}/company`);
  await configureMockWork(page, 'Fix the session refresh bug');
  await expect(page.locator('#run-settings')).not.toHaveAttribute('open', '');
  await expect(page.locator('.work-object-title strong')).toContainText('Fix the session refresh bug');
  await expect(page.getByText('Ben · Software Engineer')).toBeVisible();
  await expect(page.locator('.work-object .status')).toHaveText('Ready for review');
  await expect(page.locator('.work-object .status')).toHaveAttribute('data-tone', 'review');
  await expect(page.getByText('Code changes · 1 file')).toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-company-has-work', 'true');
  await expect(page.locator('.composer-dock')).toHaveCSS('position', 'fixed');
  await expect(page.locator('#work-brief')).toHaveCSS('min-height', '52px');
  await page.locator('#work-brief').focus();
  await expect(page.locator('#work-brief')).toHaveCSS('min-height', '68px');

  const employeeRow = page.getByTestId('operating-employee-row').filter({ hasText: 'Ben' });
  const mapNode = employeeRow.getByTestId('operating-work-node').filter({ hasText: 'Fix the session refresh bug' });
  await expect(mapNode).toBeVisible();
  await expect(mapNode).toContainText('Ready for review');
  await expect(mapNode).toContainText('Run ');
  await expect(mapNode).not.toContainText('Runtime mock');

  await page.reload();
  await waitForCompanyControllers(page);
  await expect(page.locator('#conversation-feed .work-object')).toHaveCount(0);
  await expect(page.locator('#durable-work-context')).toBeVisible();

  const restoredNode = page.getByTestId('operating-work-node').filter({ hasText: 'Fix the session refresh bug' });
  await expect(restoredNode).toBeVisible();
  await expect(restoredNode).toContainText('Ready for review');
  await restoredNode.click();

  const durableDetail = page.locator('#durable-work-detail');
  await expect(durableDetail).toBeVisible();
  await expect(durableDetail).toContainText('Fix the session refresh bug');
  await expect(durableDetail).toContainText('Code changes · 1 file');
  await expect(durableDetail).toContainText('src/session.js');
  await expect(page.locator('#work-brief')).toHaveCSS('min-height', '52px');
  await page.screenshot({ path: path.join(ROOT, 'test-results', 'company-blue-desktop-review.png') });

  await durableDetail.getByRole('button', { name: 'Accept' }).click();
  await expect(durableDetail).toContainText('Accepted');
  await expect(restoredNode).toContainText('Accepted');
});

test('out-of-envelope request mutates the owning Work on the operating map', async ({ page }) => {
  await useDesktopViewport(page);
  await page.goto(`${URL}/company`);
  await configureMockWork(page, 'Fix auth needs-approval');
  const currentWork = page.locator('.work-object').filter({ hasText: 'Fix auth needs-approval' });
  const mapNode = page.getByTestId('operating-work-node').filter({ hasText: 'Fix auth needs-approval' });
  await expect(currentWork).toBeVisible();
  await expect(mapNode).toContainText('Needs you');
  await expect(page.locator('[data-testid="needs-you-card"]')).toBeVisible();
  await expect(page.getByText('network.access')).toBeVisible();
  await expect(page.locator('#needs-you-button')).toHaveAttribute('data-active', 'true');
  await expect(page.locator('#needs-you-count')).toHaveText('1');
  await expect(page.locator('body')).toHaveAttribute('data-canvas-state', 'decision');
  await page.screenshot({ path: path.join(ROOT, 'test-results', 'company-blue-needs-you.png') });
  await page.keyboard.press('Escape');
  await expect(page.locator('#needs-you-panel')).toBeHidden();
  await page.locator('#needs-you-button').click();
  await page.locator('[data-testid="needs-you-card"] .primary-action').click();
  await expect(page.locator('#needs-you-count')).toHaveText('0');
  await expect(page.locator('[data-testid="needs-you-card"]')).toHaveCount(0);
  await expect(currentWork.locator('.canvas-event-history')).toContainText('Decision received');
  await expect(currentWork.locator('.status')).toHaveText('Ready for review');
  await expect(mapNode).toContainText('Ready for review');
});

test('keyboard shortcut submits Work without exposing runtime mechanics in the main thread', async ({ page }) => {
  await page.goto(`${URL}/company`);
  await waitForCompanyControllers(page);
  await openExecutionSetup(page);
  await page.locator('[data-runtime-id="mock"]').click();
  await page.locator('#repo-dir').fill('/tmp/lucubro-fixture-repo');
  await page.locator('#work-brief').fill('Fix keyboard submission');
  await page.locator('#work-brief').press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter');
  await expect(page.locator('.work-object-title strong')).toContainText('Fix keyboard submission');
  await expect(page.getByText('Runtime: mock')).toBeHidden();
});

test('mobile keeps the operating map, Manager relationship, composer, and Work surface inside the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${URL}/company`);
  await waitForCompanyControllers(page);
  await expect(page.locator('#company-operating-map')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your company, in motion.' })).toBeVisible();
  await expect(page.getByLabel('Alex, Primary Manager')).toBeVisible();
  await expect(page.getByLabel('Company canvas focus')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send to Alex' })).toBeVisible();

  const brief = 'Verify compact mobile company control';
  const created = await page.evaluate(async (workBrief) => {
    const response = await fetch('/api/company/works', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brief: workBrief,
        repoDir: '/tmp/lucubro-mobile-fixture',
        runtime: 'mock',
      }),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  }, brief);
  expect(created.run.id).toBeTruthy();

  await page.reload();
  await waitForCompanyControllers(page);
  await expect(page.getByTestId('operating-work-node').filter({ hasText: brief })).toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-company-has-work', 'true');
  await expect(page.locator('#work-brief')).toHaveCSS('min-height', '52px');
  await expect(page.locator('#run-settings > summary .settings-summary-label')).toBeVisible();
  await openExecutionSetup(page);
  await expect(page.locator('#runtime-choice')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.screenshot({ path: path.join(ROOT, 'test-results', 'company-blue-mobile-empty.png') });
});

test('skip navigation reaches the persistent Company Canvas content for keyboard users', async ({ page }) => {
  await page.goto(`${URL}/company`);
  await page.keyboard.press('Tab');
  await expect(page.locator('.skip-link')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#company-main')).toBeFocused();
});

test('reduced motion preserves the operating map and semantic Company state', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${URL}/company`);
  await waitForCompanyControllers(page);
  const map = page.locator('#company-operating-map');
  await expect(map).toBeVisible();
  await expect(map).toHaveCSS('opacity', '1');
  await expect(page.getByRole('heading', { name: 'Your company, in motion.' })).toBeVisible();
  await expect(page.getByLabel('Company canvas focus')).toBeVisible();
  const context = page.getByLabel('Current company context');
  await expect(context).toHaveAttribute('data-state', /^(quiet|active|review|decision)$/);
  await expect(context).toHaveCSS('opacity', '1');
  const reduced = await page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  expect(reduced).toBe(true);
  await expect(page.getByRole('button', { name: 'Send to Alex' })).toBeEnabled();
  await openExecutionSetup(page);
  await expect(page.locator('#runtime-choice')).toBeVisible();
});
