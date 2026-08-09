'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  collectCodexAdmissionOnMachine,
  normalizeGitHubRepository,
  selectFullAccessPermissionProfile,
} = require('../lib/company/runtime/codex-admission-machine');

const REPO = 'Sebastianhayashi/lucubro';
const COMMIT = '1234567890abcdef1234567890abcdef12345678';
const MODEL_ID = 'gpt-5.6-luna';

function digest(char) {
  return `sha256:${char.repeat(64)}`;
}

function hostDiagnostic() {
  return {
    appServer: {
      userAgent: 'lucubro/0.1.0 (codex-app-server; 0.147.0)',
      platformFamily: 'unix',
      platformOs: 'linux',
    },
    approvedModel: {
      expectedModelId: MODEL_ID,
      uniqueMatch: true,
      modelId: MODEL_ID,
      displayName: 'GPT-5.6-Luna',
      supportedReasoningEfforts: ['low', 'medium', 'high', 'max'],
      maxReasoningEffortSupported: true,
    },
    effectiveConfig: { modelId: MODEL_ID, modelProvider: 'openai', serviceTier: null },
    permissionProfiles: [
      { id: ':workspace', description: 'Workspace access', allowed: true },
      { id: ':danger-full-access', description: 'Full access', allowed: true },
    ],
  };
}

function bundleObservations() {
  return [
    {
      id: 'gstack',
      pinnedCommit: '94993f74012782fd94416dd44b8314f6363a13a4',
      approvedPinnedCommit: '94993f74012782fd94416dd44b8314f6363a13a4',
      pinnedCommitMatchesApproved: true,
      installationState: 'active',
      active: true,
      rootExists: true,
      manifestRootDigest: digest('a'),
      observedRootDigest: digest('a'),
      digestMatchesManifest: true,
      digestError: null,
    },
    {
      id: 'mattpocock-skills',
      pinnedCommit: '84fdeffd12f2ee307994d1eb6feb48173b6e0502',
      approvedPinnedCommit: '84fdeffd12f2ee307994d1eb6feb48173b6e0502',
      pinnedCommitMatchesApproved: true,
      installationState: 'active',
      active: true,
      rootExists: true,
      manifestRootDigest: digest('b'),
      observedRootDigest: digest('b'),
      digestMatchesManifest: true,
      digestError: null,
    },
  ];
}

function machineInput() {
  return {
    cwd: '/checkout/lucubro',
    dataDir: '/var/lib/lucubro',
    receiptFile: '/var/lib/lucubro/runtime/codex-admission.json',
    systemdRunExecutable: '/run/current-system/sw/bin/systemd-run',
    gitExecutable: '/run/current-system/sw/bin/git',
    scratchRoot: '/var/tmp/lucubro-admission',
  };
}

test('GitHub remote normalization accepts canonical HTTPS/SSH forms and rejects another host', () => {
  assert.equal(normalizeGitHubRepository('https://github.com/Sebastianhayashi/lucubro.git'), REPO);
  assert.equal(normalizeGitHubRepository('git@github.com:Sebastianhayashi/lucubro.git'), REPO);
  assert.equal(normalizeGitHubRepository('ssh://git@github.com/Sebastianhayashi/lucubro.git'), REPO);
  assert.equal(normalizeGitHubRepository('https://example.test/Sebastianhayashi/lucubro.git'), null);
});

test('full-access selector fails closed unless exactly one allowed provider profile is semantically full access', () => {
  assert.equal(selectFullAccessPermissionProfile(hostDiagnostic().permissionProfiles).id, ':danger-full-access');
  assert.throws(() => selectFullAccessPermissionProfile([{ id: ':workspace', description: 'Workspace access', allowed: true }]), /full-access provider profile/i);
  assert.throws(() => selectFullAccessPermissionProfile([
    { id: ':danger-full-access', description: 'Full access', allowed: true },
    { id: ':full-access-2', description: 'Full access', allowed: true },
  ]), /exactly one full-access provider profile/i);
});

