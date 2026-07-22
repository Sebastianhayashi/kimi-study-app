'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { isPrivateCoursePath } = require('../lib/private-course-path');

test('blocks private course state and assessment artifacts from generic file serving', () => {
  for (const target of [
    'assessments/0001-example.json',
    'learning-progress/0001-example.json',
    'learning-records/0001-example.md',
    'assessment-blueprint.json',
    'chat.json',
    'generation-events.jsonl',
    'generator-session.json',
    'mission-session.json',
    'job.json',
    'next-lesson-transaction.json',
    'learning-claims.json',
    'meta.json',
    'misconceptions.json',
    'notes.json',
    'onboarding.json',
    'quality-report.json',
    'question-bank.json',
    'source-profile.json',
    'tutor-session.json',
  ]) {
    assert.equal(isPrivateCoursePath(target), true, target);
  }
});

test('keeps intentional learner-facing course resources available', () => {
  for (const target of [
    'MISSION.md',
    'RESOURCES.md',
    'map.json',
    'assets/style.css',
    'reference/glossary.html',
    'references/example.png',
  ]) {
    assert.equal(isPrivateCoursePath(target), false, target);
  }
});
