'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { TextDecoder } = require('node:util');

const SCHEMA_VERSION = 1;
const MAX_SOURCE_BYTES = 200 * 1024 * 1024;
const ONBOARDING_FILE = 'onboarding.json';
const MAX_MISSION_ANSWER_CHARS = 4000;
const MAX_MISSION_DETAIL_CHARS = 2000;
const MISSION_FILE = 'MISSION.md';
const ACTIVE_JOB_STAGES = new Set(['understanding', 'generating']);
const EXECUTION_STATES = new Set(['starting', 'generating']);
const RETRYABLE_STATES = new Set(['failed', 'interrupted']);
const PRE_GENERATION_STATES = new Set(['draft', 'uploading', 'inspecting', 'planning_mission', 'awaiting_mission', 'mission_ready']);
const STATES = new Set([
  'draft',
  'uploading',
  'inspecting',
  'planning_mission',
  'awaiting_mission',
  'mission_ready',
  'starting',
  'generating',
  'ready',
  'failed',
  'interrupted',
]);

const SOURCE_TYPES = {
  '.pdf': {
    format: 'pdf',
    mimeTypes: new Set(['application/pdf', 'application/x-pdf', 'application/octet-stream']),
  },
  '.epub': {
    format: 'epub',
    mimeTypes: new Set(['application/epub+zip', 'application/x-epub+zip', 'application/zip', 'application/x-zip-compressed', 'application/octet-stream']),
  },
  '.md': {
    format: 'markdown',
    mimeTypes: new Set(['text/markdown', 'text/plain', 'application/octet-stream']),
  },
  '.markdown': {
    format: 'markdown',
    storedExtension: '.md',
    mimeTypes: new Set(['text/markdown', 'text/plain', 'application/octet-stream']),
  },
  '.txt': {
    format: 'text',
    mimeTypes: new Set(['text/plain', 'application/octet-stream']),
  },
};

const MISSION_OPTIONS = {
  outcome: {
    understand_main_ideas: ['理解主要观点', '能清楚解释核心概念与框架。'],
    remember_key_content: ['记住关键内容', '适合复习、考试或长期记忆。'],
    apply_real_scenarios: ['应用到真实场景', '能把方法用于工作、写作或生活。'],
    critical_reading: ['进行批判性阅读', '能判断证据、边界与可能的反例。'],
  },
  learningStyle: {
    explain_then_practice: ['短讲解后马上练习', '每个概念都配一个小任务。'],
    understand_then_practice: ['先完整理解再练习', '先建立框架，再集中应用。'],
    cases_and_questions: ['以案例和问题为主', '从真实情境中理解方法。'],
  },
  sessionLength: {
    minutes_5_10: ['5 到 10 分钟', '适合碎片时间。'],
    minutes_15_25: ['15 到 25 分钟', '适合完整完成一节课。'],
    minutes_30_plus: ['30 分钟以上', '可以加入更多练习和拓展。'],
  },
};

class OnboardingError extends Error {
  constructor(code, message, status = 400, details = null) {
    super(message);
    this.name = 'OnboardingError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function isoNow(now = Date.now()) {
  return new Date(now).toISOString();
}

function sanitizeOriginalFilename(value) {
  const base = path.basename(String(value || 'material.txt').replace(/\\/g, '/'))
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim();
  return (base || 'material.txt').slice(0, 180);
}

function sanitizeTitle(value, fallback) {
  const clean = String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, 200);
  return clean || fallback;
}

function normalizeMimeType(value) {
  return String(value || 'application/octet-stream').split(';', 1)[0].trim().toLowerCase()
    || 'application/octet-stream';
}

