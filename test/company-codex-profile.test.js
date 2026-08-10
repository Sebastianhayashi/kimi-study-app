'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createApprovedCodexProfile,
  verifyCodexProfile,
} = require('../lib/company/runtime/codex-profile');

const MODEL_ID = 'gpt-5.6-luna';

function approvedObserved(overrides = {}) {
  return {
    modelId: MODEL_ID,
    reasoningEffort: 'max',
    mode: 'default',
    fast: false,
    permissionProfile: 'full-access',
    ...overrides,
  };
}

test('approved Codex execution profile is exact gpt-5.6-luna with max effort, default mode, Fast off, and full access', () => {
  assert.deepEqual(createApprovedCodexProfile(), {
    modelId: MODEL_ID,
    reasoningEffort: 'max',
    mode: 'default',
    fast: false,
    permissionProfile: 'full-access',
  });
});

test('exact Luna max-effort default non-Fast full-access attestation is admitted', () => {
  const policy = createApprovedCodexProfile();
  const result = verifyCodexProfile({ policy, observed: approvedObserved() });

  assert.equal(result.admitted, true);
  assert.deepEqual(result.mismatches, []);
  assert.deepEqual(result.unknown, []);
});

test('wrong model, reasoning effort, mode, Fast state, or permission profile blocks admission', () => {
  const policy = createApprovedCodexProfile();

  for (const observed of [
    approvedObserved({ modelId: 'some-other-model' }),
    approvedObserved({ reasoningEffort: 'high' }),
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
  const policy = createApprovedCodexProfile();

  for (const field of ['modelId', 'reasoningEffort', 'mode', 'fast', 'permissionProfile']) {
    const observed = approvedObserved();
    delete observed[field];
    const result = verifyCodexProfile({ policy, observed });
    assert.equal(result.admitted, false, field);
    assert.ok(result.unknown.includes(field), field);
  }
});