'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { atomicWriteFile, writeJsonAtomic, OnboardingError } = require('./onboarding');

const MISSION_SESSION_FILE = 'mission-session.json';
const GENERATOR_SESSION_FILE = 'generator-session.json';
const MAX_ANSWER_CHARS = 4000;
const MAX_MISSION_ITEMS = 8;
const MIN_MISSION_OPTIONS = 3;
const MAX_MISSION_OPTIONS = 5;
const MAX_OPTION_LABEL_CHARS = 180;
const MAX_OPTION_DESCRIPTION_CHARS = 320;
const REPAIRABLE_MISSION_CODES = new Set([
  'INVALID_MISSION_RESPONSE',
  'INVALID_MISSION_SPEC',
  'MISSION_NOT_WRITTEN',
  'INVALID_MISSION_DOCUMENT',
  'MISSION_SEMANTIC_REPAIR_NEEDED',
]);

const ABSTRACT_OUTPUT_PATTERN = /^(?:了解|理解|掌握|学习|提升|增强|熟悉|知道|认识|读完|看完|learn|understand|master|improve|become familiar|know|read|理解する|学ぶ|習得する|向上する)/i;
const COVERAGE_OUTPUT_PATTERN = /(?:读完|看完|学完|覆盖|完成阅读|全部章节|all chapters|finish reading|cover the material|全章|読み終える|全て読む)/i;
const CHECKABLE_OUTPUT_PATTERN = /(?:写|完成|产出|提交|交付|制作|创建|修订|设计|形成|做出|发布|回答|方案|草稿|大纲|清单|脚本|演示|决策|行动|记录|write|draft|ship|publish|produce|create|revise|design|deliver|submit|plan|outline|checklist|decision|action|record|作る|書く|提出|公開|修正|設計|作成|記録)/i;

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

function cleanMissionText(value, label, maxChars) {
  const text = String(value == null ? '' : value)
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxChars);
  if (!text) throw new OnboardingError('INVALID_MISSION_SPEC', `Teach 没有返回 ${label}`, 502);
  return text;
}

function cleanMissionList(value, label) {
  if (!Array.isArray(value)) {
    throw new OnboardingError('INVALID_MISSION_SPEC', `Teach 没有返回 ${label}`, 502);
  }
  const seen = new Set();
  const items = [];
  for (const item of value) {
    const clean = cleanMissionText(item, label, 240).replace(/^[-*]\s*/, '');
    if (seen.has(clean)) continue;
    seen.add(clean);
    items.push(clean);
    if (items.length >= MAX_MISSION_ITEMS) break;
  }
  if (!items.length) throw new OnboardingError('INVALID_MISSION_SPEC', `Teach 没有返回 ${label}`, 502);
  return items;
}

function cleanOptionId(value, index) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
  return normalized || `option_${index + 1}`;
}

function cleanMissionOptions(value) {
  if (!Array.isArray(value)) {
    throw new OnboardingError('INVALID_MISSION_RESPONSE', 'Teach 没有返回可选答案', 502);
  }
  if (value.length < MIN_MISSION_OPTIONS || value.length > MAX_MISSION_OPTIONS) {
    throw new OnboardingError('INVALID_MISSION_RESPONSE', 'Teach 必须返回 3 到 5 个可选答案', 502);
  }
  const ids = new Set();
  const labels = new Set();
  const options = [];
  for (const [index, item] of value.entries()) {
    const source = typeof item === 'string'
      ? { label: item }
      : item && typeof item === 'object' && !Array.isArray(item) ? item : {};
    const label = cleanMissionText(source.label, 'Mission 选项', MAX_OPTION_LABEL_CHARS);
    const id = cleanOptionId(source.id, index);
    const description = String(source.description || '')
      .replace(/[\u0000-\u001f\u007f]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_OPTION_DESCRIPTION_CHARS);
    const labelKey = label.toLocaleLowerCase('zh-CN');
    if (ids.has(id) || labels.has(labelKey)) {
      throw new OnboardingError('INVALID_MISSION_RESPONSE', 'Teach 返回了重复的 Mission 选项', 502);
    }
    ids.add(id);
    labels.add(labelKey);
    options.push({ id, label, ...(description ? { description } : {}) });
  }
  return options;
}

