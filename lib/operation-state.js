'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { deriveGenerationStatus } = require('./generation-status');

const SCHEMA_VERSION = 1;
const OPERATION_FILE = 'operation.json';
const LOCK_FILE = 'operation.json.lock';
const TERMINAL_STATES = new Set(['ready', 'failed', 'interrupted', 'cancelled']);
const ACTIVE_STATES = new Set(['queued', 'running']);
const VALID_STATES = new Set([...ACTIVE_STATES, ...TERMINAL_STATES]);
const VALID_KINDS = new Set(['first-course', 'next-lesson', 'tutor-turn']);

const FIRST_PHASES = ['extracting', 'profiling', 'claims', 'blueprint', 'questions', 'quality', 'assembling', 'validating', 'complete'];
const NEXT_PHASES = ['extracting', 'assembling', 'validating', 'complete'];
const TUTOR_PHASES = ['preparing', 'answering', 'complete'];

const PHASE_PROGRESS = {
  queued: 0,
  extracting: 12,
  profiling: 24,
  claims: 38,
  blueprint: 52,
  questions: 66,
  quality: 78,
  assembling: 88,
  validating: 96,
  preparing: 20,
  answering: 70,
  complete: 100,
};

const PHASE_VARIANT = {
  extracting: 'material',
  profiling: 'structure',
  claims: 'claims',
  blueprint: 'practice',
  questions: 'questions',
  quality: 'quality',
  assembling: 'assembly',
  validating: 'validation',
  preparing: 'material',
  answering: 'assembly',
  complete: 'ready',
};

const MESSAGE_TABLE = {
  'operation.queued': '任务已排队，正在准备…',
  'first-course.extracting': '正在读取并整理教材内容…',
  'first-course.profiling': '正在理解材料结构和章节关系…',
  'first-course.claims': '正在把材料内容转化为可以检查的学习目标…',
  'first-course.blueprint': '正在设计引导练习、独立练习和应用任务…',
  'first-course.questions': '正在生成题目候选，并补充材料依据…',
  'first-course.quality': '正在筛除重复、过于简单或缺少依据的题目…',
  'first-course.assembling': '正在把讲解、示范和练习组装成第一课…',
  'first-course.validating': '正在检查课程文件、答案与评分规则…',
  'first-course.ready': '课程已准备好',
  'first-course.failed': '课程创建没有完成，请重试',
  'first-course.interrupted': '课程生成已中断，请重试',
  'first-course.cancelled': '课程生成已取消',
  'next-lesson.extracting': '正在读取学习记录并确定下一学习目标…',
  'next-lesson.assembling': '正在写入下一课讲解与互动练习…',
  'next-lesson.validating': '正在检查新增课节、活动挂载和评分规格…',
  'next-lesson.ready': '下一课已准备好',
  'next-lesson.failed': '下一课生成没有完成，请重试',
  'next-lesson.interrupted': '下一课生成已中断，请重试',
  'next-lesson.cancelled': '下一课生成已取消',
  'tutor-turn.preparing': '导师正在整理当前课节与学习记录…',
  'tutor-turn.answering': '导师正在回答…',
  'tutor-turn.ready': '导师回答已完成',
  'tutor-turn.failed': '导师这次没有完成回答，请重试',
  'tutor-turn.interrupted': '导师回答已中断，请重试',
  'tutor-turn.cancelled': '导师回答已取消',
};

const FIRST_HISTORY = [
  ['extracting', '读取并整理材料'],
  ['profiling', '理解材料结构'],
  ['claims', '确定学习目标'],
  ['blueprint', '设计练习路线'],
  ['questions', '生成题目候选'],
  ['quality', '筛选题目质量'],
  ['assembling', '组装课节'],
  ['validating', '检查课程文件'],
];
const NEXT_HISTORY = [
  ['extracting', '读取学习记录与下一目标'],
  ['assembling', '写入下一课与互动练习'],
  ['validating', '检查新增课程文件'],
];
const TUTOR_HISTORY = [
  ['preparing', '整理当前学习上下文'],
  ['answering', '生成导师回答'],
];

