'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

function resolveDataDir({ root = path.resolve(__dirname, '..'), env = process.env } = {}) {
  const configured = String(env.KIMI_STUDY_DATA_DIR || '').trim();
  return configured ? path.resolve(configured) : path.join(root, 'data', 'courses');
}

function resolveFixtureDir({ root = path.resolve(__dirname, '..'), env = process.env } = {}) {
  const configured = String(env.KIMI_STUDY_FIXTURE_DIR || '').trim();
  return configured ? path.resolve(configured) : path.join(root, 'tests', '.generated', 'fixtures');
}

function isWithin(target, parent) {
  const relative = path.relative(path.resolve(parent), path.resolve(target));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function assertSafeRuntime({ root = path.resolve(__dirname, '..'), dataDir, port, env = process.env, fsImpl = fs } = {}) {
  const resolvedData = path.resolve(dataDir || resolveDataDir({ root, env }));
  const resolvedPort = Number(port || env.PORT || 3000);
  const testRuntime = path.join(root, 'tests', '.runtime');
  const testsRoot = path.join(root, 'tests');
  const marker = path.join(resolvedData, '.kimi-study-e2e-data');
  const isTest = env.NODE_ENV === 'test';

  if (isTest) {
    if (resolvedPort === 3000) throw new Error('Refusing to start a test server on production port 3000.');
    if (!isWithin(resolvedData, testRuntime)) {
      throw new Error(`Test data must stay inside ${testRuntime}; received ${resolvedData}`);
    }
  } else {
    if (isWithin(resolvedData, testsRoot) || fsImpl.existsSync(marker)) {
      throw new Error(`Refusing to start a production server with fixture data at ${resolvedData}`);
    }
  }

  return { dataDir: resolvedData, port: resolvedPort, mode: isTest ? 'test' : 'production' };
}

function assertSafeSeedTarget({ root = path.resolve(__dirname, '..'), target } = {}) {
  const resolved = path.resolve(target || '');
  const productionRoot = path.join(root, 'data');
  const runtimeRoot = path.join(root, 'tests', '.runtime');
  const tempRoot = os.tmpdir();
  const tempName = path.relative(tempRoot, resolved).split(path.sep)[0] || '';
  const approvedTemp = isWithin(resolved, tempRoot) && /^kimi-(?:study-)?(?:e2e|playwright|test|data|fixtures)/i.test(tempName);

  if (isWithin(resolved, productionRoot)) {
    throw new Error(`Refusing to seed any production data path: ${resolved}`);
  }
  if (!isWithin(resolved, runtimeRoot) && !approvedTemp) {
    throw new Error(`Fixture data must stay inside ${runtimeRoot} or an approved kimi-study-* directory under ${tempRoot}`);
  }
  return resolved;
}

module.exports = {
  resolveDataDir,
  resolveFixtureDir,
  isWithin,
  assertSafeRuntime,
  assertSafeSeedTarget,
};
