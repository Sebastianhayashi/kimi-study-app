// Kimi Study 后端：静态页（注入 glue.js）+ 课程 API + kimi 子进程
const express = require('express');
const multer = require('multer');
const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  buildTutorPrompt,
  withHumanizerSkill,
  createTutorSessionState,
  normalizeTutorSessionState,
  isTutorSessionMissingError,
} = require('./lib/tutor-context');
const {
  buildNextLessonPrompt,
  captureNextLessonBaseline,
  clearNextLessonTransaction,
  createGeneratorSessionState,
  generatorSessionIdForRun,
  isGenerationJobActive,
  isStaleGenerationJob,
  normalizeGeneratorSessionState,
  recoverInterruptedNextLesson,
  writeNextLessonTransaction,
  withTeachSkill,
} = require('./lib/next-lesson');
const {
  cleanupNextLessonDelta,
  validateNextLessonDelta,
} = require('./lib/lesson-publish-validator');
const { normalizeLessonSpecShape, validateLessonSpec, scoreActivity, computeClaimProgress, toPublicLessonSpec } = require('./lib/activity-engine');
const { isPrivateCoursePath } = require('./lib/private-course-path');
const { deriveGenerationStatus } = require('./lib/generation-status');
const { runTrackedKimi } = require('./lib/kimi-generation-runner');
const { appendGenerationEvent, readGenerationEvents, subscribeGenerationEvents } = require('./lib/generation-events');
const { listCourseSources } = require('./lib/source-manifest');
const { resolveDataDir, assertSafeRuntime } = require('./lib/runtime-config');
const { validateCuriosityDocument } = require('./lib/curiosity-contract');
const { createLearningActionService } = require('./lib/learning-action-router');
const {
  MAX_STUDY_SURFACE_BYTES,
  inspectStudySurfaceState,
  normalizeStudySurfaceState,
  studySurfaceByteLength,
} = require('./lib/study-surface-state');
const {
  answerMissionPrompt,
  initialMissionPrompt,
  isRepairableMissionError,
  materializeMissionDocument,
  parseMissionTurn,
  promoteMissionSession,
  readMissionSessionState,
  repairMissionPrompt,
  validateMissionDocument,
  writeMissionSessionState,
} = require('./lib/standard-teach-mission');
const {
  MAX_SOURCE_BYTES,
  OnboardingError,
  confirmMission,
  createCourseDraft,
  markGenerationFailed,
  markGenerationReady,
  markGenerationRunning,
  markGenerationStarting,
  markMissionFailed,
  markMissionPlanning,
  markMissionQuestion,
  markMissionReady,
  onboardingGenerationStage,
  publicOnboarding,
  readOnboarding,
  resolveMissionAnswer,
  reconcileOnboarding,
} = require('./lib/onboarding');

const ROOT = __dirname;
const DATA = resolveDataDir({ root: ROOT });
const SKILLS = path.join(ROOT, 'skills');
const MODEL = 'kimi-code/kimi-for-coding'; // K2.7 Coding
const PORT = process.env.PORT || 3000;
const RUNTIME = assertSafeRuntime({ root: ROOT, dataDir: DATA, port: PORT, env: process.env });
fs.mkdirSync(DATA, { recursive: true });
const selectLearningActions = createLearningActionService();

const MAP_INSTRUCTION =
  `最后，把本课程工作区的内容汇总写入 map.json（严格 JSON，不要任何多余文字），格式：` +
  `{"mission":{"title":"学习目标一句话","copy":"一段话","criteria":["成功标准"],"constraints":["约束"]},` +
  `"promise":"课程承诺一句话","material":"材料理解一两句话",` +
  `"methods":[{"name":"方法名","when":"何时使用","boundary":"边界"}],` +
  `"path":["第一步","第二步"]}。内容取自 MISSION.md、RESOURCES.md、reference/ 和 learning-records/。`;


const ASSESSMENT_INSTRUCTION =
  `\n\n互动教学要求：MISSION.md 是用户学习意图的权威来源；若已存在且已填写，不要重复 Mission 问答。` +
  `按 skills/teach/ASSESSMENT-DESIGN.md 执行：分析材料单元，生成 learning claims、evidence requirements、` +
  `assessment blueprint、misconceptions、answer-first question candidates 和 quality report。` +
  `为生成的 lessons/NNNN-name.html 同时写 assessments/NNNN-name.json，并在 HTML 中放置对应的 ` +
  '`<div data-kimi-activity="activity-id"></div>`。' +
  `普通选择、填空、排序题必须可确定性评分；答案和评分键只能放在 assessments/，不要写入 HTML。`;

const CURIOSITY_INSTRUCTION =
  `

Curiosity 不是随机冷知识。完成课节与 Assessment 后，可选择生成 0—3 张高质量 Curiosity Card。` +
  `只有当内容与本课目标高度相关、确实违反合理预期、一分钟内能理解且有可靠依据时才生成；达不到门槛就生成 0 张。` +
  `写入 curiosity/<LESSON_BASE>.json，schemaVersion 为 1，lessonId 必须等于 LESSON_BASE。` +
  `每张卡包含 id、hook、prediction.prompt、prediction.options（可选 2—4 项）、reveal、bridge、section 或 anchor、` +
  `source.label 或 sourceRefs，以及 scores：relevance>=4、surprise>=3、clarity>=3、confidence>=4、load<=3。` +
  `不得把答案、Assessment 评分键或无关趣闻写入 Curiosity。`;

const FIRST_PROMPT = (ext) =>
  `/skill:teach 用户上传了一本书想学习，材料是当前目录的 book${ext}` +
  `（如为 epub 可用 unzip 提取文本，如为 pdf 请自行想办法提取文本）。` +
  `请按 teach skill 的流程执行：先写 MISSION.md（mission：掌握这本书的核心内容）和 RESOURCES.md，` +
  `然后生成第一课 lessons/0001-*.html。所有产出用中文。` +
  `另外把书的封面图片提取保存到工作区根目录 cover.jpg（epub 解压后在 OPF manifest 里找 cover 项；` +
  `pdf 可用 sips 把第一页转成 jpg）。` + ASSESSMENT_INSTRUCTION + CURIOSITY_INSTRUCTION + MAP_INSTRUCTION;

const FIRST_ONBOARDING_PROMPT = (ext) =>
  `继续当前 teach Session。用户已经确认 MISSION.md；不要重新进行 Mission 访谈，也不要改写 Mission。` +
  `材料是当前目录的 book${ext}。读取已确认的 MISSION.md，写 RESOURCES.md，然后生成第一课 lessons/0001-*.html。所有产出用中文。` +
  `另外把书的封面图片提取保存到工作区根目录 cover.jpg（epub 解压后在 OPF manifest 里找 cover 项；` +
  `pdf 可用 sips 把第一页转成 jpg）。` + ASSESSMENT_INSTRUCTION + CURIOSITY_INSTRUCTION + MAP_INSTRUCTION;


