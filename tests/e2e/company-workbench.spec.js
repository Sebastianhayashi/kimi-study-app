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

async function configureMockWork(page, brief) {
  const settings = page.locator('#run-settings');
  if (!(await settings.getAttribute('open'))) await settings.locator('summary').click();
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

test('front door presents Alex, real working context, and Klein-blue primary actions', async ({ page }) => {
  await useDesktopViewport(page);
  await page.goto(`${URL}/company`);
  await expect(page.getByRole('heading', { name: 'What should we move forward?' })).toBeVisible();
  await expect(page.getByLabel('Alex, Primary Manager')).toBeVisible();
  await expect(page.getByLabel('Current company context')).toBeVisible();
  await expect(page.locator('#context-active-count')).toHaveText('0');
  await expect(page.locator('#context-review-count')).toHaveText('0');
  await expect(page.locator('#context-decision-count')).toHaveText('0');
  await expect(page.locator('#conversation-feed h1')).toHaveCount(0);
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
  await page.locator('#run-settings > summary').click();

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

test('durable Work survives reload without replaying Conversation and remains reviewable', async ({ page }) => {
  await useDesktopViewport(page);
  await page.goto(`${URL}/company`);
  await configureMockWork(page, 'Fix the session refresh bug');
  await expect(page.locator('#run-settings')).not.toHaveAttribute('open', '');
  await expect(page.locator('.work-object-title strong')).toContainText('Fix the session refresh bug');
  await expect(page.getByText('Ben · Software Engineer')).toBeVisible();
  await expect(page.locator('.status')).toHaveText('Ready for review');
  await expect(page.locator('.status')).toHaveAttribute('data-tone', 'review');
  await expect(page.getByText('Code changes · 1 file')).toBeVisible();
  await expect(page.locator('#context-review-count')).toHaveText('1');
  await expect(page.locator('#context-active-count')).toHaveText('0');
  await expect(page.locator('#context-copy')).toContainText('ready for review');
  await expect(page.locator('body')).toHaveAttribute('data-company-has-work', 'true');
  await expect(page.locator('.composer-dock')).toHaveCSS('position', 'fixed');

  await page.reload();
  await expect(page.locator('#conversation-feed .work-object')).toHaveCount(0);
  await expect(page.locator('#durable-work-context')).toBeVisible();
  await expect(page.locator('#context-review-count')).toHaveText('1');
  await expect(page.locator('#context-copy')).toContainText('ready for review');

  const durableRow = page.locator('[data-testid="durable-work-row"]').filter({ hasText: 'Fix the session refresh bug' });
  await expect(durableRow).toBeVisible();
  await expect(durableRow).toContainText('Ready for review');
  await durableRow.click();

  const durableDetail = page.locator('#durable-work-detail');
  await expect(durableDetail).toBeVisible();
  await expect(durableDetail).toContainText('Fix the session refresh bug');
  await expect(durableDetail).toContainText('Code changes · 1 file');
  await expect(durableDetail).toContainText('src/session.js');
  await page.screenshot({ path: path.join(ROOT, 'test-results', 'company-blue-desktop-review.png') });

  await durableDetail.getByRole('button', { name: 'Accept' }).click();
  await expect(durableDetail).toContainText('Accepted');
  await expect(page.locator('#context-review-count')).toHaveText('0');
  await expect(durableRow).toContainText('Accepted');
});

test('out-of-envelope request becomes a scoped Needs You decision and Working set reflects it', async ({ page }) => {
  await useDesktopViewport(page);
  await page.goto(`${URL}/company`);
  await configureMockWork(page, 'Fix auth needs-approval');
  await expect(page.locator('[data-testid="needs-you-card"]')).toBeVisible();
  await expect(page.getByText('network.access')).toBeVisible();
  await expect(page.locator('#needs-you-button')).toHaveAttribute('data-active', 'true');
  await expect(page.locator('#context-decision-count')).toHaveText('1');
  await expect(page.locator('#company-context')).toHaveAttribute('data-state', 'decision');
  await expect(page.locator('#context-copy')).toContainText('authority decision');
  await page.screenshot({ path: path.join(ROOT, 'test-results', 'company-blue-needs-you.png') });
  await page.keyboard.press('Escape');
  await expect(page.locator('#needs-you-panel')).toBeHidden();
  await page.locator('#needs-you-button').click();
  await page.locator('[data-testid="needs-you-card"] .primary-action').click();
  await expect(page.getByText('Approved for that one decision. Ben can continue.')).toBeVisible();
  await expect(page.locator('#context-decision-count')).toHaveText('0');
  await expect(page.locator('.status')).toHaveText('Ready for review');
});

test('keyboard shortcut submits Work without exposing runtime mechanics in the main thread', async ({ page }) => {
  await page.goto(`${URL}/company`);
  await page.locator('#run-settings > summary').click();
  await page.locator('[data-runtime-id="mock"]').click();
  await page.locator('#repo-dir').fill('/tmp/lucubro-fixture-repo');
  await page.locator('#work-brief').fill('Fix keyboard submission');
  await page.locator('#work-brief').press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter');
  await expect(page.locator('.work-object-title strong')).toContainText('Fix keyboard submission');
  await expect(page.getByText('Runtime: mock')).toBeHidden();
});

test('mobile keeps relationship, working set, composer, and Work surface inside the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${URL}/company`);
  await expect(page.getByLabel('Alex, Primary Manager')).toBeVisible();
  await expect(page.getByLabel('Current company context')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send to Alex' })).toBeVisible();
  await expect(page.locator('#context-active-count')).toBeVisible();
  await page.locator('#run-settings > summary').click();
  await expect(page.locator('#runtime-choice')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.screenshot({ path: path.join(ROOT, 'test-results', 'company-blue-mobile-empty.png') });
});

test('skip navigation reaches the manager conversation for keyboard users', async ({ page }) => {
  await page.goto(`${URL}/company`);
  await page.keyboard.press('Tab');
  await expect(page.locator('.skip-link')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#company-conversation')).toBeFocused();
});

test('reduced motion preserves the complete product state without GSAP dependency', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${URL}/company`);
  await expect(page.getByRole('heading', { name: 'What should we move forward?' })).toBeVisible();
  await expect(page.getByLabel('Current company context')).toBeVisible();
  const reduced = await page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  expect(reduced).toBe(true);
  await expect(page.getByRole('button', { name: 'Send to Alex' })).toBeEnabled();
  await expect(page.locator('#company-context')).toHaveCSS('opacity', '1');
  await page.locator('#run-settings > summary').click();
  await expect(page.locator('#runtime-choice')).toBeVisible();
});
