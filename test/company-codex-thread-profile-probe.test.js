'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough, Writable } = require('node:stream');

const { probeCodexThreadProfile } = require('../lib/company/runtime/codex-thread-profile-probe');

function fakeAppServer({ serviceTier = 'default' } = {}) {
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
          result = { userAgent: 'codex-cli/fixture' };
        } else if (message.method === 'thread/start') {
          result = {
            thread: { id: 'thread_probe_fixture' },
            model: 'gpt-5.6-luna',
            modelProvider: 'openai',
            serviceTier,
            activePermissionProfile: { id: ':danger-full-access' },
          };
        } else if (message.method === 'thread/archive') {
          result = {};
        } else {
          callback(new Error(`Unexpected thread probe RPC: ${message.method}`));
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

test('thread profile probe starts and archives a Luna thread without starting any turn', async () => {
  const fake = fakeAppServer();
  const result = await probeCodexThreadProfile({
    cwd: '/work/lucubro',
    modelId: 'gpt-5.6-luna',
    permissionProfileId: ':danger-full-access',
    spawnImpl: fake.spawnImpl,
  });

  assert.deepEqual(result, {
    modelId: 'gpt-5.6-luna',
    modelProvider: 'openai',
    serviceTier: 'default',
    activePermissionProfileId: ':danger-full-access',
    providerFallbackDisabled: true,
    requestedServiceTier: null,
    archived: true,
  });
  const start = fake.calls.find((call) => call.method === 'thread/start');
  assert.deepEqual(start.params, {
    model: 'gpt-5.6-luna',
    cwd: '/work/lucubro',
    allowProviderModelFallback: false,
    serviceTier: null,
    permissions: ':danger-full-access',
  });
  assert.equal(fake.calls.some((call) => call.method === 'turn/start'), false);
  assert.equal(fake.calls.some((call) => call.method === 'turn/steer'), false);
  assert.equal(fake.calls.some((call) => call.method === 'thread/archive'), true);
});

test('probe refuses a provider model fallback or different active permission profile', async () => {
  const fallback = fakeAppServer();
  const originalSpawn = fallback.spawnImpl;
  fallback.spawnImpl = (command, args, options) => {
    const child = originalSpawn(command, args, options);
    const originalWrite = child.stdin._write.bind(child.stdin);
    child.stdin._write = function patchedWrite(chunk, encoding, callback) {
      const message = JSON.parse(String(chunk).trim());
      if (message.method !== 'thread/start') return originalWrite(chunk, encoding, callback);
      fallback.calls.push(message);
      child.stdout.write(`${JSON.stringify({
        id: message.id,
        result: {
          thread: { id: 'thread_probe_fallback' },
          model: 'gpt-5.6-sol',
          modelProvider: 'openai',
          serviceTier: 'default',
          activePermissionProfile: { id: ':danger-full-access' },
        },
      })}\n`);
      callback();
    };
    return child;
  };

  await assert.rejects(
    probeCodexThreadProfile({
      cwd: '/work/lucubro',
      modelId: 'gpt-5.6-luna',
      permissionProfileId: ':danger-full-access',
      spawnImpl: fallback.spawnImpl,
    }),
    /model mismatch/i,
  );
  assert.equal(fallback.calls.some((call) => call.method === 'turn/start'), false);
});
