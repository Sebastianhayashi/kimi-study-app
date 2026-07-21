// Kimi Study 后端：静态页（注入 glue.js）+ 课程 API + kimi 子进程
const express = require('express');
const multer = require('multer');
const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { validateLessonSpec, scoreActivity, computeClaimProgress, toPublicLessonSpec } = require('./lib/activity-engine');
const { deriveGenerationStatus } = require('./lib/generation-status');
const { runTrackedKimi } = require('./lib/kimi-generation-runner');
const { appendGenerationEvent, readGenerationEvents, subscribeGenerationEvents } = require('./lib/generation-events');
const { listCourseSources } = require('./lib/source-manifest');
const { resolveDataDir, assertSafeRuntime } = require('./lib/runtime-config');

const ROOT = __dirname;
const DATA = resolveDataDir({ root: ROOT });
const SKILLS = path.join(ROOT, 'skills');
const MODEL = 'kimi-code/kimi-for-coding'; // K2.7 Coding
const PORT = process.env.PORT || 3000;
const RUNTIME = assertSafeRuntime({ root: ROOT, dataDir: DATA, port: PORT, env: process.env });
fs.mkdirSync(DATA, { recursive: true });

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

const FIRST_PROMPT = (ext) =>
  `/skill:teach 用户上传了一本书想学习，材料是当前目录的 book${ext}` +
  `（如为 epub 可用 unzip 提取文本，如为 pdf 请自行想办法提取文本）。` +
  `请按 teach skill 的流程执行：先写 MISSION.md（mission：掌握这本书的核心内容）和 RESOURCES.md，` +
  `然后生成第一课 lessons/0001-*.html。所有产出用中文。` +
  `另外把书的封面图片提取保存到工作区根目录 cover.jpg（epub 解压后在 OPF manifest 里找 cover 项；` +
  `pdf 可用 sips 把第一页转成 jpg）。` + ASSESSMENT_INSTRUCTION + MAP_INSTRUCTION;

const NEXT_PROMPT =
  `/skill:teach 继续。请根据 MISSION.md、learning-records 和已有 lessons，` +
  `生成下一课（编号递增的新 lessons/*.html 文件）。用中文。同时更新 map.json 使其反映最新内容。` + ASSESSMENT_INSTRUCTION;

const app = express();
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
app.get('/course/:id', page('course.html', {
  head: '<link rel="stylesheet" href="/generation-preview-product.css"><link rel="stylesheet" href="/source-viewer.css"><link rel="stylesheet" href="/frontend-shell.css">',
  body: '<script src="/assistant-markdown.js"></script><script src="/generation-preview-product.js"></script><script src="/generation-events-client.js"></script><script src="/source-viewer.js"></script>',
}));
app.use('/vendor/lenis', express.static(path.join(ROOT, 'node_modules', 'lenis', 'dist')));
app.use('/vendor/pdfjs', express.static(path.join(ROOT, 'node_modules', 'pdfjs-dist')));
app.use('/vendor/epubjs', express.static(path.join(ROOT, 'node_modules', 'epubjs', 'dist')));
app.use('/vendor/jszip', express.static(path.join(ROOT, 'node_modules', 'jszip', 'dist')));
app.use(express.static(path.join(ROOT, 'public'))); // 前端外壳资源

// ---- 课程工作区 ----
const locks = new Set(); // 每门课同时只跑一个 kimi 进程
const dirOf = (id) => path.join(DATA, id);
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

