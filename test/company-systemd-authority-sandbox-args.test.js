'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildSystemdSandboxArgs } = require('../lib/company/runtime/systemd-codex-authority-boundary');

test('shared systemd sandbox builder encodes filesystem, network, environment, and fixed executable boundaries', () => {
  const args = buildSystemdSandboxArgs({
    cwd: '/work/lucubro-run',
    workspaceWrite: false,
    networkAccess: false,
    readOnlyBinds: ['/opt/codex'],
    readWriteBinds: ['/run/user/1000/lucubro-state'],
    privateHome: '/run/user/1000/lucubro-state/home',
    privateCodexHome: '/run/user/1000/lucubro-state/home/.codex',
    runtimePath: '/nix/profile/bin:/run/current-system/sw/bin',
    executable: '/nix/store/node/bin/node',
    executableArgs: ['probe.js', '--fixed'],
  });

  assert.ok(args.includes('--user'));
  assert.ok(args.includes('--pipe'));
  assert.ok(args.includes('--collect'));
  assert.ok(args.includes('--property=NoNewPrivileges=yes'));
  assert.ok(args.includes('--property=ProtectSystem=strict'));
  assert.ok(args.includes('--property=ProtectHome=tmpfs'));
  assert.ok(args.includes('--property=PrivateTmp=yes'));
  assert.ok(args.includes('--property=PrivateNetwork=yes'));
  assert.ok(args.includes('--property=UMask=0077'));
  assert.ok(args.includes('--working-directory=/work/lucubro-run'));
  assert.ok(args.includes('--property=BindReadOnlyPaths=/work/lucubro-run'));
  assert.ok(args.includes('--property=BindReadOnlyPaths=/opt/codex'));
  assert.ok(args.includes('--property=BindPaths=/run/user/1000/lucubro-state'));
  assert.ok(args.includes('--setenv=HOME=/run/user/1000/lucubro-state/home'));
  assert.ok(args.includes('--setenv=CODEX_HOME=/run/user/1000/lucubro-state/home/.codex'));
  assert.ok(args.includes('--setenv=PATH=/nix/profile/bin:/run/current-system/sw/bin'));
  assert.ok(args.includes('--setenv=GH_TOKEN='));
  assert.ok(args.includes('--setenv=GITHUB_TOKEN='));
  assert.equal(args.some((entry) => entry.startsWith('--property=RuntimeMaxSec=')), false);
  assert.deepEqual(args.slice(-3), ['/nix/store/node/bin/node', 'probe.js', '--fixed']);
});

test('shared systemd sandbox builder uses a writable Work bind and host network only when policy delegates them', () => {
  const args = buildSystemdSandboxArgs({
    cwd: '/work/lucubro-run',
    workspaceWrite: true,
    networkAccess: true,
    readOnlyBinds: [],
    readWriteBinds: ['/run/user/1000/lucubro-state'],
    privateHome: '/run/user/1000/lucubro-state/home',
    privateCodexHome: '/run/user/1000/lucubro-state/home/.codex',
    runtimePath: '/run/current-system/sw/bin',
    executable: '/run/current-system/sw/bin/true',
    executableArgs: [],
  });

  assert.ok(args.includes('--property=BindPaths=/work/lucubro-run'));
  assert.equal(args.includes('--property=BindReadOnlyPaths=/work/lucubro-run'), false);
  assert.equal(args.includes('--property=PrivateNetwork=yes'), false);
});

test('probe-only runtime limit is explicit, bounded, and does not change the production default', () => {
  const args = buildSystemdSandboxArgs({
    cwd: '/work/lucubro-run',
    workspaceWrite: true,
    networkAccess: false,
    readOnlyBinds: [],
    readWriteBinds: ['/run/user/1000/lucubro-state'],
    privateHome: '/run/user/1000/lucubro-state/home',
    privateCodexHome: '/run/user/1000/lucubro-state/home/.codex',
    runtimePath: '/run/current-system/sw/bin',
    runtimeMaxSec: 12,
    executable: '/run/current-system/sw/bin/true',
    executableArgs: [],
  });

  assert.ok(args.includes('--property=RuntimeMaxSec=12s'));
  assert.throws(() => buildSystemdSandboxArgs({
    cwd: '/work/lucubro-run',
    workspaceWrite: true,
    networkAccess: false,
    readOnlyBinds: [],
    readWriteBinds: [],
    privateHome: '/run/user/1000/lucubro-state/home',
    privateCodexHome: '/run/user/1000/lucubro-state/home/.codex',
    runtimePath: '/run/current-system/sw/bin',
    runtimeMaxSec: 0,
    executable: '/run/current-system/sw/bin/true',
    executableArgs: [],
  }), /runtimeMaxSec/i);
});
