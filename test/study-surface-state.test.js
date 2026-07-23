'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeStudySurfaceState } = require('../lib/study-surface-state');

test('scratch state is bounded and normalized per lesson', () => {
  const value = normalizeStudySurfaceState({
    cards: [{ kind: 'quote', quote: 'abc', body: 'note' }],
    strokes: [{ id: 's1', points: [[-1, 2], [0.5, 0.5], ['bad', 0]] }],
  });
  assert.equal(value.cards.length, 1);
  assert.deepEqual(value.strokes[0].points, [[0, 1], [0.5, 0.5]]);
});
