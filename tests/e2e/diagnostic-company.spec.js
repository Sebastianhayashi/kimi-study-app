'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { startCompanyTestServer, stopCompanyTestServer } = require('../support/company-test-server');

const ROOT = path.resolve(__dirname, '..', '..');
let URL;
let server;

test.beforeAll(async () => {
  const dataDir = path.join(ROOT, 'tests', '.runtime', 'company-diagnostic');
  fs.rmSync(dataDir, { recursive: true, force: true });
  server = await startCompanyTestServer({ rootDir: ROOT, dataDir });
  URL = server.url;
  console.log(`DIAG server=${URL}`);
});

test.afterAll(async () => {
  await stopCompanyTestServer(server);
});

test('reports the actual Company document served on the trusted Worker', async ({ page }) => {
  const browserConsole = [];
  const pageErrors = [];
  page.on('console', (message) => browserConsole.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const response = await page.goto(`${URL}/company`);
  await page.waitForTimeout(500);
  const status = response ? response.status() : null;
  const title = await page.title();
  const html = await page.content();
  const bodyText = await page.locator('body').innerText().catch(() => '');
  const diag = {
    status,
    finalUrl: page.url(),
    title,
    workspacePickerCount: await page.locator('#workspace-picker').count(),
    operatingMapCount: await page.locator('#company-operating-map').count(),
    bodyText: bodyText.slice(0, 800),
    html: html.slice(0, 1200),
    browserConsole: browserConsole.slice(-20),
    pageErrors: pageErrors.slice(-20),
  };
  console.log(`DIAG ${JSON.stringify(diag)}`);
  expect(status).toBe(200);
  expect(diag.workspacePickerCount).toBe(1);
});