const app = express();
// Scratch drawings can exceed Express' default 100kb JSON limit. Keep the
// larger parser scoped to this one bounded endpoint; all other APIs retain the
// default request-body limit.
app.use('/api/courses/:id/study-surface', express.json({ limit: '1mb' }));
app.use(express.json());
app.use((req, res, next) => { console.log(`[http] ${req.method} ${req.url}`); next(); });
app.get('/favicon.ico', (req, res) => res.status(204).end());

// ---- 冻结前端：原样输出，仅在响应中注入运行时资源 ----
const page = (file, { head = '', body = '' } = {}) => (req, res) => {
  const html = fs.readFileSync(path.join(ROOT, 'public', file), 'utf8')
    .replace('</head>', `${head}</head>`)
    .replace('</body>', `${body}<script src="/glue.js"></script></body>`);
  res.type('html').send(html);
};
app.get('/', page('index.html'));
app.get('/app', page('app.html'));
app.get('/new-course', page('new-course.html', {
  body: '<script src="/first-run-onboarding.js"></script>',
}));
app.get('/course/:id', page('course.html', {
  head: '<link rel="stylesheet" href="/generation-preview-product.css"><link rel="stylesheet" href="/source-viewer.css"><link rel="stylesheet" href="/frontend-shell.css"><link rel="stylesheet" href="/core-journey-polish.css"><link rel="stylesheet" href="/course-notes-index.css"><link rel="stylesheet" href="/study-surface.css">',
  body: '<script src="/assistant-markdown.js"></script><script src="/core-journey-progress.js"></script><script src="/generation-preview-product.js"></script><script src="/generation-events-client.js"></script><script src="/source-viewer.js"></script><script src="/course-notes-index.js"></script><script src="/study-surface.js"></script>',
}));
app.use('/vendor/lenis', express.static(path.join(ROOT, 'node_modules', 'lenis', 'dist')));
app.use('/vendor/pdfjs', express.static(path.join(ROOT, 'node_modules', 'pdfjs-dist')));
app.use('/vendor/epubjs', express.static(path.join(ROOT, 'node_modules', 'epubjs', 'dist')));
app.use('/vendor/jszip', express.static(path.join(ROOT, 'node_modules', 'jszip', 'dist')));
app.use(express.static(path.join(ROOT, 'public'))); // 前端外壳资源

// ---- 课程工作区 ----
const locks = new Set(); // 每门课同时只跑一个 kimi 进程
const dirOf = (id) => path.join(DATA, id);
const validId = (id) => /^[a-z0-9]+$/i.test(id);
const emitGenerationEvent = (id, event) => {
  try { return appendGenerationEvent(dirOf(id), event); }
  catch (error) {
    console.log(`[generation ${id}] event log failed: ${error.message}`);
    return null;
  }
};
const jobFile = (id) => path.join(dirOf(id), 'job.json');
const writeJob = (id, job) => fs.writeFileSync(jobFile(id), JSON.stringify(job));
const readJob = (id) => { try { return JSON.parse(fs.readFileSync(jobFile(id), 'utf8')); } catch { return { stage: 'understanding' }; } };
const lessonsOf = (id) => {
  const d = path.join(dirOf(id), 'lessons');
  return fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith('.html') && f !== 'index.html').sort() : [];
};
const assessmentsOf = (id) => {
  const d = path.join(dirOf(id), 'assessments');
  return fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith('.json')).sort() : [];
};

function runPrintKimi(id, prompt, { cont = false, sessionId = null } = {}) {
  return new Promise((resolve, reject) => {
    locks.add(id);
    const args = ['-m', MODEL, '--skills-dir', SKILLS];
    if (sessionId) args.push('--session', sessionId);
    else if (cont) args.push('-c');
    args.push('-p', prompt);
    const sessionLabel = sessionId ? ' (tutor session)' : cont ? ' (continue)' : '';
    console.log(`[kimi ${id}] start${sessionLabel}: ${prompt.slice(0, 50)}...`);
    const p = spawn('kimi', args, { cwd: dirOf(id) });
    let out = '', err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('error', (error) => {
      locks.delete(id);
      reject(error);
    });
    p.on('close', (code) => {
      locks.delete(id);
      console.log(`[kimi ${id}] exit ${code}`);
      code === 0 ? resolve(out) : reject(new Error(err || `kimi exit ${code}`));
    });
  });
}

// 生成任务优先使用真实工具/文件事件；下一课额外记录本轮基线和独立 generator session。
function launchStandardMissionTurn(id, { answer = null, retry = false } = {}) {
  const courseDir = dirOf(id);
  if (locks.has(id)) throw new OnboardingError('MISSION_BUSY', 'Teach 正在处理上一轮回答', 409);
  const record = markMissionPlanning(courseDir, { retry });
  const state = readMissionSessionState(courseDir);
  if (answer != null && (!state.initialized || !state.sessionId)) {
    markMissionFailed(courseDir, new OnboardingError('MISSION_SESSION_MISSING', 'Mission 会话不可恢复', 409));
    throw new OnboardingError('MISSION_SESSION_MISSING', 'Mission 会话不可恢复', 409);
  }
  const prompt = retry && state.initialized && state.sessionId
    ? repairMissionPrompt()
    : answer == null ? initialMissionPrompt(record.source.extension) : answerMissionPrompt(answer);

  const runMissionPrompt = (missionPrompt, sessionState) => runTrackedKimi({
    cwd: courseDir,
    prompt: missionPrompt,
    sessionId: sessionState.sessionId,
    preferredMode: sessionState.preferredMode,
    model: MODEL,
    skillsDir: SKILLS,
  });

  const persistMissionSession = (result, previousState) => {
    const sessionId = result.sessionId || previousState.sessionId;
    if (!sessionId) throw new OnboardingError('MISSION_SESSION_MISSING', 'Teach 没有返回可恢复的 Session', 502);
    return writeMissionSessionState(courseDir, {
      ...previousState,
      sessionId,
      initialized: true,
      preferredMode: result.mode || previousState.preferredMode,
    });
  };

  const acceptMissionResult = async (result, previousState, allowRepair) => {
    const nextState = persistMissionSession(result, previousState);
    try {
      const turn = parseMissionTurn(result.text);
      if (turn.status === 'question') return markMissionQuestion(courseDir, turn);
      materializeMissionDocument(courseDir, turn);
      return markMissionReady(courseDir, turn);
    } catch (error) {
      if (allowRepair && isRepairableMissionError(error)) {
        const repaired = await runMissionPrompt(repairMissionPrompt(), nextState);
        return acceptMissionResult(repaired, nextState, false);
      }
      if (isRepairableMissionError(error)) {
        throw new OnboardingError(
          'MISSION_REPAIR_FAILED',
          'Teach 没有完成学习目标整理。你之前的回答和材料已保留，请重试。',
          502,
        );
      }
      throw error;
    }
  };

  locks.add(id);
  Promise.resolve(runMissionPrompt(prompt, state))
    .then((result) => acceptMissionResult(result, state, true))
    .catch((error) => {
      try { markMissionFailed(courseDir, error); }
      catch (persistError) { console.log(`[mission ${id}] failed to persist error: ${persistError.message}`); }
    })
    .finally(() => locks.delete(id));
  return record;
}

