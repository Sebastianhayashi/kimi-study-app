'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { PassThrough, Writable } = require('node:stream');

const { createCodexAppServerRuntime } = require('../lib/company/runtime/codex-app-server');

function tempRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lucubro-codex-run-mount-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function writeSkill(root, name) {
  const directory = path.join(root, name);
  fs.mkdirSync(directory, { recursive: true });
  const skillPath = path.join(directory, 'SKILL.md');
  const body = `---\nname: ${name}\ndescription: ${name} description\n---\n# ${name}\n`;
  fs.writeFileSync(skillPath, body);
  return {
    skillPath,
    contentHash: `sha256:${crypto.createHash('sha256').update(body).digest('hex')}`,
  };
}

function fakeChild({ mountedSkill, mountEnabled = true }) {
  const child = new EventEmitter();
  const calls = [];
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.killed = false;
  child.kill = () => {
    if (child.killed) return;
    child.killed = true;
    queueMicrotask(() => child.emit('close', 0));
  };
  child.stdin = new Writable({
    write(chunk, _encoding, callback) {
      for (const line of String(chunk).split('\n').filter(Boolean)) {
        const message = JSON.parse(line);
        calls.push(message);
        if (message.id == null) continue;
        let result;
        if (message.method === 'initialize') result = { userAgent: 'codex-fixture' };
        else if (message.method === 'skills/extraRoots/set') result = {};
        else if (message.method === 'skills/list') {
          result = {
            data: [{
              cwd: '/work/lucubro',
              skills: [{
                name: 'research',
                description: 'Research',
                path: mountedSkill.skillPath,
                scope: 'user',
                enabled: mountEnabled,
              }],
              errors: [],
            }],
          };
        } else if (message.method === 'thread/start') result = { thread: { id: 'thread_mount_fixture' } };
        else if (message.method === 'turn/start') {
          result = { turn: { id: 'turn_mount_fixture', status: 'inProgress' } };
          queueMicrotask(() => {
            child.stdout.write(`${JSON.stringify({
              method: 'turn/completed',
              params: { turn: { id: 'turn_mount_fixture', status: 'completed' } },
            })}\n`);
          });
        } else throw new Error(`Unexpected method: ${message.method}`);
        child.stdout.write(`${JSON.stringify({ id: message.id, result })}\n`);
      }
      callback();
    },
  });
  return { child, calls };
}

function mountedRequest(mountRoot, mountedSkill, overrides = {}) {
  return {
    runId: 'run_mount_fixture',
    subrunId: 'subrun_research_fixture',
    workId: 'work_mount_fixture',
    cwd: '/work/lucubro',
    prompt: 'Research coffee roasting.',
    model: 'luna-runtime-id',
    delegationEnvelope: { allow: ['workspace.read'], deny: [] },
    skillMount: {
      root: mountRoot,
      expectedSkills: [{
        skillId: 'mattpocock-skills:research',
        bundleId: 'mattpocock-skills',
        bundleCommit: '84fdeffd12f2ee307994d1eb6feb48173b6e0502',
        name: 'research',
        contentHash: mountedSkill.contentHash,
        skillPath: mountedSkill.skillPath,
        activation: 'model',
        overlay: null,
      }],
    },
    async requestApproval() { return 'deny'; },
    ...overrides,
  };
}

test('Codex Run verifies Skill mount on the same App Server before thread start and emits a Run-bound receipt', async (t) => {
  const mountRoot = tempRoot(t);
  const mountedSkill = writeSkill(mountRoot, 'research');
  const fake = fakeChild({ mountedSkill });
  const boundaryCalls = [];
  const runtime = createCodexAppServerRuntime({
    spawnImpl() { throw new Error('raw spawn must not be used for Run'); },
    authorityBoundary: {
      async attest({ policy }) {
        boundaryCalls.push({ type: 'attest', policy });
        return { enforced: true, boundaryId: 'boundary_mount_fixture' };
      },
      spawn(input) {
        boundaryCalls.push({ type: 'spawn', input });
        return fake.child;
      },
    },
  });

  const events = [];
  for await (const event of runtime.run(mountedRequest(mountRoot, mountedSkill))) events.push(event);

  const receiptEvent = events.find((event) => event.type === 'skill.mounted');
  assert.ok(receiptEvent);
  assert.equal(receiptEvent.receipt.verified, true);
  assert.equal(receiptEvent.receipt.runId, 'run_mount_fixture');
  assert.equal(receiptEvent.receipt.subrunId, 'subrun_research_fixture');
  assert.equal(receiptEvent.receipt.skills[0].skillId, 'mattpocock-skills:research');
  assert.equal(receiptEvent.receipt.skills[0].contentHash, mountedSkill.contentHash);
  assert.equal(receiptEvent.receipt.method, 'skills/extraRoots/set+skills/list');

  assert.deepEqual(fake.calls.map((call) => call.method), [
    'initialize',
    'initialized',
    'skills/extraRoots/set',
    'skills/list',
    'thread/start',
    'turn/start',
  ]);
  const mountIndex = fake.calls.findIndex((call) => call.method === 'skills/list');
  const threadIndex = fake.calls.findIndex((call) => call.method === 'thread/start');
  assert.ok(mountIndex >= 0 && threadIndex > mountIndex);
  assert.equal(boundaryCalls[0].type, 'attest');
  assert.equal(boundaryCalls[1].type, 'spawn');
});

test('Codex Run terminates the App Server and never starts a thread when Skill mount verification fails', async (t) => {
  const mountRoot = tempRoot(t);
  const mountedSkill = writeSkill(mountRoot, 'research');
  const fake = fakeChild({ mountedSkill, mountEnabled: false });
  const runtime = createCodexAppServerRuntime({
    spawnImpl() { throw new Error('raw spawn must not be used for Run'); },
    authorityBoundary: {
      async attest() { return { enforced: true, boundaryId: 'boundary_mount_failure_fixture' }; },
      spawn() { return fake.child; },
    },
  });

  await assert.rejects(
    runtime.run(mountedRequest(mountRoot, mountedSkill)).next(),
    /Expected Skill is not enabled in Codex mount: research/,
  );
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(fake.child.killed, true);
  assert.equal(fake.calls.some((call) => call.method === 'thread/start'), false);
  assert.deepEqual(fake.calls.map((call) => call.method), [
    'initialize',
    'initialized',
    'skills/extraRoots/set',
    'skills/list',
  ]);
});
