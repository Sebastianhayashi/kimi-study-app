'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createCodexAppServerRuntime } = require('../lib/company/runtime/codex-app-server');
const { createAuthorityBoundaryPolicy } = require('../lib/company/runtime/authority-boundary');

function request(overrides = {}) {
  return {
    runId: 'run_authority',
    workId: 'work_authority',
    cwd: '/work/lucubro',
    prompt: 'Research coffee roasting.',
    model: 'luna-runtime-id',
    delegationEnvelope: {
      allow: ['workspace.read'],
      deny: ['network.access', 'git.push', 'filesystem.destructive'],
    },
    async requestApproval() { return 'deny'; },
    ...overrides,
  };
}

test('authority boundary policy defaults missing capabilities to denied even when provider profile is full access', () => {
  const policy = createAuthorityBoundaryPolicy({
    cwd: '/work/lucubro',
    delegationEnvelope: request().delegationEnvelope,
  });

  assert.deepEqual(policy, {
    cwd: '/work/lucubro',
    workspaceRead: true,
    workspaceWrite: false,
    shellExecute: false,
    networkAccess: false,
    gitCommit: false,
    gitPush: false,
    filesystemDestructive: false,
  });
});

test('Codex run fails before provider spawn when no enforced Lucubro authority boundary exists', async () => {
  let spawned = false;
  const runtime = createCodexAppServerRuntime({
    spawnImpl() { spawned = true; throw new Error('raw spawn must not be reached'); },
  });

  await assert.rejects(
    runtime.run(request()).next(),
    /Lucubro authority boundary is required for Codex execution/,
  );
  assert.equal(spawned, false);
});

test('Codex run sends the Delegation Envelope-derived policy to the enforced boundary before provider spawn', async () => {
  const observed = [];
  const runtime = createCodexAppServerRuntime({
    spawnImpl() { throw new Error('raw spawn must not be used for a Run'); },
    authorityBoundary: {
      async attest({ policy }) {
        observed.push({ type: 'attest', policy });
        return { enforced: true, boundaryId: 'fixture-boundary' };
      },
      spawn({ command, args, options, policy, attestation }) {
        observed.push({ type: 'spawn', command, args, options, policy, attestation });
        throw new Error('fixture boundary spawn reached');
      },
    },
  });

  await assert.rejects(runtime.run(request()).next(), /fixture boundary spawn reached/);
  assert.equal(observed[0].type, 'attest');
  assert.equal(observed[0].policy.networkAccess, false);
  assert.equal(observed[0].policy.workspaceWrite, false);
  assert.equal(observed[1].type, 'spawn');
  assert.equal(observed[1].command, 'codex');
  assert.deepEqual(observed[1].args, ['app-server']);
  assert.equal(observed[1].attestation.enforced, true);
  assert.equal(observed[1].attestation.boundaryId, 'fixture-boundary');
});

test('Codex run fails closed when a configured authority boundary cannot attest enforcement', async () => {
  let spawned = false;
  const runtime = createCodexAppServerRuntime({
    spawnImpl() { throw new Error('raw spawn must not be used for a Run'); },
    authorityBoundary: {
      async attest() { return { enforced: false, reason: 'sandbox unavailable' }; },
      spawn() { spawned = true; throw new Error('must not spawn'); },
    },
  });

  await assert.rejects(
    runtime.run(request()).next(),
    /Lucubro authority boundary is not enforced: sandbox unavailable/,
  );
  assert.equal(spawned, false);
});
