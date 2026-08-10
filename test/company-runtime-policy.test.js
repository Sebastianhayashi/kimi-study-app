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

function approvedAdmission(overrides = {}) {
  return {
    admitted: true,
    modelId: 'gpt-5.6-luna',
    reasoningEffort: 'max',
    mode: 'default',
    fast: false,
    permissionProfile: 'full-access',
    ...overrides,
  };
}

test('real provider runtimes are unavailable by default even when their adapters report ready', async () => {
  const registry = applyRuntimePolicy(new Map([
    ['claude-code', fakeRuntime('claude-agent-sdk')],
    ['codex', fakeRuntime('codex-app-server')],
    ['mock', fakeRuntime('mock')],
  ]));

  assert.equal((await registry.get('codex').available()).available, false);
  assert.equal((await registry.get('claude-code').available()).available, false);
  assert.equal((await registry.get('mock').available()).available, true);
});

test('explicit real-runtime opt-in still blocks Codex without exact Luna max-effort admission', async () => {
  const codex = fakeRuntime('codex-app-server');
  const registry = applyRuntimePolicy(new Map([['codex', codex]]), {
    enableRealRuntimes: true,
  });

  assert.notEqual(registry.get('codex'), codex);
  const state = await registry.get('codex').available();
  assert.equal(state.available, false);
  assert.match(state.reason, /gpt-5\.6-luna.*max effort/i);
});

test('only exact approved Codex execution profile is exposed; weaker effort and Claude stay blocked', async () => {
  const codex = fakeRuntime('codex-app-server');
  const claude = fakeRuntime('claude-agent-sdk');
  const registry = applyRuntimePolicy(new Map([
    ['codex', codex],
    ['claude-code', claude],
  ]), {
    enableRealRuntimes: true,
    admissions: new Map([['codex', approvedAdmission()]]),
  });

  assert.equal(registry.get('codex'), codex);
  assert.equal((await registry.get('codex').available()).available, true);
  assert.notEqual(registry.get('claude-code'), claude);
  assert.match((await registry.get('claude-code').available()).reason, /gpt-5\.6-luna.*max effort/i);

  const weak = applyRuntimePolicy(new Map([['codex', codex]]), {
    enableRealRuntimes: true,
    admissions: { codex: approvedAdmission({ reasoningEffort: 'high' }) },
  });
  assert.notEqual(weak.get('codex'), codex);
  assert.equal((await weak.get('codex').available()).available, false);
});