function runKimi(id, prompt, {
  cont = false,
  track = false,
  sessionId = null,
  preferredMode = null,
  kind = null,
  baseline = null,
  onResult = null,
} = {}) {
  if (!track) return runPrintKimi(id, prompt, { cont, sessionId });

  const runId = crypto.randomUUID();
  const isNextLesson = kind === 'next-lesson';
  const stage = lessonsOf(id).length ? 'generating' : 'understanding';
  const startedAt = new Date().toISOString();
  const job = {
    stage,
    runId,
    kind: kind || 'course-generation',
    phase: isNextLesson ? 'extracting' : null,
    currentMessage: isNextLesson ? '正在读取学习记录并确定下一学习目标…' : null,
    baselineLessons: isNextLesson ? baseline.lessons.length : undefined,
    baselineAssessments: isNextLesson ? baseline.assessments.length : undefined,
    startedAt,
    updatedAt: startedAt,
  };
  try {
    if (isNextLesson) writeNextLessonTransaction(dirOf(id), baseline);
    locks.add(id);
    writeJob(id, job);
    emitGenerationEvent(id, {
      runId,
      kind: 'run-start',
      key: `run:${runId}`,
      phase: job.phase || undefined,
      state: 'active',
      message: isNextLesson ? job.currentMessage : lessonsOf(id).length ? '正在生成下一课…' : '正在开始创建课程…',
    });
  } catch (error) {
    locks.delete(id);
    if (isNextLesson) clearNextLessonTransaction(dirOf(id));
    throw error;
  }

  const persistEvent = (event) => {
    if (!event) return;
    if (event.phase) job.phase = event.phase;
    if (event.message) job.currentMessage = event.message;
    job.updatedAt = new Date().toISOString();
    writeJob(id, job);
    emitGenerationEvent(id, { runId, ...event });
  };

  return runTrackedKimi({
    cwd: dirOf(id),
    prompt,
    cont,
    sessionId,
    preferredMode,
    model: MODEL,
    skillsDir: SKILLS,
    onEvent: persistEvent,
  }).then((result) => {
    const { text, status, mode } = result;
    if (status !== 'finished') throw new Error(`Kimi generation ended with status ${status}`);
    if (isNextLesson) {
      persistEvent({
        kind: 'runner-complete',
        key: `runner:${runId}`,
        state: 'complete',
        message: '模型生成步骤已经结束',
      });
    }
    if (typeof onResult === 'function') onResult(result);

    let newLesson = null;
    if (isNextLesson) {
      job.phase = 'validating';
      job.currentMessage = '正在检查新增课节、活动挂载和评分规格…';
      job.updatedAt = new Date().toISOString();
      writeJob(id, job);
      emitGenerationEvent(id, {
        runId,
        kind: 'phase',
        key: 'phase:validating',
        phase: 'validating',
        canvasVariant: 'validation',
        state: 'active',
        message: job.currentMessage,
      });
      const validation = validateNextLessonDelta(dirOf(id), baseline);
      if (!validation.ok) {
        throw new Error(`新增课节未通过发布验证：${validation.errors.join('；')}`);
      }
      newLesson = validation.newLesson;
    } else if (!lessonsOf(id).length) {
      throw new Error('Kimi finished without generating a lesson');
    }

    if (isNextLesson) clearNextLessonTransaction(dirOf(id));
    locks.delete(id);
    const finishedAt = new Date().toISOString();
    writeJob(id, {
      ...job,
      stage: 'ready',
      phase: 'complete',
      currentMessage: isNextLesson ? '下一课已准备好' : '课程已准备好',
      mode,
      sessionId: result.sessionId || sessionId || null,
      newLesson,
      updatedAt: finishedAt,
      finishedAt,
    });
    emitGenerationEvent(id, {
      runId,
      kind: 'run-complete',
      key: `run:${runId}`,
      phase: 'complete',
      canvasVariant: 'ready',
      state: 'complete',
      message: isNextLesson ? '下一课已准备好' : '课程已准备好',
    });
    return { text, mode, sessionId: result.sessionId || sessionId || null, newLesson };
  }).catch((error) => {
    locks.delete(id);
    const cleanup = isNextLesson ? cleanupNextLessonDelta(dirOf(id), baseline) : {
      removed: [],
      changedExisting: [],
    };
    if (isNextLesson) clearNextLessonTransaction(dirOf(id));
    const failedAt = new Date().toISOString();
    writeJob(id, {
      ...job,
      stage: 'failed',
      cleanupRemoved: cleanup.removed,
      repairRequired: cleanup.changedExisting.length > 0,
      changedExisting: cleanup.changedExisting,
      currentMessage: isNextLesson ? '下一课生成没有完成，请重试' : '课程生成没有完成，请重试',
      updatedAt: failedAt,
      failedAt,
      error: String(error.message || error).slice(-500),
    });
    emitGenerationEvent(id, {
      runId,
      kind: 'run-failed',
      key: `run:${runId}`,
      state: 'error',
      message: isNextLesson ? '下一课生成没有完成，请重试' : '课程生成没有完成，请重试',
    });
    throw error;
  });
}


function firstLessonReadable(id) {
  const [first] = lessonsOf(id);
  if (!first) return false;
  const file = path.join(dirOf(id), 'lessons', first);
  try {
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink() || !stat.isFile() || stat.size <= 0) return false;
    const fd = fs.openSync(file, 'r');
    try {
      const probe = Buffer.alloc(1);
      fs.readSync(fd, probe, 0, 1, 0);
    } finally {
      fs.closeSync(fd);
    }
    return true;
  } catch {
    return false;
  }
}

function jobMtimeMs(id) {
  try { return fs.statSync(jobFile(id)).mtimeMs; }
  catch { return 0; }
}

function reconcileStaleGeneration(id, now = Date.now()) {
  const job = readJob(id);
  if (!isStaleGenerationJob(job, {
    busy: locks.has(id),
    mtimeMs: jobMtimeMs(id),
    now,
  })) return job;

  const failedAt = new Date(now).toISOString();
  const failed = job.kind === 'next-lesson'
    ? recoverInterruptedNextLesson(dirOf(id), job, { now: new Date(now) })
    : {
      ...job,
      stage: 'failed',
      currentMessage: '课程生成已中断，请重试',
      error: '课程生成已中断，请重试',
      updatedAt: failedAt,
      failedAt,
    };
  writeJob(id, failed);
  emitGenerationEvent(id, {
    runId: failed.runId || 'interrupted-run',
    kind: 'run-failed',
    key: `run:${failed.runId || 'interrupted-run'}`,
    state: 'error',
    message: failed.currentMessage,
  });
  return failed;
}

