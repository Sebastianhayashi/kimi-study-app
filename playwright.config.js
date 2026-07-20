'use strict';

const path = require('path');
const { defineConfig, devices } = require('@playwright/test');

const port = Number(process.env.KIMI_STUDY_E2E_PORT || 3107);
const baseURL = `http://127.0.0.1:${port}`;

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
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 8_000,
    navigationTimeout: 15_000,
  },
  webServer: {
    command: 'node tests/support/test-server.js',
    url: `${baseURL}/app`,
    timeout: 60_000,
    reuseExistingServer: false,
    env: {
      ...process.env,
      PORT: String(port),
      KIMI_STUDY_E2E_PORT: String(port),
    },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
