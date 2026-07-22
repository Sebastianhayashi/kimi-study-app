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

function buildNextLessonPrompt(courseDir, baseline, { validatorCommand = '', resumedSession = false } = {}) {
  const number = String(baseline.expectedLessonNumber).padStart(4, '0');
  const learnerContext = buildTutorContext(courseDir, {});
  const existing = baseline.lessons.length ? baseline.lessons.join(', ') : '无';
  const preflight = validatorCommand
    ? [
        '',
        '写完两个文件后，必须运行下面的本地确定性预检。该命令不会调用模型：',
        validatorCommand,
        '若命令退出码非 0，读取其 JSON errors，只修正本轮两个新文件并重新运行；预检成功后不得再改文件。不要在预检成功前结束任务。',
      ]
    : [];
  const contextBudget = resumedSession
    ? [
        '当前是已恢复的 generator session。沿用会话中已有的课程理解，不重新加载 Teach Skill，不重新扫描整本材料或全部旧课。',
        '只按需读取 MISSION.md、最近两课及其 Assessment、最近 learning-progress/notes，以及本课直接相关的原文片段；除非这些信息不足，不读取更早课节或整本材料。',
      ]
    : [
        '这是 generator session 的首次任务。只建立完成本课所需的最小上下文，不生成或刷新任何课程级分析资产。',
        '优先读取 MISSION.md、最近两课及其 Assessment、最近 learning-progress/notes，再定位本课直接相关的原文片段；不要顺序扫描整本材料。',
      ];

  return [
    '这是一次增量生成任务。不要重新构建整门课程。',
    `已有课节：${existing}`,
    `只生成第 ${baseline.expectedLessonNumber} 课，文件名前缀必须是 ${number}-。`,
    '',
    '只允许新增两个文件：',
    `1. lessons/${number}-<slug>.html`,
    `2. assessments/${number}-<同一slug>.json`,
    '',
    '先确定一个 LESSON_BASE，格式必须是上述文件名去掉扩展名；HTML 文件名、Assessment 文件名和 assessment.lessonId 必须逐字等于同一个 LESSON_BASE。',
    '不得修改任何已有文件。不得更新 map.json、MISSION.md、RESOURCES.md、课程级分析文件、题库、质量报告、封面或共享资源。不得创建第三个文件。',
    '依据 MISSION.md、学习者状态、已有课节覆盖范围和本课相关原文，选择尚未覆盖且最适合当前用户的下一个内容单元。',
    '避免重复已掌握内容；对高频误区换一种解释或例子；难度与用户当前表现匹配。',
    ...contextBudget,
    '',
    '【D3 速度优先的 Lesson HTML 预算】',
    '先完成可发布的最小课节，不做百科全书式扩写或视觉重设计。',
    '复用最近一课已经使用的共享样式链接；不得新建或复制样式，不得写内联 CSS、<style>、脚本、SVG、canvas、表格、base64/data URI。',
    '正文目标 900—1400 个中文字符，硬上限 1800 个中文字符；保留一个核心解释、一个材料例子、一个常见误区修正和一个迁移提示。',
    '活动挂载点之前只写 3 个主要 h2 内容段；每段最多 2 个短段落，整课最多一个 ul（不超过 4 项）和一个 callout。',
    '不要重复讲述多个相似案例，不写泛化的推荐资源长清单，不在完成最小可发布版本后继续润色。',
    '',
    '【D2 低延迟 Assessment 机器契约】',
    '任务族名称不是 activity.type。不得自行发明 type 或 stage。',
    '本轮 Assessment 必须恰好包含 1 个 claim 和 2 个 activities，结构必须遵守下面形状：',
    '{',
    '  "schemaVersion": 1,',
    '  "lessonId": "LESSON_BASE",',
    '  "title": "本课标题",',
    '  "claims": [{',
    '    "id": "claim-1",',
    '    "label": "可观察的学习能力",',
    '    "sourceRefs": ["source:book#真实章节或页码"],',
    '    "mastery": {"requiredPassed": 1, "requiredStages": ["independent"]}',
    '  }],',
    '  "activities": [',
    '    {',
    '      "id": "guided-1",',
    '      "type": "single-choice",',
    '      "claimId": "claim-1",',
    '      "stage": "guided",',
    '      "prompt": "题目",',
    '      "options": [{"id": "a", "label": "选项"}, {"id": "b", "label": "选项"}],',
    '      "correctOptionId": "a",',
    '      "sourceRefs": ["source:book#真实章节或页码"],',
    '      "feedback": {"correct": "答对反馈", "incorrect": "答错反馈"},',
    '      "hints": []',
    '    },',
    '    {',
    '      "id": "independent-1",',
    '      "type": "short-answer",',
    '      "claimId": "claim-1",',
    '      "stage": "independent",',
    '      "prompt": "要求学习者独立应用本课能力的问题",',
    '      "scoring": {"mode": "completion", "minimumLength": 12},',
    '      "sourceRefs": ["source:book#真实章节或页码"],',
    '      "feedback": {"correct": "已记录并提示自查标准", "incorrect": "请补充完整回答"},',
    '      "hints": []',
    '    }',
    '  ]',
    '}',
    'LESSON_BASE 和 sourceRefs 中的文字都是占位说明，必须替换为本轮真实值；不得原样保留。',
    '不得使用 multiple-choice、recording、ties、application、practice 或其他未列出的 type/stage。',
    '',
    '先写 HTML，再紧接着写对应 Assessment JSON。',
    'HTML 必须复用现有课程样式，并且只为上述两个 activity 各放置一次唯一挂载点：data-kimi-activity="guided-1" 和 data-kimi-activity="independent-1"。',
    '答案、acceptedAnswers、correctOptionId、correctOptionIds、correctOrder 和评分键只能存在于 Assessment JSON。',
    '全部产出使用中文。完成后不要改写课程地图或其他文件。',
    ...preflight,
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
