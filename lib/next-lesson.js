'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { buildTutorContext } = require('./tutor-context');

const MUTABLE_RUNTIME_FILES = new Set([
  'generation-events.jsonl',
  'generator-session.json',
  'job.json',
  'notes.json',
]);

const MUTABLE_RUNTIME_PREFIXES = [
  'learning-progress/',
];

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

function createGeneratorSessionState(courseId, nonce = crypto.randomUUID()) {
  const safeCourse = String(courseId || 'course').replace(/[^a-z0-9-]/gi, '-');
  const safeNonce = String(nonce).replace(/[^a-z0-9-]/gi, '-');
  return {
    schemaVersion: 1,
    sessionId: `kimi-study-${safeCourse}-generator-${safeNonce}`,
    initialized: false,
    preferredMode: 'stream-json',
  };
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
  captureNextLessonBaseline,
  createGeneratorSessionState,
  withTeachSkill,
  buildNextLessonPrompt,
};
