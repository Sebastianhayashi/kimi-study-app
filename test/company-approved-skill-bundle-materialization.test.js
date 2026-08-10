'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  materializeApprovedSkillBundles,
} = require('../lib/company/approved-skill-bundle-materialization');
const { APPROVED_SKILL_BUNDLE_MANIFESTS } = require('../lib/company/skill-bundle-providers');

function tempRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lucubro-approved-bundles-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function createSource(root, manifest) {
  const source = path.join(root, 'sources', manifest.id);
  fs.mkdirSync(path.join(source, 'nested'), { recursive: true });
  fs.writeFileSync(path.join(source, 'SKILL.md'), `# ${manifest.id}\n`, 'utf8');
  fs.writeFileSync(path.join(source, 'LICENSE'), 'MIT\n', 'utf8');
  fs.writeFileSync(path.join(source, 'nested', 'commit.txt'), `${manifest.pinnedCommit}\n`, 'utf8');
  return source;
}

test('materializes every approved pinned bundle and returns active digest receipts', (t) => {
  const root = tempRoot(t);
  const dataDir = path.join(root, 'company-data');
  const sources = Object.fromEntries(
    APPROVED_SKILL_BUNDLE_MANIFESTS.map((manifest) => [manifest.id, createSource(root, manifest)]),
  );

  const receipts = materializeApprovedSkillBundles({ dataDir, sources });

  assert.deepEqual(receipts.map((entry) => entry.id), ['gstack', 'mattpocock-skills']);
  for (const receipt of receipts) {
    const approved = APPROVED_SKILL_BUNDLE_MANIFESTS.find((entry) => entry.id === receipt.id);
    assert.equal(receipt.pinnedCommit, approved.pinnedCommit);
    assert.equal(receipt.installationState, 'active');
    assert.match(receipt.rootDigest, /^sha256:[0-9a-f]{64}$/);
    assert.equal(fs.existsSync(receipt.materializedRoot), true);
    assert.equal(receipt.reused, false);
  }

  const second = materializeApprovedSkillBundles({ dataDir, sources });
  assert.equal(second.every((entry) => entry.reused === true), true);
  assert.deepEqual(second.map((entry) => entry.rootDigest), receipts.map((entry) => entry.rootDigest));
});

test('fails closed when any approved source root is missing', (t) => {
  const root = tempRoot(t);
  const dataDir = path.join(root, 'company-data');
  const first = APPROVED_SKILL_BUNDLE_MANIFESTS[0];
  const sources = { [first.id]: createSource(root, first) };

  assert.throws(
    () => materializeApprovedSkillBundles({ dataDir, sources }),
    /source root.*mattpocock-skills/i,
  );
});

test('refuses an existing manifest that drifted from the approved pinned commit', (t) => {
  const root = tempRoot(t);
  const dataDir = path.join(root, 'company-data');
  const manifestsDir = path.join(dataDir, 'skill-bundles', 'manifests');
  fs.mkdirSync(manifestsDir, { recursive: true });
  const approved = APPROVED_SKILL_BUNDLE_MANIFESTS[0];
  fs.writeFileSync(path.join(manifestsDir, `${approved.id}.json`), `${JSON.stringify({
    ...approved,
    pinnedCommit: '1111111111111111111111111111111111111111',
    pinnedRef: '1111111111111111111111111111111111111111',
    installationState: 'registered',
    materializedRoot: path.join(dataDir, 'skill-bundles', 'materialized', approved.id, 'wrong', 'codex'),
    createdAt: '2026-08-09T00:00:00.000Z',
    updatedAt: '2026-08-09T00:00:00.000Z',
  }, null, 2)}\n`, 'utf8');

  const sources = Object.fromEntries(
    APPROVED_SKILL_BUNDLE_MANIFESTS.map((manifest) => [manifest.id, createSource(root, manifest)]),
  );
  assert.throws(
    () => materializeApprovedSkillBundles({ dataDir, sources }),
    /pinned commit mismatch/i,
  );
});
