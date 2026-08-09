'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough, Writable } = require('node:stream');

const { probeCodexThreadProfile } = require('../lib/company/runtime/codex-thread-profile-probe');

function fakeAppServer({
  threadModel = 'gpt-5.6-luna',
  permissionProfileId = ':danger-full-access',
  serviceTier = 'default',
  ephemeral = true,
} = {}) {
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
            thread: { id: 'thread_probe_fixture', ephemeral },
            model: threadModel,
            modelProvider: 'openai',
            serviceTier,
            activePermissionProfile: permissionProfileId ? { id: permissionProfileId } : null,
          };
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

test('thread profile probe uses an ephemeral Luna thread without starting any turn or storage operation', async () => {
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
    ephemeral: true,
  });
  const start = fake.calls.find((call) => call.method === 'thread/start');
  assert.deepEqual(start.params, {
    model: 'gpt-5.6-luna',
    cwd: '/work/lucubro',
    allowProviderModelFallback: false,
    serviceTier: null,
    permissions: ':danger-full-access',
    ephemeral: true,
  });
  assert.equal(fake.calls.some((call) => call.method === 'turn/start'), false);
  assert.equal(fake.calls.some((call) => call.method === 'turn/steer'), false);
  assert.equal(fake.calls.some((call) => call.method.startsWith('thread/') && call.method !== 'thread/start'), false);
});

test('probe refuses provider fallback, wrong permission profile, Fast, or non-ephemeral response', async () => {
  for (const fixture of [
    { threadModel: 'gpt-5.6-sol', expected: /model mismatch/i },
    { permissionProfileId: ':workspace', expected: /permission profile mismatch/i },
    { serviceTier: 'fast', expected: /Fast service tier/i },
    { ephemeral: false, expected: /ephemeral/i },
  ]) {
    const fake = fakeAppServer(fixture);
    await assert.rejects(
      probeCodexThreadProfile({
        cwd: '/work/lucubro',
        modelId: 'gpt-5.6-luna',
        permissionProfileId: ':danger-full-access',
        spawnImpl: fake.spawnImpl,
      }),
      fixture.expected,
    );
    assert.equal(fake.calls.some((call) => call.method === 'turn/start'), false);
  }
});
