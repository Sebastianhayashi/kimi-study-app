'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { applyRuntimePolicy } = require('../lib/company/runtime/policy');

function fakeRuntime(kind) {
  return {
    kind,
    async available() { return { available: true, mode: 'fixture-ready' }; },
    async *run() { yield { type: 'run.completed' }; },
  };
}

test('real provider runtimes are unavailable by default even when their adapters report ready', async () => {
  const registry = applyRuntimePolicy(new Map([
    ['claude-code', fakeRuntime('claude-agent-sdk')],
    ['codex', fakeRuntime('codex-app-server')],
    ['mock', fakeRuntime('mock')],
  ]));

  assert.deepEqual(await registry.get('codex').available(), {
    available: false,
    paused: true,
    reason: 'Real provider execution is paused. Enable it explicitly only after the approved runtime policy is enforced.',
  });
  assert.deepEqual(await registry.get('claude-code').available(), {
    available: false,
    paused: true,
    reason: 'Real provider execution is paused. Enable it explicitly only after the approved runtime policy is enforced.',
  });
  assert.equal((await registry.get('mock').available()).available, true);
});

test('explicit real-runtime opt-in still blocks Codex without Luna admission', async () => {
  const codex = fakeRuntime('codex-app-server');
  const registry = applyRuntimePolicy(new Map([['codex', codex]]), {
    enableRealRuntimes: true,
  });

  assert.notEqual(registry.get('codex'), codex);
  assert.deepEqual(await registry.get('codex').available(), {
    available: false,
    paused: true,
    reason: 'Real Codex is blocked until Luna Max profile admission is verified.',
  });
});

test('verified Luna admission exposes Codex but Claude stays blocked', async () => {
  const codex = fakeRuntime('codex-app-server');
  const claude = fakeRuntime('claude-agent-sdk');
  const registry = applyRuntimePolicy(new Map([
    ['codex', codex],
    ['claude-code', claude],
  ]), {
    enableRealRuntimes: true,
    admissions: new Map([['codex', { admitted: true, profileName: 'Luna Max' }]]),
  });

  assert.equal(registry.get('codex'), codex);
  assert.equal((await registry.get('codex').available()).available, true);
  assert.notEqual(registry.get('claude-code'), claude);
  assert.deepEqual(await registry.get('claude-code').available(), {
    available: false,
    paused: true,
    reason: 'Only Codex Luna Max is permitted for Lucubro AI execution.',
  });
});