function reconcileCourseOnboarding(id) {
  const record = readOnboarding(dirOf(id), { optional: true });
  if (!record) return null;
  const lessons = lessonsOf(id);
  return reconcileOnboarding(dirOf(id), {
    job: readJob(id),
    busy: locks.has(id),
    lessons: lessons.length,
    lessonReadable: firstLessonReadable(id),
    jobMtimeMs: jobMtimeMs(id),
  });
}

function onboardingSnapshot(id, record = reconcileCourseOnboarding(id)) {
  const job = readJob(id);
  const stage = onboardingGenerationStage(record, job.stage);
  return {
    id,
    onboarding: publicOnboarding(record),
    generation: {
      stage,
      runId: stage === 'idle' ? null : job.runId || null,
      busy: stage === 'idle' ? false : locks.has(id),
      lessons: lessonsOf(id).length,
    },
  };
}

function sendOnboardingError(res, error) {
  const known = error instanceof OnboardingError;
  const body = {
    error: known ? error.code : 'ONBOARDING_ERROR',
    message: known ? error.message : '新手引导操作失败',
  };
  if (known && error.details) body.details = error.details;
  if (known && error.courseId) body.id = error.courseId;
  if (known && error.onboarding) body.onboarding = error.onboarding;
  return res.status(known ? error.status : 500).json(body);
}

function launchOnboardingGeneration(id, { retry = false } = {}) {
  const courseDir = dirOf(id);
  let record = reconcileCourseOnboarding(id);
  if (!record) throw new OnboardingError('ONBOARDING_NOT_FOUND', '未找到新手引导状态', 404);

  if (record.state === 'ready') {
    return { status: 200, reused: true, record };
  }
  if (record.state === 'starting' || record.state === 'generating') {
    return { status: 202, reused: true, record };
  }
  if (locks.has(id)) {
    throw new OnboardingError('GENERATION_BUSY', '课程当前有任务正在运行', 409);
  }

  record = markGenerationStarting(courseDir, { retry });
  let run;
  try {
    const missionSession = readMissionSessionState(courseDir);
    run = runKimi(id, FIRST_ONBOARDING_PROMPT(record.source.extension), {
      track: true,
      sessionId: missionSession.sessionId,
      preferredMode: missionSession.preferredMode,
    });
    record = markGenerationRunning(courseDir, readJob(id));
  } catch (error) {
    markGenerationFailed(courseDir, error);
    throw error;
  }

  Promise.resolve(run)
    .then(() => {
      if (!firstLessonReadable(id)) {
        throw new Error('Kimi finished but the first lesson is not readable');
      }
      markGenerationReady(courseDir, readJob(id));
    })
    .catch((error) => {
      try { markGenerationFailed(courseDir, error); }
      catch (stateError) { console.log(`[onboarding ${id}] failed to persist error: ${stateError.message}`); }
    });

  return { status: 202, reused: false, record };
}

// 上传一本书 -> 建课
const upload = multer({ dest: os.tmpdir() });
const onboardingUpload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: MAX_SOURCE_BYTES, files: 1 },
});
app.post('/api/courses', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'missing file' });
  const id = Date.now().toString(36);
  fs.mkdirSync(dirOf(id), { recursive: true });
  const ext = (path.extname(req.file.originalname) || '.txt').toLowerCase();
  fs.renameSync(req.file.path, path.join(dirOf(id), 'book' + ext));
  fs.writeFileSync(path.join(dirOf(id), 'meta.json'), JSON.stringify({
    title: req.body.title || path.basename(req.file.originalname, ext),
  }));
  runKimi(id, FIRST_PROMPT(ext), { track: true })
    .catch((e) => console.log(`[kimi ${id}] failed: ${e.message}`));
  res.json({ id });
});

app.post('/api/course-onboarding', (req, res) => {
  onboardingUpload.single('file')(req, res, (uploadError) => {
    if (uploadError) {
      if (uploadError.code === 'LIMIT_FILE_SIZE') {
        return sendOnboardingError(res, new OnboardingError(
          'FILE_TOO_LARGE',
          '文件超过 200 MB 限制',
          413,
          { maxBytes: MAX_SOURCE_BYTES },
        ));
      }
      return sendOnboardingError(res, new OnboardingError('UPLOAD_FAILED', '文件上传失败', 400));
    }
    if (!req.file) {
      return sendOnboardingError(res, new OnboardingError('MISSING_FILE', '请选择学习材料', 400));
    }

    try {
      const created = createCourseDraft({
        dataRoot: DATA,
        tempFile: req.file.path,
        originalFilename: req.file.originalname,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        title: req.body && req.body.title,
      });
      launchStandardMissionTurn(created.courseId);
      return res.status(202).json({
        id: created.courseId,
        onboarding: publicOnboarding(readOnboarding(created.courseDir)),
      });
    } catch (error) {
      return sendOnboardingError(res, error);
    } finally {
      try { if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); } catch {}
    }
  });
});

// 课程列表（书架页真实数据）
app.get('/api/courses', (req, res) => {
  const list = fs.readdirSync(DATA, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const id = d.name;
      let title = '我的课程';
      try { title = JSON.parse(fs.readFileSync(path.join(dirOf(id), 'meta.json'), 'utf8')).title; } catch {}
      const book = fs.readdirSync(dirOf(id)).find((f) => f.startsWith('book.')) || '';
      const cover = fs.readdirSync(dirOf(id)).find((f) => /^cover\.(jpe?g|png|webp)$/i.test(f)) || null;
      let archived = false;
      try { archived = !!JSON.parse(fs.readFileSync(path.join(dirOf(id), 'meta.json'), 'utf8')).archived; } catch {}
      let onboarding = null;
      try { onboarding = reconcileCourseOnboarding(id); }
      catch {
        try { onboarding = readOnboarding(dirOf(id), { optional: true }); } catch {}
      }
      const job = readJob(id);
      return {
        id, title, cover, archived,
        ext: (path.extname(book).slice(1) || 'TXT').toUpperCase(),
        lessons: lessonsOf(id).length,
        stage: onboardingGenerationStage(onboarding, job.stage),
        onboardingState: onboarding && onboarding.state || null,
        onboardingErrorCode: onboarding
          ? onboarding.inspection.errorCode || onboarding.generation.errorCode || null
          : null,
        updated: fs.statSync(dirOf(id)).mtimeMs,
      };
    })
    .sort((a, b) => b.updated - a.updated);
  res.json(list.filter((c) => !c.archived).map(({ archived, ...c }) => c));
});

