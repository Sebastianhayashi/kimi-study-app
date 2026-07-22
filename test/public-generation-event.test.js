const test = require('node:test');
const assert = require('node:assert/strict');
const {
  sanitizeProgressReport,
  mapToolCall,
  mapToolResult,
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

test('does not present a read of an existing lesson as a newly written artifact', () => {
  const { event } = mapToolCall({
    id: 'tc-read',
    function: {
      name: 'ReadFile',
      arguments: JSON.stringify({ path: '/private/course/lessons/0004-existing.html' }),
    },
  });

  assert.equal(event.kind, 'tool');
  assert.equal(event.artifact, undefined);
  assert.equal(event.phase, undefined);
  assert.equal(event.message, '正在定位并阅读与本课相关的材料…');
});

test('maps next-lesson preflight execution to safe auditable events', () => {
  const mapped = mapToolCall({
    id: 'tc-preflight',
    function: {
      name: 'Bash',
      arguments: JSON.stringify({ command: 'node /private/repo/lib/next-lesson-preflight.js' }),
    },
  });

  assert.equal(mapped.event.kind, 'preflight');
  assert.equal(mapped.event.phase, 'validating');
  assert.equal(mapped.event.state, 'active');
  assert.equal(JSON.stringify(mapped.event).includes('/private'), false);
  assert.equal(JSON.stringify(mapped.event).includes('next-lesson-preflight.js'), false);

  const completed = mapToolResult({
    tool_call_id: 'tc-preflight',
    return_value: { is_error: false, output: '{"ok":true}' },
  }, mapped.call);
  assert.equal(completed.kind, 'preflight');
  assert.equal(completed.state, 'complete');
  assert.equal(completed.message, '下一课发布预检已通过');
  assert.equal(JSON.stringify(completed).includes('{"ok":true}'), false);
});

test('never exposes Wire ThinkPart content', () => {
  assert.equal(mapWireEvent('ContentPart', { type: 'think', think: 'private reasoning' }), null);
});
