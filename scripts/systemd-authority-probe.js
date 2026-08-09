#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { buildSystemdSandboxArgs } = require('../lib/company/runtime/systemd-codex-authority-boundary');

function text(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function parseArgs(argv) {
  const result = {
    systemdRun: null,
    workspaceRoot: null,
    stateRoot: null,
    protectedRoot: null,
    gitExecutable: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--systemd-run') result.systemdRun = argv[++index];
    else if (arg === '--workspace-root') result.workspaceRoot = argv[++index];
    else if (arg === '--state-root') result.stateRoot = argv[++index];
    else if (arg === '--protected-root') result.protectedRoot = argv[++index];
    else if (arg === '--git') result.gitExecutable = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return result;
}

function absoluteExistingExecutable(value, label) {
  const resolved = path.resolve(text(value) || '');
  if (!text(value) || !path.isAbsolute(value)) throw new Error(`${label} must be an absolute path.`);
  fs.accessSync(resolved, fs.constants.X_OK);
  return resolved;
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env || process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout = `${stdout}${chunk}`.slice(-12000); });
    child.stderr.on('data', (chunk) => { stderr = `${stderr}${chunk}`.slice(-12000); });
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
}

function privatePaths(stateRoot, name) {
  const root = path.join(stateRoot, name);
  const home = path.join(root, 'home');
  const codexHome = path.join(home, '.codex');
  fs.mkdirSync(codexHome, { recursive: true, mode: 0o700 });
  return { root, home, codexHome };
}

async function runSandbox({
  systemdRun,
  workspace,
  stateRoot,
  name,
  networkAccess,
  executable,
  executableArgs,
}) {
  const privateState = privatePaths(stateRoot, name);
  const args = buildSystemdSandboxArgs({
    cwd: workspace,
    workspaceWrite: true,
    networkAccess,
    readOnlyBinds: [],
    readWriteBinds: [privateState.root],
    privateHome: privateState.home,
    privateCodexHome: privateState.codexHome,
    runtimePath: process.env.PATH || '/run/current-system/sw/bin',
    executable,
    executableArgs,
  });
  return run(systemdRun, args, {
    cwd: workspace,
    env: {
      PATH: process.env.PATH || '/run/current-system/sw/bin',
      HOME: process.env.HOME || os.homedir(),
      USER: process.env.USER || '',
      LOGNAME: process.env.LOGNAME || process.env.USER || '',
    },
  });
}

