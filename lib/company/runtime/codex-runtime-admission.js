'use strict';

const { createApprovedCodexProfile, verifyCodexProfile } = require('./codex-profile');

function rejected(reason, receipt = null) {
  return {
    ...(receipt && typeof receipt === 'object' ? receipt : {}),
    admitted: false,
    reason,
  };
}

function resolveCodexRuntimeAdmission({
  enableRealRuntimes = false,
  receipt = null,
  authorityBoundary = null,
} = {}) {
  if (!enableRealRuntimes) {
    return rejected('Real Codex runtime exposure is not enabled.', receipt);
  }
  if (!receipt || receipt.admitted !== true) {
    return rejected(receipt && receipt.reason
      ? receipt.reason
      : 'Verified gpt-5.6-luna max-effort admission receipt is required.', receipt);
  }

  const profileResult = verifyCodexProfile({
    policy: createApprovedCodexProfile(),
    observed: receipt,
  });
  if (!profileResult.admitted) {
    return rejected('Admission receipt does not match gpt-5.6-luna / max effort / default mode / Fast off / full-access.', receipt);
  }

  if (!authorityBoundary || typeof authorityBoundary.attest !== 'function' || typeof authorityBoundary.spawn !== 'function') {
    return rejected('Concrete Lucubro authority boundary is required before real Codex can be exposed.', receipt);
  }
  return { ...receipt, admitted: true, reason: null };
}

module.exports = {
  resolveCodexRuntimeAdmission,
};