'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  loadCodexAdmissionReceipt,
  verifyCodexAdmissionReceipt,
} = require('../lib/company/runtime/codex-admission-receipt');

const EXPECTED_REPO = 'Sebastianhayashi/lucubro';
const EXPECTED_COMMIT = '0123456789abcdef0123456789abcdef01234567';
const LUNA_MODEL_ID = 'gpt-5.6-luna';
const FULL_ACCESS_PROFILE_ID = ':danger-full-access';

function digest(char) {
  return `sha256:${char.repeat(64)}`;
}

function validReceipt() {
  return {
    kind: 'lucubro-codex-admission',
    schemaVersion: 1,
    observedAt: '2026-08-09T14:10:00.000Z',
    source: {
      repo: EXPECTED_REPO,
      commit: EXPECTED_COMMIT,
    },
    appServer: {
      userAgent: 'lucubro/0.1.0 (codex-app-server; 0.147.0)',
      platformFamily: 'unix',
      platformOs: 'linux',
    },
    catalogDiagnostic: {
      modelId: LUNA_MODEL_ID,
      exactModelIdMatch: true,
      supportedReasoningEfforts: ['low', 'medium', 'high', 'max'],
      maxReasoningEffortSupported: true,
      providerDisplayName: 'GPT-5.6-Luna',
      effectiveConfigModelId: LUNA_MODEL_ID,
      note: 'Provider display text is diagnostic only; exact model id is authoritative.',
    },
    profile: {
      modelId: LUNA_MODEL_ID,
      reasoningEffort: 'max',
      mode: 'default',
      fast: false,
      permissionProfile: 'full-access',
    },
    thread: {
      modelId: LUNA_MODEL_ID,
      modelProvider: 'openai',
      serviceTier: 'default',
      requestedServiceTier: null,
      collaborationMode: 'default',
      activePermissionProfileId: FULL_ACCESS_PROFILE_ID,
      providerFallbackDisabled: true,
      ephemeral: true,
    },
    permissionProfile: {
      providerId: FULL_ACCESS_PROFILE_ID,
      normalized: 'full-access',
      allowed: true,
    },
    authority: {
      enforced: true,
      boundaryId: 'systemd-user-codex-v1',
      probes: {
        workspaceEscapeBlocked: true,
        networkDenyBlocked: true,
        destructiveDenyBlocked: true,
        gitPushDenyBlocked: true,
      },
    },
    bundles: [
      {
        id: 'gstack',
        pinnedCommit: '94993f74012782fd94416dd44b8314f6363a13a4',
        rootDigest: digest('a'),
      },
      {
        id: 'mattpocock-skills',
        pinnedCommit: '84fdeffd12f2ee307994d1eb6feb48173b6e0502',
        rootDigest: digest('b'),
      },
    ],
  };
}

test('exact machine receipt admits gpt-5.6-luna with max effort independent of provider display text', () => {
  const result = verifyCodexAdmissionReceipt(validReceipt(), {
    expectedRepo: EXPECTED_REPO,
    expectedCommit: EXPECTED_COMMIT,
  });

  assert.equal(result.admitted, true);
  assert.equal(result.modelId, LUNA_MODEL_ID);
  assert.equal(result.reasoningEffort, 'max');
  assert.equal(result.mode, 'default');
  assert.equal(result.fast, false);
  assert.equal(result.permissionProfile, 'full-access');
  assert.equal(result.providerPermissionProfileId, FULL_ACCESS_PROFILE_ID);
  assert.deepEqual(result.unknown, []);
  assert.deepEqual(result.mismatches, []);
  assert.deepEqual(result.bundleDigests, {
    gstack: digest('a'),
    'mattpocock-skills': digest('b'),
  });
  assert.equal(result.authority.boundaryId, 'systemd-user-codex-v1');
});