function validateSourceDescriptor({ originalFilename, mimeType, sizeBytes }) {
  const safeName = sanitizeOriginalFilename(originalFilename);
  const extension = path.extname(safeName).toLowerCase();
  const type = SOURCE_TYPES[extension];
  if (!type) {
    throw new OnboardingError(
      'UNSUPPORTED_FORMAT',
      '仅支持 PDF、EPUB、Markdown 和 TXT 文件',
      415,
      { extension: extension || null },
    );
  }

  const size = Number(sizeBytes);
  if (!Number.isFinite(size) || size <= 0) {
    throw new OnboardingError('EMPTY_FILE', '上传文件为空', 422);
  }
  if (size > MAX_SOURCE_BYTES) {
    throw new OnboardingError('FILE_TOO_LARGE', '文件超过 200 MB 限制', 413, {
      maxBytes: MAX_SOURCE_BYTES,
      receivedBytes: size,
    });
  }

  const normalizedMime = normalizeMimeType(mimeType);
  if (!type.mimeTypes.has(normalizedMime)) {
    throw new OnboardingError('MIME_MISMATCH', '文件类型与扩展名不匹配', 415, {
      extension,
      mimeType: normalizedMime,
    });
  }

  const storedExtension = type.storedExtension || extension;
  return {
    originalFilename: safeName,
    extension: storedExtension,
    format: type.format,
    mimeType: normalizedMime,
    sizeBytes: size,
    storedFilename: `book${storedExtension}`,
  };
}

function createCourseId(dataRoot, randomBytes = crypto.randomBytes) {
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const id = randomBytes(16).toString('hex');
    if (!fs.existsSync(path.join(dataRoot, id))) return id;
  }
  throw new OnboardingError('COURSE_ID_COLLISION', '无法创建唯一课程 ID', 500);
}

function atomicWriteFile(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  let fd;
  try {
    fd = fs.openSync(tmp, 'wx', 0o600);
    fs.writeFileSync(fd, content);
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    fs.renameSync(tmp, file);
  } catch (error) {
    if (fd !== undefined) {
      try { fs.closeSync(fd); } catch {}
    }
    try { fs.unlinkSync(tmp); } catch {}
    throw error;
  }
}

function writeJsonAtomic(file, value) {
  atomicWriteFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

function moveUploadedFile(source, destination) {
  const stat = fs.lstatSync(source);
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new OnboardingError('INVALID_UPLOAD', '上传内容不是普通文件', 422);
  }
  try {
    fs.renameSync(source, destination);
  } catch (error) {
    if (error.code !== 'EXDEV') throw error;
    fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL);
    fs.unlinkSync(source);
  }
}

function hashFileSha256(file) {
  const hash = crypto.createHash('sha256');
  const fd = fs.openSync(file, 'r');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let bytesRead;
    do {
      bytesRead = fs.readSync(fd, buffer, 0, buffer.length, null);
      if (bytesRead > 0) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead > 0);
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest('hex');
}

function readWindow(file, start, length) {
  const fd = fs.openSync(file, 'r');
  const buffer = Buffer.alloc(length);
  try {
    const bytesRead = fs.readSync(fd, buffer, 0, length, start);
    return buffer.subarray(0, bytesRead);
  } finally {
    fs.closeSync(fd);
  }
}

function inspectUtf8TextFile(file) {
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const fd = fs.openSync(file, 'r');
  const buffer = Buffer.allocUnsafe(64 * 1024);
  try {
    let bytesRead;
    do {
      bytesRead = fs.readSync(fd, buffer, 0, buffer.length, null);
      if (bytesRead <= 0) continue;
      const chunk = buffer.subarray(0, bytesRead);
      if (chunk.includes(0)) {
        throw new OnboardingError('INVALID_TEXT', '文本文件包含二进制内容', 422);
      }
      decoder.decode(chunk, { stream: true });
    } while (bytesRead > 0);
    decoder.decode();
  } catch (error) {
    if (error instanceof OnboardingError) throw error;
    throw new OnboardingError('INVALID_TEXT_ENCODING', '文本文件必须使用 UTF-8 编码', 422);
  } finally {
    fs.closeSync(fd);
  }
}

