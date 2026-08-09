'use strict';

const { test, expect } = require('@playwright/test');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 3110;
const URL = `http://127.0.0.1:${PORT}`;
const DATA_DIR = path.join(ROOT, 'tests', '.runtime', 'diag-company-playwright');
let server;
let stdout = '';
let stderr = '';
let exit = null;

async function waitForServer() {
  const deadline = Date.now() + 10_000;
  let lastFetchError = null;
  while (Date.now() < deadline && !exit) {
    try {
      const response = await fetch(`${URL}/api/company/health`);
      if (response.ok) return;
    } catch (error) {
      lastFetchError = error.message;
    }
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  throw new Error(`company-server did not become ready: ${JSON.stringify({ exit, lastFetchError, stdout, stderr })}`);
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
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', (chunk) => { stdout = `${stdout}${chunk}`.slice(-12000); });
  server.stderr.on('data', (chunk) => { stderr = `${stderr}${chunk}`.slice(-12000); });
  server.on('exit', (code, signal) => { exit = { code, signal }; });
  server.on('error', (error) => { stderr = `${stderr}\n${error.stack || error}`.slice(-12000); });
  await waitForServer();
});

test.afterAll(async () => {
  if (server && server.exitCode == null && !server.killed) server.kill('SIGTERM');
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
});

test('company server is reachable inside the full Playwright harness', async ({ request }) => {
  const response = await request.get(`${URL}/api/company/health`);
  expect(response.ok()).toBe(true);
});
