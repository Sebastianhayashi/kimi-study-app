'use strict';

const { createDelegationEnvelope } = require('../delegation-envelope');

function createAuthorityBoundaryPolicy({ cwd, delegationEnvelope } = {}) {
  const envelope = createDelegationEnvelope(delegationEnvelope);
  const allowed = new Set(envelope.allow);
  return Object.freeze({
    cwd: String(cwd || ''),
    workspaceRead: allowed.has('workspace.read') || allowed.has('workspace.write'),
    workspaceWrite: allowed.has('workspace.write'),
    shellExecute: allowed.has('shell.execute'),
    networkAccess: allowed.has('network.access'),
    gitCommit: allowed.has('git.commit'),
    gitPush: allowed.has('git.push'),
    filesystemDestructive: allowed.has('filesystem.destructive'),
  });
}

async function prepareAuthorityBoundary({ boundary, cwd, delegationEnvelope } = {}) {
  if (!boundary || typeof boundary.attest !== 'function' || typeof boundary.spawn !== 'function') {
    throw new Error('Lucubro authority boundary is required for Codex execution.');
  }
  const policy = createAuthorityBoundaryPolicy({ cwd, delegationEnvelope });
  const attestation = await boundary.attest({ policy });
  if (!attestation || attestation.enforced !== true) {
    const reason = attestation && attestation.reason ? `: ${attestation.reason}` : '';
    throw new Error(`Lucubro authority boundary is not enforced${reason}`);
  }
  return {
    policy,
    attestation: Object.freeze({ ...attestation }),
    spawn(command, args, options) {
      return boundary.spawn({ command, args, options, policy, attestation });
    },
  };
}

module.exports = {
  createAuthorityBoundaryPolicy,
  prepareAuthorityBoundary,
};
