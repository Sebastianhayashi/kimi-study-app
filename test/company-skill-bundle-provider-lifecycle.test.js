'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createSkillBundleStore } = require('../lib/company/skill-bundle-store');
const { computeBundleRootDigest, createSkillBundleMaterializer } = require('../lib/company/skill-bundle-materializer');
const { APPROVED_SKILL_BUNDLE_MANIFESTS } = require('../lib/company/skill-bundle-providers');

function tempRoot(t, prefix = 'lucubro-skill-provider-') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function write(root, relative, content) {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

test('approved upstream bundle manifests pin exact commits without inventing pre-download content digests', () => {
  assert.deepEqual(APPROVED_SKILL_BUNDLE_MANIFESTS.map((manifest) => ({
    id: manifest.id,
    repository: manifest.source.repository,
    pinnedCommit: manifest.pinnedCommit,
    hostVariant: manifest.hostVariant,
    license: manifest.license.spdx,
    rootDigest: manifest.rootDigest,
  })), [
    {
      id: 'gstack',
      repository: 'garrytan/gstack',
      pinnedCommit: '94993f74012782fd94416dd44b8314f6363a13a4',
      hostVariant: 'codex',
      license: 'MIT',
      rootDigest: null,
    },
    {
      id: 'mattpocock-skills',
      repository: 'mattpocock/skills',
      pinnedCommit: '84fdeffd12f2ee307994d1eb6feb48173b6e0502',
      hostVariant: 'codex',
      license: 'MIT',
      rootDigest: null,
    },
  ]);
  assert.ok(APPROVED_SKILL_BUNDLE_MANIFESTS.every((manifest) => !Object.hasOwn(manifest, 'selectedSkills')));
});

test('registered pinned bundle may learn its content digest only during exact materialization, then becomes active', (t) => {
  const dataRoot = tempRoot(t);
  const sourceRoot = tempRoot(t, 'lucubro-provider-source-');
  write(sourceRoot, 'README.md', '# Upstream fixture\n');
  write(sourceRoot, 'one/SKILL.md', '---\nname: one\ndescription: First skill.\n---\n# One\n');
  write(sourceRoot, 'two/SKILL.md', '---\nname: two\ndescription: Second skill.\n---\n# Two\n');
  const expectedDigest = computeBundleRootDigest(sourceRoot);

  const store = createSkillBundleStore({ rootDir: dataRoot, now: () => '2026-08-09T10:10:00.000Z' });
  const manifest = store.register({
    id: 'remote-fixture',
    source: { provider: 'github', repository: 'example/skills' },
    pinnedRef: 'ffffffffffffffffffffffffffffffffffffffff',
    pinnedCommit: 'ffffffffffffffffffffffffffffffffffffffff',
    license: { spdx: 'MIT', sourcePath: 'LICENSE' },
    hostVariant: 'codex',
    rootDigest: null,
    installationState: 'registered',
  });
  assert.equal(manifest.rootDigest, null);
  assert.throws(() => store.setInstallationState(manifest.id, 'active'), /rootDigest/);

  const result = createSkillBundleMaterializer({ bundleStore: store }).importFromDirectory(manifest.id, { sourceRoot });

  assert.equal(result.rootDigest, expectedDigest);
  const active = store.get(manifest.id);
  assert.equal(active.rootDigest, expectedDigest);
  assert.equal(active.installationState, 'active');
});
