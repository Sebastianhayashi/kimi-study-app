'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createSkillBundleStore } = require('../lib/company/skill-bundle-store');
const { computeBundleRootDigest, createSkillBundleMaterializer } = require('../lib/company/skill-bundle-materializer');
const { createSkillCatalog } = require('../lib/company/skill-catalog');
const { createSkillDependencyResolver } = require('../lib/company/skill-dependency-resolver');

function tempRoot(t, prefix = 'lucubro-skill-deps-') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function write(root, relative, content) {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function setupCatalog(t) {
  const dataRoot = tempRoot(t);
  const sourceRoot = tempRoot(t, 'lucubro-skill-deps-source-');
  write(sourceRoot, 'skills/engineering/implement/SKILL.md', `---\nname: implement\ndescription: Implement a planned change.\n---\n# Implement\nUse \\`/tdd\\` for the build loop. Read [review guidance](references/review.md). Run \\`scripts/check.sh\\`. Ignore \\`../../../../outside-secret.txt\\`.\n`);
  write(sourceRoot, 'skills/engineering/implement/references/review.md', '# Review guidance\nSee [checklist](checklist.md).\n');
  write(sourceRoot, 'skills/engineering/implement/references/checklist.md', '# Checklist\n');
  write(sourceRoot, 'skills/engineering/implement/scripts/check.sh', '#!/usr/bin/env bash\nexit 0\n');
  write(sourceRoot, 'skills/engineering/tdd/SKILL.md', `---\nname: tdd\ndescription: Test first.\n---\n# TDD\nRead [tests](tests.md).\n`);
  write(sourceRoot, 'skills/engineering/tdd/tests.md', '# Tests\n');
  write(path.dirname(sourceRoot), 'outside-secret.txt', 'must never mount');

  const commit = 'cccccccccccccccccccccccccccccccccccccccc';
  const store = createSkillBundleStore({ rootDir: dataRoot });
  const bundle = store.register({
    id: 'matt-fixture',
    source: { provider: 'fixture', repository: 'local/matt' },
    pinnedRef: commit,
    pinnedCommit: commit,
    license: { spdx: 'MIT', sourcePath: 'LICENSE' },
    hostVariant: 'codex',
    rootDigest: computeBundleRootDigest(sourceRoot),
    installationState: 'registered',
  });
  createSkillBundleMaterializer({ bundleStore: store }).importFromDirectory(bundle.id, { sourceRoot });
  const catalog = createSkillCatalog({ bundleStore: store });
  catalog.refresh();
  return { store, catalog };
}

test('dependency closure follows selected Skill composition and local resource references only', (t) => {
  const { store, catalog } = setupCatalog(t);
  const resolver = createSkillDependencyResolver({ bundleStore: store, catalog });

  const closure = resolver.resolve(['matt-fixture:implement']);

  assert.deepEqual(closure.skillIds, ['matt-fixture:implement', 'matt-fixture:tdd']);
  assert.deepEqual(closure.files, [
    'skills/engineering/implement/SKILL.md',
    'skills/engineering/implement/references/checklist.md',
    'skills/engineering/implement/references/review.md',
    'skills/engineering/implement/scripts/check.sh',
    'skills/engineering/tdd/SKILL.md',
    'skills/engineering/tdd/tests.md',
  ]);
  assert.deepEqual(closure.skillRoots, [
    'skills/engineering/implement',
    'skills/engineering/tdd',
  ]);
  assert.ok(closure.diagnostics.some((item) => item.type === 'outside-bundle-reference'));
  assert.equal(closure.files.some((file) => file.includes('outside-secret')), false);
});

test('dependency resolver fails closed for a selected Skill that is not in the indexed catalog', (t) => {
  const { store, catalog } = setupCatalog(t);
  const resolver = createSkillDependencyResolver({ bundleStore: store, catalog });

  assert.throws(
    () => resolver.resolve(['matt-fixture:not-installed']),
    /Selected Skill is not indexed/,
  );
});