// 归档 / 删除课程
app.post('/api/courses/:id/archive', (req, res) => {
  if (!validId(req.params.id)) return res.status(400).end();
  try {
    const metaFile = path.join(dirOf(req.params.id), 'meta.json');
    const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
    meta.archived = true;
    fs.writeFileSync(metaFile, JSON.stringify(meta));
  } catch {}
  res.json({ ok: true });
});
app.delete('/api/courses/:id', (req, res) => {
  if (!validId(req.params.id)) return res.status(400).end();
  fs.rmSync(dirOf(req.params.id), { recursive: true, force: true });
  res.json({ ok: true });
});

// 课程信息（标题取自上传时的原始文件名）
app.get('/api/courses/:id/info', (req, res) => {
  try {
    res.json(JSON.parse(fs.readFileSync(path.join(dirOf(req.params.id), 'meta.json'), 'utf8')));
  } catch {
    res.json({ title: '我的课程' });
  }
});

app.get('/api/courses/:id/onboarding', (req, res) => {
  const id = req.params.id;
  if (!validId(id) || !fs.existsSync(dirOf(id))) {
    return sendOnboardingError(res, new OnboardingError('COURSE_NOT_FOUND', '课程不存在', 404));
  }
  try {
    const record = reconcileCourseOnboarding(id);
    if (!record) throw new OnboardingError('ONBOARDING_NOT_FOUND', '该课程没有新手引导状态', 404);
    return res.json(onboardingSnapshot(id, record));
  } catch (error) {
    return sendOnboardingError(res, error);
  }
});

app.post('/api/courses/:id/mission/answer', (req, res) => {
  const id = req.params.id;
  if (!validId(id) || !fs.existsSync(dirOf(id))) {
    return sendOnboardingError(res, new OnboardingError('COURSE_NOT_FOUND', '课程不存在', 404));
  }
  try {
    const current = readOnboarding(dirOf(id));
    const answer = resolveMissionAnswer(current, req.body);
    const record = launchStandardMissionTurn(id, { answer });
    return res.status(202).json(onboardingSnapshot(id, record));
  } catch (error) {
    return sendOnboardingError(res, error);
  }
});

app.post('/api/courses/:id/mission/retry', (req, res) => {
  const id = req.params.id;
  if (!validId(id) || !fs.existsSync(dirOf(id))) {
    return sendOnboardingError(res, new OnboardingError('COURSE_NOT_FOUND', '课程不存在', 404));
  }
  try {
    const record = launchStandardMissionTurn(id, { retry: true });
    return res.status(202).json(onboardingSnapshot(id, record));
  } catch (error) {
    return sendOnboardingError(res, error);
  }
});

app.post('/api/courses/:id/mission/confirm', (req, res) => {
  const id = req.params.id;
  if (!validId(id) || !fs.existsSync(dirOf(id))) {
    return sendOnboardingError(res, new OnboardingError('COURSE_NOT_FOUND', '课程不存在', 404));
  }
  try {
    validateMissionDocument(dirOf(id));
    promoteMissionSession(dirOf(id));
    const record = confirmMission(dirOf(id));
    return res.json(onboardingSnapshot(id, record));
  } catch (error) {
    return sendOnboardingError(res, error);
  }
});

function handleOnboardingStart(req, res, retry) {
  const id = req.params.id;
  if (!validId(id) || !fs.existsSync(dirOf(id))) {
    return sendOnboardingError(res, new OnboardingError('COURSE_NOT_FOUND', '课程不存在', 404));
  }
  try {
    const launched = launchOnboardingGeneration(id, { retry });
    return res.status(launched.status).json({
      ...onboardingSnapshot(id, launched.record),
      reused: launched.reused,
    });
  } catch (error) {
    return sendOnboardingError(res, error);
  }
}

app.post('/api/courses/:id/start', (req, res) => handleOnboardingStart(req, res, false));
app.post('/api/courses/:id/retry', (req, res) => handleOnboardingStart(req, res, true));

// 学习地图
app.get('/api/courses/:id/map.json', (req, res) => {
  const file = path.join(dirOf(req.params.id), 'map.json');
  if (!fs.existsSync(file)) return res.status(404).end();
  res.json(JSON.parse(fs.readFileSync(file, 'utf8')));
});

// 进度轮询
app.get('/api/courses/:id/status', (req, res) => {
  const id = req.params.id;
  const job = reconcileStaleGeneration(id);
  const lessons = lessonsOf(id).length;
  const assessments = assessmentsOf(id).length;
  const busy = locks.has(id);
  res.json({
    ...job,
    ...deriveGenerationStatus(dirOf(id), job, { lessons, assessments, busy }),
    lessons,
    assessments,
    busy,
  });
});

