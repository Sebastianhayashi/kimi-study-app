const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

function safeName(value) {
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80);
}

function createWorktreeManager({ execFileImpl = execFileAsync } = {}) {
  async function create({ repoDir, runId, baseRef = 'HEAD' }) {
    if (!path.isAbsolute(repoDir)) throw new Error('repoDir must be an absolute path');
    const runName = safeName(runId);
    const root = path.join(repoDir, '.lucubro', 'worktrees');
    const cwd = path.join(root, runName);
    const branch = `lucubro/run-${runName}`;
    fs.mkdirSync(root, { recursive: true });
    await execFileImpl('git', ['-C', repoDir, 'worktree', 'add', '-b', branch, cwd, baseRef]);
    return { cwd, branch };
  }

  async function inspect({ cwd }) {
    const [{ stdout: trackedDiff = '' }, { stdout: status = '' }, { stdout: untracked = '' }] = await Promise.all([
      execFileImpl('git', ['-C', cwd, 'diff', '--no-ext-diff', '--binary']),
      execFileImpl('git', ['-C', cwd, 'status', '--porcelain']),
      execFileImpl('git', ['-C', cwd, 'ls-files', '--others', '--exclude-standard']),
    ]);
    const changedFiles = status.split('\n').filter(Boolean).map((line) => line.slice(3).trim());
    const patches = [trackedDiff];
    for (const relative of untracked.split('\n').filter(Boolean)) {
      const absolute = path.join(cwd, relative);
      try {
        const { stdout = '' } = await execFileImpl('git', ['diff', '--no-index', '--binary', '--', '/dev/null', absolute]);
        patches.push(stdout);
      } catch (error) {
        if (error && error.code === 1 && typeof error.stdout === 'string') patches.push(error.stdout);
        else throw error;
      }
    }
    return { diff: patches.filter(Boolean).join('\n'), changedFiles };
  }

  async function remove({ repoDir, cwd, force = true }) {
    const args = ['-C', repoDir, 'worktree', 'remove'];
    if (force) args.push('--force');
    args.push(cwd);
    await execFileImpl('git', args);
  }

  return { create, inspect, remove };
}

module.exports = { createWorktreeManager };
