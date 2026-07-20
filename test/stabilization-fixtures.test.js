'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

function run(script, args) {
  const result = spawnSync(process.execPath, [path.join(ROOT, 'scripts', script), ...args], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result;
}

test('fixture builder produces deterministic source and course scenarios', () => {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kimi-fixtures-'));
  run('build-test-fixtures.js', ['--output', fixtureDir]);

  const manifest = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'manifest.json'), 'utf8'));
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.courses.readycourse.lessons, 1);
  assert.equal(fs.readFileSync(path.join(fixtureDir, 'sources', 'text-pdf.pdf')).subarray(0, 5).toString(), '%PDF-');

  const epub = fs.readFileSync(path.join(fixtureDir, 'sources', 'epub3.epub'));
  assert.equal(epub.readUInt32LE(0), 0x04034b50);
  assert.ok(fs.existsSync(path.join(fixtureDir, 'courses', 'readycourse', 'lessons', '0001-stabilization-fixture.html')));
  assert.ok(fs.existsSync(path.join(fixtureDir, 'courses', 'notescourse', 'notes.json')));
});

test('fixture seeding writes only to an explicitly isolated data directory', () => {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kimi-fixtures-'));
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kimi-data-'));
  run('build-test-fixtures.js', ['--output', fixtureDir]);
  run('seed-e2e-data.js', ['--fixtures', fixtureDir, '--target', dataDir, '--clean']);

  assert.ok(fs.existsSync(path.join(dataDir, '.kimi-study-e2e-data')));
  assert.ok(fs.existsSync(path.join(dataDir, 'readycourse', 'meta.json')));
  assert.ok(fs.existsSync(path.join(dataDir, 'generatingcourse', 'job.json')));
  assert.ok(fs.statSync(path.join(dataDir, 'generatingcourse', 'job.json')).mtimeMs > Date.now() - 10_000);
  assert.ok(fs.statSync(path.join(dataDir, 'interruptedcourse', 'job.json')).mtimeMs < Date.now() - 60_000);
});
