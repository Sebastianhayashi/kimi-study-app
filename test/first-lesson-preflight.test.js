'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { preflightFirstLesson } = require('../lib/first-lesson-preflight');
const { buildNextLessonPrompt } = require('../lib/next-lesson');
const { captureNextLessonBaseline } = require('../lib/next-lesson');
const {
  ASSESSMENT_MACHINE_CONTRACT_LINES,
  LESSON_PEDAGOGY_CONTRACT_LINES,
  preflightInstruction,
} = require('../lib/assessment-machine-contract');

const WORKED_EXAMPLE = '<section data-worked-example data-source-ref="source:book#chapter-1"><p data-worked-example-step="1">识别限制并解释原因。</p><p data-worked-example-step="2">判断动作并解释原因。</p></section>';

function course() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kimi-first-preflight-'));
  fs.mkdirSync(path.join(root, 'lessons'));
  fs.mkdirSync(path.join(root, 'assessments'));
  fs.writeFileSync(path.join(root, 'MISSION.md'), '# Mission\n应用到真实场景');
  return root;
}

function validSpec() {
  return {
    schemaVersion: 1,
    lessonId: '0001-intro',
    title: '入门练习',
    claims: [{
      id: 'claim-1',
      label: '能应用核心方法',
      description: '该能力直接支撑 Mission 的期望产出',
      sourceRefs: ['source:book#chapter-1'],
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
      sourceRefs: ['source:book#chapter-1'],
      feedback: { correct: '正确', incorrect: '比较选项是否解释了结构和行动。' },
      hints: [{ content: '寻找同时包含限制与动作空间的选项。' }],
    }, {
      id: 'transfer-1',
      type: 'short-answer',
      claimId: 'claim-1',
      stage: 'transfer',
      prompt: '把方法应用到一个正文未出现的新场景，并解释为什么有效。',
      scoring: { mode: 'completion', minimumLength: 40 },
      sourceRefs: ['source:book#chapter-1'],
      feedback: { correct: '已记录', incorrect: '请补充场景、动作和理由。' },
      hints: [{ content: '说明限制、动作空间和结果之间的关系。' }],
    }],
  };
}

test('first-lesson preflight accepts a valid first lesson without a transaction baseline', () => {
  const root = course();
  fs.writeFileSync(
    path.join(root, 'lessons', '0001-intro.html'),
    `${WORKED_EXAMPLE}<div data-kimi-activity="hinge-1"></div><div data-kimi-activity="transfer-1"></div>`,
  );
  fs.writeFileSync(
    path.join(root, 'assessments', '0001-intro.json'),
    JSON.stringify(validSpec()),
  );

  const result = preflightFirstLesson(root);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(result.lessons.length, 1);
  assert.equal(result.lessons[0].lesson, '0001-intro.html');
});

test('first-lesson preflight fails when no lesson exists', () => {
  const root = course();
  const result = preflightFirstLesson(root);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('no lesson HTML found')));
});

test('first-lesson preflight surfaces the same validator errors the server would raise', () => {
  const root = course();
  fs.writeFileSync(
    path.join(root, 'lessons', '0001-intro.html'),
    '<div data-kimi-activity="invented-1"></div>',
  );
  fs.writeFileSync(
    path.join(root, 'assessments', '0001-intro.json'),
    JSON.stringify({
      schemaVersion: 1,
      lessonId: '0001-intro',
      claims: [{ id: 'claim-1', label: '模糊目标' }],
      activities: [{ id: 'invented-1', type: 'ties', claimId: 'claim-1', stage: 'application', prompt: '尝试一下' }],
    }),
  );

  const result = preflightFirstLesson(root);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('type is unsupported')));
  assert.ok(result.errors.some((error) => error.includes('sourceRefs is required')));
});

test('next-lesson prompt keeps the shared machine contract verbatim (drift guard)', () => {
  const root = course();
  fs.writeFileSync(path.join(root, 'lessons', '0001-intro.html'), '<html>one</html>');
  fs.writeFileSync(path.join(root, 'assessments', '0001-intro.json'), '{}');
  const baseline = captureNextLessonBaseline(root);
  const prompt = buildNextLessonPrompt(root, baseline, { validatorCommand: 'node x.js' });
  for (const line of ASSESSMENT_MACHINE_CONTRACT_LINES) {
    assert.ok(prompt.includes(line), `prompt missing contract line: ${line.slice(0, 30)}`);
  }
  for (const line of LESSON_PEDAGOGY_CONTRACT_LINES) {
    assert.ok(prompt.includes(line), `prompt missing pedagogy line: ${line.slice(0, 30)}`);
  }
  for (const line of preflightInstruction('node x.js')) {
    assert.ok(prompt.includes(line), `prompt missing preflight line: ${line.slice(0, 30)}`);
  }
});
