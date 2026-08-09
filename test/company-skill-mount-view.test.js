'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createSkillBundleStore } = require('../lib/company/skill-bundle-store');
const { computeBundleRootDigest, createSkillBundleMaterializer } = require('../lib/company/skill-bundle-materializer');
const { createSkillCatalog } = require('../lib/company/skill-catalog');
const { createSkillMountView } = require('../lib/company/skill-mount-view');

function tempRoot(t, prefix = 'lucubro-skill-mount-view-') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function write(root, relative, content) {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function setupBundle(t) {
  const dataRoot = tempRoot(t);
  const sourceRoot = tempRoot(t, 'lucubro-mount-view-source-');
  write(sourceRoot, 'research/SKILL.md', '---\nname: research\ndescription: Research.\n---\n# Research\n');
  write(sourceRoot, 'research/references/source-policy.md', '# Sources\n');
  write(sourceRoot, 'teach/SKILL.md', '---\nname: teach\ndescription: Teach.\ndisable-model-invocation: true\n---\n# Teach\n');
  write(sourceRoot, 'teach/agents/openai.yaml', 'policy:\n  allow_implicit_invocation: false\n');
  write(sourceRoot, 'teach/assets/lesson-frame.txt', 'frame\n');
  write(sourceRoot, 'office-hours/SKILL.md', '---\nname: office-hours\ndescription: Office hours.\n---\n# Office Hours\n');

  const commit = '1212121212121212121212121212121212121212';
  const store = createSkillBundleStore({ rootDir: dataRoot });
  const bundle = store.register({
    id: 'fixture-bundle',
    source: { provider: 'fixture', repository: 'local/mount-view' },
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
  return { dataRoot, store, catalog };
}

test('run-scoped mount view copies complete selected Skill directories and excludes unselected Skill bodies', (t) => {
  const { dataRoot, store, catalog } = setupBundle(t);
  const views = createSkillMountView({ rootDir: dataRoot, bundleStore: store, catalog });

  const mount = views.build({
    runId: 'run_coffee',
    subrunId: 'subrun_research',
    selections: [
      { skillId: 'fixture-bundle:research', activation: 'model', userIntentEvidence: null, overlay: null },
      { skillId: 'fixture-bundle:teach', activation: 'user-intent', userIntentEvidence: 'Teach me', overlay: { id: 'teach-output-bridge', version: 1 } },
    ],
  });

  assert.equal(path.isAbsolute(mount.root), true);
  assert.equal(mount.expectedSkills.length, 2);
  assert.deepEqual(mount.expectedSkills.map((skill) => skill.name), ['research', 'teach']);
  assert.ok(fs.existsSync(path.join(mount.root, 'research', 'references', 'source-policy.md')));
  assert.ok(fs.existsSync(path.join(mount.root, 'teach', 'assets', 'lesson-frame.txt')));
  assert.ok(fs.existsSync(path.join(mount.root, 'teach', 'agents', 'openai.yaml')));
  assert.equal(fs.existsSync(path.join(mount.root, 'office-hours')), false);
  assert.equal(mount.expectedSkills[1].activation, 'user-intent');
  assert.equal(mount.expectedSkills[1].userIntentEvidence, 'Teach me');
  assert.deepEqual(mount.expectedSkills[1].overlay, { id: 'teach-output-bridge', version: 1 });
});

test('mount view fails closed when two selected upstream Skills have the same invocation name', (t) => {
  const { dataRoot, store, catalog } = setupBundle(t);
  const views = createSkillMountView({ rootDir: dataRoot, bundleStore: store, catalog });
  const original = catalog.get('fixture-bundle:research');
  const fakeCatalog = {
    get(id) {
      if (id === 'other-bundle:research') return { ...original, id, bundleId: 'fixture-bundle' };
      return catalog.get(id);
    },
  };
  const collisionViews = createSkillMountView({ rootDir: dataRoot, bundleStore: store, catalog: fakeCatalog });

  assert.throws(
    () => collisionViews.build({
      runId: 'run_collision',
      selections: [
        { skillId: 'fixture-bundle:research', activation: 'model' },
        { skillId: 'other-bundle:research', activation: 'model' },
      ],
    }),
    /Duplicate Skill invocation name in mount view: research/,
  );
});
