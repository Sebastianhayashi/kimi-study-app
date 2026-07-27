'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  captureNextLessonBaseline,
  writeNextLessonTransaction,
} = require('../lib/next-lesson');
const { preflightNextLesson } = require('../lib/next-lesson-preflight');

function course() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kimi-next-preflight-'));
  fs.mkdirSync(path.join(root, 'lessons'));
  fs.mkdirSync(path.join(root, 'assessments'));
  fs.writeFileSync(path.join(root, 'MISSION.md'), '# Mission\n应用到真实场景');
  fs.writeFileSync(path.join(root, 'lessons', '0001-intro.html'), '<html>one</html>');
  fs.writeFileSync(path.join(root, 'assessments', '0001-intro.json'), '{}');
  const baseline = captureNextLessonBaseline(root);
  writeNextLessonTransaction(root, baseline);
  return root;
}

function validSpec() {
  return {
    schemaVersion: 1,
    lessonId: '0002-apply',
    title: '应用练习',
    claims: [{
      id: 'claim-1',
      label: '能应用核心方法',
      sourceRefs: ['source:book#chapter-2'],
      mastery: { requiredPassed: 2, requiredStages: ['independent', 'transfer'] },
    }],
    activities: [{
      id: 'hinge-1',
      type: 'single-choice',
      claimId: 'claim-1',
      stage: 'independent',
      prompt: '面对一个新场景，哪个判断真正使用了本课方法？',
      options: [
        { id: 'a', label: '先识别关键限制，再设计可执行的小动作' },
        { id: 'b', label: '先增加外部奖励，再假设参与自然提高', misconceptionId: 'reward' },
        { id: 'c', label: '先取消全部规则，再等待自由自动出现', misconceptionId: 'no-rules' },
        { id: 'd', label: '先改变表达语气，再忽略行动结构变化', misconceptionId: 'tone' },
      ],
      correctOptionId: 'a',
      misconceptions: [
        { id: 'reward', belief: '把奖励当成方法本身', feedback: '奖励没有回答动作空间如何变化。' },
        { id: 'no-rules', belief: '认为没有规则才有自由', feedback: '限制有时会创造可行动的结构。' },
        { id: 'tone', belief: '只关注表达而忽略机制', feedback: '需要判断真实行动是否变化。' },
      ],
      sourceRefs: ['source:book#chapter-2'],
      feedback: { correct: '正确', incorrect: '比较选项是否解释了结构和行动。' },
      hints: [{ content: '寻找同时包含限制与动作空间的选项。' }],
    }, {
      id: 'transfer-1',
      type: 'short-answer',
      claimId: 'claim-1',
      stage: 'transfer',
      prompt: '把方法应用到一个正文未出现的新场景，并解释为什么有效。',
      scoring: { mode: 'completion', minimumLength: 40 },
      sourceRefs: ['source:book#chapter-2'],
      feedback: { correct: '已记录', incorrect: '请补充场景、动作和理由。' },
      hints: [{ content: '说明限制、动作空间和结果之间的关系。' }],
    }],
  };
}

test('preflight accepts the exact diagnostic lesson and assessment contract', () => {
  const root = course();
  fs.writeFileSync(
    path.join(root, 'lessons', '0002-apply.html'),
    '<section data-worked-example data-source-ref="source:book#chapter-2"><p data-worked-example-step="1">先识别关键限制并解释原因。</p><p data-worked-example-step="2">再判断动作空间并解释原因。</p></section><div data-kimi-activity="hinge-1"></div><div data-kimi-activity="transfer-1"></div>',
  );
  fs.writeFileSync(
    path.join(root, 'assessments', '0002-apply.json'),
    JSON.stringify(validSpec()),
  );

  const result = preflightNextLesson(root);
  assert.equal(result.ok, true);
  assert.equal(result.newLesson, '0002-apply.html');
  assert.equal(result.newAssessment, '0002-apply.json');
});

test('preflight returns actionable schema and publication errors before the model exits', () => {
  const root = course();
  fs.writeFileSync(
    path.join(root, 'lessons', '0002-apply.html'),
    '<div data-kimi-activity="invented-1"></div>',
  );
  fs.writeFileSync(
    path.join(root, 'assessments', '0002-apply.json'),
    JSON.stringify({
      schemaVersion: 1,
      lessonId: 'wrong-id',
      claims: [{ id: 'claim-1', label: '模糊目标' }],
      activities: [{
        id: 'invented-1',
        type: 'ties',
        claimId: 'claim-1',
        stage: 'application',
        prompt: '尝试一下',
      }],
    }),
  );

  const result = preflightNextLesson(root);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('sourceRefs is required')));
  assert.ok(result.errors.some((error) => error.includes('type is unsupported')));
  assert.ok(result.errors.some((error) => error.includes('stage is unsupported')));
  assert.ok(result.errors.some((error) => error.includes('feedback.correct')));
  assert.ok(result.errors.some((error) => error.includes('hints must be an array')));
  assert.ok(result.errors.some((error) => error.includes('assessment.lessonId must equal 0002-apply')));
  assert.ok(result.errors.some((error) => error.includes('no independent, transfer, or exit-ticket')));
});
