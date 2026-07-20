const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  appendGenerationEvent,
  readGenerationEvents,
  subscribeGenerationEvents,
} = require('../lib/generation-events');

test('persists ordered events and can resume after an id', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kimi-events-'));
  appendGenerationEvent(dir, { runId: 'r1', message: 'one' });
  appendGenerationEvent(dir, { runId: 'r1', message: 'two' });
  assert.deepEqual(readGenerationEvents(dir, { afterId: 1 }).map((event) => event.message), ['two']);
});

test('notifies live subscribers', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kimi-events-'));
  let received = null;
  const unsubscribe = subscribeGenerationEvents(dir, (event) => { received = event; });
  appendGenerationEvent(dir, { runId: 'r1', message: 'live' });
  unsubscribe();
  assert.equal(received.message, 'live');
});
