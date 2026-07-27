'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  MAX_CONTEXT_CHARS,
  recentLessonFeedback,
  recentArtifactFocus,
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
      { id: 'claim-mastered', label: '能解释相关与因果的区别', sourceRefs: ['source:book#confounders'] },
      { id: 'claim-weak', label: '能识别混杂变量', sourceRefs: ['source:book#confounders'] },
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
  fs.writeFileSync(path.join(root, 'learning-activity.json'), JSON.stringify([
    { id: 'open', type: 'lesson-opened', lessonFile: '0001-example.html', timestamp: 1 },
    { id: 'old', type: 'lesson-feedback', lessonFile: '0001-example.html', signal: 'aligned', detail: '旧选择', timestamp: 10 },
    { id: 'latest', type: 'lesson-feedback', lessonFile: '0001-example.html', signal: 'deeper', detail: '需要更严格的边界条件', timestamp: 20 },
  ]));
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
  assert.match(context, /最近课节反馈/);
  assert.match(context, /deeper/);
  assert.match(context, /需要更严格的边界条件/);
  assert.match(context, /source:book#confounders/);
  assert.equal(context.includes('旧选择'), false);
  assert.match(context, /观察到同时变化/);
  assert.equal(context.includes('secret-answer'), false);
  assert.ok(context.length <= MAX_CONTEXT_CHARS);
});

test('feedback projection is latest-wins, bounded, and excludes answer keys', () => {
  const root = fixtureCourse();
  const events = JSON.parse(fs.readFileSync(path.join(root, 'learning-activity.json'), 'utf8'));
  for (let index = 2; index <= 8; index += 1) {
    const lessonFile = `${String(index).padStart(4, '0')}-example.html`;
    fs.writeFileSync(path.join(root, 'assessments', lessonFile.replace(/\.html$/, '.json')), JSON.stringify({
      claims: [{ id: `claim-${index}`, label: `能力 ${index}`, sourceRefs: [`source:book#${index}`] }],
      activities: [{ correctOptionId: `secret-${index}`, sourceRefs: [`source:book#${index}`] }],
    }));
    events.push({ id: `feedback-${index}`, type: 'lesson-feedback', lessonFile, signal: index % 2 ? 'faster' : 'aligned', detail: 'x'.repeat(400), timestamp: 20 + index });
  }
  fs.writeFileSync(path.join(root, 'learning-activity.json'), JSON.stringify(events));

  const projection = recentLessonFeedback(root);
  assert.equal(projection.length, 5);
  assert.equal(projection[0].lessonFile, '0008-example.html');
  assert.equal(projection.some((item) => item.lessonFile === '0001-example.html'), false);
  assert.equal(projection.every((item) => item.detail.length <= 240), true);
  assert.equal(JSON.stringify(projection).includes('secret-'), false);
});


test('artifact focus projection is latest-only, bounded, and excludes body, answer keys, and other artifacts', () => {
  const root = fixtureCourse();
  const file = path.join(root, 'learning-activity.json');
  const events = JSON.parse(fs.readFileSync(file, 'utf8'));
  events.push({
    id: 'focus-old',
    type: 'artifact-gap-focus',
    artifactId: 'a_oldartifact000001',
    gapId: 'g_old',
    rubricItemId: 'r_old',
    gapSummary: 'Old gap must not survive latest-wins projection.',
    sourceRefs: ['source:old#1'],
    supportKind: 'next-lesson',
    body: 'OLD FULL BODY SECRET',
    answerKey: 'old-secret-answer',
    timestamp: 30,
  });
  events.push({
    id: 'focus-latest',
    type: 'artifact-gap-focus',
    artifactId: 'a_currentartifact01',
    gapId: 'g_current',
    rubricItemId: 'r_evidence',
    gapSummary: `${'需要补强材料到论断之间的因果桥。'.repeat(40)}`,
    sourceRefs: ['source:book#mechanism', 'source:book#boundary', 'source:book#third', 'source:book#fourth', 'source:book#fifth'],
    supportKind: 'next-lesson',
    body: 'CURRENT FULL BODY SECRET',
    answerKey: 'current-secret-answer',
    otherArtifact: { id: 'a_otherartifact001', title: 'Other artifact secret' },
    decisionReason: 'private decision reason',
    timestamp: 40,
  });
  fs.writeFileSync(file, JSON.stringify(events));

  const projection = recentArtifactFocus(root);
  assert.deepEqual(Object.keys(projection).sort(), [
    'artifactId', 'gapId', 'gapSummary', 'rubricItemId', 'sourceRefs', 'supportKind', 'timestamp',
  ]);
  assert.equal(projection.artifactId, 'a_currentartifact01');
  assert.equal(projection.gapSummary.length, 500);
  assert.equal(projection.sourceRefs.length, 4);
  assert.equal(JSON.stringify(projection).includes('FULL BODY'), false);
  assert.equal(JSON.stringify(projection).includes('secret-answer'), false);
  assert.equal(JSON.stringify(projection).includes('Other artifact'), false);
  assert.equal(JSON.stringify(projection).includes('decision reason'), false);

  const context = buildTutorContext(root);
  assert.match(context, /【当前作品缺口】/);
  assert.match(context, /a_currentartifact01/);
  assert.ok(context.indexOf('【当前作品缺口】') < context.indexOf('【最近课节反馈】'));
  assert.equal(context.includes('a_oldartifact000001'), false);
  assert.equal(context.includes('FULL BODY SECRET'), false);
  assert.equal(context.includes('secret-answer'), false);
  assert.equal(context.includes('a_otherartifact001'), false);
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
    sessionId: 'lucubro-course123-tutor-fixed-nonce',
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
