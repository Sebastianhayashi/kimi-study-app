'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createSkillBundleStore } = require('../lib/company/skill-bundle-store');
const { createSkillBundleMaterializer } = require('../lib/company/skill-bundle-materializer');

function tempRoot(t, prefix = 'lucubro-skill-materializer-') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function writeFixtureBundle(root) {
  const files = new Map([
    ['README.md', '# Fixture bundle\n'],
    ['skills/engineering/tdd/SKILL.md', '---\nname: tdd\ndescription: Test first.\n---\n# TDD\n'],
    ['skills/engineering/tdd/references/tests.md', '# Testing reference\n'],
    ['skills/productivity/teach/SKILL.md', '---\nname: teach\ndescription: Teach a concept.\n---\n# Teach\n'],
    ['office-hours/SKILL.md', '---\nname: office-hours\ndescription: Interrogate a product idea.\n---\n# Office Hours\n'],
    ['bin/setup', '#!/usr/bin/env bash\necho setup\n'],
  ]);
  for (const [relative, content] of files) {
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
  return [...files.keys()].sort();
}

function digestTree(root) {
  const hash = crypto.createHash('sha256');
  const files = fs.readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(root, path.join(entry.parentPath, entry.name)).split(path.sep).join('/'))
    .sort();
  for (const relative of files) {
    const body = fs.readFileSync(path.join(root, relative));
    hash.update(`${relative}\0${body.length}\0`);
    hash.update(body);
    hash.update('\0');
  }
  return `sha256:${hash.digest('hex')}`;
}

function registerFixture(store, sourceRoot, overrides = {}) {
  const commit = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  return store.register({
    id: 'fixture-bundle',
    source: { provider: 'fixture', repository: 'local/full-bundle' },
    pinnedRef: commit,
    pinnedCommit: commit,
    license: { spdx: 'MIT', sourcePath: 'LICENSE' },
    hostVariant: 'codex',
    rootDigest: digestTree(sourceRoot),
    installationState: 'registered',
    ...overrides,
  });
}

test('materialization retains the complete upstream bundle tree, not a selected Skill subset', (t) => {
  const root = tempRoot(t);
  const sourceRoot = tempRoot(t, 'lucubro-upstream-bundle-');
  const expectedFiles = writeFixtureBundle(sourceRoot);
  const store = createSkillBundleStore({ rootDir: root, now: () => '2026-08-09T09:40:00.000Z' });
  const manifest = registerFixture(store, sourceRoot);
  const materializer = createSkillBundleMaterializer({ bundleStore: store });

  const result = materializer.importFromDirectory(manifest.id, { sourceRoot });

  const installedFiles = fs.readdirSync(manifest.materializedRoot, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(manifest.materializedRoot, path.join(entry.parentPath, entry.name)).split(path.sep).join('/'))
    .sort();
  assert.deepEqual(installedFiles, expectedFiles);
  assert.equal(result.rootDigest, manifest.rootDigest);
  assert.equal(store.get(manifest.id).installationState, 'active');
});

test('digest mismatch rolls back staging and leaves no partially active bundle', (t) => {
  const root = tempRoot(t);
  const sourceRoot = tempRoot(t, 'lucubro-upstream-bundle-bad-');
  writeFixtureBundle(sourceRoot);
  const store = createSkillBundleStore({ rootDir: root });
  const manifest = registerFixture(store, sourceRoot, { rootDigest: `sha256:${'0'.repeat(64)}` });
  const materializer = createSkillBundleMaterializer({ bundleStore: store });

  assert.throws(
    () => materializer.importFromDirectory(manifest.id, { sourceRoot }),
    /Skill bundle digest mismatch/,
  );
  assert.equal(fs.existsSync(manifest.materializedRoot), false);
  assert.equal(store.get(manifest.id).installationState, 'registered');
});
