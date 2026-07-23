'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {
  normalizeLessonSpecShape,
  validateLessonSpec,
  scoreActivity,
  toPublicLessonSpec,
} = require('../lib/activity-engine');
const NotesCore = require('../public/margin-notes-core');

function read(relative) {
  return fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');
}

function nestedSpec() {
  return {
    schemaVersion: 1,
    lessonId: 'lesson-1',
    title: 'Nested legacy shape',
    claims: {
      claimOne: {
        label: 'Can order two steps',
        sourceRefs: { first: 'source-1' },
        mastery: { requiredPassed: 1, requiredStages: { guided: 'guided' } },
      },
    },
    activities: {
      orderOne: {
        type: 'ordering',
        claimId: 'claimOne',
        stage: 'guided',
        prompt: 'Put the steps in order',
        sourceRefs: { first: 'source-1' },
        feedback: { correct: 'Correct', incorrect: 'Try again' },
        hints: { first: 'Start with one' },
        items: {
          first: { label: 'First step' },
          second: { label: 'Second step' },
        },
        correctOrder: { first: 'first', second: 'second' },
      },
    },
  };
}

test('normalizes nested object-map assessment collections without exposing keys', () => {
  const spec = normalizeLessonSpecShape(nestedSpec());
  assert.equal(Array.isArray(spec.claims), true);
  assert.equal(Array.isArray(spec.activities), true);
  assert.equal(Array.isArray(spec.activities[0].items), true);
  assert.equal(Array.isArray(spec.activities[0].correctOrder), true);
  assert.deepEqual(validateLessonSpec(spec), { ok: true, errors: [] });
  assert.equal(scoreActivity(spec.activities[0], ['first', 'second']).passed, true);
  const publicSpec = toPublicLessonSpec(spec);
  assert.equal('correctOrder' in publicSpec.activities[0], false);
});

test('hostile nested activity shapes return validation errors instead of throwing', () => {
  const spec = nestedSpec();
  spec.activities.orderOne.items = 'not-an-array';
  let result;
  assert.doesNotThrow(() => { result = validateLessonSpec(spec); });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('items')));
});

test('lesson ownership survives note normalization and serialization', () => {
  const normalized = NotesCore.normalizeNote({
    id: 'n1',
    lessonFile: '0001-example.html',
    anchor: { exact: 'example' },
    custom: 'note',
  }, 0);
  assert.equal(normalized.lessonFile, '0001-example.html');
  assert.equal(NotesCore.serializeNote(normalized).lessonFile, '0001-example.html');
});

test('installs lesson-scoped note merge and EPUB meaningful-target behavior', () => {
  const notes = read('public/margin-notes.js');
  const server = read('server.js');
  const viewer = read('public/source-viewer.js');
  assert.match(notes, /notes\?lesson=\$\{encodeURIComponent\(this\.lessonFile\)\}/);
  assert.match(notes, /note\.lessonFile === this\.lessonFile/);
  assert.match(server, /note\.lessonFile === lesson/);
  assert.match(server, /writeJsonAtomic\(notesFile\(req\.params\.id\), \[\.\.\.retained, \.\.\.incoming\]\)/);
  assert.match(viewer, /function firstReadableEpubTarget/);
  assert.match(viewer, /rendition\.display\(firstTarget\)/);
});
