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
const LUNA_MODEL_ID = 'provider-luna-max-id';

function digest(char) {
  return `sha256:${char.repeat(64)}`;
}

function validReceipt() {
  return {
    kind: 'lucubro-codex-admission',
    schemaVersion: 1,
    observedAt: '2026-08-09T13:30:00.000Z',
    source: {
      repo: EXPECTED_REPO,
      commit: EXPECTED_COMMIT,
    },
    appServer: {
      userAgent: 'codex-cli/0.147.0',
      platformFamily: 'unix',
      platformOs: 'linux',
    },
    catalog: {
      modelId: LUNA_MODEL_ID,
      displayName: 'Luna Max',
      uniqueMatch: true,
    },
    profile: {
      profileName: 'Luna Max',
      modelId: LUNA_MODEL_ID,
      mode: 'default',
      fast: false,
      permissionProfile: 'full-access',
    },
    thread: {
      modelId: LUNA_MODEL_ID,
      modelProvider: 'openai',
      serviceTier: null,
      collaborationMode: 'default',
      activePermissionProfileId: ':full-access',
    },
    permissionProfile: {
      providerId: ':full-access',
      normalized: 'full-access',
      allowed: true,
    },
    authority: {
      enforced: true,
      boundaryId: 'nixos-external-authority-v1',
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

test('exact machine receipt admits only Luna Max default Fast-off full-access on the exact Lucubro commit', () => {
  const result = verifyCodexAdmissionReceipt(validReceipt(), {
    expectedRepo: EXPECTED_REPO,
    expectedCommit: EXPECTED_COMMIT,
  });

  assert.equal(result.admitted, true);
  assert.equal(result.profileName, 'Luna Max');
  assert.equal(result.modelId, LUNA_MODEL_ID);
  assert.deepEqual(result.unknown, []);
  assert.deepEqual(result.mismatches, []);
  assert.deepEqual(result.bundleDigests, {
    gstack: digest('a'),
    'mattpocock-skills': digest('b'),
  });
  assert.equal(result.authority.boundaryId, 'nixos-external-authority-v1');
});

test('receipt fails closed for stale commit, Fast service tier, or a thread that did not actually use Luna', () => {
  const stale = validReceipt();
  stale.source.commit = 'fedcba9876543210fedcba9876543210fedcba98';
  assert.equal(verifyCodexAdmissionReceipt(stale, {
    expectedRepo: EXPECTED_REPO,
    expectedCommit: EXPECTED_COMMIT,
  }).admitted, false);

  const fast = validReceipt();
  fast.thread.serviceTier = 'fast';
  const fastResult = verifyCodexAdmissionReceipt(fast, {
    expectedRepo: EXPECTED_REPO,
    expectedCommit: EXPECTED_COMMIT,
  });
  assert.equal(fastResult.admitted, false);
  assert.ok(fastResult.mismatches.some((entry) => entry.field === 'thread.serviceTier'));

  const fallback = validReceipt();
  fallback.thread.modelId = 'fallback-model-id';
  const fallbackResult = verifyCodexAdmissionReceipt(fallback, {
    expectedRepo: EXPECTED_REPO,
    expectedCommit: EXPECTED_COMMIT,
  });
  assert.equal(fallbackResult.admitted, false);
  assert.ok(fallbackResult.mismatches.some((entry) => entry.field === 'thread.modelId'));
});

test('receipt requires machine-observed default mode, active full-access profile, and every authority probe', () => {
  const wrongMode = validReceipt();
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

  const weakBoundary = validReceipt();
  weakBoundary.authority.probes.gitPushDenyBlocked = false;
  const weakResult = verifyCodexAdmissionReceipt(weakBoundary, {
    expectedRepo: EXPECTED_REPO,
    expectedCommit: EXPECTED_COMMIT,
  });
  assert.equal(weakResult.admitted, false);
  assert.ok(weakResult.mismatches.some((entry) => entry.field === 'authority.probes.gitPushDenyBlocked'));
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
