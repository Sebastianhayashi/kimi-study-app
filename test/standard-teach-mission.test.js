'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  answerMissionPrompt,
  compileMissionDocument,
  initialMissionPrompt,
  isRepairableMissionError,
  materializeMissionDocument,
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

test('standard mode invokes original teach, excludes deep gates, and requests a structured ready envelope', () => {
  const prompt = initialMissionPrompt('.epub');
  assert.match(prompt, /^\/skill:teach/);
  assert.match(prompt, /快速通读/);
  assert.match(prompt, /不要执行.*RIA-TV\+\+/s);
  assert.match(prompt, /successLooksLike/);
  assert.doesNotMatch(prompt, /理解主要观点|应用到真实场景/);
  assert.match(answerMissionPrompt('我想改善团队决策'), /继续原版 teach Skill/);
});

test('parses bounded Mission turn envelopes including structured ready content', () => {
  assert.equal(parseMissionTurn('{"status":"question","question":"现实目标是什么？","materialSummary":"系统思考"}').status, 'question');
  const ready = parseMissionTurn(JSON.stringify({
    status: 'ready',
    summary: '形成可执行目标',
    materialSummary: '系统思考',
    mission: missionSpec,
  }));
  assert.equal(ready.status, 'ready');
  assert.equal(ready.mission.topic, missionSpec.topic);
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
  assert.equal(isRepairableMissionError({ code: 'INVALID_MISSION_DOCUMENT' }), true);
  assert.equal(isRepairableMissionError({ code: 'MISSION_SESSION_MISSING' }), false);
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
