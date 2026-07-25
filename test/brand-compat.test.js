'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { resolveDataDir, resolveFixtureDir, resolveE2EPort } = require('../lib/runtime-config');

const ROOT = path.join(path.sep, 'tmp', 'lucubro-brand-test');

test('LUCUBRO_* values take precedence over legacy KIMI_STUDY_* values', () => {
  const env = {
    LUCUBRO_DATA_DIR: 'tmp/lucubro-data',
    KIMI_STUDY_DATA_DIR: 'tmp/legacy-data',
    LUCUBRO_FIXTURE_DIR: 'tmp/lucubro-fixtures',
    KIMI_STUDY_FIXTURE_DIR: 'tmp/legacy-fixtures',
    LUCUBRO_E2E_PORT: '4310',
    KIMI_STUDY_E2E_PORT: '4311',
  };
  assert.equal(resolveDataDir({ root: ROOT, env }), path.resolve('tmp/lucubro-data'));
  assert.equal(resolveFixtureDir({ root: ROOT, env }), path.resolve('tmp/lucubro-fixtures'));
  assert.equal(resolveE2EPort({ env }), 4310);
});

test('legacy KIMI_STUDY_* values remain supported as fallbacks', () => {
  const env = {
    KIMI_STUDY_DATA_DIR: 'tmp/legacy-data',
    KIMI_STUDY_FIXTURE_DIR: 'tmp/legacy-fixtures',
    KIMI_STUDY_E2E_PORT: '4311',
  };
  assert.equal(resolveDataDir({ root: ROOT, env }), path.resolve('tmp/legacy-data'));
  assert.equal(resolveFixtureDir({ root: ROOT, env }), path.resolve('tmp/legacy-fixtures'));
  assert.equal(resolveE2EPort({ env }), 4311);
});

test('blank LUCUBRO_* values fall back to nonblank legacy values', () => {
  const env = {
    LUCUBRO_DATA_DIR: '  ',
    KIMI_STUDY_DATA_DIR: 'tmp/legacy-data',
    LUCUBRO_FIXTURE_DIR: '',
    KIMI_STUDY_FIXTURE_DIR: 'tmp/legacy-fixtures',
    LUCUBRO_E2E_PORT: ' ',
    KIMI_STUDY_E2E_PORT: '4311',
  };
  assert.equal(resolveDataDir({ root: ROOT, env }), path.resolve('tmp/legacy-data'));
  assert.equal(resolveFixtureDir({ root: ROOT, env }), path.resolve('tmp/legacy-fixtures'));
  assert.equal(resolveE2EPort({ env }), 4311);
});

test('brand environment resolvers preserve existing defaults', () => {
  assert.equal(resolveDataDir({ root: ROOT, env: {} }), path.join(ROOT, 'data', 'courses'));
  assert.equal(resolveFixtureDir({ root: ROOT, env: {} }), path.join(ROOT, 'tests', '.generated', 'fixtures'));
  assert.equal(resolveE2EPort({ env: {} }), 3107);
});

class MemoryStorage {
  constructor(entries = {}) {
    this.values = new Map(Object.entries(entries));
  }
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

test('browser compatibility layer migrates legacy storage keys without overwriting new values and is idempotent', () => {
  const script = fs.readFileSync(path.join(__dirname, '..', 'public', 'brand-compat.js'), 'utf8');
  const storage = new MemoryStorage({
    'kimi-study-first-run-ready:course-a': 'ready',
    'kimi-study-notes-panel:course-a:/course/course-a': 'open',
    'kimi-study:mission-answer:course-a:1:q1': 'draft',
    'kimi-study-left-width': '280',
    'lucubro-notes-panel:course-a:/course/course-a': 'newer',
    unrelated: 'keep',
  });
  const context = vm.createContext({ window: { localStorage: storage } });

  vm.runInContext(script, context);
  vm.runInContext(script, context);

  assert.equal(storage.getItem('lucubro-first-run-ready:course-a'), 'ready');
  assert.equal(storage.getItem('lucubro-notes-panel:course-a:/course/course-a'), 'newer');
  assert.equal(storage.getItem('lucubro:mission-answer:course-a:1:q1'), 'draft');
  assert.equal(storage.getItem('lucubro-left-width'), '280');
  assert.equal(storage.getItem('kimi-study-first-run-ready:course-a'), null);
  assert.equal(storage.getItem('kimi-study-notes-panel:course-a:/course/course-a'), null);
  assert.equal(storage.getItem('kimi-study:mission-answer:course-a:1:q1'), null);
  assert.equal(storage.getItem('kimi-study-left-width'), null);
  assert.equal(storage.getItem('unrelated'), 'keep');
});