function inspectSourceFile(file, descriptor, now = Date.now()) {
  const stat = fs.lstatSync(file);
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new OnboardingError('INVALID_SOURCE', '课程材料不是普通文件', 422);
  }
  if (stat.size !== descriptor.sizeBytes) {
    throw new OnboardingError('SOURCE_SIZE_CHANGED', '上传文件大小在检查过程中发生变化', 422);
  }

  const head = readWindow(file, 0, Math.min(stat.size, 128 * 1024));
  if (descriptor.format === 'pdf') {
    const tail = readWindow(file, Math.max(0, stat.size - 4096), Math.min(stat.size, 4096));
    if (!head.subarray(0, 5).equals(Buffer.from('%PDF-')) || !tail.includes(Buffer.from('%%EOF'))) {
      throw new OnboardingError('INVALID_PDF', 'PDF 文件结构无效或不完整', 422);
    }
  } else if (descriptor.format === 'epub') {
    const zipHeader = head.length >= 4 && head[0] === 0x50 && head[1] === 0x4b
      && ((head[2] === 0x03 && head[3] === 0x04) || (head[2] === 0x05 && head[3] === 0x06));
    const hasEpubMime = head.includes(Buffer.from('application/epub+zip'));
    if (!zipHeader || !hasEpubMime) {
      throw new OnboardingError('INVALID_EPUB', 'EPUB 文件结构无效或缺少 mimetype', 422);
    }
  } else {
    inspectUtf8TextFile(file);
  }

  return {
    status: 'complete',
    format: descriptor.format,
    inspectedAt: isoNow(now),
    errorCode: null,
    errorMessage: null,
  };
}

function onboardingPath(courseDir) {
  return path.join(courseDir, ONBOARDING_FILE);
}

function missionPath(courseDir) {
  return path.join(courseDir, MISSION_FILE);
}

function createOnboardingRecord({ courseId, source, now = Date.now() }) {
  const timestamp = isoNow(now);
  return {
    version: SCHEMA_VERSION,
    state: 'inspecting',
    courseId,
    createdAt: timestamp,
    updatedAt: timestamp,
    source: { ...source },
    inspection: {
      status: 'pending',
      format: source.format,
      inspectedAt: null,
      errorCode: null,
      errorMessage: null,
    },
    mission: {
      version: 1,
      mode: 'standard',
      status: 'pending',
      question: null,
      options: [],
      summary: null,
      materialSummary: null,
      turns: 0,
      errorCode: null,
      errorMessage: null,
      outcome: null,
      learningStyle: null,
      sessionLength: null,
      completedAt: null,
      confirmedAt: null,
    },
    generation: {
      attempts: 0,
      activeRunId: null,
      startedAt: null,
      readyAt: null,
      failedAt: null,
      errorCode: null,
      errorMessage: null,
    },
  };
}

function assertRecord(record) {
  if (!record || record.version !== SCHEMA_VERSION || !STATES.has(record.state)) {
    throw new OnboardingError('INVALID_ONBOARDING_STATE', 'onboarding.json 无效或版本不受支持', 500);
  }
  return record;
}

function readOnboarding(courseDir, { optional = false } = {}) {
  try {
    return assertRecord(JSON.parse(fs.readFileSync(onboardingPath(courseDir), 'utf8')));
  } catch (error) {
    if (optional && error.code === 'ENOENT') return null;
    if (error instanceof OnboardingError) throw error;
    if (error.code === 'ENOENT') throw new OnboardingError('ONBOARDING_NOT_FOUND', '未找到新手引导状态', 404);
    throw new OnboardingError('INVALID_ONBOARDING_JSON', '无法读取 onboarding.json', 500);
  }
}

function writeOnboarding(courseDir, record) {
  assertRecord(record);
  writeJsonAtomic(onboardingPath(courseDir), record);
  return record;
}

function mergeRecord(record, patch) {
  return {
    ...record,
    ...patch,
    source: { ...record.source, ...(patch.source || {}) },
    inspection: { ...record.inspection, ...(patch.inspection || {}) },
    mission: { ...record.mission, ...(patch.mission || {}) },
    generation: { ...record.generation, ...(patch.generation || {}) },
  };
}

function updateOnboarding(courseDir, record, patch, now = Date.now()) {
  const next = mergeRecord(record, { ...patch, updatedAt: isoNow(now) });
  return writeOnboarding(courseDir, next);
}

function publicOnboarding(record) {
  if (!record) return null;
  return JSON.parse(JSON.stringify(record));
}