function normalizeMissionSpec(value) {
  const source = value && typeof value === 'object' ? value : {};
  const successLooksLike = cleanMissionList(source.successLooksLike, '成功标准');
  if (successLooksLike.length < 2) {
    throw new OnboardingError('INVALID_MISSION_SPEC', 'Teach 必须返回 1 项期望产出和至少 1 项成功证据', 502);
  }
  return {
    topic: cleanMissionText(source.topic, 'Mission 主题', 180).replace(/^#+\s*/, ''),
    why: cleanMissionText(source.why, '问题陈述', 1000),
    successLooksLike,
    constraints: cleanMissionList(source.constraints, '学习约束'),
    outOfScope: cleanMissionList(source.outOfScope, '暂不展开内容'),
  };
}

function auditMissionSemantics(value) {
  const mission = normalizeMissionSpec(value);
  const warnings = [];
  const expectedOutput = mission.successLooksLike[0];
  if (ABSTRACT_OUTPUT_PATTERN.test(expectedOutput) || !CHECKABLE_OUTPUT_PATTERN.test(expectedOutput)) {
    warnings.push('expected output is abstract or not directly checkable');
  }
  if (COVERAGE_OUTPUT_PATTERN.test(expectedOutput)) {
    warnings.push('material coverage cannot be the expected output by itself');
  }
  const evidence = mission.successLooksLike.slice(1);
  if (evidence.every((item) => /^(?:感觉|觉得|更有信心|更清楚|feel|understand|confidence|理解できる|自信)/i.test(item))) {
    warnings.push('success evidence is only self-reported feeling');
  }
  return warnings;
}

function compileMissionDocument(value) {
  const mission = normalizeMissionSpec(value);
  const bullets = (items) => items.map((item) => `- ${item}`).join('\n');
  return `# Mission: ${mission.topic}\n\n`
    + `## Why\n${mission.why}\n\n`
    + `## Success looks like\n${bullets(mission.successLooksLike)}\n\n`
    + `## Constraints\n${bullets(mission.constraints)}\n\n`
    + `## Out of scope\n${bullets(mission.outOfScope)}\n`;
}

function writeMissionDocument(courseDir, value) {
  const markdown = compileMissionDocument(value);
  atomicWriteFile(path.join(courseDir, 'MISSION.md'), markdown);
  return markdown;
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
    const options = cleanMissionOptions(value.options);
    return { status, question, options, materialSummary };
  }
  if (status === 'ready') {
    const summary = String(value.summary || '').trim().slice(0, 1200);
    if (!summary) throw new OnboardingError('INVALID_MISSION_RESPONSE', 'Teach 没有返回 Mission 摘要', 502);
    const mission = value.mission == null ? null : normalizeMissionSpec(value.mission);
    return { status, summary, materialSummary, mission };
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

function missionPresentationFromMarkdown(markdown) {
  const text = String(markdown || '');
  const section = (heading, nextHeading) => {
    const end = nextHeading ? `(?=\\n## ${nextHeading}\\s*$)` : '$';
    const match = text.match(new RegExp(`^## ${heading}\\s*$\\n([\\s\\S]*?)${end}`, 'm'));
    return match ? match[1].trim() : '';
  };
  const problemStatement = section('Why', 'Success looks like');
  const successLooksLike = section('Success looks like', 'Constraints')
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-*+]\s+/, '').trim())
    .filter(Boolean);
  if (!problemStatement || successLooksLike.length < 2) return null;
  return {
    problemStatement,
    expectedOutput: successLooksLike[0],
    successEvidence: successLooksLike.slice(1),
  };
}

function readMissionPresentation(courseDir) {
  try {
    return missionPresentationFromMarkdown(validateMissionDocument(courseDir));
  } catch {
    return null;
  }
}

function materializeMissionDocument(courseDir, turn) {
  if (!turn || turn.status !== 'ready') {
    throw new OnboardingError('INVALID_MISSION_RESPONSE', 'Teach Mission 尚未准备好', 502);
  }
  if (turn.mission) writeMissionDocument(courseDir, turn.mission);
  return validateMissionDocument(courseDir);
}

