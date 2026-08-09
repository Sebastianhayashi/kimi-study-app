'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveCodexRuntimeAdmission } = require('../lib/company/runtime/codex-runtime-admission');

function admittedReceipt() {
  return {
    admitted: true,
    profileName: 'Luna Max',
    modelId: 'luna-runtime-id',
    providerPermissionProfileId: ':full-access',
    bundleDigests: {
      gstack: `sha256:${'a'.repeat(64)}`,
      'mattpocock-skills': `sha256:${'b'.repeat(64)}`,
    },
    authority: {
      boundaryId: 'nixos-external-authority-v1',
      enforced: true,
    },
  };
}

function boundary() {
  return {
    async attest() { return { enforced: true, boundaryId: 'nixos-external-authority-v1' }; },
    spawn() { throw new Error('not used by config test'); },
  };
}

test('real Codex exposure requires both a verified receipt and a configured Lucubro authority boundary', () => {
  const receipt = admittedReceipt();
  const admitted = resolveCodexRuntimeAdmission({
    enableRealRuntimes: true,
    receipt,
    authorityBoundary: boundary(),
  });
  assert.equal(admitted.admitted, true);
  assert.equal(admitted.modelId, 'luna-runtime-id');

  const noBoundary = resolveCodexRuntimeAdmission({
    enableRealRuntimes: true,
    receipt,
    authorityBoundary: null,
  });
  assert.equal(noBoundary.admitted, false);
  assert.match(noBoundary.reason, /authority boundary/i);
});

test('disabled exposure or a failed receipt stays fail-closed even when a boundary exists', () => {
  const disabled = resolveCodexRuntimeAdmission({
    enableRealRuntimes: false,
    receipt: admittedReceipt(),
    authorityBoundary: boundary(),
  });
  assert.equal(disabled.admitted, false);
  assert.match(disabled.reason, /not enabled/i);

  const rejected = resolveCodexRuntimeAdmission({
    enableRealRuntimes: true,
    receipt: { admitted: false, profileName: 'Luna Max', reason: 'stale commit' },
    authorityBoundary: boundary(),
  });
  assert.equal(rejected.admitted, false);
  assert.match(rejected.reason, /stale commit/);
});

test('authority boundary object must expose both attest and spawn', () => {
  for (const badBoundary of [{}, { attest() {} }, { spawn() {} }]) {
    const result = resolveCodexRuntimeAdmission({
      enableRealRuntimes: true,
      receipt: admittedReceipt(),
      authorityBoundary: badBoundary,
    });
    assert.equal(result.admitted, false);
    assert.match(result.reason, /authority boundary/i);
  }
});
