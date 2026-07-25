'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { resolveDataDir, resolveFixtureDir } = require('../lib/runtime-config');

test('resolveDataDir uses the production data path by default', () => {
  const root = path.join(path.sep, 'tmp', 'lucubro-root');
  assert.equal(resolveDataDir({ root, env: {} }), path.join(root, 'data', 'courses'));
});

test('resolveDataDir honors an isolated absolute or relative test directory', () => {
  const expected = path.resolve('tmp/e2e-courses');
  assert.equal(resolveDataDir({ env: { KIMI_STUDY_DATA_DIR: 'tmp/e2e-courses' } }), expected);
});

test('resolveFixtureDir can be redirected without changing production data', () => {
  const expected = path.resolve('tmp/generated-fixtures');
  assert.equal(resolveFixtureDir({ env: { KIMI_STUDY_FIXTURE_DIR: 'tmp/generated-fixtures' } }), expected);
});
