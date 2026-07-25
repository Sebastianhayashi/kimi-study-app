#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { assertSafeRuntime, resolveE2EPort } = require('../../lib/runtime-config');

const ROOT = path.resolve(__dirname, '..', '..');
const runtimeRoot = path.join(ROOT, 'tests', '.runtime');
const fixtureDir = path.join(runtimeRoot, 'fixtures');
const dataDir = path.join(runtimeRoot, 'courses');
const port = resolveE2EPort();

if (!Number.isInteger(port) || port <= 0 || port > 65535) throw new Error(`Invalid E2E port: ${port}`);
if (port === 3000) throw new Error('E2E tests must never use production port 3000.');

process.env.NODE_ENV = 'test';
process.env.PORT = String(port);
process.env.LUCUBRO_E2E_PORT = String(port);
process.env.LUCUBRO_DATA_DIR = dataDir;
process.env.LUCUBRO_FIXTURE_DIR = fixtureDir;
assertSafeRuntime({ root: ROOT, dataDir, port, env: process.env });

function run(script, args) {
  const result = spawnSync(process.execPath, [path.join(ROOT, 'scripts', script), ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    process.exit(result.status || 1);
  }
}

fs.rmSync(runtimeRoot, { recursive: true, force: true });
fs.mkdirSync(runtimeRoot, { recursive: true });
run('build-test-fixtures.js', ['--output', fixtureDir]);
run('seed-e2e-data.js', ['--fixtures', fixtureDir, '--target', dataDir, '--clean']);

console.log(`[e2e] isolated server port=${port} data=${dataDir}`);
require(path.join(ROOT, 'server.js'));