test('receipt fails closed unless the machine catalog proves exact Luna identity and max support', () => {
  const missing = validReceipt();
  delete missing.catalogDiagnostic;
  const missingResult = verifyCodexAdmissionReceipt(missing, {
    expectedRepo: EXPECTED_REPO,
    expectedCommit: EXPECTED_COMMIT,
  });
  assert.equal(missingResult.admitted, false);
  assert.ok(missingResult.unknown.includes('catalogDiagnostic.modelId'));
  assert.ok(missingResult.unknown.includes('catalogDiagnostic.supportedReasoningEfforts'));

  const wrongModel = validReceipt();
  wrongModel.catalogDiagnostic.modelId = 'gpt-5.6-sol';
  const wrongModelResult = verifyCodexAdmissionReceipt(wrongModel, {
    expectedRepo: EXPECTED_REPO,
    expectedCommit: EXPECTED_COMMIT,
  });
  assert.equal(wrongModelResult.admitted, false);
  assert.ok(wrongModelResult.mismatches.some((entry) => entry.field === 'catalogDiagnostic.modelId'));

  const ambiguous = validReceipt();
  ambiguous.catalogDiagnostic.exactModelIdMatch = false;
  const ambiguousResult = verifyCodexAdmissionReceipt(ambiguous, {
    expectedRepo: EXPECTED_REPO,
    expectedCommit: EXPECTED_COMMIT,
  });
  assert.equal(ambiguousResult.admitted, false);
  assert.ok(ambiguousResult.mismatches.some((entry) => entry.field === 'catalogDiagnostic.exactModelIdMatch'));

  const noMax = validReceipt();
  noMax.catalogDiagnostic.supportedReasoningEfforts = ['low', 'medium', 'high'];
  noMax.catalogDiagnostic.maxReasoningEffortSupported = false;
  const noMaxResult = verifyCodexAdmissionReceipt(noMax, {
    expectedRepo: EXPECTED_REPO,
    expectedCommit: EXPECTED_COMMIT,
  });
  assert.equal(noMaxResult.admitted, false);
  assert.ok(noMaxResult.mismatches.some((entry) => entry.field === 'catalogDiagnostic.maxReasoningEffortSupported'));
  assert.ok(noMaxResult.mismatches.some((entry) => entry.field === 'catalogDiagnostic.supportedReasoningEfforts'));
});

test('receipt fails closed for stale commit, wrong model, non-max effort, Fast tier, or provider fallback', () => {
  const stale = validReceipt();
  stale.source.commit = 'fedcba9876543210fedcba9876543210fedcba98';
  assert.equal(verifyCodexAdmissionReceipt(stale, {
    expectedRepo: EXPECTED_REPO,
    expectedCommit: EXPECTED_COMMIT,
  }).admitted, false);

  const wrongModel = validReceipt();
  wrongModel.profile.modelId = 'gpt-5.6-sol';
  wrongModel.thread.modelId = 'gpt-5.6-sol';
  const wrongModelResult = verifyCodexAdmissionReceipt(wrongModel, {
    expectedRepo: EXPECTED_REPO,
    expectedCommit: EXPECTED_COMMIT,
  });
  assert.equal(wrongModelResult.admitted, false);
  assert.ok(wrongModelResult.mismatches.some((entry) => entry.field === 'profile.modelId'));

  const weakEffort = validReceipt();
  weakEffort.profile.reasoningEffort = 'high';
  const weakEffortResult = verifyCodexAdmissionReceipt(weakEffort, {
    expectedRepo: EXPECTED_REPO,
    expectedCommit: EXPECTED_COMMIT,
  });
  assert.equal(weakEffortResult.admitted, false);
  assert.ok(weakEffortResult.mismatches.some((entry) => entry.field === 'profile.reasoningEffort'));

  const fast = validReceipt();
  fast.thread.serviceTier = 'fast';
  const fastResult = verifyCodexAdmissionReceipt(fast, {
    expectedRepo: EXPECTED_REPO,
    expectedCommit: EXPECTED_COMMIT,
  });
  assert.equal(fastResult.admitted, false);
  assert.ok(fastResult.mismatches.some((entry) => entry.field === 'thread.serviceTier'));

  const fallbackEnabled = validReceipt();
  fallbackEnabled.thread.providerFallbackDisabled = false;
  const fallbackEnabledResult = verifyCodexAdmissionReceipt(fallbackEnabled, {
    expectedRepo: EXPECTED_REPO,
    expectedCommit: EXPECTED_COMMIT,
  });
  assert.equal(fallbackEnabledResult.admitted, false);
  assert.ok(fallbackEnabledResult.mismatches.some((entry) => entry.field === 'thread.providerFallbackDisabled'));
});

