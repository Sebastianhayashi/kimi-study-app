'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createSkillBundleStore } = require('../lib/company/skill-bundle-store');
const {
  computeBundleRootDigest,
  createSkillBundleMaterializer,
} = require('../lib/company/skill-bundle-materializer');

function tempRoot(t, prefix = 'lucubro-skill-symlink-') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function register(store) {
  const commit = 'dddddddddddddddddddddddddddddddddddddddd';
  return store.register({
    id: 'symlink-fixture',
    source: { provider: 'fixture', repository: 'local/symlink-bundle' },
    pinnedRef: commit,
    pinnedCommit: commit,
    license: { spdx: 'MIT', sourcePath: 'LICENSE' },
    hostVariant: 'codex',
    rootDigest: null,
    installationState: 'registered',
  });
}

test('materializer preserves a relative symlink whose final target stays inside the bundle and includes symlink identity in the digest', (t) => {
  const root = tempRoot(t);
  const source = tempRoot(t, 'lucubro-symlink-source-');
  fs.mkdirSync(path.join(source, 'bin'), { recursive: true });
  fs.writeFileSync(path.join(source, 'bin', 'consumer'), '#!/bin/sh\nexit 0\n', 'utf8');
  fs.symlinkSync('consumer', path.join(source, 'bin', 'reader'));

  const store = createSkillBundleStore({ rootDir: root });
  const manifest = register(store);
  const materializer = createSkillBundleMaterializer({ bundleStore: store });
  const sourceDigest = computeBundleRootDigest(source);
  const result = materializer.importFromDirectory(manifest.id, { sourceRoot: source });

  const installedLink = path.join(result.materializedRoot, 'bin', 'reader');
  assert.equal(fs.lstatSync(installedLink).isSymbolicLink(), true);
  assert.equal(fs.readlinkSync(installedLink), 'consumer');
  assert.equal(fs.realpathSync(installedLink), path.join(result.materializedRoot, 'bin', 'consumer'));
  assert.equal(result.rootDigest, sourceDigest);
  assert.equal(computeBundleRootDigest(result.materializedRoot), sourceDigest);

  fs.unlinkSync(path.join(source, 'bin', 'reader'));
  fs.symlinkSync('./consumer', path.join(source, 'bin', 'reader'));
  assert.notEqual(computeBundleRootDigest(source), sourceDigest);
});

test('materializer rejects absolute, lexical escape, and final-realpath escape symlinks', (t) => {
  const root = tempRoot(t);
  const outside = path.join(root, 'outside.txt');
  fs.writeFileSync(outside, 'outside\n', 'utf8');

  for (const [name, target] of [
    ['absolute', outside],
    ['lexical-escape', '../outside.txt'],
  ]) {
    const source = tempRoot(t, `lucubro-${name}-source-`);
    fs.symlinkSync(target, path.join(source, 'escape'));
    assert.throws(() => computeBundleRootDigest(source), /symlink.*bundle root|relative symlink/i);
  }

  const source = tempRoot(t, 'lucubro-chain-source-');
  const internal = path.join(source, 'internal');
  fs.mkdirSync(internal, { recursive: true });
  fs.symlinkSync(outside, path.join(internal, 'outside-hop'));
  fs.symlinkSync('internal/outside-hop', path.join(source, 'chain'));
  assert.throws(() => computeBundleRootDigest(source), /symlink.*bundle root|relative symlink/i);
});