function onboardingGenerationStage(record, jobStage = 'understanding') {
  if (!record) return jobStage;
  const attempts = Number(record.generation && record.generation.attempts || 0);
  if (PRE_GENERATION_STATES.has(record.state) || (record.state === 'failed' && attempts === 0)) {
    return 'idle';
  }
  if (record.state === 'ready') return 'ready';
  if (record.state === 'failed' || record.state === 'interrupted') return 'failed';
  return jobStage;
}

function createCourseDraft({ dataRoot, tempFile, originalFilename, mimeType, sizeBytes, title, now = Date.now() }) {
  const descriptor = validateSourceDescriptor({ originalFilename, mimeType, sizeBytes });
  const courseId = createCourseId(dataRoot);
  const courseDir = path.join(dataRoot, courseId);
  fs.mkdirSync(courseDir, { recursive: false, mode: 0o700 });
  let record;

  try {
    const sourceFile = path.join(courseDir, descriptor.storedFilename);
    moveUploadedFile(tempFile, sourceFile);
    const source = {
      ...descriptor,
      sha256: hashFileSha256(sourceFile),
    };
    const fallbackTitle = path.basename(descriptor.originalFilename, path.extname(descriptor.originalFilename));
    writeJsonAtomic(path.join(courseDir, 'meta.json'), {
      title: sanitizeTitle(title, fallbackTitle || '我的课程'),
    });
    record = createOnboardingRecord({ courseId, source, now });
    writeOnboarding(courseDir, record);

    try {
      const inspection = inspectSourceFile(sourceFile, source, now);
      record = updateOnboarding(courseDir, record, {
        state: 'awaiting_mission',
        inspection,
      }, now);
      return { courseId, courseDir, record };
    } catch (error) {
      const normalized = error instanceof OnboardingError
        ? error
        : new OnboardingError('INSPECTION_FAILED', '材料检查失败', 422);
      record = updateOnboarding(courseDir, record, {
        state: 'failed',
        inspection: {
          status: 'failed',
          inspectedAt: isoNow(now),
          errorCode: normalized.code,
          errorMessage: normalized.message,
        },
      }, now);
      normalized.courseId = courseId;
      normalized.onboarding = publicOnboarding(record);
      throw normalized;
    }
  } catch (error) {
    if (!record) fs.rmSync(courseDir, { recursive: true, force: true });
    throw error;
  }
}

function normalizeMissionQuestionOptions(value) {
  if (!Array.isArray(value) || value.length < 3 || value.length > 5) {
    throw new OnboardingError('INVALID_MISSION_OPTIONS', 'Teach 必须返回 3 到 5 个 Mission 选项', 502);
  }
  const ids = new Set();
  const labels = new Set();
  const options = [];
  for (const [index, item] of value.entries()) {
    const source = item && typeof item === 'object' && !Array.isArray(item) ? item : {};
    const id = String(source.id || `option_${index + 1}`)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 64);
    const label = String(source.label || '')
      .replace(/[\u0000-\u001f\u007f]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 180);
    const description = String(source.description || '')
      .replace(/[\u0000-\u001f\u007f]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 320);
    const labelKey = label.toLocaleLowerCase('zh-CN');
    if (!id || !label || ids.has(id) || labels.has(labelKey)) {
      throw new OnboardingError('INVALID_MISSION_OPTIONS', 'Teach 返回了无效或重复的 Mission 选项', 502);
    }
    ids.add(id);
    labels.add(labelKey);
    options.push({ id, label, ...(description ? { description } : {}) });
  }
  return options;
}

function cleanMissionAnswerText(value, maxChars, errorCode, message) {
  const text = String(value || '')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .trim();
  if (text.length > maxChars) throw new OnboardingError(errorCode, message, 422);
  return text;
}