test('machine collector binds checkout identity, exact Luna model, full-access profile, authority probes, and bundle roots before writing a receipt', async () => {
  const calls = [];
  const result = await collectCodexAdmissionOnMachine(machineInput(), {
    readGitIdentityImpl() {
      calls.push(['git']);
      return { repo: REPO, commit: COMMIT };
    },
    async inspectHostImpl({ cwd }) {
      calls.push(['host', cwd]);
      return hostDiagnostic();
    },
    async probeThreadImpl(input) {
      calls.push(['thread', input]);
      return {
        modelId: MODEL_ID,
        modelProvider: 'openai',
        serviceTier: null,
        activePermissionProfileId: ':danger-full-access',
        providerFallbackDisabled: true,
        requestedServiceTier: null,
        ephemeral: true,
      };
    },
    runAuthorityProbeImpl(input) {
      calls.push(['authority', input]);
      return {
        kind: 'lucubro-systemd-authority-probe',
        boundaryId: 'systemd-user-codex-v1',
        enforced: true,
        probes: {
          workspaceEscapeBlocked: true,
          networkDenyBlocked: true,
          destructiveDenyBlocked: true,
          gitPushDenyBlocked: true,
        },
      };
    },
    inspectBundlesImpl({ dataDir }) {
      calls.push(['bundles', dataDir]);
      return bundleObservations();
    },
    writeReceiptImpl(input) {
      calls.push(['write', input]);
      return { filePath: input.filePath, admission: { admitted: true }, receipt: { source: { repo: input.expectedRepo, commit: input.expectedCommit } } };
    },
  });

  assert.equal(result.admission.admitted, true);
  assert.equal(result.receipt.source.repo, REPO);
  assert.equal(result.receipt.source.commit, COMMIT);
  assert.equal(calls[0][0], 'git');
  assert.equal(calls[1][0], 'host');
  assert.equal(calls[2][0], 'thread');
  assert.equal(calls[2][1].modelId, MODEL_ID);
  assert.equal(calls[2][1].permissionProfileId, ':danger-full-access');
  assert.equal(Object.hasOwn(calls[2][1], 'modelProvider'), false);
  assert.equal(calls[3][0], 'authority');
  assert.equal(calls[4][0], 'bundles');
  assert.equal(calls[5][0], 'write');
  assert.equal(calls[5][1].expectedRepo, REPO);
  assert.equal(calls[5][1].expectedCommit, COMMIT);
});

test('machine collector rejects an ambiguous, wrong, or non-max Luna catalog before thread creation', async () => {
  for (const mutate of [
    (diagnostic) => { diagnostic.approvedModel.uniqueMatch = false; },
    (diagnostic) => { diagnostic.approvedModel.modelId = 'gpt-5.6-sol'; },
    (diagnostic) => {
      diagnostic.approvedModel.supportedReasoningEfforts = ['low', 'medium', 'high'];
      diagnostic.approvedModel.maxReasoningEffortSupported = false;
    },
  ]) {
    let threadCalled = false;
    const diagnostic = hostDiagnostic();
    mutate(diagnostic);
    await assert.rejects(
      collectCodexAdmissionOnMachine(machineInput(), {
        readGitIdentityImpl() { return { repo: REPO, commit: COMMIT }; },
        async inspectHostImpl() { return diagnostic; },
        async probeThreadImpl() { threadCalled = true; throw new Error('thread must not be called'); },
      }),
      /approved Luna catalog/i,
    );
    assert.equal(threadCalled, false);
  }
});

test('machine collector rejects a checkout from another repo before any Codex host call', async () => {
  let hostCalled = false;
  await assert.rejects(
    collectCodexAdmissionOnMachine(machineInput(), {
      readGitIdentityImpl() { return { repo: 'someone/fork', commit: COMMIT }; },
      async inspectHostImpl() { hostCalled = true; return hostDiagnostic(); },
    }),
    /trusted Lucubro repository/i,
  );
  assert.equal(hostCalled, false);
});