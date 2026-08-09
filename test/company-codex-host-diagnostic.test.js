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
    id: 'gpt-5.6-luna',
    model: 'gpt-5.6-luna',
    displayName: 'GPT-5.6-Luna',
    isDefault: false,
    supportedReasoningEfforts: ['low', 'medium', 'high', 'xhigh', 'max'],
    defaultServiceTier: 'priority',
    additionalSpeedTiers: ['fast'],
    serviceTiers: [{ id: 'priority', name: 'Priority' }],
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
              model: 'gpt-5.6-luna',
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

test('host diagnostic binds the approved profile to exact gpt-5.6-luna and proves max is advertised without starting a turn', async () => {
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
  assert.deepEqual(result.approvedModel, {
    expectedModelId: 'gpt-5.6-luna',
    uniqueMatch: true,
    modelId: 'gpt-5.6-luna',
    model: 'gpt-5.6-luna',
    displayName: 'GPT-5.6-Luna',
    isDefault: false,
    supportedReasoningEfforts: ['low', 'medium', 'high', 'xhigh', 'max'],
    maxReasoningEffortSupported: true,
    defaultServiceTier: 'priority',
    additionalSpeedTiers: ['fast'],
    serviceTierIds: ['priority'],
  });
  assert.deepEqual(result.effectiveConfig, {
    modelId: 'gpt-5.6-luna',
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

test('provider display text is diagnostic only; exact provider model id controls the match', async () => {
  const fake = fakeAppServer({
    models: [
      {
        id: 'gpt-5.6-luna',
        model: 'gpt-5.6-luna',
        displayName: 'A Future Display Label',
        supportedReasoningEfforts: [{ effort: 'high' }, { effort: 'max' }],
      },
      { id: 'other-id', model: 'other-id', displayName: 'GPT-5.6-Luna' },
    ],
  });
  const result = await inspectCodexHost({
    cwd: '/work/lucubro',
    expectedModelId: 'gpt-5.6-luna',
    spawnImpl: fake.spawnImpl,
    now: () => '2026-08-09T14:00:00.000Z',
  });

  assert.equal(result.approvedModel.uniqueMatch, true);
  assert.equal(result.approvedModel.modelId, 'gpt-5.6-luna');
  assert.equal(result.approvedModel.displayName, 'A Future Display Label');
  assert.deepEqual(result.approvedModel.supportedReasoningEfforts, ['high', 'max']);
  assert.equal(result.approvedModel.maxReasoningEffortSupported, true);
});

test('host diagnostic fails closed when the exact model id is absent or does not advertise max effort', async () => {
  const absent = fakeAppServer({ models: [{ id: 'other', model: 'other', displayName: 'GPT-5.6-Luna' }] });
  const absentResult = await inspectCodexHost({ cwd: '/work/lucubro', spawnImpl: absent.spawnImpl });
  assert.equal(absentResult.approvedModel.uniqueMatch, false);
  assert.equal(absentResult.approvedModel.modelId, null);

  const noMax = fakeAppServer({
    models: [{
      id: 'gpt-5.6-luna',
      model: 'gpt-5.6-luna',
      displayName: 'GPT-5.6-Luna',
      supportedReasoningEfforts: ['high'],
    }],
  });
  const noMaxResult = await inspectCodexHost({ cwd: '/work/lucubro', spawnImpl: noMax.spawnImpl });
  assert.equal(noMaxResult.approvedModel.uniqueMatch, true);
  assert.equal(noMaxResult.approvedModel.maxReasoningEffortSupported, false);
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