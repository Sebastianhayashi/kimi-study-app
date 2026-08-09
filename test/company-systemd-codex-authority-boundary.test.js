'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');

const { createSystemdCodexAuthorityBoundary } = require('../lib/company/runtime/systemd-codex-authority-boundary');

function tempRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lucubro-systemd-boundary-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function fixture(t) {
  const root = tempRoot(t);
  const cwd = path.join(root, 'workspace');
  const codexInstallRoot = path.join(root, 'npm-global');
  const codexExecutable = path.join(codexInstallRoot, 'bin', 'codex');
  const codexHomeSource = path.join(root, 'source-codex-home');
  const stateRoot = path.join(root, 'authority-state');
  fs.mkdirSync(cwd, { recursive: true });
  fs.mkdirSync(path.dirname(codexExecutable), { recursive: true });
  fs.writeFileSync(codexExecutable, '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  fs.mkdirSync(codexHomeSource, { recursive: true });
  fs.writeFileSync(path.join(codexHomeSource, 'auth.json'), '{"fixture":true}\n', { mode: 0o600 });
  fs.writeFileSync(path.join(codexHomeSource, 'config.toml'), 'model = "gpt-5.6-luna"\n', { mode: 0o600 });
  fs.writeFileSync(path.join(codexHomeSource, 'ignored-secret.txt'), 'do not copy\n', { mode: 0o600 });
  return { root, cwd, codexInstallRoot, codexExecutable, codexHomeSource, stateRoot };
}

function policy(f, overrides = {}) {
  return {
    cwd: f.cwd,
    workspaceKind: 'scratch',
    workspaceRead: true,
    workspaceWrite: true,
    shellExecute: true,
    networkAccess: false,
    gitCommit: false,
    gitPush: false,
    filesystemDestructive: false,
    ...overrides,
  };
}

function fakeSpawn(calls) {
  return (command, args, options) => {
    calls.push({ command, args: [...args], options: structuredClone(options || {}) });
    const child = new EventEmitter();
    child.stdin = new PassThrough();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.killed = false;
    child.kill = () => { child.killed = true; queueMicrotask(() => child.emit('close', 0)); };
    return child;
  };
}

test('attestation accepts isolated scratch/git workspaces but rejects unsupported authority combinations', async (t) => {
  const f = fixture(t);
  const boundary = createSystemdCodexAuthorityBoundary({
    systemdRunBinary: '/run/current-system/sw/bin/systemd-run',
    codexExecutable: f.codexExecutable,
    codexInstallRoot: f.codexInstallRoot,
    codexHomeSource: f.codexHomeSource,
    stateRoot: f.stateRoot,
  });

  const scratch = await boundary.attest({ policy: policy(f) });
  assert.equal(scratch.enforced, true);
  assert.equal(scratch.boundaryId, 'systemd-user-codex-v1');

  const noShell = await boundary.attest({ policy: policy(f, { shellExecute: false }) });
  assert.equal(noShell.enforced, false);
  assert.match(noShell.reason, /shell.execute/i);

  const unsafeRepoNetwork = await boundary.attest({
    policy: policy(f, { workspaceKind: 'git-worktree', networkAccess: true, gitPush: false }),
  });
  assert.equal(unsafeRepoNetwork.enforced, false);
  assert.match(unsafeRepoNetwork.reason, /git push/i);

  const unknownWorkspace = await boundary.attest({ policy: policy(f, { workspaceKind: 'host-directory' }) });
  assert.equal(unknownWorkspace.enforced, false);
  assert.match(unknownWorkspace.reason, /isolated execution workspace/i);
});

test('spawn wraps Codex in a transient systemd user service with only Work and private Codex state writable', async (t) => {
  const f = fixture(t);
  const calls = [];
  const boundary = createSystemdCodexAuthorityBoundary({
    systemdRunBinary: '/run/current-system/sw/bin/systemd-run',
    codexExecutable: f.codexExecutable,
    codexInstallRoot: f.codexInstallRoot,
    codexHomeSource: f.codexHomeSource,
    stateRoot: f.stateRoot,
    spawnImpl: fakeSpawn(calls),
  });
  const activePolicy = policy(f);
  const attestation = await boundary.attest({ policy: activePolicy });
  const child = boundary.spawn({
    command: 'codex',
    args: ['app-server'],
    options: { cwd: f.cwd, stdio: ['pipe', 'pipe', 'pipe'] },
    policy: activePolicy,
    attestation,
  });

  assert.equal(calls.length, 1);
  const call = calls[0];
  assert.equal(call.command, '/run/current-system/sw/bin/systemd-run');
  assert.ok(call.args.includes('--user'));
  assert.ok(call.args.includes('--pipe'));
  assert.ok(call.args.includes('--collect'));
  assert.ok(call.args.includes('--property=NoNewPrivileges=yes'));
  assert.ok(call.args.includes('--property=ProtectSystem=strict'));
  assert.ok(call.args.includes('--property=ProtectHome=tmpfs'));
  assert.ok(call.args.includes('--property=PrivateTmp=yes'));
  assert.ok(call.args.includes('--property=PrivateNetwork=yes'));
  assert.ok(call.args.includes(`--property=BindPaths=${f.cwd}`));
  assert.ok(call.args.includes(`--property=BindReadOnlyPaths=${f.codexInstallRoot}`));
  assert.ok(call.args.some((entry) => entry.startsWith('--setenv=CODEX_HOME=')));
  assert.ok(call.args.some((entry) => entry.startsWith('--setenv=HOME=')));
  assert.equal(call.args.at(-2), f.codexExecutable);
  assert.equal(call.args.at(-1), 'app-server');

  const runStateRoot = fs.readdirSync(f.stateRoot).map((name) => path.join(f.stateRoot, name))[0];
  const isolatedCodexHome = path.join(runStateRoot, 'home', '.codex');
  assert.equal(fs.existsSync(path.join(isolatedCodexHome, 'auth.json')), true);
  assert.equal(fs.existsSync(path.join(isolatedCodexHome, 'config.toml')), true);
  assert.equal(fs.existsSync(path.join(isolatedCodexHome, 'ignored-secret.txt')), false);

  child.emit('close', 0);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(fs.existsSync(runStateRoot), false);
});

test('read-only Work uses a read-only bind and network delegation removes PrivateNetwork', async (t) => {
  const f = fixture(t);
  const calls = [];
  const boundary = createSystemdCodexAuthorityBoundary({
    systemdRunBinary: '/run/current-system/sw/bin/systemd-run',
    codexExecutable: f.codexExecutable,
    codexInstallRoot: f.codexInstallRoot,
    codexHomeSource: f.codexHomeSource,
    stateRoot: f.stateRoot,
    spawnImpl: fakeSpawn(calls),
  });
  const activePolicy = policy(f, { workspaceWrite: false, networkAccess: true });
  const attestation = await boundary.attest({ policy: activePolicy });
  assert.equal(attestation.enforced, true);
  boundary.spawn({
    command: 'codex', args: ['app-server'], options: { cwd: f.cwd }, policy: activePolicy, attestation,
  });

  const args = calls[0].args;
  assert.ok(args.includes(`--property=BindReadOnlyPaths=${f.cwd}`));
  assert.equal(args.includes(`--property=BindPaths=${f.cwd}`), false);
  assert.equal(args.includes('--property=PrivateNetwork=yes'), false);
});

test('boundary refuses any command surface except the configured Codex app-server', async (t) => {
  const f = fixture(t);
  const boundary = createSystemdCodexAuthorityBoundary({
    systemdRunBinary: '/run/current-system/sw/bin/systemd-run',
    codexExecutable: f.codexExecutable,
    codexInstallRoot: f.codexInstallRoot,
    codexHomeSource: f.codexHomeSource,
    stateRoot: f.stateRoot,
    spawnImpl: fakeSpawn([]),
  });
  const activePolicy = policy(f);
  const attestation = await boundary.attest({ policy: activePolicy });

  assert.throws(
    () => boundary.spawn({ command: 'bash', args: ['-lc', 'id'], options: {}, policy: activePolicy, attestation }),
    /only launch Codex app-server/i,
  );
  assert.throws(
    () => boundary.spawn({ command: 'codex', args: ['exec', 'hello'], options: {}, policy: activePolicy, attestation }),
    /only launch Codex app-server/i,
  );
});
