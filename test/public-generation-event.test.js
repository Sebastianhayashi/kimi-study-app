const test = require('node:test');
const assert = require('node:assert/strict');
const {
  sanitizeProgressReport,
  mapToolCall,
  mapWireEvent,
} = require('../lib/public-generation-event');

test('sanitizes model-reported progress and keeps only allowed metrics', () => {
  const event = sanitizeProgressReport(JSON.stringify({
    phase: 'questions',
    message: '正在生成题目',
    detail: '基于四个目标',
    metrics: { candidates: 9, secret: 123 },
  }));
  assert.equal(event.phase, 'questions');
  assert.deepEqual(event.metrics, { candidates: 9 });
});

test('maps a write tool to a public artifact event without exposing an internal path', () => {
  const { event } = mapToolCall({
    id: 'tc-1',
    function: {
      name: 'WriteFile',
      arguments: JSON.stringify({ path: '/private/course/question-bank.json', content: 'answers' }),
    },
  });
  assert.equal(event.artifact, 'question-bank.json');
  assert.equal(event.message.includes('/private'), false);
  assert.equal(event.message.includes('answers'), false);
});

test('never exposes Wire ThinkPart content', () => {
  assert.equal(mapWireEvent('ContentPart', { type: 'think', think: 'private reasoning' }), null);
});
