'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { captureNextLessonBaseline } = require('../lib/next-lesson');
const {
  cleanupNextLessonDelta,
  validateNextLessonDelta,
  validatePublishedLesson,
} = require('../lib/lesson-publish-validator');

function root() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kimi-publish-validator-'));
  fs.mkdirSync(path.join(dir, 'lessons'));
  fs.mkdirSync(path.join(dir, 'assessments'));
  fs.writeFileSync(path.join(dir, 'MISSION.md'), '# Mission');
  fs.writeFileSync(path.join(dir, 'map.json'), '{"path":["one"]}');
  fs.writeFileSync(path.join(dir, 'lessons', '0001-one.html'), '<html>old</html>');
  fs.writeFileSync(path.join(dir, 'assessments', '0001-one.json'), '{}');
  return dir;
}

function validSpec(base = '0002-two') {
  return {
    schemaVersion: 1,
    lessonId: base,
    title: '第二课',
    claims: [{
      id: 'claim-2',
      label: '能应用第二课原则',
      sourceRefs: ['source:book#2'],
      mastery: { requiredPassed: 2, requiredStages: ['independent', 'transfer'] },
    }],
    activities: [{
      id: 'hinge-2',
      type: 'single-choice',
      claimId: 'claim-2',
      stage: 'independent',
      prompt: '在一个新的例子中，哪项解释最符合第二课原则？',
      options: [
        { id: 'a', label: '它改变了关键限制，因此产生新的动作空间' },
        { id: 'b', label: '它只是增加奖励，所以参与一定会更深入', misconceptionId: 'reward' },
        { id: 'c', label: '它消除了全部规则，所以行动自然更自由', misconceptionId: 'no-rules' },
        { id: 'd', label: '它只改变即时情绪，所以机制本身没有变化', misconceptionId: 'mood' },
      ],
      correctOptionId: 'a',
      misconceptions: [
        { id: 'reward', belief: '奖励本身就是机制', feedback: '奖励不等于改变动作空间。' },
        { id: 'no-rules', belief: '自由等于没有规则', feedback: '有意义的限制可能创造行动空间。' },
        { id: 'mood', belief: '体验只由情绪变化解释', feedback: '需要判断结构和行动可能性是否变化。' },
      ],
      feedback: { correct: '正确', incorrect: '比较每个解释所指向的机制。' },
      hints: [{ content: '先判断哪个选项解释了结构变化。' }],
      sourceRefs: ['source:book#2'],
    }, {
      id: 'transfer-2',
      type: 'short-answer',
      claimId: 'claim-2',
      stage: 'transfer',
      prompt: '把第二课原则应用到一个正文没有直接出现的新场景，并解释理由。',
      scoring: { mode: 'completion', minimumLength: 40 },
      feedback: { correct: '已记录', incorrect: '请补充具体场景、应用方式和理由。' },
      hints: [{ content: '说明限制、动作空间和预期结果之间的关系。' }],
      sourceRefs: ['source:book#2'],
    }],
  };
}

function writePair(dir, html, spec = validSpec()) {
  fs.writeFileSync(path.join(dir, 'lessons', '0002-two.html'), html);
  fs.writeFileSync(path.join(dir, 'assessments', '0002-two.json'), JSON.stringify(spec));
}

test('accepts one matched lesson and assessment with exact activity mounts', () => {
  const dir = root();
  const baseline = captureNextLessonBaseline(dir);
  writePair(dir, '<html><body><div data-kimi-activity="hinge-2"></div><div data-kimi-activity="transfer-2"></div></body></html>');
  const result = validateNextLessonDelta(dir, baseline);
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.equal(result.newLesson, '0002-two.html');
});

test('rejects missing and orphan activity mounts', () => {
  const dir = root();
  writePair(dir, '<html><body><div data-kimi-activity="orphan"></div></body></html>');
  const result = validatePublishedLesson(dir, '0002-two.html');
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((item) => item.includes('no matching activity')));
  assert.ok(result.errors.some((item) => item.includes('not mounted')));
});

test('rejects answer-key fields leaked into lesson HTML', () => {
  const dir = root();
  writePair(dir, '<html><script>const answer = { correctOptionId: "a" };</script><div data-kimi-activity="hinge-2"></div><div data-kimi-activity="transfer-2"></div></html>');
  const result = validatePublishedLesson(dir, '0002-two.html');
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((item) => item.includes('private answer-key')));
});

test('rejects changes to protected existing course artifacts', () => {
  const dir = root();
  const baseline = captureNextLessonBaseline(dir);
  writePair(dir, '<html><body><div data-kimi-activity="hinge-2"></div><div data-kimi-activity="transfer-2"></div></body></html>');
  fs.writeFileSync(path.join(dir, 'map.json'), '{"path":["changed"]}');
  const result = validateNextLessonDelta(dir, baseline);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((item) => item.includes('existing workspace file changed: map.json')));
});


test('rejects an unexpected third file and cleanup removes all current-run additions', () => {
  const dir = root();
  const baseline = captureNextLessonBaseline(dir);
  writePair(dir, '<html><body><div data-kimi-activity="hinge-2"></div><div data-kimi-activity="transfer-2"></div></body></html>');
  fs.writeFileSync(path.join(dir, 'extra-analysis.md'), 'unexpected');

  const result = validateNextLessonDelta(dir, baseline);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((item) => item.includes('unexpected new workspace file: extra-analysis.md')));

  const cleanup = cleanupNextLessonDelta(dir, baseline);
  assert.deepEqual(cleanup.removed, [
    'assessments/0002-two.json',
    'extra-analysis.md',
    'lessons/0002-two.html',
  ]);
  assert.deepEqual(cleanup.changedExisting, []);
  assert.equal(fs.existsSync(path.join(dir, 'lessons', '0001-one.html')), true);
  assert.equal(fs.existsSync(path.join(dir, 'assessments', '0001-one.json')), true);
});

test('rejects a symlinked assessment file', () => {
  const dir = root();
  const outside = path.join(dir, 'outside.json');
  fs.writeFileSync(outside, JSON.stringify(validSpec()));
  fs.writeFileSync(path.join(dir, 'lessons', '0002-two.html'), '<div data-kimi-activity="hinge-2"></div><div data-kimi-activity="transfer-2"></div>');
  fs.symlinkSync(outside, path.join(dir, 'assessments', '0002-two.json'));

  const result = validatePublishedLesson(dir, '0002-two.html');
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((item) => item.includes('assessment is missing or invalid JSON')));
});

test('detects changed existing files and marks them as unrecoverable by cleanup', () => {
  const dir = root();
  fs.writeFileSync(path.join(dir, 'book.txt'), 'original source');
  const baseline = captureNextLessonBaseline(dir);
  writePair(dir, '<html><body><div data-kimi-activity="hinge-2"></div><div data-kimi-activity="transfer-2"></div></body></html>');
  fs.writeFileSync(path.join(dir, 'book.txt'), 'changed source');

  const result = validateNextLessonDelta(dir, baseline);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((item) => item.includes('existing workspace file changed: book.txt')));

  const cleanup = cleanupNextLessonDelta(dir, baseline);
  assert.deepEqual(cleanup.changedExisting, ['book.txt']);
  assert.equal(fs.existsSync(path.join(dir, 'lessons', '0002-two.html')), false);
  assert.equal(fs.readFileSync(path.join(dir, 'book.txt'), 'utf8'), 'changed source');
});