function operationStateEnabled(env = process.env) {
  return String(env.LUCUBRO_OPERATION_STATE == null ? '1' : env.LUCUBRO_OPERATION_STATE).trim() !== '0';
}

function safeJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}

function readEvents(courseDir) {
  try {
    return fs.readFileSync(path.join(courseDir, 'generation-events.jsonl'), 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

function listCount(courseDir, directory, extension) {
  try {
    return fs.readdirSync(path.join(courseDir, directory))
      .filter((name) => name.endsWith(extension)).length;
  } catch {
    return 0;
  }
}

function runtimeFromDisk(courseDir, runtime = {}) {
  return {
    lessons: Number.isFinite(Number(runtime.lessons)) ? Number(runtime.lessons) : listCount(courseDir, 'lessons', '.html'),
    assessments: Number.isFinite(Number(runtime.assessments)) ? Number(runtime.assessments) : listCount(courseDir, 'assessments', '.json'),
    busy: Boolean(runtime.busy),
  };
}

function normalizeKind(value) {
  if (VALID_KINDS.has(value)) return value;
  if (value === 'next-lesson') return 'next-lesson';
  if (value === 'tutor' || value === 'chat' || value === 'tutor-turn') return 'tutor-turn';
  return 'first-course';
}

function normalizeState(value, fallback = 'queued') {
  if (VALID_STATES.has(value)) return value;
  const mapped = {
    understanding: 'running',
    generating: 'running',
    active: 'running',
    complete: 'ready',
    error: 'failed',
  }[value];
  return mapped || fallback;
}

function stateFromJob(job = {}) {
  if (job.cancelled || job.stage === 'cancelled') return 'cancelled';
  if (job.interrupted || job.stage === 'interrupted') return 'interrupted';
  if (job.stage === 'ready') return 'ready';
  if (job.stage === 'failed') return 'failed';
  if (job.stage === 'understanding' || job.stage === 'generating' || job.stage === 'running') return 'running';
  return 'queued';
}

function messageKeyFor(kind, state, phase) {
  if (state === 'queued') return 'operation.queued';
  if (TERMINAL_STATES.has(state)) return `${kind}.${state}`;
  return `${kind}.${phase || (kind === 'tutor-turn' ? 'preparing' : 'extracting')}`;
}

function progressEvidenceFromProjection(projection = {}, runtime = {}) {
  const preview = projection.preview || {};
  return {
    units: Number.isInteger(preview.unitsFound) ? preview.unitsFound : null,
    claims: Number.isInteger(preview.claimsFound) ? preview.claimsFound : null,
    candidates: Number.isInteger(preview.candidatesGenerated) ? preview.candidatesGenerated : null,
    accepted: Number.isInteger(preview.accepted) ? preview.accepted : null,
    rejected: Number.isInteger(preview.rejected) ? preview.rejected : null,
    lessons: Number.isInteger(Number(runtime.lessons)) ? Number(runtime.lessons) : 0,
  };
}

function normalizeEvidence(value = {}, fallback = {}) {
  const result = {};
  for (const key of ['units', 'claims', 'candidates', 'accepted', 'rejected', 'lessons']) {
    const selected = value[key] == null ? fallback[key] : value[key];
    result[key] = Number.isFinite(Number(selected)) && Number(selected) >= 0 ? Number(selected) : null;
  }
  if (result.lessons == null) result.lessons = 0;
  return result;
}

function normalizeTimestamp(value, fallback = null) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : fallback;
}

function normalizeSnapshot(raw, courseDir, { now = new Date() } = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const courseId = String(raw.courseId || path.basename(courseDir));
  const kind = normalizeKind(raw.kind || raw.operationKind || raw.jobKind);
  const state = normalizeState(raw.state || raw.status || raw.stage);
  const defaultPhase = state === 'ready' ? 'complete' : kind === 'tutor-turn' ? 'preparing' : 'extracting';
  const phase = String(raw.phase || defaultPhase);
  const updatedAt = normalizeTimestamp(raw.updatedAt || raw.time, now.toISOString());
  const startedAt = normalizeTimestamp(raw.startedAt, updatedAt);
  const finishedAt = TERMINAL_STATES.has(state)
    ? normalizeTimestamp(raw.finishedAt || raw.failedAt || raw.cancelledAt, updatedAt)
    : null;
  return {
    schemaVersion: SCHEMA_VERSION,
    operationId: String(raw.operationId || raw.runId || crypto.randomUUID()),
    courseId,
    kind,
    state,
    phase,
    progressEvidence: normalizeEvidence(raw.progressEvidence || raw.metrics || raw.preview || {}, {}),
    startedAt,
    updatedAt,
    finishedAt,
    currentMessageKey: String(raw.currentMessageKey || raw.messageKey || messageKeyFor(kind, state, phase)),
    currentMessageParams: raw.currentMessageParams && typeof raw.currentMessageParams === 'object'
      ? { ...raw.currentMessageParams }
      : {},
    publishedArtifact: raw.publishedArtifact == null
      ? null
      : Math.max(0, Number(raw.publishedArtifact) || 0),
    retryable: Boolean(raw.retryable == null ? ['failed', 'interrupted', 'cancelled'].includes(state) : raw.retryable),
  };
}

function deriveLegacyOperation(courseDir, runtime = {}) {
  const jobFile = path.join(courseDir, 'job.json');
  const eventFile = path.join(courseDir, 'generation-events.jsonl');
  if (!fs.existsSync(jobFile) && !fs.existsSync(eventFile)) return null;
  const job = safeJson(jobFile, {});
  const actualRuntime = runtimeFromDisk(courseDir, runtime);
  const projection = deriveGenerationStatus(courseDir, job, actualRuntime);
  const events = readEvents(courseDir);
  const latest = [...events].reverse().find((event) => event && event.runId === job.runId) || events.at(-1) || null;
  const kind = normalizeKind(job.kind);
  const state = stateFromJob(job);
  const phase = state === 'ready' ? 'complete' : (job.phase || latest?.phase || projection.phase || 'extracting');
  const updatedAt = normalizeTimestamp(job.updatedAt || latest?.time, new Date().toISOString());
  const startedAt = normalizeTimestamp(job.startedAt, updatedAt);
  return normalizeSnapshot({
    schemaVersion: SCHEMA_VERSION,
    operationId: job.runId || latest?.runId || `legacy-${path.basename(courseDir)}`,
    courseId: path.basename(courseDir),
    kind,
    state,
    phase,
    progressEvidence: progressEvidenceFromProjection(projection, actualRuntime),
    startedAt,
    updatedAt,
    finishedAt: job.finishedAt || job.failedAt || (TERMINAL_STATES.has(state) ? updatedAt : null),
    currentMessageKey: messageKeyFor(kind, state, phase),
    currentMessageParams: {},
    publishedArtifact: actualRuntime.lessons || null,
    retryable: ['failed', 'interrupted', 'cancelled'].includes(state),
  }, courseDir);
}

function readOperation(courseDir) {
  const file = path.join(courseDir, OPERATION_FILE);
  const existing = safeJson(file, null);
  if (existing) return normalizeSnapshot(existing, courseDir);
  return deriveLegacyOperation(courseDir);
}

function sleepSync(milliseconds) {
  const buffer = new SharedArrayBuffer(4);
  Atomics.wait(new Int32Array(buffer), 0, 0, milliseconds);
}

function acquireLock(courseDir, { timeoutMs = 1500, staleMs = 15000 } = {}) {
  fs.mkdirSync(courseDir, { recursive: true });
  const lock = path.join(courseDir, LOCK_FILE);
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const fd = fs.openSync(lock, 'wx');
      fs.writeFileSync(fd, `${process.pid}\n${new Date().toISOString()}\n`);
      return { fd, lock };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      try {
        const age = Date.now() - fs.statSync(lock).mtimeMs;
        if (age > staleMs) fs.unlinkSync(lock);
      } catch {}
      sleepSync(8);
    }
  }
  throw new Error(`Timed out acquiring operation state lock for ${courseDir}`);
}