// Kimi Wire 真实生成事件：SSE 实时推送；status 轮询继续负责百分比、ready/failed 和重启恢复。
app.get('/api/courses/:id/generation-events', (req, res) => {
  const id = req.params.id;
  if (!validId(id) || !fs.existsSync(dirOf(id))) return res.status(404).end();

  res.set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();
  res.write('retry: 2000\n\n');

  const afterId = Number(req.get('Last-Event-ID') || req.query.after || 0);
  const previousJob = readJob(id);
  const job = reconcileStaleGeneration(id);
  const recovered = isGenerationJobActive(previousJob) && job.stage === 'failed';
  const active = isGenerationJobActive(job);
  const send = (event) => {
    res.write(`id: ${event.id}\n`);
    res.write('event: generation-event\n');
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  if (recovered) {
    const runId = job.runId || 'fixture-run';
    send({ id: afterId + 1, runId, kind: 'run-failed', key: `run:${runId}`, state: 'error', message: job.currentMessage || '课程生成没有完成，请重试' });
  } else if (active) {
    readGenerationEvents(dirOf(id), { afterId, runId: job.runId || null }).forEach(send);
  }
  const unsubscribe = subscribeGenerationEvents(dirOf(id), send);
  const heartbeat = setInterval(() => res.write(': keepalive\n\n'), 15_000);
  heartbeat.unref?.();
  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

// 原始材料与参考资料清单。只暴露允许预览的文件，不暴露题目答案或学习记录。
app.get('/api/courses/:id/sources', (req, res) => {
  const id = req.params.id;
  if (!validId(id) || !fs.existsSync(dirOf(id))) return res.status(404).end();
  res.json({ sources: listCourseSources(dirOf(id), id) });
});

// 课节列表 / 课节内容（注入 <base> 和划词脚本，磁盘课件不动）
app.get('/api/courses/:id/lessons', (req, res) => res.json(lessonsOf(req.params.id)));
app.get('/api/courses/:id/lessons/:file', (req, res) => {
  const f = lessonsOf(req.params.id).find((x) => x === req.params.file);
  if (!f) return res.status(404).end();
  const html = fs.readFileSync(path.join(dirOf(req.params.id), 'lessons', f), 'utf8')
    .replace(/<head[^>]*>/i, (m) => `${m}<base href="/api/courses/${req.params.id}/lessons/">`)
    .replace(/<\/body>/i, `<script>window.__courseId=${JSON.stringify(req.params.id)};window.__lessonFile=${JSON.stringify(f)}</script><link rel="stylesheet" href="/vendor/lenis/lenis.css"><link rel="stylesheet" href="/margin-notes.css"><link rel="stylesheet" href="/activity-runtime.css"><link rel="stylesheet" href="/lesson-content-normalizer.css"><link rel="stylesheet" href="/curiosity-runtime.css"><link rel="stylesheet" href="/contextual-actions.css"><script src="/margin-notes-core.js"></script><script src="/margin-notes.js"></script><script src="/study-cards.js"></script><script src="/contextual-actions.js"></script><script src="/select.js"></script><script src="/activity-runtime.js"></script><script src="/vendor/lenis/lenis.min.js"></script><script src="/lesson-scroll-policy.js"></script><script src="/lesson-content-normalizer.js"></script><script src="/curiosity-runtime.js"></script><script src="/lesson-shell.js"></script></body>`);
  res.type('html').send(html);
});

// 互动活动：私有题目规格、确定性评分、尝试记录与 claim 掌握度
const safeLesson = (id, file) => lessonsOf(id).find((name) => name === file) || null;
const lessonBase = (file) => String(file || '').replace(/\.html$/i, '');
const assessmentFile = (id, file) => path.join(dirOf(id), 'assessments', `${lessonBase(file)}.json`);
const progressFile = (id, file) => path.join(dirOf(id), 'learning-progress', `${lessonBase(file)}.json`);
const readJson = (file, fallback) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } };
const writeJsonAtomic = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
};
const loadLessonSpec = (id, file) => {
  if (!safeLesson(id, file)) return { status: 404, error: 'lesson not found' };
  const target = assessmentFile(id, file);
  if (!fs.existsSync(target)) return { status: 404, error: 'interactive activities not found' };
  const spec = normalizeLessonSpecShape(readJson(target, null));
  let validation;
  try {
    validation = validateLessonSpec(spec);
  } catch {
    return { status: 422, error: 'invalid assessment spec', details: ['assessment shape could not be validated'] };
  }
  if (!validation.ok) return { status: 422, error: 'invalid assessment spec', details: validation.errors.slice(0, 40) };
  return { status: 200, spec };
};
const readLessonProgress = (id, file, spec) => {
  const progress = readJson(progressFile(id, file), { schemaVersion: 1, attempts: [] });
  if (!Array.isArray(progress.attempts)) progress.attempts = [];
  progress.mastery = computeClaimProgress(spec, progress.attempts);
  return progress;
};

app.get('/api/courses/:id/lessons/:file/activities', (req, res) => {
  const loaded = loadLessonSpec(req.params.id, req.params.file);
  if (!loaded.spec) return res.status(loaded.status).json({ error: loaded.error, details: loaded.details });
  res.json({ spec: toPublicLessonSpec(loaded.spec), progress: readLessonProgress(req.params.id, req.params.file, loaded.spec) });
});

app.get('/api/courses/:id/lessons/:file/progress', (req, res) => {
  const loaded = loadLessonSpec(req.params.id, req.params.file);
  if (!loaded.spec) return res.status(loaded.status).json({ error: loaded.error, details: loaded.details });
  res.json(readLessonProgress(req.params.id, req.params.file, loaded.spec));
});

app.post('/api/courses/:id/lessons/:file/activities/:activityId/attempt', (req, res) => {
  const loaded = loadLessonSpec(req.params.id, req.params.file);
  if (!loaded.spec) return res.status(loaded.status).json({ error: loaded.error, details: loaded.details });
  const activity = loaded.spec.activities.find((item) => item.id === req.params.activityId);
  if (!activity) return res.status(404).json({ error: 'activity not found' });
  const progress = readLessonProgress(req.params.id, req.params.file, loaded.spec);
  const previous = progress.attempts.filter((item) => item.activityId === activity.id);
  let result;
  try { result = scoreActivity(activity, req.body && req.body.response); }
  catch (error) { return res.status(400).json({ error: error.message }); }
  const attempt = {
    activityId: activity.id,
    claimId: activity.claimId,
    stage: activity.stage,
    response: req.body && req.body.response,
    attemptNumber: previous.length + 1,
    passed: result.passed,
    correct: result.correct,
    misconceptionId: result.misconceptionId,
    submittedAt: new Date().toISOString(),
  };
  progress.attempts.push(attempt);
  progress.mastery = computeClaimProgress(loaded.spec, progress.attempts);
  writeJsonAtomic(progressFile(req.params.id, req.params.file), progress);
  res.json({ attempt, passed: result.passed, correct: result.correct, feedback: result.feedback, misconceptionId: result.misconceptionId, mastery: progress.mastery });
});

// Contextual learning actions are selected by the backend. The provider-neutral
// service can accept a model selector later; this candidate uses a fast,
// deterministic fallback and therefore adds no model call or selection latency.
app.post('/api/courses/:id/learning-actions', async (req, res) => {
  if (!validId(req.params.id) || !fs.existsSync(dirOf(req.params.id))) return res.status(404).json({ error: 'course not found' });
  try {
    const result = await selectLearningActions(req.body || {});
    return res.json(result);
  } catch {
    return res.json({ source: 'safe-fallback', selectionType: 'passage', actions: [
      { id: 'ask', label: '问 Tutor', kind: 'tutor' },
      { id: 'note', label: '记笔记', kind: 'note' },
      { id: 'scratch', label: '放到草稿', kind: 'scratch' },
    ] });
  }
});

