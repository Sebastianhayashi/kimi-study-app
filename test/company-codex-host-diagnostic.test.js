'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { PassThrough, Writable } = require('node:stream');

const {
  inspectCodexHost,
  inspectSkillBundleMaterializations,
} = require('../lib/company/runtime/codex-host-diagnostic');
const { createSkillBundleStore } = require('../lib/company/skill-bundle-store');
const { createSkillBundleMaterializer } = require('../lib/company/skill-bundle-materializer');
const { APPROVED_SKILL_BUNDLE_MANIFESTS } = require('../lib/company/skill-bundle-providers');

const DEFAULT_MODELS = [
  {
    id: 'luna-real-id',
    model: 'luna-provider-slug',
    displayName: 'Luna Max',
    isDefault: false,
    defaultServiceTier: null,
    additionalSpeedTiers: ['fast'],
    serviceTiers: [{ id: 'fast', name: 'Fast' }],
  },
  {
    id: 'other-id',
    model: 'other-provider-slug',
    displayName: 'Other Model',
    isDefault: true,
  },
];

function fakeAppServer({ models = DEFAULT_MODELS } = {}) {
  const calls = [];
  const process = new EventEmitter();
  process.stdout = new PassThrough();
  process.stderr = new PassThrough();
  process.killed = false;
  process.kill = () => {
    process.killed = true;
    queueMicrotask(() => process.emit('close', 0));
  };
  process.stdin = new Writable({
    write(chunk, _encoding, callback) {
      for (const line of String(chunk).split('\n').filter(Boolean)) {
        const message = JSON.parse(line);
        calls.push(message);
        if (message.id == null) continue;
        let result;
        if (message.method === 'initialize') {
          result = {
            userAgent: 'codex-cli/fixture',
            codexHome: '/home/fixture/.codex',
            platformFamily: 'unix',
            platformOs: 'linux',
          };
        } else if (message.method === 'model/list') {
          result = { data: models };
        } else if (message.method === 'config/read') {
          result = {
            config: {
              model: 'luna-real-id',
              model_provider: 'openai',
              service_tier: null,
              api_key: 'must-not-leak',
            },
          };
        } else if (message.method === 'permissionProfile/list') {
          result = {
            data: [
              { id: ':read-only', description: 'Read only', allowed: true },
              { id: ':danger-full-access', description: 'Full access', allowed: true },
            ],
          };
        } else {
          callback(new Error(`Unexpected diagnostic RPC: ${message.method}`));
          return;
        }
        process.stdout.write(`${JSON.stringify({ id: message.id, result })}\n`);
      }
      callback();
    },
  });
  return {
    calls,
    spawnImpl(command, args) {
      assert.equal(command, 'codex');
      assert.deepEqual(args, ['app-server']);
      return process;
    },
  };
}

test('host diagnostic discovers Luna/config/permission profiles without starting any thread or model turn', async () => {
  const fake = fakeAppServer();
  const result = await inspectCodexHost({
    cwd: '/work/lucubro',
    spawnImpl: fake.spawnImpl,
    now: () => '2026-08-09T14:00:00.000Z',
  });

  assert.equal(result.kind, 'lucubro-codex-host-diagnostic');
  assert.equal(result.observedAt, '2026-08-09T14:00:00.000Z');
  assert.deepEqual(result.appServer, {
    userAgent: 'codex-cli/fixture',
    platformFamily: 'unix',
    platformOs: 'linux',
  });
  assert.deepEqual(result.lunaMax, {
    uniqueMatch: true,
    modelId: 'luna-real-id',
    model: 'luna-provider-slug',
    displayName: 'Luna Max',
    isDefault: false,
    defaultServiceTier: null,
    additionalSpeedTiers: ['fast'],
    serviceTierIds: ['fast'],
  });
  assert.deepEqual(result.effectiveConfig, {
    modelId: 'luna-real-id',
    modelProvider: 'openai',
    serviceTier: null,
  });
  assert.deepEqual(result.permissionProfiles, [
    { id: ':danger-full-access', description: 'Full access', allowed: true },
    { id: ':read-only', description: 'Read only', allowed: true },
  ]);
  assert.equal(JSON.stringify(result).includes('must-not-leak'), false);
  assert.deepEqual(fake.calls.map((call) => call.method), [
    'initialize',
    'initialized',
    'model/list',
    'config/read',
    'permissionProfile/list',
  ]);
  assert.equal(fake.calls.some((call) => call.method === 'thread/start'), false);
  assert.equal(fake.calls.some((call) => call.method === 'turn/start'), false);
});