function releaseLock(handle) {
  if (!handle) return;
  try { fs.closeSync(handle.fd); } catch {}
  try { fs.unlinkSync(handle.lock); } catch {}
}

function monotonicIso(previous, requested) {
  const previousMs = Date.parse(previous || '');
  const requestedMs = requested instanceof Date ? requested.getTime() : Date.parse(requested || '');
  const base = Number.isFinite(requestedMs) ? requestedMs : Date.now();
  return new Date(Number.isFinite(previousMs) && base <= previousMs ? previousMs + 1 : base).toISOString();
}

function writeOperation(courseDir, patch = {}, { now = new Date() } = {}) {
  const lock = acquireLock(courseDir);
  try {
    const file = path.join(courseDir, OPERATION_FILE);
    const existingRaw = safeJson(file, null);
    const legacy = existingRaw ? null : deriveLegacyOperation(courseDir);
    const hadExisting = Boolean(existingRaw || legacy);
    const existing = normalizeSnapshot(existingRaw, courseDir, { now }) || legacy || normalizeSnapshot({
      operationId: patch.operationId || crypto.randomUUID(),
      courseId: path.basename(courseDir),
      kind: patch.kind || 'first-course',
      state: patch.state || 'queued',
      phase: patch.phase || 'extracting',
      startedAt: now instanceof Date ? now.toISOString() : new Date(now).toISOString(),
      updatedAt: now instanceof Date ? now.toISOString() : new Date(now).toISOString(),
      progressEvidence: {},
      retryable: false,
    }, courseDir, { now: now instanceof Date ? now : new Date(now) });

    const requestedOperationId = String(patch.operationId || existing.operationId);
    const operationChanged = hadExisting && requestedOperationId !== existing.operationId;
    if (operationChanged) {
      const requestedStart = Date.parse(patch.startedAt || '');
      const currentUpdated = Date.parse(existing.updatedAt || '');
      // A different operation may replace the snapshot only through its explicit start write.
      // Late phase/terminal callbacks from an older run do not carry startedAt and are ignored.
      if (!Number.isFinite(requestedStart) || (Number.isFinite(currentUpdated) && requestedStart < currentUpdated)) {
        return existing;
      }
    }

    const state = normalizeState(patch.state == null ? existing.state : patch.state, existing.state);
    if (!operationChanged && TERMINAL_STATES.has(existing.state) && ACTIVE_STATES.has(state)) {
      // Same-run late events cannot resurrect a terminal operation after cancel/fail/ready.
      return existing;
    }
    const kind = normalizeKind(patch.kind == null ? existing.kind : patch.kind);
    const phase = String(patch.phase == null ? existing.phase : patch.phase);
    const updatedAt = hadExisting ? monotonicIso(existing.updatedAt, now) : normalizeTimestamp(now, new Date().toISOString());
    const merged = normalizeSnapshot({
      ...existing,
      ...patch,
      schemaVersion: SCHEMA_VERSION,
      operationId: patch.operationId || existing.operationId,
      courseId: patch.courseId || existing.courseId || path.basename(courseDir),
      kind,
      state,
      phase,
      progressEvidence: normalizeEvidence(patch.progressEvidence || {}, existing.progressEvidence),
      currentMessageParams: {
        ...(existing.currentMessageParams || {}),
        ...(patch.currentMessageParams || {}),
      },
      currentMessageKey: patch.currentMessageKey || messageKeyFor(kind, state, phase),
      startedAt: patch.startedAt || existing.startedAt || updatedAt,
      updatedAt,
      finishedAt: TERMINAL_STATES.has(state) ? (patch.finishedAt || existing.finishedAt || updatedAt) : null,
      retryable: patch.retryable == null ? ['failed', 'interrupted', 'cancelled'].includes(state) : patch.retryable,
    }, courseDir, { now: new Date(updatedAt) });

    const temp = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
    const payload = `${JSON.stringify(merged, null, 2)}\n`;
    const fd = fs.openSync(temp, 'w', 0o600);
    try {
      fs.writeFileSync(fd, payload);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(temp, file);
    try {
      const dirFd = fs.openSync(courseDir, 'r');
      try { fs.fsyncSync(dirFd); } finally { fs.closeSync(dirFd); }
    } catch {}
    return merged;
  } finally {
    releaseLock(lock);
  }
}

function phasesFor(kind) {
  if (kind === 'next-lesson') return NEXT_PHASES;
  if (kind === 'tutor-turn') return TUTOR_PHASES;
  return FIRST_PHASES;
}

function historyFor(snapshot) {
  const source = snapshot.kind === 'next-lesson' ? NEXT_HISTORY : snapshot.kind === 'tutor-turn' ? TUTOR_HISTORY : FIRST_HISTORY;
  const phases = phasesFor(snapshot.kind);
  const currentIndex = Math.max(0, phases.indexOf(snapshot.phase));
  return source.map(([phase, label]) => {
    const index = phases.indexOf(phase);
    let state = 'pending';
    if (snapshot.state === 'ready' || snapshot.phase === 'complete' || index < currentIndex) state = 'complete';
    else if (index === currentIndex && ACTIVE_STATES.has(snapshot.state)) state = 'active';
    else if (index === currentIndex && ['failed', 'interrupted', 'cancelled'].includes(snapshot.state)) state = 'error';
    return { id: phase, label, state };
  });
}

function progressFor(snapshot) {
  if (snapshot.state === 'ready') return 100;
  const base = PHASE_PROGRESS[snapshot.phase] == null ? 0 : PHASE_PROGRESS[snapshot.phase];
  if (snapshot.state === 'queued') return 0;
  return Math.max(0, Math.min(99, base));
}

function renderMessage(snapshot) {
  const template = MESSAGE_TABLE[snapshot.currentMessageKey]
    || MESSAGE_TABLE[messageKeyFor(snapshot.kind, snapshot.state, snapshot.phase)]
    || '正在处理…';
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => String(snapshot.currentMessageParams?.[key] ?? ''));
}