const studySurfaceFile = (id) => path.join(dirOf(id), 'study-surface.json');
const requestedStudyLesson = (id, value) => {
  const requested = String(value || '').trim();
  return requested ? safeLesson(id, requested) : null;
};
app.get('/api/courses/:id/study-surface', (req, res) => {
  const lesson = requestedStudyLesson(req.params.id, req.query.lesson);
  if (!lesson) return res.status(400).json({ error: 'invalid lesson' });
  const stored = readJson(studySurfaceFile(req.params.id), { version: 1, lessons: {} });
  return res.json(normalizeStudySurfaceState(stored?.lessons?.[lesson]));
});
app.put('/api/courses/:id/study-surface', (req, res) => {
  const lesson = requestedStudyLesson(req.params.id, req.query.lesson);
  if (!lesson) return res.status(400).json({ error: 'invalid lesson' });
  const inspection = inspectStudySurfaceState(req.body);
  if (!inspection.ok) {
    return res.status(413).json({
      error: 'study surface is too large to save safely',
      code: 'STUDY_SURFACE_TOO_LARGE',
      details: inspection.errors,
      maxBytes: MAX_STUDY_SURFACE_BYTES,
    });
  }
  const nextState = normalizeStudySurfaceState(req.body);
  if (studySurfaceByteLength(nextState) > MAX_STUDY_SURFACE_BYTES) {
    return res.status(413).json({
      error: 'normalized study surface exceeds the save budget',
      code: 'STUDY_SURFACE_TOO_LARGE',
      maxBytes: MAX_STUDY_SURFACE_BYTES,
    });
  }
  const stored = readJson(studySurfaceFile(req.params.id), { version: 1, lessons: {} });
  const lessons = stored && typeof stored.lessons === 'object' ? stored.lessons : {};
  lessons[lesson] = nextState;
  writeJsonAtomic(studySurfaceFile(req.params.id), { version: 1, lessons, updatedAt: Date.now() });
  return res.json({ ok: true, lesson, bytes: studySurfaceByteLength(nextState) });
});

const curiosityFileForLesson = (id, lesson) => path.join(dirOf(id), 'curiosity', lesson.replace(/\.html$/i, '') + '.json');
app.get('/api/courses/:id/lessons/:file/curiosity', (req, res) => {
  const lesson = safeLesson(req.params.id, req.params.file);
  if (!lesson) return res.status(404).json({ cards: [] });
  const raw = readJson(curiosityFileForLesson(req.params.id, lesson), { schemaVersion: 1, lessonId: lesson.replace(/\.html$/i, ''), cards: [] });
  const validation = validateCuriosityDocument(raw);
  if (!validation.ok) return res.status(422).json({ error: 'invalid curiosity document', details: validation.errors.slice(0, 20), cards: [] });
  return res.json(validation.document);
});

// 笔记（划词高亮 + 卡片），按课节合并读写；无 lesson 参数时保留旧的整体接口。
const notesFile = (id) => path.join(dirOf(id), 'notes.json');
const readCourseNotes = (id) => {
  const value = readJson(notesFile(id), []);
  return Array.isArray(value) ? value.filter((note) => note && typeof note === 'object') : [];
};
const requestedNoteLesson = (id, value) => {
  const requested = String(value || '').trim();
  if (!requested) return null;
  return safeLesson(id, requested);
};
app.get('/api/courses/:id/notes', (req, res) => {
  const requested = String(req.query.lesson || '').trim();
  const lesson = requestedNoteLesson(req.params.id, requested);
  if (requested && !lesson) return res.status(400).json({ error: 'invalid lesson' });
  const notes = readCourseNotes(req.params.id);
  if (!lesson) return res.json(notes);
  return res.json(notes.filter((note) => !note.lessonFile || note.lessonFile === lesson));
});
app.put('/api/courses/:id/notes', (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).json({ error: 'expected array' });
  const requested = String(req.query.lesson || '').trim();
  const lesson = requestedNoteLesson(req.params.id, requested);
  if (requested && !lesson) return res.status(400).json({ error: 'invalid lesson' });
  if (!lesson) {
    fs.writeFileSync(notesFile(req.params.id), JSON.stringify(req.body));
    return res.json({ ok: true });
  }
  const incoming = req.body
    .filter((note) => note && typeof note === 'object')
    .map((note) => ({ ...note, lessonFile: lesson }));
  const incomingIds = new Set(incoming.map((note) => note.id).filter((id) => typeof id === 'string' && id));
  const retained = readCourseNotes(req.params.id).filter((note) => {
    if (note.lessonFile === lesson) return false;
    if (incomingIds.has(note.id)) return false;
    return true;
  });
  writeJsonAtomic(notesFile(req.params.id), [...retained, ...incoming]);
  return res.json({ ok: true, lesson, notes: incoming.length });
});

// 聊天记录（须在 splat 静态路由之前注册，否则会被当成文件 404）
const chatFile = (id) => path.join(dirOf(id), 'chat.json');
app.get('/api/courses/:id/chat', (req, res) => {
  try {
    res.json({ messages: JSON.parse(fs.readFileSync(chatFile(req.params.id), 'utf8')) });
  } catch {
    res.json({ messages: [] });
  }
});

// 课程根目录的原始材料（book.pdf / book.epub / book.txt / cover.jpg 等）
// Express 5 默认路径参数不跨 '.'，因此为常用根文件注册显式路由。
function serveRootFile(name) {
  return (req, res, next) => {
    const root = dirOf(req.params.id);
    const file = path.normalize(path.join(root, name));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return next();
    res.sendFile(name, { root });
  };
}
app.get('/api/courses/:id/book.pdf', serveRootFile('book.pdf'));
app.get('/api/courses/:id/book.epub', serveRootFile('book.epub'));
app.get('/api/courses/:id/book.txt', serveRootFile('book.txt'));
app.get('/api/courses/:id/cover.jpg', serveRootFile('cover.jpg'));
app.get('/api/courses/:id/cover.jpeg', serveRootFile('cover.jpeg'));
app.get('/api/courses/:id/cover.png', serveRootFile('cover.png'));
app.get('/api/courses/:id/cover.webp', serveRootFile('cover.webp'));

// 课节引用的相对资源（assets/style.css、map.json 等，须放在已有路由之后）
app.get('/api/courses/:id/*splat', (req, res) => {
  const root = dirOf(req.params.id);
  const relative = req.params.splat.join('/');
  if (isPrivateCoursePath(relative)) return res.status(404).end();
  const file = path.normalize(path.join(root, relative));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return res.status(404).end();
  res.sendFile(relative, { root });
});

// 生成下一课：首次创建新会话，后续只恢复 Kimi 已返回的真实 session。
const generatorSessionFile = (id) => path.join(dirOf(id), 'generator-session.json');
function readGeneratorSession(id) {
  const loaded = readJson(generatorSessionFile(id), null);
  const normalized = normalizeGeneratorSessionState(loaded);
  if (JSON.stringify(loaded) !== JSON.stringify(normalized)) {
    writeJsonAtomic(generatorSessionFile(id), normalized);
  }
  return normalized;
}
function saveGeneratorSession(id, value) {
  writeJsonAtomic(generatorSessionFile(id), normalizeGeneratorSessionState(value));
}