function resolveMissionAnswer(record, input) {
  const source = input && typeof input === 'object' ? input : {};
  const missionOptions = Array.isArray(record && record.mission && record.mission.options)
    ? record.mission.options
    : [];
  const detail = cleanMissionAnswerText(
    source.detail,
    MAX_MISSION_DETAIL_CHARS,
    'MISSION_DETAIL_TOO_LONG',
    '补充说明不能超过 2000 个字符',
  );
  if (missionOptions.length) {
    const selectionId = String(source.selectionId || '').trim();
    const selected = missionOptions.find((option) => option && option.id === selectionId);
    if (!selected) throw new OnboardingError('MISSION_SELECTION_REQUIRED', '请先选择一个最接近的答案', 422);
    return detail ? `用户选择：${selected.label}\n补充说明：${detail}` : `用户选择：${selected.label}`;
  }
  const legacy = cleanMissionAnswerText(
    source.answer || source.detail,
    MAX_MISSION_ANSWER_CHARS,
    'MISSION_ANSWER_TOO_LONG',
    '回答不能超过 4000 个字符',
  );
  if (!legacy) throw new OnboardingError('MISSION_ANSWER_REQUIRED', '请先回答这个问题', 422);
  return legacy;
}

function markMissionPlanning(courseDir, { retry = false, now = Date.now() } = {}) {
  const record = readOnboarding(courseDir);
  const allowed = retry
    ? record.mission && record.mission.status === 'failed'
    : record.state === 'awaiting_mission' || record.state === 'planning_mission';
  if (!allowed) throw new OnboardingError('INVALID_STATE', '当前状态不可开始 Mission 访谈', 409, { state: record.state });
  return updateOnboarding(courseDir, record, {
    state: 'planning_mission',
    mission: { mode: 'standard', status: 'planning', question: null, options: [], errorCode: null, errorMessage: null },
  }, now);
}

function markMissionQuestion(courseDir, { question, options, materialSummary = '', now = Date.now() }) {
  const record = readOnboarding(courseDir);
  if (record.state !== 'planning_mission') throw new OnboardingError('INVALID_STATE', '当前状态不可保存 Mission 问题', 409);
  const normalizedOptions = normalizeMissionQuestionOptions(options);
  return updateOnboarding(courseDir, record, {
    state: 'awaiting_mission',
    mission: {
      mode: 'standard', status: 'question', question: String(question || '').trim().slice(0, 800),
      options: normalizedOptions,
      materialSummary: String(materialSummary || '').trim().slice(0, 800),
      turns: Number(record.mission.turns || 0) + 1, errorCode: null, errorMessage: null,
    },
  }, now);
}

function markMissionReady(courseDir, { summary, materialSummary = '', now = Date.now() }) {
  const record = readOnboarding(courseDir);
  if (record.state !== 'planning_mission') throw new OnboardingError('INVALID_STATE', '当前状态不可完成 Mission 访谈', 409);
  return updateOnboarding(courseDir, record, {
    state: 'mission_ready',
    mission: {
      mode: 'standard', status: 'ready', question: null,
      options: [],
      summary: String(summary || '').trim().slice(0, 1200),
      materialSummary: String(materialSummary || '').trim().slice(0, 800),
      completedAt: isoNow(now), errorCode: null, errorMessage: null,
    },
  }, now);
}

function markMissionFailed(courseDir, error, now = Date.now()) {
  const record = readOnboarding(courseDir);
  return updateOnboarding(courseDir, record, {
    state: 'awaiting_mission',
    mission: {
      mode: 'standard', status: 'failed', question: null,
      options: [],
      errorCode: error && error.code || 'MISSION_FAILED',
      errorMessage: String(error && error.message || 'Mission 访谈没有完成').slice(0, 500),
    },
  }, now);
}

function confirmMission(courseDir, now = Date.now()) {
  const record = readOnboarding(courseDir);
  if (record.state !== 'mission_ready' || record.mission.status !== 'ready' || !fs.existsSync(missionPath(courseDir))) {
    throw new OnboardingError('MISSION_INCOMPLETE', 'Teach Mission 尚未准备好', 409);
  }
  return updateOnboarding(courseDir, record, {
    state: 'awaiting_mission',
    mission: { status: 'confirmed', confirmedAt: isoNow(now) },
  }, now);
}

function normalizeMission(input) {
  const source = input && typeof input === 'object' ? input : {};
  const mission = {
    outcome: String(source.outcome || ''),
    learningStyle: String(source.learningStyle || ''),
    sessionLength: String(source.sessionLength || ''),
  };
  for (const [field, value] of Object.entries(mission)) {
    if (!MISSION_OPTIONS[field][value]) {
      throw new OnboardingError('INVALID_MISSION', `无效的 Mission 字段：${field}`, 422, { field });
    }
  }
  return mission;
}

