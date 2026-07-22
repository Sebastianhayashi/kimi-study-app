'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { buildTutorContext } = require('./tutor-context');

const MUTABLE_RUNTIME_FILES = new Set([
  'generation-events.jsonl',
  'generator-session.json',
  'job.json',
  'next-lesson-transaction.json',
  'notes.json',
]);

const MUTABLE_RUNTIME_PREFIXES = [
  'learning-progress/',
];


const NEXT_LESSON_TRANSACTION = 'next-lesson-transaction.json';
const STALE_GENERATION_MS = 60_000;

function transactionFile(courseDir) {
  return path.join(courseDir, NEXT_LESSON_TRANSACTION);
}

function writeJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
}

function writeNextLessonTransaction(courseDir, baseline) {
  writeJsonAtomic(transactionFile(courseDir), {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    baseline,
  });
}

function readNextLessonTransaction(courseDir) {
  try {
    const value = JSON.parse(fs.readFileSync(transactionFile(courseDir), 'utf8'));
    if (!value || value.schemaVersion !== 1 || !value.baseline || typeof value.baseline !== 'object') return null;
    return value;
  } catch {
    return null;
  }
}

function clearNextLessonTransaction(courseDir) {
  try { fs.rmSync(transactionFile(courseDir), { force: true }); } catch {}
}

function isGenerationJobActive(job) {
  return Boolean(job && (job.stage === 'generating' || job.stage === 'understanding'));
}

function isStaleGenerationJob(job, {
  busy = false,
  mtimeMs = 0,
  now = Date.now(),
  staleAfterMs = STALE_GENERATION_MS,
} = {}) {
  if (busy || !isGenerationJobActive(job) || !Number.isFinite(mtimeMs) || mtimeMs <= 0) return false;
  return now - mtimeMs > staleAfterMs;
}

function recoverInterruptedNextLesson(courseDir, job, { now = new Date() } = {}) {
  const transaction = readNextLessonTransaction(courseDir);
  const failedAt = now instanceof Date ? now.toISOString() : new Date(now).toISOString();
  if (!transaction) {
    clearNextLessonTransaction(courseDir);
    return {
      ...job,
      stage: 'failed',
      repairRequired: true,
      changedExisting: ['next-lesson transaction baseline missing'],
      cleanupRemoved: [],
      currentMessage: '下一课生成中断，课程工作区需要检查',
      error: '下一课事务基线缺失，已阻止自动重试',
      updatedAt: failedAt,
      failedAt,
    };
  }

  const baseline = transaction.baseline;
  const changedExisting = changedExistingWorkspaceFiles(courseDir, baseline);
  const cleanupRemoved = removeNewWorkspaceFiles(courseDir, baseline);
  clearNextLessonTransaction(courseDir);
  const repairRequired = changedExisting.length > 0;
  return {
    ...job,
    stage: 'failed',
    repairRequired,
    changedExisting,
    cleanupRemoved,
    currentMessage: repairRequired
      ? '下一课生成中断，已有课程文件需要修复'
      : '下一课生成已中断，请重试',
    error: repairRequired
      ? '生成中断且已有课程文件发生变化，已阻止自动重试'
      : '下一课生成已中断，请重试',
    updatedAt: failedAt,
    failedAt,
  };
}

const PROTECTED_ROOT_FILES = [
  'MISSION.md',
  'RESOURCES.md',
  'map.json',
  'source-profile.json',
  'learning-claims.json',
  'assessment-blueprint.json',
  'misconceptions.json',
  'question-bank.json',
  'quality-report.json',
];

function listFiles(dir, extension) {
  try {
    return fs.readdirSync(dir)
      .filter((name) => name.endsWith(extension))
      .sort();
  } catch {
    return [];
  }
}

function lessonsIn(courseDir) {
  return listFiles(path.join(courseDir, 'lessons'), '.html')
    .filter((name) => name !== 'index.html');
}

function assessmentsIn(courseDir) {
  return listFiles(path.join(courseDir, 'assessments'), '.json');
}

function fileDigest(file) {
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) return null;
    return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  } catch {
    return null;
  }
}

function normalizeRelative(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\/+/, '');
}

