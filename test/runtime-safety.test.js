'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { assertSafeRuntime, assertSafeSeedTarget } = require('../lib/runtime-config');

const ROOT = path.resolve(__dirname, '..');

test('test runtime refuses production port and production data', () => {
  assert.throws(() => assertSafeRuntime({
    root: ROOT,
    dataDir: path.join(ROOT, 'tests', '.runtime', 'courses'),
    port: 3000,
    env: { NODE_ENV: 'test' },
  }), /production port 3000/);

  assert.throws(() => assertSafeRuntime({
    root: ROOT,
    dataDir: path.join(ROOT, 'data', 'courses'),
    port: 3107,
    env: { NODE_ENV: 'test' },
  }), /Test data must stay inside/);
});

test('production runtime refuses marked fixture data', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kimi-study-runtime-'));
  fs.writeFileSync(path.join(dir, '.kimi-study-e2e-data'), '{}');
  assert.throws(() => assertSafeRuntime({
    root: ROOT,
    dataDir: dir,
    port: 3000,
    env: { NODE_ENV: 'production' },
  }), /fixture data/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('fixture seeding never accepts repository production data, even with force', () => {
  assert.throws(() => assertSafeSeedTarget({ root: ROOT, target: path.join(ROOT, 'data', 'courses') }), /production data/);
  assert.doesNotThrow(() => assertSafeSeedTarget({ root: ROOT, target: path.join(ROOT, 'tests', '.runtime', 'courses') }));
  assert.doesNotThrow(() => assertSafeSeedTarget({ root: ROOT, target: path.join(os.tmpdir(), 'kimi-study-e2e-safe') }));
});
