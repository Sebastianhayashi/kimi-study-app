'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createApprovedCodexProfile,
  verifyCodexProfile,
} = require('../lib/company/runtime/codex-profile');

const MODEL_ID = 'fixture-luna-max-model-id';

function approvedObserved(overrides = {}) {
  return {
    modelId: MODEL_ID,
    mode: 'default',
    fast: false,
    permissionProfile: 'full-access',
    ...overrides,
  };
}

test('approved Codex profile requires an explicit trusted Luna Max model id', () => {
  assert.throws(
    () => createApprovedCodexProfile({ modelId: '' }),
    /Luna Max model id is required/,
  );

  assert.deepEqual(createApprovedCodexProfile({ modelId: MODEL_ID }), {
    profileName: 'Luna Max',
    modelId: MODEL_ID,
    mode: 'default',
    fast: false,
    permissionProfile: 'full-access',
  });
});

test('exact Luna Max default non-Fast full-access attestation is admitted', () => {
  const policy = createApprovedCodexProfile({ modelId: MODEL_ID });
  const result = verifyCodexProfile({ policy, observed: approvedObserved() });

  assert.equal(result.admitted, true);
  assert.deepEqual(result.mismatches, []);
  assert.deepEqual(result.unknown, []);
  assert.equal(result.profileName, 'Luna Max');
});

test('wrong model, mode, Fast state, or permission profile blocks admission', () => {
  const policy = createApprovedCodexProfile({ modelId: MODEL_ID });

  for (const observed of [
    approvedObserved({ modelId: 'some-other-model' }),
    approvedObserved({ mode: 'plan' }),
    approvedObserved({ fast: true }),
    approvedObserved({ permissionProfile: 'workspace-write' }),
  ]) {
    const result = verifyCodexProfile({ policy, observed });
    assert.equal(result.admitted, false);
    assert.ok(result.mismatches.length >= 1);
  }
});

test('missing required attestation fields fail closed instead of being inferred', () => {
  const policy = createApprovedCodexProfile({ modelId: MODEL_ID });

  for (const field of ['modelId', 'mode', 'fast', 'permissionProfile']) {
    const observed = approvedObserved();
    delete observed[field];
    const result = verifyCodexProfile({ policy, observed });
    assert.equal(result.admitted, false, field);
    assert.ok(result.unknown.includes(field), field);
  }
});
