'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createDefaultRuntimeRegistry } = require('../lib/company/runtime/default-runtime-registry');

function runtime(kind) {
  return {
    kind,
    async available() { return { available: true, kind }; },
    async *run() { yield { type: 'run.completed' }; },
  };
}

function boundary() {
  return {
    async attest() { return { enforced: true, boundaryId: 'fixture-boundary' }; },
    spawn() { throw new Error('not used'); },
  };
}

function validReceipt() {
  return {
    admitted: true,
    profileName: 'Luna Max',
    modelId: 'luna-runtime-id',
    providerPermissionProfileId: ':full-access',
    reason: null,
  };
}

function harness(overrides = {}) {
  const calls = [];
  const result = createDefaultRuntimeRegistry({
    enableRealRuntimes: false,
    codexAdmissionFile: null,
    expectedRepo: 'Sebastianhayashi/lucubro',
    expectedCommit: null,
    codexAuthorityBoundary: null,
    loadAdmissionReceipt(input) {
      calls.push({ type: 'load', input: structuredClone(input) });
      return validReceipt();
    },
    createCodexRuntime(input) {
      calls.push({ type: 'codex', input });
      return runtime('codex');
    },
    createClaudeRuntime() {
      calls.push({ type: 'claude' });
      return runtime('claude-code');
    },
    ...overrides,
  });
  return { ...result, calls };
}

test('default registry keeps every real provider paused and does not require a receipt', async () => {
  const { registry, admission, calls } = harness();

  assert.equal(admission.admitted, false);
  assert.match(admission.reason, /not enabled/i);
  assert.equal(calls.some((call) => call.type === 'load'), false);
  assert.equal((await registry.get('codex').available()).available, false);
  assert.equal((await registry.get('claude-code').available()).available, false);
});

test('enable + exact receipt + concrete authority boundary exposes only admitted Luna Codex', async () => {
  const authority = boundary();
  const { registry, admission, calls } = harness({
    enableRealRuntimes: true,
    codexAdmissionFile: '/var/lib/lucubro/codex-admission.json',
    expectedCommit: '0123456789abcdef0123456789abcdef01234567',
    codexAuthorityBoundary: authority,
  });

  assert.equal(admission.admitted, true);
  assert.equal(admission.modelId, 'luna-runtime-id');
  const load = calls.find((call) => call.type === 'load');
  assert.deepEqual(load.input, {
    filePath: '/var/lib/lucubro/codex-admission.json',
    expectedRepo: 'Sebastianhayashi/lucubro',
    expectedCommit: '0123456789abcdef0123456789abcdef01234567',
  });
  const codex = calls.find((call) => call.type === 'codex');
  assert.equal(codex.input.admission.admitted, true);
  assert.equal(codex.input.authorityBoundary, authority);
  assert.equal((await registry.get('codex').available()).available, true);
  const claude = await registry.get('claude-code').available();
  assert.equal(claude.available, false);
  assert.match(claude.reason, /Only Codex Luna Max/i);
});

test('valid receipt without a concrete Lucubro authority boundary remains paused', async () => {
  const { registry, admission } = harness({
    enableRealRuntimes: true,
    codexAdmissionFile: '/var/lib/lucubro/codex-admission.json',
    expectedCommit: '0123456789abcdef0123456789abcdef01234567',
  });

  assert.equal(admission.admitted, false);
  assert.match(admission.reason, /authority boundary/i);
  assert.equal((await registry.get('codex').available()).available, false);
});

test('real exposure without an exact deployed commit fails closed before receipt verification', async () => {
  const { registry, admission, calls } = harness({
    enableRealRuntimes: true,
    codexAdmissionFile: '/var/lib/lucubro/codex-admission.json',
    codexAuthorityBoundary: boundary(),
  });

  assert.equal(admission.admitted, false);
  assert.match(admission.reason, /commit/i);
  assert.equal(calls.some((call) => call.type === 'load'), false);
  assert.equal((await registry.get('codex').available()).available, false);
});