function projectOperation(snapshot, runtime = {}) {
  if (!snapshot) return null;
  const normalized = normalizeSnapshot(snapshot, runtime.courseDir || process.cwd());
  const actualRuntime = {
    lessons: Number.isFinite(Number(runtime.lessons)) ? Number(runtime.lessons) : Number(normalized.progressEvidence.lessons || 0),
    assessments: Number.isFinite(Number(runtime.assessments)) ? Number(runtime.assessments) : 0,
    busy: Boolean(runtime.busy),
  };
  const progress = progressFor(normalized);
  const state = normalized.state;
  const stage = state === 'ready' ? 'ready' : ['failed', 'interrupted', 'cancelled'].includes(state) ? 'failed' : 'generating';
  return {
    ...normalized,
    progress,
    currentMessage: renderMessage(normalized),
    canvasVariant: state === 'failed' || state === 'interrupted' || state === 'cancelled'
      ? 'error'
      : PHASE_VARIANT[normalized.phase] || 'material',
    history: historyFor(normalized),
    preview: {
      unitsFound: normalized.progressEvidence.units,
      claimsFound: normalized.progressEvidence.claims,
      candidatesGenerated: normalized.progressEvidence.candidates,
      accepted: normalized.progressEvidence.accepted,
      rejected: normalized.progressEvidence.rejected,
      lessonNumber: normalized.kind === 'next-lesson' ? Number(normalized.publishedArtifact || actualRuntime.lessons || 0) + (state === 'ready' ? 0 : 1) : null,
    },
    stage,
    lessons: actualRuntime.lessons,
    assessments: actualRuntime.assessments,
    busy: actualRuntime.busy && ACTIVE_STATES.has(state),
    detailsAvailable: true,
  };
}

module.exports = {
  SCHEMA_VERSION,
  OPERATION_FILE,
  operationStateEnabled,
  readOperation,
  writeOperation,
  projectOperation,
  deriveLegacyOperation,
  normalizeSnapshot,
};
