#!/usr/bin/env node
'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PORT = 3110;
const URL = `http://127.0.0.1:${PORT}`;
const DATA_DIR = path.join(ROOT, 'tests', '.runtime', 'diag-company-server');

fs.rmSync(DATA_DIR, { recursive: true, force: true });

const child = spawn(process.execPath, [path.join(ROOT, 'company-server.js')], {
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

let stdout = '';
let stderr = '';
let exit = null;
child.stdout.on('data', (chunk) => { stdout = `${stdout}${chunk}`.slice(-12000); });
child.stderr.on('data', (chunk) => { stderr = `${stderr}${chunk}`.slice(-12000); });
child.on('exit', (code, signal) => { exit = { code, signal }; });
child.on('error', (error) => { stderr = `${stderr}\n${error.stack || error}`.slice(-12000); });

async function main() {
  const deadline = Date.now() + 10_000;
  let ready = false;
  let lastFetchError = null;
  while (Date.now() < deadline && !ready && !exit) {
    try {
      const response = await fetch(`${URL}/api/company/health`);
      ready = response.ok;
    } catch (error) {
      lastFetchError = error.message;
    }
    if (!ready) await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const result = {
    ready,
    port: PORT,
    exit,
    lastFetchError,
    stdout,
    stderr,
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!ready) process.exitCode = 1;
}

main()
  .catch((error) => {
    process.stderr.write(`${error.stack || error}\n`);
    process.exitCode = 1;
  })
  .finally(() => {
    if (child.exitCode == null && !child.killed) child.kill('SIGTERM');
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  });
