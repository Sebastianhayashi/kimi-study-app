const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('events');
const { PassThrough } = require('stream');
const { runTrackedKimi, runWire } = require('../lib/kimi-generation-runner');

function fakeWireProcess() {
  const child = new EventEmitter();
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.killed = false;
  child.kill = () => { child.killed = true; };

  let buffer = '';
  const send = (message) => child.stdout.write(`${JSON.stringify(message)}\n`);
  child.stdin.on('data', (chunk) => {
    buffer += chunk.toString();
    let newline;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      const message = JSON.parse(line);
      if (message.method === 'initialize') {
        send({ jsonrpc: '2.0', id: message.id, result: { protocol_version: '1.10', server: { name: 'test', version: '1' }, slash_commands: [], external_tools: { accepted: ['report_generation_progress'], rejected: [] } } });
      } else if (message.method === 'prompt') {
        send({ jsonrpc: '2.0', method: 'event', params: { type: 'ContentPart', payload: { type: 'think', think: 'private reasoning' } } });
        send({ jsonrpc: '2.0', method: 'request', id: 'progress-request', params: { type: 'ToolCallRequest', payload: { id: 'progress-call', name: 'report_generation_progress', arguments: JSON.stringify({ phase: 'questions', message: '正在生成候选题', metrics: { candidates: 9 } }) } } });
        send({ jsonrpc: '2.0', method: 'event', params: { type: 'ContentPart', payload: { type: 'text', text: 'done' } } });
        send({ jsonrpc: '2.0', id: message.id, result: { status: 'finished' } });
      }
    }
  });
  return child;
}

test('Wire runner reports safe external progress and never emits ThinkPart', async () => {
  const events = [];
  const result = await runWire({
    cwd: '/tmp',
    prompt: 'build lesson',
    cont: false,
    model: 'test',
    skillsDir: '/skills',
    onEvent: (event) => events.push(event),
    spawnImpl: () => fakeWireProcess(),
    initializeTimeoutMs: 1000,
  });

  assert.equal(result.status, 'finished');
  assert.equal(result.text, 'done');
  assert.deepEqual(events.map((event) => event.message), ['正在生成候选题']);
  assert.equal(JSON.stringify(events).includes('private reasoning'), false);
});


test('resumed stream-json mode uses an existing explicit session and records the canonical session id', async () => {
  let capturedArgs = null;
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.stdin = new PassThrough();

  const resultPromise = runTrackedKimi({
    cwd: '/tmp',
    prompt: 'build next lesson',
    cont: false,
    sessionId: 'session_existing123',
    preferredMode: 'stream-json',
    model: 'test',
    skillsDir: '/skills',
    spawnImpl(command, args) {
      assert.equal(command, 'kimi');
      capturedArgs = args;
      process.nextTick(() => {
        child.stdout.write(`${JSON.stringify({ role: 'assistant', content: 'done' })}\n`);
        child.stderr.write('To resume this session: kimi -r session_canonical123\n');
        child.emit('close', 0);
      });
      return child;
    },
  });

  const result = await resultPromise;
  assert.equal(result.mode, 'stream-json');
  assert.equal(result.sessionId, 'session_canonical123');
  assert.deepEqual(capturedArgs.slice(0, 6), [
    '-m', 'test', '--skills-dir', '/skills', '--session', 'session_existing123',
  ]);
  assert.equal(capturedArgs.includes('--wire'), false);
  assert.equal(capturedArgs.includes('-c'), false);
});


test('cold stream-json mode omits session flags and captures the newly created canonical session', async () => {
  let capturedArgs = null;
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.stdin = new PassThrough();

  const resultPromise = runTrackedKimi({
    cwd: '/tmp',
    prompt: 'bootstrap next lesson',
    cont: false,
    sessionId: null,
    preferredMode: 'stream-json',
    model: 'test',
    skillsDir: '/skills',
    spawnImpl(command, args) {
      assert.equal(command, 'kimi');
      capturedArgs = args;
      process.nextTick(() => {
        child.stdout.write(`${JSON.stringify({ role: 'assistant', content: 'done' })}\n`);
        child.stdout.write(`${JSON.stringify({
          role: 'meta',
          type: 'session.resume_hint',
          session_id: 'session_new123',
          command: 'kimi -r session_new123',
          content: 'To resume this session: kimi -r session_new123',
        })}\n`);
        child.stderr.write('To resume this session: kimi -r session_stderr999\n');
        child.emit('close', 0);
      });
      return child;
    },
  });

  const result = await resultPromise;
  assert.equal(result.mode, 'stream-json');
  assert.equal(result.sessionId, 'session_new123');
  assert.equal(capturedArgs.includes('--session'), false);
  assert.equal(capturedArgs.includes('-S'), false);
  assert.equal(capturedArgs.includes('-c'), false);
  assert.equal(capturedArgs.includes('--wire'), false);
});
