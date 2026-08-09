'use strict';

const { createClaudeAgentSdkRuntime } = require('./claude-agent-sdk');
const { createCodexAppServerRuntime } = require('./codex-app-server');
const { loadCodexAdmissionReceipt } = require('./codex-admission-receipt');
const { resolveCodexRuntimeAdmission } = require('./codex-runtime-admission');
const { applyRuntimePolicy } = require('./policy');

function rejectedAdmission(reason) {
  return {
    admitted: false,
    modelId: null,
    reasoningEffort: null,
    mode: null,
    fast: null,
    permissionProfile: null,
    providerPermissionProfileId: null,
    reason,
  };
}

function createDefaultRuntimeRegistry({
  enableRealRuntimes = false,
  codexAdmissionFile = null,
  expectedRepo = 'Sebastianhayashi/lucubro',
  expectedCommit = null,
  codexAuthorityBoundary = null,
  loadAdmissionReceipt = loadCodexAdmissionReceipt,
  createCodexRuntime = createCodexAppServerRuntime,
  createClaudeRuntime = createClaudeAgentSdkRuntime,
} = {}) {
  if (typeof loadAdmissionReceipt !== 'function') throw new Error('loadAdmissionReceipt must be a function');
  if (typeof createCodexRuntime !== 'function') throw new Error('createCodexRuntime must be a function');
  if (typeof createClaudeRuntime !== 'function') throw new Error('createClaudeRuntime must be a function');

  let receipt = rejectedAdmission('Real Codex runtime exposure is not enabled.');
  if (enableRealRuntimes) {
    if (typeof expectedCommit !== 'string' || !expectedCommit.trim()) {
      receipt = rejectedAdmission('Exact deployed Lucubro commit is required before real Codex can be exposed.');
    } else {
      receipt = loadAdmissionReceipt({
        filePath: codexAdmissionFile,
        expectedRepo,
        expectedCommit: expectedCommit.trim(),
      });
    }
  }

  const admission = resolveCodexRuntimeAdmission({
    enableRealRuntimes,
    receipt,
    authorityBoundary: codexAuthorityBoundary,
  });

  const configured = new Map([
    ['claude-code', createClaudeRuntime()],
    ['codex', createCodexRuntime({
      admission,
      authorityBoundary: codexAuthorityBoundary,
    })],
  ]);

  const registry = applyRuntimePolicy(configured, {
    enableRealRuntimes,
    admissions: { codex: admission },
  });

  return { registry, admission };
}

module.exports = {
  createDefaultRuntimeRegistry,
  rejectedAdmission,
};