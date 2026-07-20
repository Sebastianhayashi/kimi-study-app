#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const outputIndex = process.argv.indexOf('--output');
const output = outputIndex >= 0 && process.argv[outputIndex + 1]
  ? path.resolve(process.argv[outputIndex + 1])
  : null;
const verify = process.argv.includes('--verify');

function command(command, args, { inherit = false } = {}) {
  const startedAt = Date.now();
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  });
  return {
    command: [command, ...args].join(' '),
    exitCode: typeof result.status === 'number' ? result.status : 1,
    durationMs: Date.now() - startedAt,
    stdout: inherit ? '' : String(result.stdout || '').trim().slice(-4000),
    stderr: inherit ? '' : String(result.stderr || result.error?.message || '').trim().slice(-4000),
  };
}

function value(commandName, args) {
  const result = command(commandName, args);
  return result.exitCode === 0 ? result.stdout : null;
}

const report = {
  schemaVersion: 1,
  capturedAt: new Date().toISOString(),
  repository: {
    commit: value('git', ['rev-parse', 'HEAD']),
    branch: value('git', ['branch', '--show-current']),
    dirty: Boolean(value('git', ['status', '--porcelain'])),
  },
  runtime: {
    node: process.version,
    npm: value('npm', ['--version']),
    platform: process.platform,
    arch: process.arch,
    osRelease: os.release(),
  },
  configuration: {
    dataDirConfigured: Boolean(process.env.KIMI_STUDY_DATA_DIR),
    fixtureDirConfigured: Boolean(process.env.KIMI_STUDY_FIXTURE_DIR),
    port: process.env.PORT || '3000',
  },
  verification: [],
};

if (verify) {
  report.verification.push(command('npm', ['run', 'check']));
  report.verification.push(command('npm', ['test']));
}
report.ok = report.verification.every((item) => item.exitCode === 0);

const serialized = `${JSON.stringify(report, null, 2)}\n`;
if (output) {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, serialized);
  console.log(`Wrote stabilization baseline to ${output}`);
} else {
  process.stdout.write(serialized);
}
if (!report.ok) process.exitCode = 1;
