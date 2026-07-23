'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { routeLearningActions, createLearningActionService } = require('../lib/learning-action-router');

test('english word exposes only pronunciation, explanation, and word card', () => {
  const result = routeLearningActions({ selectedText: 'entertainment' });
  assert.equal(result.selectionType, 'english-word');
  assert.deepEqual(result.actions.map((item) => item.id), ['pronounce', 'explain', 'save-card']);
  assert.ok(result.actions.length <= 3);
});

test('passage does not expose a permanent toolbox', () => {
  const result = routeLearningActions({ selectedText: '这是一段需要理解并记录的课文。' });
  assert.deepEqual(result.actions.map((item) => item.id), ['ask', 'note', 'scratch']);
  assert.ok(result.actions.length <= 3);
});

test('optional model router fails closed to deterministic actions', async () => {
  const select = createLearningActionService({ modelSelector: async () => { throw new Error('offline'); } });
  const result = await select({ selectedText: 'F = ma' });
  assert.equal(result.source, 'deterministic-fallback');
  assert.equal(result.selectionType, 'formula');
});