function compileMissionMarkdown(input) {
  const mission = normalizeMission(input);
  const [outcomeLabel, outcomeDescription] = MISSION_OPTIONS.outcome[mission.outcome];
  const [styleLabel, styleDescription] = MISSION_OPTIONS.learningStyle[mission.learningStyle];
  const [sessionLabel, sessionDescription] = MISSION_OPTIONS.sessionLength[mission.sessionLength];
  return `# Mission\n\n`
    + `## Desired outcome\n${outcomeLabel}\n\n${outcomeDescription}\n\n`
    + `## Preferred learning approach\n${styleLabel}\n\n${styleDescription}\n\n`
    + `## Session length\n${sessionLabel}\n\n${sessionDescription}\n\n`
    + `## Success definition\n`
    + `围绕“${outcomeLabel}”设计课程，并采用“${styleLabel}”的节奏；每节课应适合“${sessionLabel}”的单次投入。\n\n`
    + `## Authority\n`
    + `以上内容来自学习者在首次建课时的明确选择。生成课程时不得覆盖、猜测或重新询问这些设置。\n`;
}

function missionComplete(record) {
  if (record && record.mission && record.mission.status === 'confirmed') return true;
  try {
    normalizeMission(record && record.mission);
    return true;
  } catch {
    return false;
  }
}

function saveMission(courseDir, input, now = Date.now()) {
  const record = readOnboarding(courseDir);
  const mission = normalizeMission(input);
  const markdown = compileMissionMarkdown(mission);
  const currentMission = {
    outcome: record.mission.outcome,
    learningStyle: record.mission.learningStyle,
    sessionLength: record.mission.sessionLength,
  };
  const unchanged = JSON.stringify(currentMission) === JSON.stringify(mission)
    && fs.existsSync(missionPath(courseDir))
    && fs.readFileSync(missionPath(courseDir), 'utf8') === markdown;
  if (unchanged) return record;
  if (record.state !== 'awaiting_mission') {
    throw new OnboardingError('INVALID_STATE', '当前状态不允许修改 Mission', 409, { state: record.state });
  }
  if (record.inspection.status !== 'complete') {
    throw new OnboardingError('INSPECTION_NOT_COMPLETE', '材料检查尚未完成', 409);
  }

  atomicWriteFile(missionPath(courseDir), markdown);
  return updateOnboarding(courseDir, record, {
    mission: {
      version: 1,
      ...mission,
      completedAt: isoNow(now),
    },
  }, now);
}

function markGenerationStarting(courseDir, { retry = false, now = Date.now() } = {}) {
  const record = readOnboarding(courseDir);
  const allowed = retry ? RETRYABLE_STATES.has(record.state) : record.state === 'awaiting_mission';
  if (!allowed) {
    throw new OnboardingError('INVALID_STATE', retry ? '当前状态不可重试' : '当前状态不可启动生成', 409, {
      state: record.state,
    });
  }
  if (record.inspection.status !== 'complete') {
    throw new OnboardingError('INSPECTION_NOT_COMPLETE', '材料检查尚未完成', 409);
  }
  if (!missionComplete(record) || !fs.existsSync(missionPath(courseDir))) {
    throw new OnboardingError('MISSION_INCOMPLETE', '请先完成并确认 Teach Mission', 409);
  }
  return updateOnboarding(courseDir, record, {
    state: 'starting',
    generation: {
      attempts: Number(record.generation.attempts || 0) + 1,
      activeRunId: null,
      startedAt: isoNow(now),
      readyAt: null,
      failedAt: null,
      errorCode: null,
      errorMessage: null,
    },
  }, now);
}

function markGenerationRunning(courseDir, job, now = Date.now()) {
  const record = readOnboarding(courseDir);
  if (record.state !== 'starting' && record.state !== 'generating') {
    throw new OnboardingError('INVALID_STATE', '当前状态不可标记为生成中', 409, { state: record.state });
  }
  return updateOnboarding(courseDir, record, {
    state: 'generating',
    generation: {
      activeRunId: job && job.runId || record.generation.activeRunId,
      startedAt: job && job.startedAt || record.generation.startedAt || isoNow(now),
      errorCode: null,
      errorMessage: null,
    },
  }, now);
}

