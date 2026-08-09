'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createSkillBundleStore } = require('../lib/company/skill-bundle-store');
const { computeBundleRootDigest, createSkillBundleMaterializer } = require('../lib/company/skill-bundle-materializer');
const { createSkillCatalog } = require('../lib/company/skill-catalog');

function tempRoot(t, prefix = 'lucubro-skill-catalog-') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function writeFile(root, relative, content) {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function skill(name, description, extra = '') {
  return `---\nname: ${name}\n${extra}description: ${description}\n---\n\n# ${name}\n\nBody for ${name}.\n`;
}

function materializeFixture(t) {
  const dataRoot = tempRoot(t);
  const sourceRoot = tempRoot(t, 'lucubro-skill-catalog-source-');
  writeFile(sourceRoot, 'SKILL.md', skill('bundle-router', 'Route across this bundle.', 'version: 1.0.0\n'));
  writeFile(sourceRoot, 'skills/engineering/tdd/SKILL.md', skill('tdd', 'Test-driven development.'));
  writeFile(sourceRoot, 'skills/productivity/teach/SKILL.md', skill('teach', 'Teach a concept.'));
  writeFile(sourceRoot, 'office-hours/SKILL.md', skill('office-hours', 'Interrogate a product idea.', 'version: 2.0.0\n'));
  writeFile(sourceRoot, 'notes/SKILL.md', '# Not an eligible skill because it has no frontmatter\n');
  writeFile(sourceRoot, 'skills/engineering/tdd/references/tests.md', '# Reference only\n');

  const commit = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  const store = createSkillBundleStore({ rootDir: dataRoot, now: () => '2026-08-09T09:50:00.000Z' });
  const bundle = store.register({
    id: 'fixture-bundle',
    source: { provider: 'fixture', repository: 'local/catalog' },
    pinnedRef: commit,
    pinnedCommit: commit,
    license: { spdx: 'MIT', sourcePath: 'LICENSE' },
    hostVariant: 'codex',
    rootDigest: computeBundleRootDigest(sourceRoot),
    installationState: 'registered',
  });
  createSkillBundleMaterializer({ bundleStore: store }).importFromDirectory(bundle.id, { sourceRoot });
  return { store, bundle };
}

test('full Skill Catalog recursively indexes every eligible SKILL.md across bundle layouts', (t) => {
  const { store } = materializeFixture(t);
  const catalog = createSkillCatalog({ bundleStore: store });

  const refresh = catalog.refresh();
  const entries = catalog.list();

  assert.equal(refresh.indexedSkills, 4);
  assert.deepEqual(entries.map((entry) => entry.name), [
    'bundle-router',
    'office-hours',
    'tdd',
    'teach',
  ]);
  assert.deepEqual(entries.map((entry) => entry.skillPath), [
    'SKILL.md',
    'office-hours/SKILL.md',
    'skills/engineering/tdd/SKILL.md',
    'skills/productivity/teach/SKILL.md',
  ]);
  assert.ok(entries.every((entry) => entry.bundleId === 'fixture-bundle'));
  assert.ok(entries.every((entry) => /^sha256:[0-9a-f]{64}$/.test(entry.contentHash)));
  assert.ok(entries.every((entry) => !Object.hasOwn(entry, 'body')));
});

test('Skill body is loaded lazily by stable bundle-qualified identity', (t) => {
  const { store } = materializeFixture(t);
  const catalog = createSkillCatalog({ bundleStore: store });
  catalog.refresh();

  const metadata = catalog.get('fixture-bundle:tdd');
  assert.equal(metadata.name, 'tdd');
  assert.equal(metadata.description, 'Test-driven development.');
  assert.equal(metadata.version, null);
  assert.equal(Object.hasOwn(metadata, 'body'), false);

  const loaded = catalog.load('fixture-bundle:tdd');
  assert.match(loaded.body, /Body for tdd\./);
  assert.equal(loaded.contentHash, metadata.contentHash);
});
