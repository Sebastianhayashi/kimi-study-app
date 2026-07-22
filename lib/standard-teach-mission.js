'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { writeJsonAtomic, OnboardingError } = require('./onboarding');

const MISSION_SESSION_FILE = 'mission-session.json';
const GENERATOR_SESSION_FILE = 'generator-session.json';
const MAX_ANSWER_CHARS = 4000;

function missionSessionPath(courseDir) {
  return path.join(courseDir, MISSION_SESSION_FILE);
}

function createMissionSessionState() {
  return {
    schemaVersion: 1,
    mode: 'standard',
    sessionId: null,
    initialized: false,
    preferredMode: 'stream-json',
  };
}

function normalizeMissionSessionState(value) {
  const source = value && typeof value === 'object' ? value : {};
  const sessionId = typeof source.sessionId === 'string' && /^session_[a-z0-9_-]+$/i.test(source.sessionId)
    ? source.sessionId
    : null;
  return {
    schemaVersion: 1,
    mode: 'standard',
    sessionId,
    initialized: Boolean(source.initialized && sessionId),
    preferredMode: source.preferredMode === 'wire' || source.preferredMode === 'text'
      ? source.preferredMode
      : 'stream-json',
  };
}

function readMissionSessionState(courseDir) {
  try {
    return normalizeMissionSessionState(JSON.parse(fs.readFileSync(missionSessionPath(courseDir), 'utf8')));
  } catch (error) {
    if (error.code === 'ENOENT') return createMissionSessionState();
    throw new OnboardingError('INVALID_MISSION_SESSION', 'Mission 会话状态无法读取', 500);
  }
}

function writeMissionSessionState(courseDir, value) {
  const state = normalizeMissionSessionState(value);
  writeJsonAtomic(missionSessionPath(courseDir), state);
  return state;
}

function cleanAnswer(value) {
  const answer = String(value || '').trim();
  if (!answer) throw new OnboardingError('MISSION_ANSWER_REQUIRED', '请先回答这个问题', 422);
  if (answer.length > MAX_ANSWER_CHARS) {
    throw new OnboardingError('MISSION_ANSWER_TOO_LONG', '回答不能超过 4000 个字符', 422);
  }
  return answer;
}

function parseMissionTurn(text) {
  const raw = String(text || '').trim();
  const unfenced = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  let value;
  try { value = JSON.parse(unfenced); }
  catch { throw new OnboardingError('INVALID_MISSION_RESPONSE', 'Teach 没有返回可读取的 Mission 状态', 502); }
  const status = String(value && value.status || '');
  const materialSummary = String(value && value.materialSummary || '').trim().slice(0, 800);
  if (status === 'question') {
    const question = String(value.question || '').trim().slice(0, 800);
    if (!question) throw new OnboardingError('INVALID_MISSION_RESPONSE', 'Teach 没有返回 Mission 问题', 502);
    return { status, question, materialSummary };
  }
  if (status === 'ready') {
    const summary = String(value.summary || '').trim().slice(0, 1200);
    if (!summary) throw new OnboardingError('INVALID_MISSION_RESPONSE', 'Teach 没有返回 Mission 摘要', 502);
    return { status, summary, materialSummary };
  }
  throw new OnboardingError('INVALID_MISSION_RESPONSE', 'Teach 返回了未知的 Mission 状态', 502);
}

function validateMissionDocument(courseDir) {
  const file = path.join(courseDir, 'MISSION.md');
  let markdown;
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0 || stat.size > 32 * 1024) throw new Error('invalid file');
    markdown = fs.readFileSync(file, 'utf8');
  } catch {
    throw new OnboardingError('MISSION_NOT_WRITTEN', 'Teach 尚未写出有效的 MISSION.md', 502);
  }
  const required = [
    /^# Mission:\s*.+$/m,
    /^## Why\s*$/m,
    /^## Success looks like\s*$/m,
    /^## Constraints\s*$/m,
    /^## Out of scope\s*$/m,
  ];
  if (!required.every((pattern) => pattern.test(markdown))) {
    throw new OnboardingError('INVALID_MISSION_DOCUMENT', 'MISSION.md 不符合 Teach Skill 的格式', 502);
  }
  return markdown;
}

function initialMissionPrompt(extension) {
  return [
    `/skill:teach 用户上传了当前目录中的 book${extension}，现在走默认的一般模式。`,
    '先对整份材料做一次轻量但覆盖主要结构的快速通读：识别材料类型、目录或章节结构、主要主题、受众和难度。',
    '不要执行全书深度阅读门禁、RIA-TV++、CURRICULUM-BLUEPRINT 或 lesson brief；这些属于未来的深度模式。',
    '当前唯一任务是按原版 teach Skill 的 Mission 流程了解用户为什么学习。不要生成课程、RESOURCES.md、lesson、assessment、map 或其他教学产物。',
    '如果 Mission 还不清楚，只问一个最有信息量、与材料上下文相关的自然语言问题。',
    '如果无需追问即可形成具体 Mission，按 skills/teach/MISSION-FORMAT.md 写 MISSION.md。',
    '最后只输出一行严格 JSON，不要 Markdown、解释或隐藏推理：',
    '{"status":"question","question":"一个问题","materialSummary":"对材料的简短理解"}',
    '或在已写好 MISSION.md 时输出：',
    '{"status":"ready","summary":"供用户确认的 Mission 摘要","materialSummary":"对材料的简短理解"}',
  ].join('\n');
}

function answerMissionPrompt(answer) {
  return [
    '继续原版 teach Skill 的 Mission 访谈。',
    `用户本轮回答：${JSON.stringify(cleanAnswer(answer))}`,
    '结合当前 Session 中已经快速通读的材料与之前回答，判断 Mission 是否已经具体到现实目标、可观察成功、约束和明确排除项。',
    '信息不足时只问一个下一问题；信息充分时按 skills/teach/MISSION-FORMAT.md 写入或更新 MISSION.md。',
    '不要生成课程、资源、lesson、assessment、map 或深度阅读产物。',
    '最后只输出一行严格 JSON：',
    '{"status":"question","question":"一个问题","materialSummary":"对材料的简短理解"}',
    '或 {"status":"ready","summary":"供用户确认的 Mission 摘要","materialSummary":"对材料的简短理解"}',
  ].join('\n');
}

function promoteMissionSession(courseDir) {
  const state = readMissionSessionState(courseDir);
  if (!state.initialized || !state.sessionId) {
    throw new OnboardingError('MISSION_SESSION_MISSING', 'Teach Mission 会话不可恢复', 409);
  }
  const generator = {
    schemaVersion: 2,
    sessionId: state.sessionId,
    initialized: true,
    preferredMode: state.preferredMode,
  };
  writeJsonAtomic(path.join(courseDir, GENERATOR_SESSION_FILE), generator);
  return generator;
}

module.exports = {
  MAX_ANSWER_CHARS,
  answerMissionPrompt,
  cleanAnswer,
  createMissionSessionState,
  initialMissionPrompt,
  missionSessionPath,
  normalizeMissionSessionState,
  parseMissionTurn,
  promoteMissionSession,
  readMissionSessionState,
  validateMissionDocument,
  writeMissionSessionState,
};
