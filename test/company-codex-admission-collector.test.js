'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  buildCodexAdmissionReceipt,
  writeVerifiedCodexAdmissionReceipt,
} = require('../lib/company/runtime/codex-admission-collector');
const { verifyCodexAdmissionReceipt } = require('../lib/company/runtime/codex-admission-receipt');

const REPO = 'Sebastianhayashi/lucubro';
const COMMIT = '1234567890abcdef1234567890abcdef12345678';
const MODEL_ID = 'gpt-5.6-luna';
const PROFILE_ID = ':danger-full-access';

function digest(char) {
  return `sha256:${char.repeat(64)}`;
}

function observations() {
  return {
    expectedRepo: REPO,
    expectedCommit: COMMIT,
    observedAt: '2026-08-09T20:00:00.000Z',
    hostDiagnostic: {
      appServer: {
        userAgent: 'lucubro/0.1.0 (codex-app-server; 0.147.0)',
        platformFamily: 'unix',
        platformOs: 'linux',
      },
      approvedModel: {
        expectedModelId: MODEL_ID,
        uniqueMatch: true,
        modelId: MODEL_ID,
        model: MODEL_ID,
        displayName: 'GPT-5.6-Luna',
        supportedReasoningEfforts: ['low', 'medium', 'high', 'max'],
        maxReasoningEffortSupported: true,
      },
      effectiveConfig: {
        modelId: MODEL_ID,
        modelProvider: 'openai',
        serviceTier: null,
      },
      permissionProfiles: [
        { id: PROFILE_ID, allowed: true, description: 'Full access' },
      ],
    },
    threadObservation: {
      modelId: MODEL_ID,
      modelProvider: 'openai',
      serviceTier: null,
      activePermissionProfileId: PROFILE_ID,
      providerFallbackDisabled: true,
      requestedServiceTier: null,
      ephemeral: true,
    },
    authorityObservation: {
      kind: 'lucubro-systemd-authority-probe',
      boundaryId: 'systemd-user-codex-v1',
      enforced: true,
      probes: {
        workspaceEscapeBlocked: true,
        networkDenyBlocked: true,
        destructiveDenyBlocked: true,
        gitPushDenyBlocked: true,
      },
    },
    bundleObservations: [
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
    ],
  };
}

test('collector assembles one verifier-admitted receipt from machine observations', () => {
  const receipt = buildCodexAdmissionReceipt(observations());
  assert.equal(receipt.source.repo, REPO);
  assert.equal(receipt.source.commit, COMMIT);
  assert.equal(receipt.catalogDiagnostic.modelId, MODEL_ID);
  assert.equal(receipt.catalogDiagnostic.exactModelIdMatch, true);
  assert.equal(receipt.catalogDiagnostic.maxReasoningEffortSupported, true);
  assert.deepEqual(receipt.catalogDiagnostic.supportedReasoningEfforts, ['low', 'medium', 'high', 'max']);
  assert.equal(receipt.profile.modelId, MODEL_ID);
  assert.equal(receipt.profile.reasoningEffort, 'max');
  assert.equal(receipt.profile.mode, 'default');
  assert.equal(receipt.profile.fast, false);
  assert.equal(receipt.thread.collaborationMode, 'default');
  assert.equal(receipt.thread.collaborationModeSource, 'lucubro-runtime-contract');
  assert.equal(receipt.permissionProfile.providerId, PROFILE_ID);
  assert.equal(receipt.permissionProfile.allowed, true);
  assert.deepEqual(receipt.bundles.map((bundle) => bundle.rootDigest), [digest('a'), digest('b')]);

  const verification = verifyCodexAdmissionReceipt(receipt, {
    expectedRepo: REPO,
    expectedCommit: COMMIT,
  });
  assert.equal(verification.admitted, true);
});

test('collector refuses ambiguous catalog identity, missing max support, weak authority, or incomplete bundle observations', () => {
  const ambiguous = observations();
  ambiguous.hostDiagnostic.approvedModel.uniqueMatch = false;
  assert.throws(() => buildCodexAdmissionReceipt(ambiguous), /admission receipt failed verification/i);

  const noMax = observations();
  noMax.hostDiagnostic.approvedModel.supportedReasoningEfforts = ['low', 'medium', 'high'];
  noMax.hostDiagnostic.approvedModel.maxReasoningEffortSupported = false;
  assert.throws(() => buildCodexAdmissionReceipt(noMax), /admission receipt failed verification/i);

  const weakAuthority = observations();
  weakAuthority.authorityObservation.probes.gitPushDenyBlocked = false;
  weakAuthority.authorityObservation.enforced = false;
  assert.throws(() => buildCodexAdmissionReceipt(weakAuthority), /admission receipt failed verification/i);

  const inactiveBundle = observations();
  inactiveBundle.bundleObservations[0].active = false;
  inactiveBundle.bundleObservations[0].installationState = 'materialized';
  assert.throws(() => buildCodexAdmissionReceipt(inactiveBundle), /bundle observation is not active/i);

  const driftedDigest = observations();
  driftedDigest.bundleObservations[1].digestMatchesManifest = false;
  driftedDigest.bundleObservations[1].observedRootDigest = digest('c');
  assert.throws(() => buildCodexAdmissionReceipt(driftedDigest), /bundle digest does not match manifest/i);
});

test('verified receipt writer is atomic, mode 0600, and never writes a rejected receipt', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lucubro-admission-collector-'));
  try {
    const filePath = path.join(root, 'runtime', 'codex-admission.json');
    const result = writeVerifiedCodexAdmissionReceipt({
      filePath,
      ...observations(),
    });
    assert.equal(result.admission.admitted, true);
    assert.equal(fs.existsSync(filePath), true);
    assert.equal(fs.statSync(filePath).mode & 0o777, 0o600);
    const persisted = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    assert.equal(persisted.source.commit, COMMIT);
    assert.equal(persisted.profile.reasoningEffort, 'max');
    assert.equal(fs.readdirSync(path.dirname(filePath)).some((name) => name.includes('.tmp-')), false);

    const rejectedPath = path.join(root, 'runtime', 'rejected.json');
    const rejected = observations();
    rejected.threadObservation.modelId = 'gpt-5.6-sol';
    assert.throws(() => writeVerifiedCodexAdmissionReceipt({ filePath: rejectedPath, ...rejected }), /failed verification/i);
    assert.equal(fs.existsSync(rejectedPath), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