function runPrintKimi(id, prompt, { cont = false } = {}) {
  return new Promise((resolve, reject) => {
    locks.add(id);
    const args = ['-m', MODEL, '--skills-dir', SKILLS];
    if (cont) args.push('-c');
    args.push('-p', prompt);
    console.log(`[kimi ${id}] start${cont ? ' (continue)' : ''}: ${prompt.slice(0, 50)}...`);
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

// 生成任务优先使用 Kimi Wire 的真实工具事件；聊天保留现有 print 模式，避免改变回复协议。
function runKimi(id, prompt, { cont = false, track = false } = {}) {
  if (!track) return runPrintKimi(id, prompt, { cont });

  const runId = crypto.randomUUID();
  const stage = lessonsOf(id).length ? 'generating' : 'understanding';
  const startedAt = new Date().toISOString();
  locks.add(id);
  writeJob(id, { stage, runId, startedAt, updatedAt: startedAt });
  emitGenerationEvent(id, {
    runId,
    kind: 'run-start',
    key: `run:${runId}`,
    state: 'active',
    message: lessonsOf(id).length ? '正在生成下一课…' : '正在开始创建课程…',
  });

  return runTrackedKimi({
    cwd: dirOf(id),
    prompt,
    cont,
    model: MODEL,
    skillsDir: SKILLS,
    onEvent(event) {
      if (event) emitGenerationEvent(id, { runId, ...event });
    },
  }).then(({ text, status, mode }) => {
    if (status !== 'finished') throw new Error(`Kimi generation ended with status ${status}`);
    if (!lessonsOf(id).length) throw new Error('Kimi finished without generating a lesson');
    locks.delete(id);
    const finishedAt = new Date().toISOString();
    writeJob(id, { stage: 'ready', runId, mode, startedAt, updatedAt: finishedAt, finishedAt });
    emitGenerationEvent(id, {
      runId,
      kind: 'run-complete',
      key: `run:${runId}`,
      phase: 'complete',
      canvasVariant: 'ready',
      state: 'complete',
      message: '课程已准备好',
    });
    return text;
  }).catch((error) => {
    locks.delete(id);
    const failedAt = new Date().toISOString();
    writeJob(id, {
      stage: 'failed',
      runId,
      startedAt,
      updatedAt: failedAt,
      failedAt,
      error: String(error.message || error).slice(-500),
    });
    emitGenerationEvent(id, {
      runId,
      kind: 'run-failed',
      key: `run:${runId}`,
      state: 'error',
      message: '课程生成没有完成，请重试',
    });
    throw error;
  });
}


// 上传一本书 -> 建课
const upload = multer({ dest: os.tmpdir() });
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
      return {
        id, title, cover, archived,
        ext: (path.extname(book).slice(1) || 'TXT').toUpperCase(),
        lessons: lessonsOf(id).length,
        stage: readJob(id).stage,
        updated: fs.statSync(dirOf(id)).mtimeMs,
      };
    })
    .sort((a, b) => b.updated - a.updated);
  res.json(list.filter((c) => !c.archived).map(({ archived, ...c }) => c));
});

// 归档 / 删除课程
const validId = (id) => /^[a-z0-9]+$/i.test(id);
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

// 学习地图
app.get('/api/courses/:id/map.json', (req, res) => {
  const file = path.join(dirOf(req.params.id), 'map.json');
  if (!fs.existsSync(file)) return res.status(404).end();
  res.json(JSON.parse(fs.readFileSync(file, 'utf8')));
});

