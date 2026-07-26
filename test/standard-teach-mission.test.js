'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  auditMissionSemantics,
  answerMissionPrompt,
  compileMissionDocument,
  initialMissionPrompt,
  isRepairableMissionError,
  materializeMissionDocument,
  missionPresentationFromMarkdown,
  normalizeMissionSessionState,
  parseMissionTurn,
  promoteMissionSession,
  repairMissionPrompt,
  validateMissionDocument,
  writeMissionSessionState,
} = require('../lib/standard-teach-mission');

function tempCourse() { return fs.mkdtempSync(path.join(os.tmpdir(), 'kimi-standard-mission-')); }

const missionSpec = {
  topic: '把创作过程变成稳定的公开分享习惯',
  why: '每周公开一次可复用的创作进展，并通过反馈改善下一次输出。',
  successLooksLike: ['能设计一套每周分享流程', '能从反馈中选择下一步行动'],
  constraints: ['每次学习 20 分钟', '优先使用书中的轻量方法'],
  outOfScope: ['本轮不学习复杂的个人品牌投放'],
};

test('standard mode invokes original teach, returns choices first, and excludes deep gates', () => {
  const prompt = initialMissionPrompt('.epub');
  assert.match(prompt, /^\/skill:teach/);
  assert.match(prompt, /目录或章节标题/);
  assert.match(prompt, /不要在提出第一个问题前遍历或深度读取整份材料/);
  assert.match(prompt, /不要执行.*RIA-TV\+\+/s);
  assert.match(prompt, /3 到 5 个可直接选择的答案/);
  assert.match(prompt, /"options"/);
  assert.match(prompt, /successLooksLike/);
  assert.match(prompt, /successLooksLike\[0\].*期望产出/);
  assert.match(prompt, /successLooksLike\[1\.\.\].*成功证据/);
  assert.match(prompt, /读完多少章|覆盖多少材料/);
  assert.doesNotMatch(prompt, /理解主要观点|应用到真实场景/);
  const answerPrompt = answerMissionPrompt('用户选择：改善团队决策');
  assert.match(answerPrompt, /继续原版 teach Skill/);
  assert.match(answerPrompt, /补充说明只能是可选的/);
});

test('parses bounded Mission turn envelopes including structured ready content', () => {
  const question = parseMissionTurn(JSON.stringify({
    status: 'question',
    question: '现实目标是什么？',
    options: [
      { id: 'team', label: '改善团队决策', description: '用于项目复盘与选择。' },
      { id: 'creative', label: '改善创作方法' },
      { id: 'explore', label: '还不确定，先探索' },
    ],
    materialSummary: '系统思考',
  }));
  assert.equal(question.status, 'question');
  assert.equal(question.options[0].id, 'team');
  const ready = parseMissionTurn(JSON.stringify({
    status: 'ready',
    summary: '形成可执行目标',
    materialSummary: '系统思考',
    mission: missionSpec,
  }));
  assert.equal(ready.status, 'ready');
  assert.equal(ready.mission.topic, missionSpec.topic);
  assert.throws(() => parseMissionTurn('{"status":"question","question":"现实目标是什么？"}'), /可选答案/);
  assert.throws(() => parseMissionTurn('{"status":"question"}'), /Mission 问题/);
  assert.throws(() => parseMissionTurn('not json'), /Mission 状态/);
  assert.throws(() => parseMissionTurn('{"status":"ready","summary":"ok","mission":{"topic":"x"}}'), /成功标准|现实目标/);
});

test('application code publishes the canonical upstream Mission format from structured content', () => {
  const course = tempCourse();
  const markdown = compileMissionDocument(missionSpec);
  assert.match(markdown, /^# Mission: 把创作过程/m);
  assert.match(markdown, /^## Why$/m);
  assert.match(markdown, /^## Success looks like$/m);
  assert.match(markdown, /^## Constraints$/m);
  assert.match(markdown, /^## Out of scope$/m);
  materializeMissionDocument(course, { status: 'ready', mission: missionSpec });
  assert.equal(fs.readFileSync(path.join(course, 'MISSION.md'), 'utf8'), markdown);
  assert.deepEqual(missionPresentationFromMarkdown(markdown), {
    problemStatement: missionSpec.why,
    expectedOutput: missionSpec.successLooksLike[0],
    successEvidence: missionSpec.successLooksLike.slice(1),
  });
  validateMissionDocument(course);
  fs.rmSync(course, { recursive: true, force: true });
});

test('legacy ready output remains compatible when Teach already wrote a valid document', () => {
  const course = tempCourse();
  fs.writeFileSync(path.join(course, 'MISSION.md'), '# Mission: 改善团队决策\n\n## Why\n减少表面修补。\n\n## Success looks like\n- 能画反馈回路\n\n## Constraints\n- 每次 20 分钟\n\n## Out of scope\n- 暂不学仿真软件\n');
  materializeMissionDocument(course, { status: 'ready', mission: null });
  fs.rmSync(course, { recursive: true, force: true });
});

test('repair prompt preserves the current Session and excludes course generation', () => {
  const prompt = repairMissionPrompt();
  assert.match(prompt, /不要重新询问用户/);
  assert.match(prompt, /已有的用户回答/);
  assert.match(prompt, /successLooksLike/);
  assert.match(prompt, /不要生成 RESOURCES\.md/);
  assert.match(prompt, /同一个问题/);
  assert.match(prompt, /"options"/);
  assert.equal(isRepairableMissionError({ code: 'INVALID_MISSION_DOCUMENT' }), true);
  assert.equal(isRepairableMissionError({ code: 'MISSION_SEMANTIC_REPAIR_NEEDED' }), true);
  assert.equal(isRepairableMissionError({ code: 'MISSION_SESSION_MISSING' }), false);
});

test('Mission output contract requires one expected output plus success evidence', () => {
  assert.throws(() => compileMissionDocument({
    ...missionSpec,
    successLooksLike: ['一项孤立目标'],
  }), /期望产出.*成功证据/);

  assert.deepEqual(auditMissionSemantics(missionSpec), []);
  assert.match(auditMissionSemantics({
    ...missionSpec,
    successLooksLike: ['掌握核心内容', '感觉更有信心'],
  }).join('\n'), /abstract|self-reported/);
  assert.match(auditMissionSemantics({
    ...missionSpec,
    successLooksLike: ['读完全部章节', '写出一份可审阅的提纲'],
  }).join('\n'), /coverage/);
});

test('validates upstream Mission format and promotes canonical Session', () => {
  const course = tempCourse();
  fs.writeFileSync(path.join(course, 'MISSION.md'), '# Mission: 改善团队决策\n\n## Why\n减少表面修补。\n\n## Success looks like\n- 能画反馈回路\n\n## Constraints\n- 每次 20 分钟\n\n## Out of scope\n- 暂不学仿真软件\n');
  validateMissionDocument(course);
  writeMissionSessionState(course, { sessionId: 'session_standard123', initialized: true, preferredMode: 'stream-json' });
  const generator = promoteMissionSession(course);
  assert.equal(generator.sessionId, 'session_standard123');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(course, 'generator-session.json'), 'utf8')), generator);
  fs.rmSync(course, { recursive: true, force: true });
});

test('invalid aliases do not become resumable Sessions', () => {
  assert.equal(normalizeMissionSessionState({ sessionId: 'friendly-alias', initialized: true }).initialized, false);
});