test('host diagnostic binds the Luna Max operator profile to the exact trusted provider model id, not provider display text', async () => {
  const fake = fakeAppServer({
    models: [
      {
        id: 'gpt-5.6-luna',
        model: 'gpt-5.6-luna',
        displayName: 'GPT-5.6-Luna',
        isDefault: false,
        defaultServiceTier: 'priority',
        additionalSpeedTiers: ['fast'],
        serviceTiers: [{ id: 'priority', name: 'Priority' }],
      },
      { id: 'other-id', model: 'other-id', displayName: 'Other Model' },
    ],
  });
  const result = await inspectCodexHost({
    cwd: '/work/lucubro',
    expectedModelId: 'gpt-5.6-luna',
    spawnImpl: fake.spawnImpl,
    now: () => '2026-08-09T14:00:00.000Z',
  });

  assert.deepEqual(result.lunaMax, {
    uniqueMatch: true,
    modelId: 'gpt-5.6-luna',
    model: 'gpt-5.6-luna',
    displayName: 'GPT-5.6-Luna',
    isDefault: false,
    defaultServiceTier: 'priority',
    additionalSpeedTiers: ['fast'],
    serviceTierIds: ['priority'],
  });
});

test('host diagnostic refuses to invent a Luna model id when catalog match is ambiguous', async () => {
  const fake = fakeAppServer({
    models: [
      { id: 'luna-a', model: 'luna-a', displayName: 'Luna Max' },
      { id: 'luna-b', model: 'luna-b', displayName: 'Luna Max' },
    ],
  });
  const result = await inspectCodexHost({
    cwd: '/work/lucubro',
    spawnImpl: fake.spawnImpl,
    now: () => '2026-08-09T14:00:00.000Z',
  });

  assert.equal(result.lunaMax.uniqueMatch, false);
  assert.equal(result.lunaMax.modelId, null);
  assert.deepEqual(result.lunaMax.matches.map((match) => match.id), ['luna-a', 'luna-b']);
  assert.equal(fake.calls.some((call) => call.method === 'thread/start'), false);
  assert.equal(fake.calls.some((call) => call.method === 'turn/start'), false);
});

test('bundle diagnostic recomputes real materialized digests and verifies pinned manifests', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lucubro-codex-host-diagnostic-'));
  try {
    const store = createSkillBundleStore({ rootDir: root });
    for (const manifest of APPROVED_SKILL_BUNDLE_MANIFESTS) store.register(manifest);
    const materializer = createSkillBundleMaterializer({ bundleStore: store });

    for (const manifest of APPROVED_SKILL_BUNDLE_MANIFESTS) {
      const source = path.join(root, 'sources', manifest.id);
      fs.mkdirSync(path.join(source, 'nested'), { recursive: true });
      fs.writeFileSync(path.join(source, 'SKILL.md'), `# ${manifest.id}\n`, 'utf8');
      fs.writeFileSync(path.join(source, 'nested', 'resource.txt'), manifest.pinnedCommit, 'utf8');
      materializer.importFromDirectory(manifest.id, { sourceRoot: source });
    }

    const result = inspectSkillBundleMaterializations({ dataDir: root });
    assert.equal(result.every((entry) => entry.active), true);
    assert.equal(result.every((entry) => entry.rootExists), true);
    assert.equal(result.every((entry) => entry.digestMatchesManifest), true);
    assert.deepEqual(
      result.map((entry) => entry.pinnedCommit),
      APPROVED_SKILL_BUNDLE_MANIFESTS.map((entry) => entry.pinnedCommit),
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});