function isMutableRuntimePath(relative) {
  const normalized = normalizeRelative(relative);
  return MUTABLE_RUNTIME_FILES.has(normalized)
    || MUTABLE_RUNTIME_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function fileSignature(file) {
  try {
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink()) return `symlink:${fs.readlinkSync(file)}`;
    if (!stat.isFile()) return null;
    return `file:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;
  } catch {
    return null;
  }
}

function workspaceFileSnapshot(courseDir) {
  const snapshot = {};
  const visit = (dir) => {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const absolute = path.join(dir, entry.name);
      const relative = normalizeRelative(path.relative(courseDir, absolute));
      if (!relative || isMutableRuntimePath(relative)) continue;
      if (entry.isDirectory()) visit(absolute);
      else {
        const signature = fileSignature(absolute);
        if (signature) snapshot[relative] = signature;
      }
    }
  };
  visit(courseDir);
  return snapshot;
}

function changedExistingWorkspaceFiles(courseDir, baseline) {
  const before = baseline && baseline.workspaceFiles || {};
  const current = workspaceFileSnapshot(courseDir);
  return Object.entries(before)
    .filter(([relative, signature]) => current[relative] !== signature)
    .map(([relative]) => relative)
    .sort();
}

function pruneEmptyDirectories(courseDir) {
  const visit = (dir) => {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (entry.isDirectory()) visit(path.join(dir, entry.name));
    }
    if (dir === courseDir) return;
    try {
      if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
    } catch {}
  };
  visit(courseDir);
}

function removeNewWorkspaceFiles(courseDir, baseline) {
  const before = baseline && baseline.workspaceFiles || {};
  const current = workspaceFileSnapshot(courseDir);
  const removed = [];
  for (const relative of Object.keys(current)) {
    if (Object.prototype.hasOwnProperty.call(before, relative)) continue;
    try {
      fs.rmSync(path.join(courseDir, relative), { force: true });
      removed.push(relative);
    } catch {}
  }
  pruneEmptyDirectories(courseDir);
  return removed.sort();
}

function captureNextLessonBaseline(courseDir) {
  const lessons = lessonsIn(courseDir);
  const assessments = assessmentsIn(courseDir);
  const protectedFiles = {};
  for (const name of PROTECTED_ROOT_FILES) {
    const digest = fileDigest(path.join(courseDir, name));
    if (digest) protectedFiles[name] = digest;
  }
  for (const name of lessons) {
    const relative = `lessons/${name}`;
    protectedFiles[relative] = fileDigest(path.join(courseDir, relative));
  }
  for (const name of assessments) {
    const relative = `assessments/${name}`;
    protectedFiles[relative] = fileDigest(path.join(courseDir, relative));
  }

  return {
    lessons,
    assessments,
    protectedFiles,
    workspaceFiles: workspaceFileSnapshot(courseDir),
    expectedLessonNumber: lessons.length + 1,
  };
}

function normalizeGeneratorSessionState(value) {
  const input = value && typeof value === 'object' ? value : {};
  const sessionId = typeof input.sessionId === 'string' && input.sessionId.trim()
    ? input.sessionId.trim()
    : null;
  const initialized = input.initialized === true && Boolean(sessionId);
  const preferredMode = ['stream-json', 'wire', 'text'].includes(input.preferredMode)
    ? input.preferredMode
    : 'stream-json';

  return {
    schemaVersion: 2,
    sessionId: initialized ? sessionId : null,
    initialized,
    preferredMode,
  };
}

function createGeneratorSessionState() {
  return normalizeGeneratorSessionState(null);
}

function generatorSessionIdForRun(value) {
  const state = normalizeGeneratorSessionState(value);
  return state.initialized ? state.sessionId : null;
}

function withTeachSkill(prompt, initialized) {
  return initialized ? prompt : `/skill:teach\n\n${prompt}`;
}

function buildNextLessonPrompt(courseDir, baseline) {
  const number = String(baseline.expectedLessonNumber).padStart(4, '0');
  const learnerContext = buildTutorContext(courseDir, {});
  const existing = baseline.lessons.length ? baseline.lessons.join(', ') : '无';

  return [
    '这是一次增量生成任务。不要重新构建整门课程。',
    `已有课节：${existing}`,
    `只生成第 ${baseline.expectedLessonNumber} 课，文件名前缀必须是 ${number}-。`,
    '',
    '只允许新增两个文件：',
    `1. lessons/${number}-<slug>.html`,
    `2. assessments/${number}-<同一slug>.json`,
    '',
    '不得修改任何已有文件。不得更新 map.json、MISSION.md、RESOURCES.md、课程级分析文件、题库、质量报告、封面或共享资源。不得创建第三个文件。',
    '读取 MISSION.md、原始材料、已有课节和下面的学习者状态，选择尚未覆盖且最适合当前用户的下一个内容单元。',
    '避免重复已掌握内容；对高频误区换一种解释或例子；难度与用户当前表现匹配。',
    '先写 HTML，再紧接着写对应 Assessment JSON。',
    'HTML 必须复用现有课程样式，并为 Assessment 中每个 activity 放置唯一的 data-kimi-activity 挂载点。',
    '答案、acceptedAnswers、correctOptionId、correctOptionIds、correctOrder 和评分键只能存在于 Assessment JSON。',
    'Assessment 必须通过现有 schema，至少包含一个 independent、transfer 或 exit-ticket 阶段的可提交活动。',
    '全部产出使用中文。完成后不要改写课程地图或其他文件。',
    '',
    '<learner-context>',
    learnerContext || '当前没有额外学习记录；根据 Mission 和已有课节继续。',
    '</learner-context>',
  ].join('\n');
}

module.exports = {
  NEXT_LESSON_TRANSACTION,
  STALE_GENERATION_MS,
  MUTABLE_RUNTIME_FILES,
  MUTABLE_RUNTIME_PREFIXES,
  PROTECTED_ROOT_FILES,
  lessonsIn,
  assessmentsIn,
  fileDigest,
  fileSignature,
  isMutableRuntimePath,
  workspaceFileSnapshot,
  changedExistingWorkspaceFiles,
  removeNewWorkspaceFiles,
  writeNextLessonTransaction,
  readNextLessonTransaction,
  clearNextLessonTransaction,
  isGenerationJobActive,
  isStaleGenerationJob,
  recoverInterruptedNextLesson,
  captureNextLessonBaseline,
  normalizeGeneratorSessionState,
  createGeneratorSessionState,
  generatorSessionIdForRun,
  withTeachSkill,
  buildNextLessonPrompt,
};
