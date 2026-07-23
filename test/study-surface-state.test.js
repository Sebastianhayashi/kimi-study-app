'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MAX_STUDY_SURFACE_BYTES,
  MAX_TOTAL_POINTS,
  inspectStudySurfaceState,
  normalizeStudySurfaceState,
  studySurfaceByteLength,
} = require('../lib/study-surface-state');

test('scratch state is bounded and normalized per lesson', () => {
  const value = normalizeStudySurfaceState({
    cards: [{ kind: 'quote', quote: 'abc', body: 'note' }],
    strokes: [{ id: 's1', points: [[-1, 2], [0.50000009, 0.49999991], ['bad', 0]] }],
  });
  assert.equal(value.cards.length, 1);
  assert.deepEqual(value.strokes[0].points, [[0, 1], [0.5, 0.5]]);
});

test('a realistic medium drawing fits the explicit save budget', () => {
  const strokes = Array.from({ length: 20 }, (_, strokeIndex) => ({
    id: `s${strokeIndex}`,
    points: Array.from({ length: 300 }, (_, pointIndex) => [pointIndex / 300, strokeIndex / 20]),
  }));
  const state = normalizeStudySurfaceState({ cards: [], strokes });
  const inspection = inspectStudySurfaceState(state);
  assert.equal(inspection.ok, true, inspection.errors.join('\n'));
  assert.ok(studySurfaceByteLength(state) < MAX_STUDY_SURFACE_BYTES);
});

test('oversized point collections are rejected before persistence', () => {
  const points = Array.from({ length: MAX_TOTAL_POINTS + 1 }, (_, index) => [index / MAX_TOTAL_POINTS, 0.5]);
  const inspection = inspectStudySurfaceState({
    cards: [],
    strokes: Array.from({ length: 11 }, (_, index) => ({
      id: `s${index}`,
      points: points.slice(index * 1100, index === 10 ? undefined : (index + 1) * 1100),
    })),
  });
  assert.equal(inspection.ok, false);
  assert.match(inspection.errors.join('\n'), /total points exceed/);
});

test('payloads beyond the byte budget are rejected explicitly', () => {
  const inspection = inspectStudySurfaceState({
    cards: Array.from({ length: 80 }, (_, index) => ({ id: `c${index}`, kind: 'note', body: '界'.repeat(5000) })),
    strokes: [],
  });
  assert.equal(inspection.ok, false);
  assert.match(inspection.errors.join('\n'), /payload exceeds/);
});
