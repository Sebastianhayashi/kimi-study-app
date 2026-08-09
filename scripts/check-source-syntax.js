#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_FILES = Object.freeze([
  'company-server.js',
  'server.js',
  'playwright.config.js',
]);
const SOURCE_DIRS = Object.freeze([
  'lib',
  'public',
  'test',
  'tests',
  'scripts',
  'research/prototypes',
]);
const IGNORED_DIRS = new Set([
  '.git',
  '.runtime',
  'node_modules',
  'playwright-report',
  'test-results',
]);

function comparePath(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function collectJavaScriptFiles(directory, output) {
  if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => comparePath(a.name, b.name))) {
    if (entry.name.startsWith('.') && entry.name !== '.well-known') continue;
    if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) collectJavaScriptFiles(absolute, output);
    else if (entry.isFile() && /\.(?:c?js|mjs)$/.test(entry.name)) output.push(absolute);
  }
}

function listJavaScriptFiles(rootDir = ROOT) {
  const files = [];
  for (const relative of SOURCE_FILES) {
    const absolute = path.join(rootDir, relative);
    if (fs.existsSync(absolute) && fs.statSync(absolute).isFile()) files.push(absolute);
  }
  for (const relative of SOURCE_DIRS) collectJavaScriptFiles(path.join(rootDir, relative), files);
  return [...new Set(files)].sort(comparePath);
}

function checkJavaScriptSyntax({ rootDir = ROOT, spawnSyncImpl = spawnSync } = {}) {
  const files = listJavaScriptFiles(rootDir);
  if (files.length === 0) throw new Error('No JavaScript sources found for syntax verification.');
  const failures = [];
  for (const file of files) {
    const result = spawnSyncImpl(process.execPath, ['--check', file], {
      cwd: rootDir,
      encoding: 'utf8',
      timeout: 30_000,
      maxBuffer: 1024 * 1024,
    });
    if (!result || result.error || result.status !== 0) {
      failures.push({
        file: path.relative(rootDir, file),
        status: result ? result.status : null,
        error: result && result.error ? result.error.message : null,
        stderr: result && result.stderr ? result.stderr.trim() : '',
      });
    }
  }
  if (failures.length) {
    const error = new Error(`JavaScript syntax verification failed for ${failures.length} file(s).`);
    error.failures = failures;
    throw error;
  }
  return { checked: files.length, files: files.map((file) => path.relative(rootDir, file)) };
}

function main() {
  try {
    const result = checkJavaScriptSyntax();
    process.stdout.write(`Checked JavaScript syntax: ${result.checked} files\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    for (const failure of error.failures || []) {
      process.stderr.write(`${failure.file}: ${failure.stderr || failure.error || `exit ${failure.status}`}\n`);
    }
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  SOURCE_DIRS,
  SOURCE_FILES,
  checkJavaScriptSyntax,
  listJavaScriptFiles,
};
