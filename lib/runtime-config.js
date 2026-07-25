'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

function firstNonBlank(...values) {
  for (const value of values) {
    const normalized = String(value || '').trim();
    if (normalized) return normalized;
  }
  return '';
}

function resolveDataDir({ root = path.resolve(__dirname, '..'), env = process.env } = {}) {
  const configured = firstNonBlank(env.LUCUBRO_DATA_DIR, env.KIMI_STUDY_DATA_DIR);
  return configured ? path.resolve(configured) : path.join(root, 'data', 'courses');
}

function resolveFixtureDir({ root = path.resolve(__dirname, '..'), env = process.env } = {}) {
  const configured = firstNonBlank(env.LUCUBRO_FIXTURE_DIR, env.KIMI_STUDY_FIXTURE_DIR);
  return configured ? path.resolve(configured) : path.join(root, 'tests', '.generated', 'fixtures');
}

function resolveE2EPort({ env = process.env, fallback = 3107 } = {}) {
  const configured = firstNonBlank(env.LUCUBRO_E2E_PORT, env.KIMI_STUDY_E2E_PORT);
  return Number(configured || fallback);
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
  const marker = path.join(resolvedData, '.lucubro-e2e-data');
  const legacyMarker = path.join(resolvedData, '.kimi-study-e2e-data');
  const isTest = env.NODE_ENV === 'test';

  if (isTest) {
    if (resolvedPort === 3000) throw new Error('Refusing to start a test server on production port 3000.');
    if (!isWithin(resolvedData, testRuntime)) {
      throw new Error(`Test data must stay inside ${testRuntime}; received ${resolvedData}`);
    }
  } else {
    if (isWithin(resolvedData, testsRoot) || fsImpl.existsSync(marker) || fsImpl.existsSync(legacyMarker)) {
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
  const approvedTemp = isWithin(resolved, tempRoot) && /^(?:lucubro-|kimi-(?:study-)?)(?:e2e|playwright|test|data|fixtures)/i.test(tempName);

  if (isWithin(resolved, productionRoot)) {
    throw new Error(`Refusing to seed any production data path: ${resolved}`);
  }
  if (!isWithin(resolved, runtimeRoot) && !approvedTemp) {
    throw new Error(`Fixture data must stay inside ${runtimeRoot} or an approved lucubro-*/kimi-* directory under ${tempRoot}`);
  }
  return resolved;
}

module.exports = {
  resolveDataDir,
  resolveFixtureDir,
  resolveE2EPort,
  isWithin,
  assertSafeRuntime,
  assertSafeSeedTarget,
};
