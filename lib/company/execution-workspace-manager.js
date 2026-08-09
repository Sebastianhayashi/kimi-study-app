'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SAFE_RUN_ID = /^[a-zA-Z0-9_-]+$/;

function assertRunId(runId) {
  const value = typeof runId === 'string' ? runId.trim() : '';
  if (!value || !SAFE_RUN_ID.test(value)) throw new Error(`Invalid execution workspace runId: ${runId}`);
  return value;
}

function createExecutionWorkspaceManager({ rootDir, gitWorktreeManager = null } = {}) {
  if (!rootDir) throw new Error('Execution workspace manager rootDir is required');
  const scratchRoot = path.join(rootDir, 'execution-workspaces');
  fs.mkdirSync(scratchRoot, { recursive: true });

  async function create({ repoDir = null, runId, baseRef = 'HEAD' } = {}) {
    const normalizedRunId = assertRunId(runId);
    if (repoDir) {
      if (!gitWorktreeManager || typeof gitWorktreeManager.create !== 'function') {
        throw new Error('Git worktree manager is required for repo-backed execution');
      }
      const created = await gitWorktreeManager.create({ repoDir, runId: normalizedRunId, baseRef });
      return {
        kind: 'git-worktree',
        repoDir,
        cwd: created.cwd,
        branch: created.branch || null,
      };
    }

    const cwd = path.join(scratchRoot, normalizedRunId);
    if (fs.existsSync(cwd)) throw new Error(`Execution workspace already exists: ${normalizedRunId}`);
    fs.mkdirSync(cwd, { recursive: false });
    return {
      kind: 'scratch',
      repoDir: null,
      cwd,
      branch: null,
    };
  }

  async function inspect(workspace = {}) {
    if (workspace.kind === 'git-worktree') {
      if (!gitWorktreeManager || typeof gitWorktreeManager.inspect !== 'function') {
        throw new Error('Git worktree manager is required for repo-backed inspection');
      }
      return gitWorktreeManager.inspect({ cwd: workspace.cwd });
    }
    if (workspace.kind === 'scratch') return { diff: '', changedFiles: [] };
    throw new Error(`Unknown execution workspace kind: ${workspace.kind}`);
  }

  async function remove(workspace = {}) {
    if (workspace.kind === 'git-worktree') {
      if (!gitWorktreeManager || typeof gitWorktreeManager.remove !== 'function') {
        throw new Error('Git worktree manager is required for repo-backed removal');
      }
      return gitWorktreeManager.remove({ repoDir: workspace.repoDir, cwd: workspace.cwd, force: true });
    }
    if (workspace.kind === 'scratch') {
      fs.rmSync(workspace.cwd, { recursive: true, force: true });
      return;
    }
    throw new Error(`Unknown execution workspace kind: ${workspace.kind}`);
  }

  return { create, inspect, remove };
}

module.exports = {
  createExecutionWorkspaceManager,
};