test('receipt requires default mode, active full-access profile, ephemeral thread, and exact systemd authority probes', () => {
  const wrongMode = validReceipt();
  wrongMode.profile.mode = 'plan';
  wrongMode.thread.collaborationMode = 'plan';
  assert.equal(verifyCodexAdmissionReceipt(wrongMode, {
    expectedRepo: EXPECTED_REPO,
    expectedCommit: EXPECTED_COMMIT,
  }).admitted, false);

  const wrongPermission = validReceipt();
  wrongPermission.thread.activePermissionProfileId = ':workspace';
  assert.equal(verifyCodexAdmissionReceipt(wrongPermission, {
    expectedRepo: EXPECTED_REPO,
    expectedCommit: EXPECTED_COMMIT,
  }).admitted, false);

  const durableProviderThread = validReceipt();
  durableProviderThread.thread.ephemeral = false;
  assert.equal(verifyCodexAdmissionReceipt(durableProviderThread, {
    expectedRepo: EXPECTED_REPO,
    expectedCommit: EXPECTED_COMMIT,
  }).admitted, false);

  const wrongBoundary = validReceipt();
  wrongBoundary.authority.boundaryId = 'legacy-provider-sandbox';
  assert.equal(verifyCodexAdmissionReceipt(wrongBoundary, {
    expectedRepo: EXPECTED_REPO,
    expectedCommit: EXPECTED_COMMIT,
  }).admitted, false);

  const weakBoundary = validReceipt();
  weakBoundary.authority.probes.gitPushDenyBlocked = false;
  const weakResult = verifyCodexAdmissionReceipt(weakBoundary, {
    expectedRepo: EXPECTED_REPO,
    expectedCommit: EXPECTED_COMMIT,
  });
  assert.equal(weakResult.admitted, false);
  assert.ok(weakResult.mismatches.some((entry) => entry.field === 'authority.probes.gitPushDenyBlocked'));
});

test('receipt accepts both null and explicit default service-tier observations but rejects non-default values', () => {
  const nullTier = validReceipt();
  nullTier.thread.serviceTier = null;
  assert.equal(verifyCodexAdmissionReceipt(nullTier, {
    expectedRepo: EXPECTED_REPO,
    expectedCommit: EXPECTED_COMMIT,
  }).admitted, true);

  const unexpected = validReceipt();
  unexpected.thread.serviceTier = 'priority';
  assert.equal(verifyCodexAdmissionReceipt(unexpected, {
    expectedRepo: EXPECTED_REPO,
    expectedCommit: EXPECTED_COMMIT,
  }).admitted, false);
});

test('receipt requires complete pinned Matt/gstack roots with real sha256 digests', () => {
  const missingBundle = validReceipt();
  missingBundle.bundles = missingBundle.bundles.filter((bundle) => bundle.id !== 'gstack');
  const missingResult = verifyCodexAdmissionReceipt(missingBundle, {
    expectedRepo: EXPECTED_REPO,
    expectedCommit: EXPECTED_COMMIT,
  });
  assert.equal(missingResult.admitted, false);
  assert.ok(missingResult.unknown.includes('bundles.gstack'));

  const drifted = validReceipt();
  drifted.bundles[0].pinnedCommit = '1111111111111111111111111111111111111111';
  const driftedResult = verifyCodexAdmissionReceipt(drifted, {
    expectedRepo: EXPECTED_REPO,
    expectedCommit: EXPECTED_COMMIT,
  });
  assert.equal(driftedResult.admitted, false);
  assert.ok(driftedResult.mismatches.some((entry) => entry.field === 'bundles.gstack.pinnedCommit'));

  const badDigest = validReceipt();
  badDigest.bundles[1].rootDigest = 'sha256:not-a-digest';
  const digestResult = verifyCodexAdmissionReceipt(badDigest, {
    expectedRepo: EXPECTED_REPO,
    expectedCommit: EXPECTED_COMMIT,
  });
  assert.equal(digestResult.admitted, false);
  assert.ok(digestResult.unknown.includes('bundles.mattpocock-skills.rootDigest'));
});

test('file loader never treats the enable flag or an unreadable/invalid receipt as admission', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lucubro-codex-admission-'));
  try {
    const missing = loadCodexAdmissionReceipt({
      filePath: path.join(root, 'missing.json'),
      expectedRepo: EXPECTED_REPO,
      expectedCommit: EXPECTED_COMMIT,
    });
    assert.equal(missing.admitted, false);
    assert.match(missing.reason, /receipt.*not found/i);

    const invalidPath = path.join(root, 'invalid.json');
    fs.writeFileSync(invalidPath, '{not json', 'utf8');
    const invalid = loadCodexAdmissionReceipt({
      filePath: invalidPath,
      expectedRepo: EXPECTED_REPO,
      expectedCommit: EXPECTED_COMMIT,
    });
    assert.equal(invalid.admitted, false);
    assert.match(invalid.reason, /invalid/i);

    const validPath = path.join(root, 'valid.json');
    fs.writeFileSync(validPath, `${JSON.stringify(validReceipt(), null, 2)}\n`, 'utf8');
    const valid = loadCodexAdmissionReceipt({
      filePath: validPath,
      expectedRepo: EXPECTED_REPO,
      expectedCommit: EXPECTED_COMMIT,
    });
    assert.equal(valid.admitted, true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});