'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough, Writable } = require('node:stream');

const { createCodexAppServerRuntime } = require('../lib/company/runtime/codex-app-server');

function fakeAppServer({ models = [], config = {}, permissionProfiles = [] } = {}) {
  const calls = [];

  function spawnImpl(command, args) {
    assert.equal(command, 'codex');
    assert.deepEqual(args, ['app-server']);
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.killed = false;
    child.kill = () => { child.killed = true; queueMicrotask(() => child.emit('close', 0)); };
    child.stdin = new Writable({
      write(chunk, _encoding, callback) {
        const lines = String(chunk).split('\n').filter(Boolean);
        for (const line of lines) {
          const message = JSON.parse(line);
          calls.push(message);
          if (message.id == null) continue;
          let result;
          if (message.method === 'initialize') {
            result = { userAgent: 'codex-test', codexHome: '/tmp/codex-home', platformFamily: 'unix', platformOs: 'linux' };
          } else if (message.method === 'model/list') {
            result = { data: models, nextCursor: null };
          } else if (message.method === 'config/read') {
            result = { config, origins: {}, layers: null };
          } else if (message.method === 'permissionProfile/list') {
            result = { data: permissionProfiles, nextCursor: null };
          } else {
            callback(new Error(`Unexpected fake app-server method: ${message.method}`));
            return;
          }
          child.stdout.write(`${JSON.stringify({ id: message.id, result })}\n`);
        }
        callback();
      },
    });
    return child;
  }

  return { spawnImpl, calls };
}

test('Codex admission preflight collects machine-readable exact model/config/permission evidence without claiming admission', async () => {
  const fake = fakeAppServer({
    models: [{
      id: 'gpt-5.6-luna',
      model: 'gpt-5.6-luna',
      displayName: 'GPT-5.6-Luna',
      hidden: false,
      isDefault: false,
      supportedReasoningEfforts: ['high', 'max'],
      defaultServiceTier: 'priority',
      additionalSpeedTiers: ['fast'],
      serviceTiers: [{ id: 'priority', name: 'Priority', description: 'Priority tier' }],
    }],
    config: {
      model: 'gpt-5.6-luna',
      model_provider: 'openai',
      service_tier: null,
    },
    permissionProfiles: [
      { id: ':workspace', description: 'Workspace', allowed: true },
      { id: ':full-access', description: 'Full access', allowed: true },
    ],
  });
  const runtime = createCodexAppServerRuntime({ spawnImpl: fake.spawnImpl });

  const preflight = await runtime.preflight({
    cwd: '/work/lucubro',
    requestedModelId: 'gpt-5.6-luna',
    requestedPermissionProfileId: ':full-access',
  });

  assert.equal(preflight.kind, 'codex-app-server-preflight');
  assert.equal(preflight.admitted, undefined);
  assert.deepEqual(preflight.model, {
    requestedId: 'gpt-5.6-luna',
    catalogMatch: true,
    displayName: 'GPT-5.6-Luna',
    isDefault: false,
    defaultServiceTier: 'priority',
    additionalSpeedTiers: ['fast'],
    serviceTierIds: ['priority'],
  });
  assert.deepEqual(preflight.effectiveConfig, {
    modelId: 'gpt-5.6-luna',
    modelProvider: 'openai',
    serviceTier: null,
  });
  assert.deepEqual(preflight.permissionProfile, {
    requestedId: ':full-access',
    present: true,
    allowed: true,
    description: 'Full access',
  });
  assert.deepEqual(preflight.unknown, []);

  assert.deepEqual(fake.calls.map((call) => call.method), [
    'initialize',
    'initialized',
    'model/list',
    'config/read',
    'permissionProfile/list',
  ]);
  assert.equal(fake.calls[0].params.capabilities.experimentalApi, true);
  assert.deepEqual(fake.calls[2].params, { includeHidden: true });
  assert.deepEqual(fake.calls[3].params, { cwd: '/work/lucubro', includeLayers: true });
  assert.deepEqual(fake.calls[4].params, { cwd: '/work/lucubro' });
});

test('Codex admission preflight reports unknown/missing machine state instead of inferring it', async () => {
  const fake = fakeAppServer({
    models: [{ id: 'other-model', model: 'other-model', displayName: 'Other', hidden: false, isDefault: true, serviceTiers: [] }],
    config: { model: null, model_provider: 'openai', service_tier: null },
    permissionProfiles: [{ id: ':workspace', description: 'Workspace', allowed: true }],
  });
  const runtime = createCodexAppServerRuntime({ spawnImpl: fake.spawnImpl });

  const preflight = await runtime.preflight({
    cwd: '/work/lucubro',
    requestedModelId: 'gpt-5.6-luna',
    requestedPermissionProfileId: ':full-access',
  });

  assert.equal(preflight.model.catalogMatch, false);
  assert.equal(preflight.effectiveConfig.modelId, null);
  assert.equal(preflight.permissionProfile.present, false);
  assert.equal(preflight.permissionProfile.allowed, false);
  assert.deepEqual(preflight.unknown.sort(), [
    'effectiveConfig.modelId',
    'model.catalogMatch',
    'permissionProfile.present',
  ]);
});