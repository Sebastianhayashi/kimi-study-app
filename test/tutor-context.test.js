'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  MAX_CONTEXT_CHARS,
  buildTutorContext,
  buildTutorPrompt,
  withHumanizerSkill,
  createTutorSessionState,
  normalizeTutorSessionState,
  isTutorSessionMissingError,
} = require('../lib/tutor-context');

function fixtureCourse() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kimi-tutor-context-'));
  fs.mkdirSync(path.join(root, 'assessments'));
  fs.mkdirSync(path.join(root, 'learning-progress'));
  fs.writeFileSync(path.join(root, 'MISSION.md'), [
    '# Mission',
    '理解主要观点',
    '短讲解后马上练习',
    '15 到 25 分钟',
  ].join('\n'));
  fs.writeFileSync(path.join(root, 'notes.json'), JSON.stringify([{
    section: '因果推断',
    anchor: { exact: '相关不等于因果' },
    custom: '把这个原则用在增长实验里',
    createdAt: 10,
    updatedAt: 20,
  }]));
  fs.writeFileSync(path.join(root, 'assessments', '0001-example.json'), JSON.stringify({
    claims: [
      { id: 'claim-mastered', label: '能解释相关与因果的区别' },
      { id: 'claim-weak', label: '能识别混杂变量' },
    ],
    activities: [{
      id: 'q-weak',
      claimId: 'claim-weak',
      prompt: '哪个变量可能同时影响曝光和转化？',
      correctOptionId: 'secret-answer',
      misconceptions: [{ id: 'm-confounder', feedback: '把结果变量当成了混杂变量' }],
    }],
  }));
  fs.writeFileSync(path.join(root, 'learning-progress', '0001-example.json'), JSON.stringify({
    mastery: {
      'claim-mastered': { claimId: 'claim-mastered', label: '能解释相关与因果的区别', mastered: true },
      'claim-weak': { claimId: 'claim-weak', label: '能识别混杂变量', mastered: false },
    },
    attempts: [{
      activityId: 'q-weak',
      claimId: 'claim-weak',
      attemptNumber: 1,
      passed: false,
      misconceptionId: 'm-confounder',
      submittedAt: '2026-07-21T00:00:00.000Z',
    }],
  }));
  return root;
}

test('builds a compact tutor context from mission, notes, mastery, and misconceptions', () => {
  const root = fixtureCourse();
  const context = buildTutorContext(root, {
    lesson: 'Lesson 1 · 因果推断',
    section: '混杂变量',
    selectedText: '观察到同时变化，不能直接证明因果。',
    surrounding: '需要考虑共同原因。',
  });

  assert.match(context, /理解主要观点/);
  assert.match(context, /能解释相关与因果的区别/);
  assert.match(context, /能识别混杂变量/);
  assert.match(context, /把结果变量当成了混杂变量/);
  assert.match(context, /增长实验/);
  assert.match(context, /观察到同时变化/);
  assert.equal(context.includes('secret-answer'), false);
  assert.ok(context.length <= MAX_CONTEXT_CHARS);
});

test('uses the uploaded humanizer skill only for tutor session bootstrap', () => {
  const root = fixtureCourse();
  const prompt = buildTutorPrompt({ courseDir: root, message: '这个例子怎么理解？' });
  assert.match(withHumanizerSkill(prompt, false), /^\/skill:humanizer-zh/);
  assert.equal(withHumanizerSkill(prompt, true), prompt);
});

test('bootstraps tutor without inventing a Kimi session id', () => {
  assert.deepEqual(createTutorSessionState(), {
    schemaVersion: 1,
    sessionId: null,
    initialized: false,
    preferredMode: 'stream-json',
  });
});

test('discards legacy fabricated tutor sessions and keeps real Kimi sessions', () => {
  assert.equal(normalizeTutorSessionState({
    sessionId: 'kimi-study-course123-tutor-fixed-nonce',
    initialized: true,
  }).initialized, false);
  assert.deepEqual(normalizeTutorSessionState({
    sessionId: 'session_real_123',
    initialized: true,
    preferredMode: 'wire',
  }), {
    schemaVersion: 1,
    sessionId: 'session_real_123',
    initialized: true,
    preferredMode: 'wire',
  });
});

test('recognizes missing-session failures so the tutor can self-heal once', () => {
  assert.equal(isTutorSessionMissingError(new Error('Session "session_old" not found.')), true);
  assert.equal(isTutorSessionMissingError(new Error('network timeout')), false);
});