function markGenerationReady(courseDir, job, now = Date.now()) {
  const record = readOnboarding(courseDir);
  if (!EXECUTION_STATES.has(record.state)) {
    if (record.state === 'ready') return record;
    throw new OnboardingError('INVALID_STATE', '当前状态不可标记为 ready', 409, { state: record.state });
  }
  return updateOnboarding(courseDir, record, {
    state: 'ready',
    generation: {
      activeRunId: job && job.runId || record.generation.activeRunId,
      readyAt: job && job.finishedAt || isoNow(now),
      failedAt: null,
      errorCode: null,
      errorMessage: null,
    },
  }, now);
}

function markGenerationFailed(courseDir, error, { interrupted = false, now = Date.now() } = {}) {
  const record = readOnboarding(courseDir);
  if (!EXECUTION_STATES.has(record.state)
    && record.state !== 'ready'
    && record.state !== 'failed'
    && record.state !== 'interrupted') {
    return record;
  }
  const message = String(error && error.message || error || '课程生成没有完成').slice(0, 500);
  return updateOnboarding(courseDir, record, {
    state: interrupted ? 'interrupted' : 'failed',
    generation: {
      failedAt: isoNow(now),
      errorCode: interrupted ? 'GENERATION_INTERRUPTED' : 'GENERATION_FAILED',
      errorMessage: message,
    },
  }, now);
}

function reconcileOnboarding(courseDir, {
  job = {},
  busy = false,
  lessons = 0,
  lessonReadable = false,
  jobMtimeMs = 0,
  now = Date.now(),
  staleAfterMs = 60_000,
} = {}) {
  let record = readOnboarding(courseDir);
  if (record.state === 'ready') {
    if (lessons > 0 && lessonReadable) return record;
    return markGenerationFailed(courseDir, new Error('课程已标记完成，但第一课不可读取'), { now });
  }
  if (!EXECUTION_STATES.has(record.state)) return record;

  if (job.stage === 'ready') {
    if (lessons > 0 && lessonReadable) return markGenerationReady(courseDir, job, now);
    return markGenerationFailed(courseDir, new Error('课程生成完成，但第一课暂时不可读取'), { now });
  }
  if (job.stage === 'failed') {
    return markGenerationFailed(courseDir, new Error(job.error || '课程生成没有完成'), { now });
  }
  if (!busy && ACTIVE_JOB_STAGES.has(job.stage) && jobMtimeMs <= 0) {
    return markGenerationFailed(courseDir, new Error('课程生成记录缺失，请重试'), {
      interrupted: true,
      now,
    });
  }
  if (busy || ACTIVE_JOB_STAGES.has(job.stage)) {
    const stale = !busy && jobMtimeMs > 0 && now - jobMtimeMs > staleAfterMs;
    if (stale) {
      return markGenerationFailed(courseDir, new Error('课程生成已中断，请重试'), {
        interrupted: true,
        now,
      });
    }
    if (record.state === 'starting' || record.generation.activeRunId !== job.runId) {
      record = markGenerationRunning(courseDir, job, now);
    }
    return record;
  }
  return markGenerationFailed(courseDir, new Error('课程生成已中断，请重试'), {
    interrupted: true,
    now,
  });
}

module.exports = {
  ACTIVE_JOB_STAGES,
  MAX_SOURCE_BYTES,
  MISSION_OPTIONS,
  OnboardingError,
  SCHEMA_VERSION,
  atomicWriteFile,
  compileMissionMarkdown,
  confirmMission,
  createCourseDraft,
  createCourseId,
  inspectSourceFile,
  markGenerationFailed,
  markGenerationReady,
  markGenerationRunning,
  markGenerationStarting,
  markMissionFailed,
  markMissionPlanning,
  markMissionQuestion,
  markMissionReady,
  missionComplete,
  onboardingGenerationStage,
  publicOnboarding,
  readOnboarding,
  reconcileOnboarding,
  resolveMissionAnswer,
  saveMission,
  updateOnboarding,
  validateSourceDescriptor,
  writeJsonAtomic,
};
