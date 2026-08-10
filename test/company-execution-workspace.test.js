'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createExecutionWorkspaceManager } = require('../lib/company/execution-workspace-manager');

function tempRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lucubro-execution-workspace-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

test('ordinary non-repo Run receives a Lucubro-owned scratch workspace', async (t) => {
  const root = tempRoot(t);
  let gitCalls = 0;
  const manager = createExecutionWorkspaceManager({
    rootDir: root,
    gitWorktreeManager: {
      async create() { gitCalls += 1; throw new Error('git must not be used'); },
      async inspect() { throw new Error('git must not be inspected'); },
    },
  });

  const workspace = await manager.create({ repoDir: null, runId: 'run_coffee' });

  assert.equal(workspace.kind, 'scratch');
  assert.equal(workspace.repoDir, null);
  assert.equal(workspace.branch, null);
  assert.equal(path.isAbsolute(workspace.cwd), true);
  assert.equal(workspace.cwd, path.join(root, 'execution-workspaces', 'run_coffee'));
  assert.equal(fs.statSync(workspace.cwd).isDirectory(), true);
  assert.equal(gitCalls, 0);
  assert.deepEqual(await manager.inspect(workspace), { diff: '', changedFiles: [] });

  await manager.remove(workspace);
  assert.equal(fs.existsSync(workspace.cwd), false);
});

test('repo-backed Run delegates to the existing Git worktree manager', async (t) => {
  const root = tempRoot(t);
  const calls = [];
  const manager = createExecutionWorkspaceManager({
    rootDir: root,
    gitWorktreeManager: {
      async create(input) {
        calls.push({ type: 'create', input });
        return { cwd: '/repo/.lucubro/worktrees/run_code', branch: 'lucubro/run-run_code' };
      },
      async inspect(input) {
        calls.push({ type: 'inspect', input });
        return { diff: 'diff', changedFiles: ['src/index.js'] };
      },
      async remove(input) { calls.push({ type: 'remove', input }); },
    },
  });

  const workspace = await manager.create({ repoDir: '/repo', runId: 'run_code', baseRef: 'main' });
  assert.deepEqual(workspace, {
    kind: 'git-worktree',
    repoDir: '/repo',
    cwd: '/repo/.lucubro/worktrees/run_code',
    branch: 'lucubro/run-run_code',
  });
  assert.deepEqual(await manager.inspect(workspace), { diff: 'diff', changedFiles: ['src/index.js'] });
  await manager.remove(workspace);
  assert.equal(calls[0].type, 'create');
  assert.deepEqual(calls[0].input, { repoDir: '/repo', runId: 'run_code', baseRef: 'main' });
  assert.deepEqual(calls[1], { type: 'inspect', input: { cwd: workspace.cwd } });
  assert.deepEqual(calls[2], { type: 'remove', input: { repoDir: '/repo', cwd: workspace.cwd, force: true } });
});
