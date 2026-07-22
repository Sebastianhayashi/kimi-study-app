'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  answerMissionPrompt,
  initialMissionPrompt,
  normalizeMissionSessionState,
  parseMissionTurn,
  promoteMissionSession,
  validateMissionDocument,
  writeMissionSessionState,
} = require('../lib/standard-teach-mission');

function tempCourse() { return fs.mkdtempSync(path.join(os.tmpdir(), 'kimi-standard-mission-')); }

test('standard mode invokes original teach and excludes deep gates', () => {
  const prompt = initialMissionPrompt('.epub');
  assert.match(prompt, /^\/skill:teach/);
  assert.match(prompt, /快速通读/);
  assert.match(prompt, /不要执行.*RIA-TV\+\+/s);
  assert.doesNotMatch(prompt, /理解主要观点|应用到真实场景/);
  assert.match(answerMissionPrompt('我想改善团队决策'), /继续原版 teach Skill/);
});

test('parses bounded Mission turn envelopes', () => {
  assert.equal(parseMissionTurn('{"status":"question","question":"现实目标是什么？","materialSummary":"系统思考"}').status, 'question');
  assert.equal(parseMissionTurn('```json\n{"status":"ready","summary":"形成可执行目标","materialSummary":"系统思考"}\n```').status, 'ready');
  assert.throws(() => parseMissionTurn('{"status":"question"}'), /Mission 问题/);
  assert.throws(() => parseMissionTurn('not json'), /Mission 状态/);
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