function runSyncGit(git, args, cwd) {
  const { spawnSync } = require('node:child_process');
  const result = spawnSync(git, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `git exited ${result.status}`);
  return result.stdout;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const systemdRun = absoluteExistingExecutable(args.systemdRun, 'systemd-run');
  const git = absoluteExistingExecutable(args.gitExecutable, 'git');
  const workspaceRoot = path.resolve(text(args.workspaceRoot) || '');
  const stateRoot = path.resolve(text(args.stateRoot) || '');
  const protectedRoot = path.resolve(text(args.protectedRoot) || '');
  for (const [label, value] of [['workspaceRoot', args.workspaceRoot], ['stateRoot', args.stateRoot], ['protectedRoot', args.protectedRoot]]) {
    if (!text(value) || !path.isAbsolute(value)) throw new Error(`${label} must be an absolute path.`);
  }

  fs.rmSync(workspaceRoot, { recursive: true, force: true });
  fs.rmSync(stateRoot, { recursive: true, force: true });
  fs.rmSync(protectedRoot, { recursive: true, force: true });
  fs.mkdirSync(workspaceRoot, { recursive: true, mode: 0o700 });
  fs.mkdirSync(stateRoot, { recursive: true, mode: 0o700 });
  fs.mkdirSync(protectedRoot, { recursive: true, mode: 0o700 });

  const sentinel = path.join(protectedRoot, 'sentinel.txt');
  fs.writeFileSync(sentinel, 'protected-host-state\n', { mode: 0o600 });
  const originalSentinel = fs.readFileSync(sentinel, 'utf8');

  const escape = await runSandbox({
    systemdRun,
    workspace: workspaceRoot,
    stateRoot,
    name: 'workspace-escape',
    networkAccess: false,
    executable: process.execPath,
    executableArgs: [
      '-e',
      "const fs=require('node:fs');try{fs.writeFileSync(process.argv[1],'mutated\\n');process.exit(51)}catch(e){process.stdout.write(String(e.code||e.name));process.exit(0)}",
      sentinel,
    ],
  });
  const workspaceEscapeBlocked = escape.code === 0 && fs.readFileSync(sentinel, 'utf8') === originalSentinel;

  const destructive = await runSandbox({
    systemdRun,
    workspace: workspaceRoot,
    stateRoot,
    name: 'destructive',
    networkAccess: false,
    executable: process.execPath,
    executableArgs: [
      '-e',
      "const fs=require('node:fs');try{fs.unlinkSync(process.argv[1]);process.exit(52)}catch(e){process.stdout.write(String(e.code||e.name));process.exit(0)}",
      sentinel,
    ],
  });
  const destructiveDenyBlocked = destructive.code === 0
    && fs.existsSync(sentinel)
    && fs.readFileSync(sentinel, 'utf8') === originalSentinel;

  let hostAcceptedConnection = false;
  const server = net.createServer((socket) => {
    hostAcceptedConnection = true;
    socket.destroy();
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  let network;
  try {
    network = await runSandbox({
      systemdRun,
      workspace: workspaceRoot,
      stateRoot,
      name: 'network',
      networkAccess: false,
      executable: process.execPath,
      executableArgs: [
        '-e',
        "const net=require('node:net');const s=net.createConnection({host:'127.0.0.1',port:Number(process.argv[1])});let done=false;const finish=(code)=>{if(done)return;done=true;s.destroy();process.exit(code)};s.once('connect',()=>finish(61));s.once('error',()=>finish(0));setTimeout(()=>finish(0),1000)",
        String(port),
      ],
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  const networkDenyBlocked = network.code === 0 && hostAcceptedConnection === false;

  const gitWorkspace = path.join(workspaceRoot, 'git-workspace');
  const bareRemote = path.join(protectedRoot, 'remote.git');
  fs.mkdirSync(gitWorkspace, { recursive: true });
  runSyncGit(git, ['init', '--bare', bareRemote], workspaceRoot);
  runSyncGit(git, ['init'], gitWorkspace);
  runSyncGit(git, ['config', 'user.email', 'probe@lucubro.invalid'], gitWorkspace);
  runSyncGit(git, ['config', 'user.name', 'Lucubro Probe'], gitWorkspace);
  fs.writeFileSync(path.join(gitWorkspace, 'probe.txt'), 'probe\n', 'utf8');
  runSyncGit(git, ['add', 'probe.txt'], gitWorkspace);
  runSyncGit(git, ['commit', '-m', 'probe'], gitWorkspace);
  runSyncGit(git, ['remote', 'add', 'origin', `file://${bareRemote}`], gitWorkspace);
  const push = await runSandbox({
    systemdRun,
    workspace: gitWorkspace,
    stateRoot,
    name: 'git-push',
    networkAccess: false,
    executable: git,
    executableArgs: ['push', 'origin', 'HEAD:refs/heads/probe'],
  });
  const showRef = require('node:child_process').spawnSync(git, ['--git-dir', bareRemote, 'show-ref', '--verify', '--quiet', 'refs/heads/probe']);
  const gitPushDenyBlocked = push.code !== 0 && showRef.status !== 0;

  const probes = {
    workspaceEscapeBlocked,
    networkDenyBlocked,
    destructiveDenyBlocked,
    gitPushDenyBlocked,
  };
  const result = {
    kind: 'lucubro-systemd-authority-probe',
    boundaryId: 'systemd-user-codex-v1',
    enforced: Object.values(probes).every(Boolean),
    probes,
    observations: {
      workspaceEscapeExit: escape.code,
      destructiveExit: destructive.code,
      networkExit: network.code,
      gitPushExit: push.code,
    },
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.enforced) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${error && error.stack || error}\n`);
  process.exitCode = 1;
});