// 进度轮询
app.get('/api/courses/:id/status', (req, res) => {
  const id = req.params.id;
  const job = readJob(id);
  const lessons = lessonsOf(id).length;
  const busy = locks.has(id);
  // 进程已不在（服务器重启/生成被杀）但状态停在生成中 → 判定为中断，避免前端动画空转
  if (!busy && (job.stage === 'generating' || job.stage === 'understanding')) {
    try {
      if (Date.now() - fs.statSync(jobFile(id)).mtimeMs > 60_000) {
        job.stage = 'failed';
        job.error = '课程生成已中断，请重试';
      }
    } catch {}
  }
  res.json({
    ...job,
    ...deriveGenerationStatus(dirOf(id), job, { lessons, busy }),
    lessons,
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
  let job = readJob(id);
  // 与 status 轮询保持一致：僵死生成任务在 SSE 中也应表现为失败，避免前端被旧 run-start 事件重置错误状态。
  const isStale = !locks.has(id) && (job.stage === 'generating' || job.stage === 'understanding')
    && Date.now() - fs.statSync(jobFile(id)).mtimeMs > 60_000;
  const active = !isStale && (job.stage === 'understanding' || job.stage === 'generating');
  const send = (event) => {
    res.write(`id: ${event.id}\n`);
    res.write('event: generation-event\n');
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  if (isStale) {
    const runId = job.runId || 'fixture-run';
    send({ id: afterId + 1, runId, kind: 'run-failed', key: `run:${runId}`, state: 'error', message: '课程生成没有完成，请重试' });
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
    .replace(/<\/body>/i, `<script>window.__courseId=${JSON.stringify(req.params.id)};window.__lessonFile=${JSON.stringify(f)}</script><link rel="stylesheet" href="/vendor/lenis/lenis.css"><link rel="stylesheet" href="/margin-notes.css"><link rel="stylesheet" href="/activity-runtime.css"><script src="/margin-notes-core.js"></script><script src="/margin-notes.js"></script><script src="/study-cards.js"></script><script src="/select.js"></script><script src="/activity-runtime.js"></script><script src="/vendor/lenis/lenis.min.js"></script><script src="/lesson-scroll-policy.js"></script><script src="/lesson-shell.js"></script></body>`);
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
  const spec = readJson(target, null);
  const validation = validateLessonSpec(spec);
  if (!validation.ok) return { status: 422, error: 'invalid assessment spec', details: validation.errors };
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

// 笔记（划词高亮 + 卡片），整体读写
const notesFile = (id) => path.join(dirOf(id), 'notes.json');
app.get('/api/courses/:id/notes', (req, res) => {
  try { res.json(JSON.parse(fs.readFileSync(notesFile(req.params.id), 'utf8'))); } catch { res.json([]); }
});
app.put('/api/courses/:id/notes', (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).json({ error: 'expected array' });
  fs.writeFileSync(notesFile(req.params.id), JSON.stringify(req.body));
  res.json({ ok: true });
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
  if (/^(assessments|learning-progress|learning-records)(\/|$)/i.test(relative)
    || /^(question-bank|quality-report|misconceptions|learning-claims|assessment-blueprint|source-profile)\.json$/i.test(relative)
    || /^generation-events\.jsonl$/i.test(relative)) return res.status(404).end();
  const file = path.normalize(path.join(root, relative));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return res.status(404).end();
  res.sendFile(relative, { root });
});

// 生成下一课
app.post('/api/courses/:id/lessons/next', (req, res) => {
  if (locks.has(req.params.id)) return res.status(409).json({ error: 'busy' });
  runKimi(req.params.id, NEXT_PROMPT, { cont: true, track: true })
    .catch((e) => console.log(`[kimi ${req.params.id}] failed: ${e.message}`));
  res.json({ ok: true });
});

// 助教问答（继续该课会话，保留教学上下文；可带划词上下文）
// chat.json 不存在（新对话首轮）时不传 -c，即开新 kimi 会话
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

app.post('/api/courses/:id/chat/reset', (req, res) => {
  if (locks.has(req.params.id)) return res.status(409).json({ error: 'busy' });
  try { fs.unlinkSync(chatFile(req.params.id)); } catch {}
  res.json({ ok: true });
});

app.post('/api/courses/:id/chat', async (req, res) => {
  const id = req.params.id;
  if (locks.has(id)) return res.status(409).json({ error: '老师正在备课，请稍后再问' });
  const { message, context } = req.body || {};
  let prompt = String(message || '');
  if (context && context.selectedText) {
    prompt = `你正在回答用户对当前课程内容的疑问。\n当前课节：${context.lesson || ''} ${context.section || ''}\n` +
      `用户选中的原文：\n<selection>\n${context.selectedText}\n</selection>\n` +
      `所在段落：\n<context>\n${context.surrounding || ''}\n</context>\n用户问题：${message}`;
  }
  try {
    const out = await runKimi(id, prompt + SUGGEST_INSTRUCTION, { cont: fs.existsSync(chatFile(id)) });
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
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.use((req, res) => {
  if (process.env.NODE_ENV === 'test') console.log(`[404] ${req.method} ${req.url}`);
  res.status(404).end();
});

app.listen(PORT, () => {
  console.log(`Kimi Study → http://localhost:${PORT} [${RUNTIME.mode}] data=${RUNTIME.dataDir}`);
});
