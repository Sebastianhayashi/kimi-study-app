'use strict';

const fs = require('fs');
const path = require('path');
const { defineConfig, devices } = require('@playwright/test');
const { resolveE2EPort } = require('./lib/runtime-config');

const port = resolveE2EPort();
if (!Number.isInteger(port) || port <= 0 || port > 65535 || port === 3000) {
  throw new Error(`Unsafe Playwright port: ${port}. E2E must use an isolated non-production port.`);
}
const baseURL = `http://127.0.0.1:${port}`;
const polPort = Number(process.env.LUCUBRO_POL_E2E_PORT || (port + 1));
if (!Number.isInteger(polPort) || polPort <= 0 || polPort > 65535 || polPort === 3000 || polPort === port) {
  throw new Error(`Unsafe Flag-A Playwright port: ${polPort}.`);
}
const polBaseURL = `http://127.0.0.1:${polPort}`;
const chromiumExecutable = [process.env.PLAYWRIGHT_CHROMIUM_PATH, '/usr/bin/chromium', '/usr/bin/chromium-browser']
  .filter(Boolean)
  .find((candidate) => fs.existsSync(candidate));

module.exports = defineConfig({
  testDir: path.join(__dirname, 'tests', 'e2e'),
  outputDir: path.join(__dirname, 'test-results'),
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL,
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    viewport: { width: 1440, height: 900 },
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: chromiumExecutable ? 'off' : 'retain-on-failure',
    actionTimeout: 8_000,
    navigationTimeout: 15_000,
    ...(chromiumExecutable ? { launchOptions: { executablePath: chromiumExecutable } } : {}),
  },
  webServer: [
    {
      command: 'node tests/support/test-server.js',
      url: `${baseURL}/app`,
      timeout: 60_000,
      reuseExistingServer: false,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        PORT: String(port),
        LUCUBRO_E2E_PORT: String(port),
        LUCUBRO_POL_V2: '0',
      },
    },
    {
      command: 'node tests/support/pol-v2-test-server.js',
      url: `${polBaseURL}/artifact/new`,
      timeout: 60_000,
      reuseExistingServer: false,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        PORT: String(polPort),
        LUCUBRO_POL_E2E_PORT: String(polPort),
        LUCUBRO_POL_V2: '1',
      },
    },
  ],
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
