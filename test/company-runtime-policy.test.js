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

test('explicit policy opt-in preserves the real runtime adapters', async () => {
  const codex = fakeRuntime('codex-app-server');
  const registry = applyRuntimePolicy(new Map([['codex', codex]]), { enableRealRuntimes: true });
  assert.equal(registry.get('codex'), codex);
  assert.equal((await registry.get('codex').available()).available, true);
});
