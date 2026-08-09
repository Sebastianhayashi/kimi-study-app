'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createProjectStore } = require('../lib/company/project-store');
const { discoverProjectSources } = require('../lib/company/project-discovery');
const { createWorkStore } = require('../lib/company/work-store');

function tempRoot(t, prefix = 'lucubro-project-') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

test('Project identity and continuation checkpoint survive store recreation', (t) => {
  const root = tempRoot(t);
  let tick = 0;
  const now = () => `2026-08-09T08:00:0${tick++}.000Z`;
  const firstStore = createProjectStore({ rootDir: root, now });
  const created = firstStore.create({
    id: 'project_lucubro',
    name: 'Lucubro',
    repoDir: '/work/lucubro',
    sources: [{ kind: 'context', path: 'CONTEXT.md' }],
  });

  firstStore.updateCheckpoint(created.id, {
    status: 'active',
    scope: 'Project Persistence v1',
    exactTarget: 'feature/project-persistence-v1',
    completed: ['spec'],
    evidence: ['commit:8f6ec9c'],
    mutations: ['PROJECT-PERSISTENCE-V1-SPEC.md'],
    unfinished: ['project domain'],
    nextSafeAction: 'implement project store',
    exactReferences: ['issue:#19'],
    suggestedSkills: ['implement'],
    doNotRepeat: ['do not use transcript as memory'],
  });

  const secondStore = createProjectStore({ rootDir: root, now });
  const restored = secondStore.get(created.id);
  assert.equal(restored.id, 'project_lucubro');
  assert.equal(restored.repoDir, '/work/lucubro');
  assert.equal(restored.checkpoint.nextSafeAction, 'implement project store');
  assert.deepEqual(restored.sources, [{ kind: 'context', path: 'CONTEXT.md' }]);
});

test('Project discovery recognizes source-backed Matt-style context without mutating the repository', (t) => {
  const repo = tempRoot(t, 'lucubro-discovery-');
  fs.mkdirSync(path.join(repo, '.git'));
  fs.mkdirSync(path.join(repo, 'docs', 'adr'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'docs', 'specs'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'AGENTS.md'), '# Instructions\n');
  fs.writeFileSync(path.join(repo, 'CONTEXT.md'), '# Domain context\n');
  fs.writeFileSync(path.join(repo, 'docs', 'adr', '0001-auth.md'), '# ADR\n');
  fs.writeFileSync(path.join(repo, 'docs', 'specs', 'login.md'), '# Spec\n');
  const before = fs.readdirSync(repo, { recursive: true }).sort();

  const result = discoverProjectSources({ repoDir: repo });

  assert.equal(result.repoDir, fs.realpathSync(repo));
  assert.equal(result.isGitRepository, true);
  assert.deepEqual(result.sources.map((source) => [source.kind, source.path]), [
    ['instructions', 'AGENTS.md'],
    ['context', 'CONTEXT.md'],
    ['decision', 'docs/adr/0001-auth.md'],
    ['spec', 'docs/specs/login.md'],
  ]);
  assert.deepEqual(fs.readdirSync(repo, { recursive: true }).sort(), before);
});

test('Project discovery refuses source paths that escape the repository through symlinks', (t) => {
  const repo = tempRoot(t, 'lucubro-discovery-symlink-');
  const outside = tempRoot(t, 'lucubro-discovery-outside-');
  fs.mkdirSync(path.join(repo, '.git'));
  fs.writeFileSync(path.join(outside, 'secret.md'), 'outside');
  fs.symlinkSync(path.join(outside, 'secret.md'), path.join(repo, 'CONTEXT.md'));

  const result = discoverProjectSources({ repoDir: repo });
  assert.deepEqual(result.sources, []);
});

test('Work can bind to a durable Project without changing existing Work identity', (t) => {
  const root = tempRoot(t);
  const workStore = createWorkStore({ rootDir: root, now: () => '2026-08-09T08:10:00.000Z' });
  const work = workStore.create({
    id: 'work_project_bound',
    brief: 'Continue project persistence',
    projectId: 'project_lucubro',
  });

  assert.equal(work.id, 'work_project_bound');
  assert.equal(work.projectId, 'project_lucubro');
  assert.equal(workStore.get(work.id).projectId, 'project_lucubro');
});
