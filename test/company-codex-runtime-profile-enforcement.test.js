'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough, Writable } = require('node:stream');

const { createCodexAppServerRuntime } = require('../lib/company/runtime/codex-app-server');

function admission() {
  return {
    admitted: true,
    profileName: 'Luna Max',
    modelId: 'luna-runtime-id',
    providerPermissionProfileId: ':full-access',
  };
}

function request(overrides = {}) {
  return {
    runId: 'run_luna_enforced',
    workId: 'work_luna_enforced',
    cwd: '/work/lucubro',
    prompt: 'Return a short source-backed summary.',
    model: 'luna-runtime-id',
    delegationEnvelope: {
      allow: ['workspace.read'],
      deny: ['workspace.write', 'network.access', 'git.push', 'filesystem.destructive'],
    },
    async requestApproval() { return 'deny'; },
    ...overrides,
  };
}

function fakeAppServer({ threadModel = 'luna-runtime-id', permissionProfileId = ':full-access', serviceTier = null } = {}) {
  const calls = [];

  function child() {
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
            result = { userAgent: 'codex-test' };
          } else if (message.method === 'thread/start') {
            result = {
              thread: { id: 'thread_luna' },
              model: threadModel,
              modelProvider: 'openai',
              serviceTier,
              activePermissionProfile: permissionProfileId ? { id: permissionProfileId } : null,
            };
          } else if (message.method === 'turn/start') {
            result = { turn: { id: 'turn_luna', status: 'inProgress' } };
            queueMicrotask(() => {
              process.stdout.write(`${JSON.stringify({
                method: 'turn/completed',
                params: { turn: { id: 'turn_luna', status: 'completed' } },
              })}\n`);
            });
          } else {
            callback(new Error(`Unexpected fake app-server method: ${message.method}`));
            return;
          }
          process.stdout.write(`${JSON.stringify({ id: message.id, result })}\n`);
        }
        callback();
      },
    });
    return process;
  }

  const authorityBoundary = {
    async attest() {
      return { enforced: true, boundaryId: 'fixture-external-boundary' };
    },
    spawn({ command, args }) {
      assert.equal(command, 'codex');
      assert.deepEqual(args, ['app-server']);
      return child();
    },
  };

  return { calls, authorityBoundary };
}

async function collect(runtime, input) {
  const events = [];
  for await (const event of runtime.run(input)) events.push(event);
  return events;
}

test('admitted Codex Run pins Luna, clears Fast, disables provider fallback, and uses named full-access without provider sandbox', async () => {
  const fake = fakeAppServer();
  const runtime = createCodexAppServerRuntime({
    admission: admission(),
    authorityBoundary: fake.authorityBoundary,
  });

  const events = await collect(runtime, request());
  assert.ok(events.some((event) => event.type === 'run.started'));
  assert.ok(events.some((event) => event.type === 'run.completed'));

  const threadStart = fake.calls.find((call) => call.method === 'thread/start');
  assert.deepEqual(threadStart.params, {
    model: 'luna-runtime-id',
    cwd: '/work/lucubro',
    allowProviderModelFallback: false,
    serviceTier: null,
    permissions: ':full-access',
  });

  const turnStart = fake.calls.find((call) => call.method === 'turn/start');
  assert.equal(Object.hasOwn(turnStart.params, 'model'), false);
  assert.equal(Object.hasOwn(turnStart.params, 'sandboxPolicy'), false);
});

test('admitted Codex Run rejects a caller model override before provider spawn', async () => {
  let boundaryCalled = false;
  const runtime = createCodexAppServerRuntime({
    admission: admission(),
    authorityBoundary: {
      async attest() { boundaryCalled = true; return { enforced: true }; },
      spawn() { throw new Error('must not spawn'); },
    },
  });

  await assert.rejects(
    runtime.run(request({ model: 'other-model' })).next(),
    /must use admitted Luna Max model/i,
  );
  assert.equal(boundaryCalled, false);
});

test('thread/start machine response must match admitted Luna model, no-Fast tier, and active provider profile before any user turn starts', async () => {
  for (const fixture of [
    { threadModel: 'other-model', permissionProfileId: ':full-access', serviceTier: null, expected: /model/i },
    { threadModel: 'luna-runtime-id', permissionProfileId: ':workspace', serviceTier: null, expected: /permission/i },
    { threadModel: 'luna-runtime-id', permissionProfileId: ':full-access', serviceTier: 'fast', expected: /service tier/i },
  ]) {
    const fake = fakeAppServer(fixture);
    const runtime = createCodexAppServerRuntime({
      admission: admission(),
      authorityBoundary: fake.authorityBoundary,
    });

    await assert.rejects(runtime.run(request()).next(), fixture.expected);
    assert.equal(fake.calls.some((call) => call.method === 'turn/start'), false);
  }
});
