#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const runtimeRoot = path.join(ROOT, 'tests', '.runtime');
const fixtureDir = path.join(runtimeRoot, 'fixtures');
const dataDir = path.join(runtimeRoot, 'courses');

function run(script, args) {
  const result = spawnSync(process.execPath, [path.join(ROOT, 'scripts', script), ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
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

process.env.KIMI_STUDY_DATA_DIR = dataDir;
process.env.KIMI_STUDY_FIXTURE_DIR = fixtureDir;
process.env.PORT = process.env.KIMI_STUDY_E2E_PORT || process.env.PORT || '3107';
process.env.NODE_ENV = 'test';

require(path.join(ROOT, 'server.js'));