function isRepairableMissionError(error) {
  return Boolean(error && REPAIRABLE_MISSION_CODES.has(error.code));
}

function missionReadyEnvelopeInstruction() {
  return [
    '准备完成时，除写入 MISSION.md 外，JSON 必须同时返回同一份结构化内容。',
    '有序语义必须严格遵守：why 是当前问题陈述；successLooksLike[0] 是可检查的期望产出；successLooksLike[1..] 是判断产出有效的成功证据。',
    '期望产出必须是后续 transfer 能直接推进或演练的作品、决策、行动或可提交片段。不要把“了解、掌握、提升表达力、读完多少章、覆盖多少材料”单独当作成果；材料覆盖最多只能写入 constraints。',
    'mission 字段格式严格为：',
    '{"topic":"问题或产出的短标题","why":"具体问题陈述","successLooksLike":["期望产出","成功证据"],"constraints":["时间或学习约束"],"outOfScope":["本轮明确不展开的内容"]}',
    '五个字段都必须有内容；successLooksLike 至少 2 项，其余数组各 1 到 8 项。应用会验证并原子写入标准 MISSION.md。',
  ].join('\n');
}

function profileInstructions(profile = {}) {
  const mode = profile && profile.mode === 'goal' ? 'goal' : 'student';
  const locale = profile && profile.locale || 'en';
  const language = locale === 'zh-CN'
    ? '所有面向用户的问题、选项和摘要使用简体中文。'
    : locale === 'ja'
      ? 'ユーザー向けの質問、選択肢、要約は日本語で書く。'
      : 'Write every user-facing question, option, and summary in English.';
  const purpose = mode === 'goal'
    ? '用户正在用这份材料解决一个现实问题。Mission 优先确认要改善的情境、要产出的作品或行动，以及可观察的结果。'
    : '用户正在准备或改善学习表现。Mission 优先结合教材、试卷、练习题和已有作答，确认薄弱点及可观察的掌握证据。';
  return [purpose, '判断方向时重视用户已经做过的作答、练习或作品，不只采纳用户对自己的描述。', language];
}

function initialMissionPrompt(extension, materialDigest = '', profile = {}) {
  const digest = String(materialDigest || '').trim();
  const readingInstruction = digest
    ? [
        '服务端已在本地解析出这份材料的结构摘要（元数据、目录和各部分开头片段），覆盖主要结构：',
        '<material-digest>',
        digest,
        '</material-digest>',
        '这份摘要就是本轮的快速通读结果；不要再去打开、遍历或深读 book 文件，直接基于摘要开始 Mission 访谈。',
      ].join('\n')
    : '第一轮只读取文件元数据、目录或章节标题，以及少量代表性片段；不要在提出第一个问题前遍历或深度读取整份材料。';
  return [
    `/skill:teach 用户上传了当前目录中的 book${extension}，现在走默认的一般模式。`,
    ...profileInstructions(profile),
    readingInstruction,
    '快速识别材料类型、主要主题、受众和难度后，立即进入 Mission 访谈。',
    '不要执行全书深度阅读门禁、RIA-TV++、CURRICULUM-BLUEPRINT 或 lesson brief；这些属于未来的深度模式。',
    '当前唯一任务是按原版 teach Skill 的 Mission 流程了解用户为什么学习。不要生成课程、RESOURCES.md、lesson、assessment、map 或其他教学产物。',
    '如果 Mission 还不清楚，只问一个最有信息量、与材料上下文相关的自然语言问题，并同时给出 3 到 5 个可直接选择的答案。',
    '选项必须具体、彼此可区分，并覆盖最常见的学习意图；至少保留一个“还不确定，先探索”或同义选项。不要让用户必须先写开放回答。',
    '如果无需追问即可形成具体 Mission，按 skills/teach/MISSION-FORMAT.md 写 MISSION.md。',
    missionReadyEnvelopeInstruction(),
    '最后只输出一行严格 JSON，不要 Markdown、解释或隐藏推理：',
    '{"status":"question","question":"一个问题","options":[{"id":"stable_id","label":"可选答案","description":"为什么这个选项可能适合"}],"materialSummary":"对材料的简短理解"}',
    '或在已写好 MISSION.md 时输出：',
    '{"status":"ready","summary":"供用户确认的问题、期望产出与成功证据摘要","materialSummary":"对材料的简短理解","mission":{"topic":"问题或产出的短标题","why":"当前问题陈述","successLooksLike":["可检查的期望产出","成功证据"],"constraints":["约束"],"outOfScope":["暂不展开"]}}',
  ].join('\n');
}

