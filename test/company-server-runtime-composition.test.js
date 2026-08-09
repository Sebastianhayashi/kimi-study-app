'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createCompanyServer } = require('../company-server');

function tempRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lucubro-server-runtime-composition-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function pdfRenderer() {
  return {
    available() { return { available: false, reason: 'fixture' }; },
    async render() { throw new Error('not used'); },
  };
}

function runtime(kind) {
  return {
    kind,
    async available() { return { available: true, kind }; },
    async *run() { yield { type: 'run.completed' }; },
  };
}

test('default Company server composition binds exact admission receipt and concrete systemd boundary to Luna-only registry', (t) => {
  const dataDir = tempRoot(t);
  const boundary = {
    async attest() { return { enforced: true, boundaryId: 'systemd-user-codex-v1' }; },
    spawn() { throw new Error('not used'); },
  };
  const registry = new Map([
    ['codex', runtime('codex')],
    ['claude-code', runtime('blocked-claude')],
  ]);
  const authorityCalls = [];
  const registryCalls = [];
  const environment = {
    LUCUBRO_ENABLE_REAL_RUNTIMES: '1',
    LUCUBRO_CODEX_ADMISSION_FILE: '/home/yuyu/.wrp/lucubro/codex-admission.json',
    LUCUBRO_BUILD_REPO: 'Sebastianhayashi/lucubro',
    LUCUBRO_BUILD_COMMIT: '0123456789abcdef0123456789abcdef01234567',
    LUCUBRO_SYSTEMD_RUN_BINARY: '/run/current-system/sw/bin/systemd-run',
    LUCUBRO_CODEX_EXECUTABLE: '/home/yuyu/.local/share/npm-global/bin/codex',
    LUCUBRO_CODEX_INSTALL_ROOT: '/home/yuyu/.local/share/npm-global',
    LUCUBRO_CODEX_HOME_SOURCE: '/home/yuyu/.codex',
    PATH: '/run/current-system/sw/bin:/home/yuyu/.local/share/npm-global/bin',
  };

  const instance = createCompanyServer({
    dataDir,
    environment,
    canvasPdfRenderer: pdfRenderer(),
    createSystemdAuthorityBoundary(input) {
      authorityCalls.push(structuredClone(input));
      return boundary;
    },
    createDefaultRuntimeRegistry(input) {
      registryCalls.push({ ...input, codexAuthorityBoundary: input.codexAuthorityBoundary });
      return {
        registry,
        admission: {
          admitted: true,
          profileName: 'Luna Max',
          modelId: 'gpt-5.6-luna',
          providerPermissionProfileId: ':danger-full-access',
        },
      };
    },
  });

  assert.equal(authorityCalls.length, 1);
  assert.deepEqual(authorityCalls[0], {
    systemdRunBinary: environment.LUCUBRO_SYSTEMD_RUN_BINARY,
    codexExecutable: environment.LUCUBRO_CODEX_EXECUTABLE,
    codexInstallRoot: environment.LUCUBRO_CODEX_INSTALL_ROOT,
    codexHomeSource: environment.LUCUBRO_CODEX_HOME_SOURCE,
    stateRoot: path.join(dataDir, 'codex-authority'),
    runtimePath: environment.PATH,
  });
  assert.equal(registryCalls.length, 1);
  assert.equal(registryCalls[0].enableRealRuntimes, true);
  assert.equal(registryCalls[0].codexAdmissionFile, environment.LUCUBRO_CODEX_ADMISSION_FILE);
  assert.equal(registryCalls[0].expectedRepo, 'Sebastianhayashi/lucubro');
  assert.equal(registryCalls[0].expectedCommit, environment.LUCUBRO_BUILD_COMMIT);
  assert.equal(registryCalls[0].codexAuthorityBoundary, boundary);
  assert.equal(instance.runtimeRegistry, registry);
  assert.equal(instance.codexAdmission.admitted, true);
  assert.equal(instance.codexAdmission.modelId, 'gpt-5.6-luna');
});

test('real runtime exposure stays disabled when concrete authority machine configuration is incomplete', (t) => {
  const dataDir = tempRoot(t);
  const registryCalls = [];
  let authorityCalls = 0;
  const environment = {
    LUCUBRO_ENABLE_REAL_RUNTIMES: '1',
    LUCUBRO_CODEX_ADMISSION_FILE: '/home/yuyu/.wrp/lucubro/codex-admission.json',
    LUCUBRO_BUILD_REPO: 'Sebastianhayashi/lucubro',
    LUCUBRO_BUILD_COMMIT: '0123456789abcdef0123456789abcdef01234567',
    LUCUBRO_SYSTEMD_RUN_BINARY: '/run/current-system/sw/bin/systemd-run',
    LUCUBRO_CODEX_EXECUTABLE: '/home/yuyu/.local/share/npm-global/bin/codex',
    LUCUBRO_CODEX_INSTALL_ROOT: '/home/yuyu/.local/share/npm-global',
    // LUCUBRO_CODEX_HOME_SOURCE is intentionally absent.
    PATH: '/run/current-system/sw/bin:/home/yuyu/.local/share/npm-global/bin',
  };

  createCompanyServer({
    dataDir,
    environment,
    canvasPdfRenderer: pdfRenderer(),
    createSystemdAuthorityBoundary() {
      authorityCalls += 1;
      throw new Error('must not construct an incomplete authority boundary');
    },
    createDefaultRuntimeRegistry(input) {
      registryCalls.push(input);
      return {
        registry: new Map(),
        admission: { admitted: false, profileName: 'Luna Max' },
      };
    },
  });

  assert.equal(authorityCalls, 0);
  assert.equal(registryCalls.length, 1);
  assert.equal(registryCalls[0].enableRealRuntimes, false);
  assert.equal(registryCalls[0].codexAuthorityBoundary, null);
});

test('explicit runtime injection remains a test/product seam and bypasses default real-runtime composition', (t) => {
  const dataDir = tempRoot(t);
  const injected = new Map([['mock', runtime('mock')]]);
  let authorityCalls = 0;
  let registryCalls = 0;

  const instance = createCompanyServer({
    dataDir,
    runtimes: injected,
    environment: { LUCUBRO_ENABLE_REAL_RUNTIMES: '1' },
    canvasPdfRenderer: pdfRenderer(),
    createSystemdAuthorityBoundary() {
      authorityCalls += 1;
      throw new Error('must not construct authority for explicit runtimes');
    },
    createDefaultRuntimeRegistry() {
      registryCalls += 1;
      throw new Error('must not construct default registry for explicit runtimes');
    },
  });

  assert.equal(instance.runtimeRegistry, injected);
  assert.equal(instance.codexAdmission, null);
  assert.equal(authorityCalls, 0);
  assert.equal(registryCalls, 0);
});
