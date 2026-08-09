'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createSkillBundleStore } = require('../lib/company/skill-bundle-store');

function tempRoot(t, prefix = 'lucubro-skill-bundles-') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

const MATT_COMMIT = '84fdeffd12f2ee307994d1eb6feb48173b6e0502';
const GSTACK_COMMIT = '94993f74012782fd94416dd44b8314f6363a13a4';

function manifest(overrides = {}) {
  return {
    id: 'mattpocock-skills',
    source: {
      provider: 'github',
      repository: 'mattpocock/skills',
    },
    pinnedRef: MATT_COMMIT,
    pinnedCommit: MATT_COMMIT,
    license: {
      spdx: 'MIT',
      sourcePath: 'LICENSE',
    },
    hostVariant: 'codex',
    rootDigest: 'sha256:matt-fixture',
    installationState: 'active',
    ...overrides,
  };
}

test('managed Skill bundle manifest survives store recreation with immutable provenance', (t) => {
  const root = tempRoot(t);
  let tick = 0;
  const now = () => `2026-08-09T09:30:0${tick++}.000Z`;
  const first = createSkillBundleStore({ rootDir: root, now });

  const created = first.register(manifest());

  assert.equal(created.id, 'mattpocock-skills');
  assert.deepEqual(created.source, {
    provider: 'github',
    repository: 'mattpocock/skills',
  });
  assert.equal(created.pinnedRef, MATT_COMMIT);
  assert.equal(created.pinnedCommit, MATT_COMMIT);
  assert.deepEqual(created.license, { spdx: 'MIT', sourcePath: 'LICENSE' });
  assert.equal(created.hostVariant, 'codex');
  assert.equal(created.rootDigest, 'sha256:matt-fixture');
  assert.equal(created.installationState, 'active');
  assert.equal(
    created.materializedRoot,
    path.join(root, 'skill-bundles', 'materialized', 'mattpocock-skills', MATT_COMMIT, 'codex'),
  );

  const second = createSkillBundleStore({ rootDir: root, now });
  assert.deepEqual(second.get('mattpocock-skills'), created);
});

test('managed Skill bundle registration requires an exact pinned commit', (t) => {
  const root = tempRoot(t);
  const store = createSkillBundleStore({ rootDir: root });

  assert.throws(
    () => store.register(manifest({ pinnedRef: 'main', pinnedCommit: null })),
    /pinnedCommit is required/,
  );
});

test('bundle inventory stores multiple complete upstream bundles without task-specific selection', (t) => {
  const root = tempRoot(t);
  const store = createSkillBundleStore({ rootDir: root, now: () => '2026-08-09T09:31:00.000Z' });

  store.register(manifest());
  store.register(manifest({
    id: 'gstack',
    source: {
      provider: 'github',
      repository: 'garrytan/gstack',
    },
    pinnedRef: GSTACK_COMMIT,
    pinnedCommit: GSTACK_COMMIT,
    rootDigest: 'sha256:gstack-fixture',
  }));

  assert.deepEqual(
    store.list().map((bundle) => [bundle.id, bundle.source.repository, bundle.pinnedCommit]),
    [
      ['gstack', 'garrytan/gstack', GSTACK_COMMIT],
      ['mattpocock-skills', 'mattpocock/skills', MATT_COMMIT],
    ],
  );
});