function answerMissionPrompt(answer, profile = {}) {
  return [
    '继续原版 teach Skill 的 Mission 访谈。',
    ...profileInstructions(profile),
    `用户本轮回答：${JSON.stringify(cleanAnswer(answer))}`,
    '结合当前 Session 中已经快速通读的材料与之前回答，判断 Mission 是否已经具体到现实目标、可观察成功、约束和明确排除项。',
    '信息不足时只问一个下一问题，并同时给出 3 到 5 个可直接选择的答案；至少保留一个“还不确定，先探索”或同义选项。',
    '不要要求用户必须输入开放回答；补充说明只能是可选的。信息充分时按 skills/teach/MISSION-FORMAT.md 写入或更新 MISSION.md。',
    '不要生成课程、资源、lesson、assessment、map 或深度阅读产物。',
    missionReadyEnvelopeInstruction(),
    '最后只输出一行严格 JSON：',
    '{"status":"question","question":"一个问题","options":[{"id":"stable_id","label":"可选答案","description":"为什么这个选项可能适合"}],"materialSummary":"对材料的简短理解"}',
    '或 {"status":"ready","summary":"供用户确认的问题、期望产出与成功证据摘要","materialSummary":"对材料的简短理解","mission":{"topic":"问题或产出的短标题","why":"当前问题陈述","successLooksLike":["可检查的期望产出","成功证据"],"constraints":["约束"],"outOfScope":["暂不展开"]}}',
  ].join('\n');
}

function repairMissionPrompt() {
  return [
    '继续当前原版 teach Mission Session，并修复上一轮的公开输出合同。',
    '不要重新通读材料，不要重新询问用户新的问题，也不要丢弃本 Session 中已有的用户回答。',
    '如果上一轮本来需要用户回答，重新输出同一个问题并补齐 3 到 5 个可直接选择的答案；不要在这时擅自完成 Mission。',
    '如果信息已经充分，再根据材料理解和全部既有回答整理具体 Mission，并按 skills/teach/MISSION-FORMAT.md 写 MISSION.md。',
    '重点修复：why 必须是具体问题陈述；successLooksLike 第一项必须是可检查的期望产出，后续项必须是成功证据。抽象目标或材料覆盖不能单独作为成果。',
    missionReadyEnvelopeInstruction(),
    '不要生成 RESOURCES.md、课程、lesson、assessment、map 或任何其他产物。',
    '最后只输出一行严格 JSON：',
    '{"status":"question","question":"同一个问题","options":[{"id":"stable_id","label":"可选答案","description":"为什么这个选项可能适合"}],"materialSummary":"对材料的简短理解"}',
    '或：',
    '{"status":"ready","summary":"供用户确认的问题、期望产出与成功证据摘要","materialSummary":"对材料的简短理解","mission":{"topic":"问题或产出的短标题","why":"当前问题陈述","successLooksLike":["可检查的期望产出","成功证据"],"constraints":["约束"],"outOfScope":["暂不展开"]}}',
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
  auditMissionSemantics,
  answerMissionPrompt,
  cleanMissionOptions,
  cleanAnswer,
  compileMissionDocument,
  createMissionSessionState,
  initialMissionPrompt,
  isRepairableMissionError,
  materializeMissionDocument,
  missionPresentationFromMarkdown,
  missionSessionPath,
  normalizeMissionSessionState,
  normalizeMissionSpec,
  parseMissionTurn,
  promoteMissionSession,
  readMissionPresentation,
  readMissionSessionState,
  repairMissionPrompt,
  validateMissionDocument,
  writeMissionDocument,
  writeMissionSessionState,
};
