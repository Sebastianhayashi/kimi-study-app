// Kimi Study 后端：静态页（注入 glue.js）+ 课程 API + kimi 子进程
const express = require('express');
const multer = require('multer');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = __dirname;
const DATA = path.join(ROOT, 'data', 'courses');
const SKILLS = path.join(ROOT, 'skills');
const MODEL = 'kimi-code/kimi-for-coding'; // K2.7 Coding
const PORT = process.env.PORT || 3000;

const MAP_INSTRUCTION =
  `最后，把本课程工作区的内容汇总写入 map.json（严格 JSON，不要任何多余文字），格式：` +
  `{"mission":{"title":"学习目标一句话","copy":"一段话","criteria":["成功标准"],"constraints":["约束"]},` +
  `"promise":"课程承诺一句话","material":"材料理解一两句话",` +
  `"methods":[{"name":"方法名","when":"何时使用","boundary":"边界"}],` +
  `"path":["第一步","第二步"]}。内容取自 MISSION.md、RESOURCES.md、reference/ 和 learning-records/。`;

const FIRST_PROMPT = (ext) =>
  `/skill:teach 用户上传了一本书想学习，材料是当前目录的 book${ext}` +
  `（如为 epub 可用 unzip 提取文本，如为 pdf 请自行想办法提取文本）。` +
  `请按 teach skill 的流程执行：先写 MISSION.md（mission：掌握这本书的核心内容）和 RESOURCES.md，` +
  `然后生成第一课 lessons/0001-*.html。所有产出用中文。` +
  `另外把书的封面图片提取保存到工作区根目录 cover.jpg（epub 解压后在 OPF manifest 里找 cover 项；` +
  `pdf 可用 sips 把第一页转成 jpg）。` + MAP_INSTRUCTION;

const NEXT_PROMPT =
  `/skill:teach 继续。请根据 MISSION.md、learning-records 和已有 lessons，` +
  `生成下一课（编号递增的新 lessons/*.html 文件）。用中文。同时更新 map.json 使其反映最新内容。`;

const app = express();
app.use(express.json());
app.use((req, res, next) => { console.log(`[http] ${req.method} ${req.url}`); next(); });

// ---- 冻结前端：原样输出，仅在 </body> 前注入 glue.js ----
const page = (file) => (req, res) => {
  const html = fs.readFileSync(path.join(ROOT, 'public', file), 'utf8')
    .replace('</body>', '<script src="/glue.js"></script></body>');
  res.type('html').send(html);
};
app.get('/', page('index.html'));
app.get('/app', page('app.html'));
app.get('/course/:id', page('course.html'));
app.use(express.static(path.join(ROOT, 'public'))); // 前端外壳资源

// ---- 课程工作区 ----
const locks = new Set(); // 每门课同时只跑一个 kimi 进程
const dirOf = (id) => path.join(DATA, id);
const jobFile = (id) => path.join(dirOf(id), 'job.json');
const writeJob = (id, job) => fs.writeFileSync(jobFile(id), JSON.stringify(job));
const readJob = (id) => { try { return JSON.parse(fs.readFileSync(jobFile(id), 'utf8')); } catch { return { stage: 'understanding' }; } };
const lessonsOf = (id) => {
  const d = path.join(dirOf(id), 'lessons');
  return fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith('.html') && f !== 'index.html').sort() : [];
};

// track=true 时把阶段写入 job.json（生成任务）；聊天不写，避免干扰进度轮询
function runKimi(id, prompt, { cont = false, track = false } = {}) {
  return new Promise((resolve, reject) => {
    locks.add(id);
    if (track) writeJob(id, { stage: lessonsOf(id).length ? 'generating' : 'understanding' });
    const args = ['-m', MODEL, '--skills-dir', SKILLS];
    if (cont) args.push('-c');
    args.push('-p', prompt);
    console.log(`[kimi ${id}] start${cont ? ' (continue)' : ''}: ${prompt.slice(0, 50)}...`);
    const p = spawn('kimi', args, { cwd: dirOf(id) });
    let out = '', err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('close', (code) => {
      locks.delete(id);
      console.log(`[kimi ${id}] exit ${code}`);
      if (track) writeJob(id, code === 0 && lessonsOf(id).length ? { stage: 'ready' } : { stage: 'failed', error: err.slice(-500) });
      code === 0 ? resolve(out) : reject(new Error(err || `kimi exit ${code}`));
    });
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

// 进度轮询
app.get('/api/courses/:id/status', (req, res) => {
  res.json({ ...readJob(req.params.id), lessons: lessonsOf(req.params.id).length, busy: locks.has(req.params.id) });
});

// 课节列表 / 课节内容（注入 <base> 和划词脚本，磁盘课件不动）
app.get('/api/courses/:id/lessons', (req, res) => res.json(lessonsOf(req.params.id)));
app.get('/api/courses/:id/lessons/:file', (req, res) => {
  const f = lessonsOf(req.params.id).find((x) => x === req.params.file);
  if (!f) return res.status(404).end();
  const html = fs.readFileSync(path.join(dirOf(req.params.id), 'lessons', f), 'utf8')
    .replace(/<head[^>]*>/i, (m) => `${m}<base href="/api/courses/${req.params.id}/lessons/">`)
    .replace(/<\/body>/i, `<script>window.__courseId=${JSON.stringify(req.params.id)}</script><script src="/select.js"></script></body>`);
  res.type('html').send(html);
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

// 课节引用的相对资源（assets/style.css、map.json 等，须放在已有路由之后）
app.get('/api/courses/:id/*splat', (req, res) => {
  const root = dirOf(req.params.id);
  const file = path.normalize(path.join(root, req.params.splat.join('/')));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return res.status(404).end();
  res.sendFile(file);
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

app.listen(PORT, () => console.log(`Kimi Study → http://localhost:${PORT}`));
