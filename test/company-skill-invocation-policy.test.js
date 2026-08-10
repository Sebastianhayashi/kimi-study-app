'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createSkillBundleStore } = require('../lib/company/skill-bundle-store');
const { computeBundleRootDigest, createSkillBundleMaterializer } = require('../lib/company/skill-bundle-materializer');
const { createSkillCatalog } = require('../lib/company/skill-catalog');

function tempRoot(t, prefix = 'lucubro-skill-invocation-') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function write(root, relative, content) {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

test('catalog distinguishes model-invoked and user-only upstream Skills using both host policies', (t) => {
  const dataRoot = tempRoot(t);
  const sourceRoot = tempRoot(t, 'lucubro-invocation-source-');
  write(sourceRoot, 'research/SKILL.md', '---\nname: research\ndescription: Research a topic.\n---\n# Research\n');
  write(sourceRoot, 'research/agents/openai.yaml', 'interface:\n  display_name: Research\n');
  write(sourceRoot, 'teach/SKILL.md', '---\nname: teach\ndescription: Teach a concept.\ndisable-model-invocation: true\n---\n# Teach\n');
  write(sourceRoot, 'teach/agents/openai.yaml', 'interface:\n  display_name: Teach\npolicy:\n  allow_implicit_invocation: false\n');
  write(sourceRoot, 'inconsistent/SKILL.md', '---\nname: inconsistent\ndescription: Fixture mismatch.\ndisable-model-invocation: true\n---\n# Inconsistent\n');
  write(sourceRoot, 'inconsistent/agents/openai.yaml', 'policy:\n  allow_implicit_invocation: true\n');

  const commit = 'abababababababababababababababababababab';
  const store = createSkillBundleStore({ rootDir: dataRoot });
  const bundle = store.register({
    id: 'invocation-fixture',
    source: { provider: 'fixture', repository: 'local/invocation' },
    pinnedRef: commit,
    pinnedCommit: commit,
    license: { spdx: 'MIT', sourcePath: 'LICENSE' },
    hostVariant: 'codex',
    rootDigest: computeBundleRootDigest(sourceRoot),
    installationState: 'registered',
  });
  createSkillBundleMaterializer({ bundleStore: store }).importFromDirectory(bundle.id, { sourceRoot });
  const catalog = createSkillCatalog({ bundleStore: store });
  const refresh = catalog.refresh();

  assert.deepEqual(catalog.get('invocation-fixture:research').invocationPolicy, {
    mode: 'model-or-user',
    skillFrontmatterAllowsImplicit: true,
    codexPolicyAllowsImplicit: null,
  });
  assert.deepEqual(catalog.get('invocation-fixture:teach').invocationPolicy, {
    mode: 'user-only',
    skillFrontmatterAllowsImplicit: false,
    codexPolicyAllowsImplicit: false,
  });
  assert.deepEqual(catalog.get('invocation-fixture:inconsistent').invocationPolicy, {
    mode: 'user-only',
    skillFrontmatterAllowsImplicit: false,
    codexPolicyAllowsImplicit: true,
  });
  assert.ok(refresh.diagnostics.some((item) => item.type === 'invocation-policy-mismatch' && item.skillId === 'invocation-fixture:inconsistent'));
});