app.post('/api/courses/:id/lessons/next', (req, res) => {
  const id = req.params.id;
  if (locks.has(id)) return res.status(409).json({ error: 'busy' });

  try {
    const previousJob = reconcileStaleGeneration(id);
    if (isGenerationJobActive(previousJob)) {
      return res.status(409).json({ error: 'generation recovery pending' });
    }
    if (previousJob.repairRequired) {
      return res.status(409).json({
        error: 'course repair required',
        details: previousJob.changedExisting || [],
      });
    }
    const baseline = captureNextLessonBaseline(dirOf(id));
    if (!baseline.lessons.length) return res.status(409).json({ error: 'first lesson is not ready' });
    const generator = readGeneratorSession(id);
    const resumedSession = generator.initialized === true;
    const prompt = withTeachSkill(
      buildNextLessonPrompt(dirOf(id), baseline, {
        validatorCommand: `node ${JSON.stringify(path.join(ROOT, 'lib', 'next-lesson-preflight.js'))}`,
        resumedSession,
      }),
      resumedSession,
    );
    const persistGeneratorResult = (result) => {
      const sessionId = result.sessionId || generatorSessionIdForRun(generator);
      saveGeneratorSession(id, {
        ...generator,
        initialized: Boolean(sessionId),
        sessionId,
        preferredMode: result.mode || generator.preferredMode || 'stream-json',
      });
    };
    const run = runKimi(id, prompt, {
      track: true,
      kind: 'next-lesson',
      baseline,
      sessionId: generatorSessionIdForRun(generator),
      preferredMode: generator.preferredMode || 'stream-json',
      onResult: persistGeneratorResult,
    });
    const job = readJob(id);
    Promise.resolve(run)
      .catch((error) => console.log(`[kimi ${id}] failed: ${error.message}`));
    return res.status(202).json({ ok: true, runId: job.runId });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// 助教问答：显式 tutor session + 确定性学习者上下文；首次会话原样加载 humanizer-zh Skill。
const SUGGEST_MARKER = '<<<SUGGESTIONS>>>';
const SUGGEST_INSTRUCTION =
  `\n\n回答完用户问题后，在回复最后一行单独输出一行，格式严格为：\n` +
  `${SUGGEST_MARKER}[{"label":"按钮文字","prompt":"用户点击后发送的完整问题"},...]\n` +
  `要求：3 到 4 条；基于当前课节内容和本次对话；label 不超过 14 个汉字；` +
  `涵盖解释/举例/应用/检查理解中的至少三种；不要重复用户刚问过的问题；只输出这一行 JSON，不要其他标记。`;

function parseSuggestions(text) {
  try {
    const arr = JSON.parse(text);
    if (!Array.isArray(arr)) return null;
    const list = arr
      .filter((s) => s && typeof s.label === 'string' && s.label.trim() && typeof s.prompt === 'string' && s.prompt.trim())
      .slice(0, 4)
      .map((s) => ({ label: s.label.trim(), prompt: s.prompt.trim() }));
    return list.length ? list : null;
  } catch {
    return null;
  }
}

const tutorSessionFile = (id) => path.join(dirOf(id), 'tutor-session.json');
function readTutorSession(id) {
  const existing = readJson(tutorSessionFile(id), null);
  const normalized = normalizeTutorSessionState(existing);
  if (JSON.stringify(existing) !== JSON.stringify(normalized)) {
    writeJsonAtomic(tutorSessionFile(id), normalized);
  }
  return normalized;
}
function saveTutorSession(id, value) {
  writeJsonAtomic(tutorSessionFile(id), normalizeTutorSessionState(value));
}

async function runTutorTurn(id, tutorPrompt, session) {
  const result = await runTrackedKimi({
    cwd: dirOf(id),
    prompt: withHumanizerSkill(tutorPrompt, session.initialized === true),
    sessionId: session.initialized ? session.sessionId : null,
    preferredMode: session.preferredMode || 'stream-json',
    model: MODEL,
    skillsDir: SKILLS,
  });
  const next = normalizeTutorSessionState({
    ...session,
    sessionId: result.sessionId || session.sessionId,
    initialized: Boolean(result.sessionId || session.sessionId),
    preferredMode: result.mode || session.preferredMode,
  });
  if (!next.initialized) throw new Error('Tutor did not return a resumable Kimi session');
  saveTutorSession(id, next);
  return result.text;
}

app.post('/api/courses/:id/chat/reset', (req, res) => {
  if (locks.has(req.params.id)) return res.status(409).json({ error: 'busy' });
  try { fs.unlinkSync(chatFile(req.params.id)); } catch {}
  try { fs.unlinkSync(tutorSessionFile(req.params.id)); } catch {}
  res.json({ ok: true });
});

app.post('/api/courses/:id/chat', async (req, res) => {
  const id = req.params.id;
  if (locks.has(id)) return res.status(409).json({
    error: '导师正在处理上一项任务。你的课程和笔记都已保留，请稍后重试。',
    code: 'TUTOR_BUSY',
    retryable: true,
  });
  const { message, context } = req.body || {};
  if (!String(message || '').trim()) return res.status(422).json({ error: '请输入问题', code: 'TUTOR_MESSAGE_REQUIRED' });
  let tutorSession = readTutorSession(id);
  const tutorPrompt = buildTutorPrompt({
    courseDir: dirOf(id),
    message: String(message || ''),
    context: context || {},
  }) + SUGGEST_INSTRUCTION;
  locks.add(id);
  try {
    let out;
    try {
      out = await runTutorTurn(id, tutorPrompt, tutorSession);
    } catch (error) {
      if (!tutorSession.initialized || !isTutorSessionMissingError(error)) throw error;
      tutorSession = createTutorSessionState();
      saveTutorSession(id, tutorSession);
      out = await runTutorTurn(id, tutorPrompt, tutorSession);
    }
    const idx = out.lastIndexOf(SUGGEST_MARKER);
    const raw = idx >= 0 ? out.slice(0, idx) : out;
    const suggestions = idx >= 0 ? parseSuggestions(out.slice(idx + SUGGEST_MARKER.length).trim()) : null;
    const reply = raw.split('\n').map((l) => l.replace(/^• /, '').replace(/^ {2}/, '')).join('\n').trim();
    let history = [];
    try { history = JSON.parse(fs.readFileSync(chatFile(id), 'utf8')); } catch {}
    history.push({ role: 'user', text: String(message || '') });
    history.push({ role: 'assistant', text: reply, suggestions });
    fs.writeFileSync(chatFile(id), JSON.stringify(history));
    res.json({ reply, suggestions });
  } catch (error) {
    console.log(`[tutor ${id}] failed: ${error.message}`);
    res.status(500).json({
      error: '导师这次没有完成回答。你的课程、进度和笔记都已保留，请重试。',
      code: 'TUTOR_FAILED',
      retryable: true,
    });
  } finally {
    locks.delete(id);
  }
});

app.use((req, res) => {
  if (process.env.NODE_ENV === 'test') console.log(`[404] ${req.method} ${req.url}`);
  res.status(404).end();
});

app.listen(PORT, () => {
  console.log(`Kimi Study → http://localhost:${PORT} [${RUNTIME.mode}] data=${RUNTIME.dataDir}`);
});
