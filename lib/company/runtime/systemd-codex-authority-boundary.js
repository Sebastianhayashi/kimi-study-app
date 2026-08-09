'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ISOLATED_WORKSPACE_KINDS = new Set(['scratch', 'git-worktree']);
const CODEX_HOME_FILES = Object.freeze(['auth.json', 'config.toml', 'models_cache.json']);

function text(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function absolutePath(value, label) {
  const normalized = text(value);
  if (!normalized || !path.isAbsolute(normalized)) throw new Error(`${label} must be an absolute path.`);
  return path.resolve(normalized);
}

function existingAbsolutePath(value, label, { directory = false, executable = false } = {}) {
  const normalized = absolutePath(value, label);
  if (!fs.existsSync(normalized)) throw new Error(`${label} does not exist: ${normalized}`);
  const stat = fs.statSync(normalized);
  if (directory && !stat.isDirectory()) throw new Error(`${label} must be a directory: ${normalized}`);
  if (executable) fs.accessSync(normalized, fs.constants.X_OK);
  return normalized;
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function copyCodexHome({ sourceRoot, destinationRoot }) {
  fs.mkdirSync(destinationRoot, { recursive: true, mode: 0o700 });
  for (const name of CODEX_HOME_FILES) {
    const source = path.join(sourceRoot, name);
    if (!fs.existsSync(source)) continue;
    const resolved = fs.realpathSync(source);
    if (!isInside(sourceRoot, resolved)) {
      throw new Error(`Codex home file escapes configured source root: ${name}`);
    }
    const stat = fs.statSync(resolved);
    if (!stat.isFile()) continue;
    const destination = path.join(destinationRoot, name);
    fs.copyFileSync(resolved, destination);
    fs.chmodSync(destination, 0o600);
  }
  if (!fs.existsSync(path.join(destinationRoot, 'auth.json'))) {
    throw new Error('Codex authority boundary requires auth.json in the configured Codex home source.');
  }
}

function safeUnitEnvironment({ privateHome, privateCodexHome, runtimePath }) {
  return [
    `--setenv=HOME=${absolutePath(privateHome, 'Private HOME')}`,
    `--setenv=CODEX_HOME=${absolutePath(privateCodexHome, 'Private CODEX_HOME')}`,
    `--setenv=PATH=${text(runtimePath) || '/run/current-system/sw/bin:/usr/bin:/bin'}`,
    '--setenv=GH_TOKEN=',
    '--setenv=GITHUB_TOKEN=',
    '--setenv=SSH_AUTH_SOCK=',
    '--setenv=GIT_ASKPASS=',
    '--setenv=GIT_TERMINAL_PROMPT=0',
  ];
}

function buildSystemdSandboxArgs({
  cwd,
  workspaceWrite = false,
  networkAccess = false,
  readOnlyBinds = [],
  readWriteBinds = [],
  privateHome,
  privateCodexHome,
  runtimePath,
  executable,
  executableArgs = [],
} = {}) {
  const workDir = absolutePath(cwd, 'Systemd sandbox cwd');
  const command = absolutePath(executable, 'Systemd sandbox executable');
  if (!Array.isArray(readOnlyBinds) || !Array.isArray(readWriteBinds) || !Array.isArray(executableArgs)) {
    throw new Error('Systemd sandbox bind lists and executableArgs must be arrays.');
  }
  return [
    '--user',
    '--pipe',
    '--collect',
    '--property=NoNewPrivileges=yes',
    '--property=ProtectSystem=strict',
    '--property=ProtectHome=tmpfs',
    '--property=PrivateTmp=yes',
    '--property=UMask=0077',
    `--working-directory=${workDir}`,
    ...readOnlyBinds.map((entry) => `--property=BindReadOnlyPaths=${absolutePath(entry, 'Read-only bind')}`),
    ...readWriteBinds.map((entry) => `--property=BindPaths=${absolutePath(entry, 'Read-write bind')}`),
    workspaceWrite
      ? `--property=BindPaths=${workDir}`
      : `--property=BindReadOnlyPaths=${workDir}`,
    ...(networkAccess ? [] : ['--property=PrivateNetwork=yes']),
    ...safeUnitEnvironment({ privateHome, privateCodexHome, runtimePath }),
    command,
    ...executableArgs.map((entry) => String(entry)),
  ];
}

function createSystemdCodexAuthorityBoundary({
  systemdRunBinary,
  codexExecutable,
  codexInstallRoot,
  codexHomeSource,
  stateRoot,
  runtimePath = process.env.PATH || '/run/current-system/sw/bin:/usr/bin:/bin',
  spawnImpl = spawn,
  createId = () => crypto.randomUUID(),
} = {}) {
  const systemdRun = existingAbsolutePath(systemdRunBinary, 'systemd-run binary', { executable: true });
  const codexBin = existingAbsolutePath(codexExecutable, 'Codex executable', { executable: true });
  const installRoot = existingAbsolutePath(codexInstallRoot, 'Codex install root', { directory: true });
  const sourceHome = existingAbsolutePath(codexHomeSource, 'Codex home source', { directory: true });
  const authorityStateRoot = absolutePath(stateRoot, 'Codex authority stateRoot');
  fs.mkdirSync(authorityStateRoot, { recursive: true, mode: 0o700 });
  fs.chmodSync(authorityStateRoot, 0o700);
  if (!isInside(installRoot, codexBin)) throw new Error('Codex executable must live inside codexInstallRoot.');
  if (typeof spawnImpl !== 'function') throw new Error('Codex authority boundary spawnImpl must be a function.');
  if (typeof createId !== 'function') throw new Error('Codex authority boundary createId must be a function.');
  const unitPath = text(runtimePath) || '/run/current-system/sw/bin:/usr/bin:/bin';

  async function attest({ policy } = {}) {
    if (!policy || typeof policy !== 'object') return { enforced: false, reason: 'Authority policy is required.' };
    if (!ISOLATED_WORKSPACE_KINDS.has(policy.workspaceKind)) {
      return { enforced: false, reason: 'Real Codex requires a Lucubro isolated execution workspace.' };
    }
    if (!policy.workspaceRead) {
      return { enforced: false, reason: 'Real Codex V1 requires workspace.read for its isolated execution workspace.' };
    }
    if (!policy.shellExecute) {
      return { enforced: false, reason: 'Real Codex V1 cannot yet prove shell.execute denial under provider full access.' };
    }
    if (policy.workspaceKind === 'git-worktree' && policy.networkAccess && !policy.gitPush) {
      return {
        enforced: false,
        reason: 'Repo Work with network access and denied git push is blocked until Lucubro can prove push-specific network isolation.',
      };
    }
    try {
      existingAbsolutePath(policy.cwd, 'Authority Work cwd', { directory: true });
      fs.accessSync(path.join(sourceHome, 'auth.json'), fs.constants.R_OK);
    } catch (error) {
      return { enforced: false, reason: error.message };
    }
    return {
      enforced: true,
      boundaryId: 'systemd-user-codex-v1',
      workspaceKind: policy.workspaceKind,
      workspaceMode: policy.workspaceWrite ? 'read-write' : 'read-only',
      networkMode: policy.networkAccess ? 'host-network' : 'private-network',
      providerHomeMode: 'isolated-copy',
    };
  }

  function spawnCodex({ command, args, options = {}, policy, attestation } = {}) {
    if (command !== 'codex' || !Array.isArray(args) || args.length !== 1 || args[0] !== 'app-server') {
      throw new Error('Systemd authority boundary may only launch Codex app-server.');
    }
    if (!attestation || attestation.enforced !== true || attestation.boundaryId !== 'systemd-user-codex-v1') {
      throw new Error('Systemd authority boundary requires a successful attestation.');
    }
    const cwd = existingAbsolutePath(policy && policy.cwd, 'Authority Work cwd', { directory: true });
    const runStateRoot = path.join(authorityStateRoot, `run-${createId()}`);
    const privateHome = path.join(runStateRoot, 'home');
    const privateCodexHome = path.join(privateHome, '.codex');
    fs.mkdirSync(privateHome, { recursive: true, mode: 0o700 });
    copyCodexHome({ sourceRoot: sourceHome, destinationRoot: privateCodexHome });

    const systemdArgs = buildSystemdSandboxArgs({
      cwd,
      workspaceWrite: Boolean(policy.workspaceWrite),
      networkAccess: Boolean(policy.networkAccess),
      readOnlyBinds: [installRoot],
      readWriteBinds: [runStateRoot],
      privateHome,
      privateCodexHome,
      runtimePath: unitPath,
      executable: codexBin,
      executableArgs: ['app-server'],
    });

    const child = spawnImpl(systemdRun, systemdArgs, {
      cwd,
      stdio: options.stdio || ['pipe', 'pipe', 'pipe'],
      env: {
        PATH: process.env.PATH || '/run/current-system/sw/bin:/usr/bin:/bin',
        HOME: process.env.HOME || '',
        USER: process.env.USER || '',
        LOGNAME: process.env.LOGNAME || process.env.USER || '',
      },
    });
    let cleaned = false;
    function cleanup() {
      if (cleaned) return;
      cleaned = true;
      fs.rmSync(runStateRoot, { recursive: true, force: true });
    }
    child.once?.('close', cleanup);
    child.once?.('error', cleanup);
    return child;
  }

  return {
    attest,
    spawn: spawnCodex,
  };
}

module.exports = {
  CODEX_HOME_FILES,
  ISOLATED_WORKSPACE_KINDS,
  buildSystemdSandboxArgs,
  copyCodexHome,
  createSystemdCodexAuthorityBoundary,
  safeUnitEnvironment,
};
