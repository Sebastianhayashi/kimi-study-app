'use strict';

function rejected(reason, receipt = null) {
  return {
    ...(receipt && typeof receipt === 'object' ? receipt : {}),
    admitted: false,
    profileName: 'Luna Max',
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
  if (!receipt || receipt.admitted !== true || receipt.profileName !== 'Luna Max') {
    return rejected(receipt && receipt.reason
      ? receipt.reason
      : 'Verified Luna Max admission receipt is required.', receipt);
  }
  if (!authorityBoundary || typeof authorityBoundary.attest !== 'function' || typeof authorityBoundary.spawn !== 'function') {
    return rejected('Concrete Lucubro authority boundary is required before real Codex can be exposed.', receipt);
  }
  return { ...receipt, admitted: true, profileName: 'Luna Max', reason: null };
}

module.exports = {
  resolveCodexRuntimeAdmission,
};
