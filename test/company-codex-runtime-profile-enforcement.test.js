'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough, Writable } = require('node:stream');

const { createCodexAppServerRuntime } = require('../lib/company/runtime/codex-app-server');

function admission(overrides = {}) {
  return {
    admitted: true,
    modelId: 'gpt-5.6-luna',
    reasoningEffort: 'max',
    mode: 'default',
    fast: false,
    permissionProfile: 'full-access',
    providerPermissionProfileId: ':full-access',
    ...overrides,
  };
}

function request(overrides = {}) {
  return {
    runId: 'run_luna_enforced',
    workId: 'work_luna_enforced',
    cwd: '/work/lucubro',
    workspaceKind: 'scratch',
    prompt: 'Return a short source-backed summary.',
    model: 'gpt-5.6-luna',
    delegationEnvelope: {
      allow: ['workspace.read', 'shell.execute'],
      deny: ['workspace.write', 'network.access', 'git.push', 'filesystem.destructive'],
    },
    async requestApproval() { return 'deny'; },
    ...overrides,
  };
}

function fakeAppServer({
  threadModel = 'gpt-5.6-luna',
  permissionProfileId = ':full-access',
  serviceTier = 'default',
  ephemeral = true,
} = {}) {
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
              thread: { id: 'thread_luna', ephemeral },
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
    async attest({ policy }) {
      assert.equal(policy.workspaceKind, 'scratch');
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

test('admitted Codex Run pins gpt-5.6-luna, max effort, clears Fast, disables fallback, pins Default mode, and uses an ephemeral named full-access thread', async () => {
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
    model: 'gpt-5.6-luna',
    cwd: '/work/lucubro',
    allowProviderModelFallback: false,
    serviceTier: null,
    permissions: ':full-access',
    ephemeral: true,
  });

  const turnStart = fake.calls.find((call) => call.method === 'turn/start');
  assert.equal(Object.hasOwn(turnStart.params, 'model'), false);
  assert.equal(Object.hasOwn(turnStart.params, 'sandboxPolicy'), false);
  assert.deepEqual(turnStart.params.collaborationMode, {
    mode: 'default',
    settings: {
      model: 'gpt-5.6-luna',
      reasoningEffort: 'max',
      developerInstructions: null,
    },
  });
});

test('admitted Codex Run rejects caller model override, non-max admission, and provider-session resume before boundary spawn', async () => {
  let boundaryCalled = false;
  const authorityBoundary = {
    async attest() { boundaryCalled = true; return { enforced: true }; },
    spawn() { throw new Error('must not spawn'); },
  };

  const runtime = createCodexAppServerRuntime({ admission: admission(), authorityBoundary });
  await assert.rejects(
    runtime.run(request({ model: 'other-model' })).next(),
    /must use admitted.*gpt-5\.6-luna/i,
  );
  await assert.rejects(
    runtime.run(request({ providerSessionId: 'thread_old' })).next(),
    /ephemeral.*provider session/i,
  );

  const weakRuntime = createCodexAppServerRuntime({
    admission: admission({ reasoningEffort: 'high' }),
    authorityBoundary,
  });
  await assert.rejects(
    weakRuntime.run(request()).next(),
    /reasoning.*max|execution profile/i,
  );
  assert.equal(boundaryCalled, false);
});

test('thread/start machine response must match admitted Luna model, non-Fast tier, active provider profile, and ephemeral state before any user turn starts', async () => {
  for (const fixture of [
    { threadModel: 'other-model', expected: /model/i },
    { permissionProfileId: ':workspace', expected: /permission/i },
    { serviceTier: 'fast', expected: /service tier/i },
    { ephemeral: false, expected: /ephemeral/i },
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