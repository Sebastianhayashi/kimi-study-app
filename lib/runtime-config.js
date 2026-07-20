'use strict';

const path = require('path');

function resolveDataDir({ root = path.resolve(__dirname, '..'), env = process.env } = {}) {
  const configured = String(env.KIMI_STUDY_DATA_DIR || '').trim();
  return configured ? path.resolve(configured) : path.join(root, 'data', 'courses');
}

function resolveFixtureDir({ root = path.resolve(__dirname, '..'), env = process.env } = {}) {
  const configured = String(env.KIMI_STUDY_FIXTURE_DIR || '').trim();
  return configured ? path.resolve(configured) : path.join(root, 'tests', '.generated', 'fixtures');
}

module.exports = {
  resolveDataDir,
  resolveFixtureDir,
};
