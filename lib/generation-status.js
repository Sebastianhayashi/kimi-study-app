const fs = require('fs');
const path = require('path');

const ARTIFACTS = {
  profile: ['source-profile.json'],
  claims: ['learning-claims.json', 'learning-claim.json'],
  blueprint: ['assessment-blueprint.json'],
  questionBank: ['question-bank.json'],
  quality: ['quality-report.json'],
};

const PHASE_BY_VARIANT = {
  material: 'extracting',
  structure: 'profiling',
  claims: 'claims',
  practice: 'blueprint',
  questions: 'questions',
  quality: 'quality',
  assembly: 'assembling',
  validation: 'validating',
  ready: 'complete',
};

const SEARCH_DIRS = ['', 'learning-records', 'analysis', 'artifacts', 'output'];

function safeJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function firstExisting(root, names) {
  for (const dir of SEARCH_DIRS) {
    for (const name of names) {
      const target = path.join(root, dir, name);
      if (fs.existsSync(target)) return target;
    }
  }
  return null;
}

function directoryHasFiles(target, matcher = () => true) {
  try {
    return fs.readdirSync(target, { withFileTypes: true })
      .some((entry) => entry.isFile() && matcher(entry.name));
  } catch {
    return false;
  }
}

function arrayFrom(value, keys) {
  if (!value || typeof value !== 'object') return [];
  for (const key of keys) {
    if (Array.isArray(value[key])) return value[key];
  }
  return [];
}

function numberFrom(value, keys) {
  if (!value || typeof value !== 'object') return null;
  for (const key of keys) {
    if (Number.isFinite(value[key])) return value[key];
  }
  return null;
}

function stepState(done, active) {
  if (done) return 'complete';
  return active ? 'active' : 'pending';
}

function deriveGenerationStatus(courseDir, job = {}, runtime = {}) {
  const lessons = Number(runtime.lessons || 0);
  const busy = Boolean(runtime.busy);
  const failed = job.stage === 'failed';
  const ready = job.stage === 'ready' && lessons > 0;

  const extracted = fs.existsSync(path.join(courseDir, 'RESOURCES.md'))
    || fs.existsSync(path.join(courseDir, 'MISSION.md'))
    || directoryHasFiles(path.join(courseDir, 'text_pages'))
    || directoryHasFiles(path.join(courseDir, 'reference'));

  const files = Object.fromEntries(
    Object.entries(ARTIFACTS).map(([key, names]) => [key, firstExisting(courseDir, names)]),
  );

  const assessmentExists = directoryHasFiles(
    path.join(courseDir, 'assessments'),
    (name) => name.endsWith('.json'),
  );

  const flags = {
    uploaded: directoryHasFiles(courseDir, (name) => /^book\./i.test(name)),
    extracted,
    profile: Boolean(files.profile),
    claims: Boolean(files.claims),
    blueprint: Boolean(files.blueprint),
    questionBank: Boolean(files.questionBank),
    quality: Boolean(files.quality),
    lesson: lessons > 0,
    assessment: assessmentExists,
    ready,
  };

  const milestones = [
    ['uploaded', 5, 'material'],
    ['extracted', 15, 'material'],
    ['profile', 27, 'structure'],
    ['claims', 40, 'claims'],
    ['blueprint', 53, 'practice'],
    ['questionBank', 68, 'questions'],
    ['quality', 79, 'quality'],
    ['lesson', 89, 'assembly'],
    ['assessment', 96, 'validation'],
    ['ready', 100, 'ready'],
  ];

  let progress = busy ? 3 : 0;
  let canvasVariant = 'material';
  for (const [flag, value, variant] of milestones) {
    if (!flags[flag]) continue;
    if (value >= progress) {
      progress = value;
      canvasVariant = variant;
    }
  }

  if (ready) {
    progress = 100;
    canvasVariant = 'ready';
  }
  if (failed) canvasVariant = 'error';

  const profile = safeJson(files.profile);
  const claims = safeJson(files.claims);
  const questionBank = safeJson(files.questionBank);
  const quality = safeJson(files.quality);

  const unitsFound = arrayFrom(profile, ['units', 'chapters', 'sections', 'modules']).length || null;
  const claimsFound = arrayFrom(claims, ['claims', 'learningClaims', 'objectives', 'items']).length || null;
  const candidatesGenerated = arrayFrom(questionBank, ['questions', 'items', 'candidates', 'activities']).length || null;
  const accepted = numberFrom(quality?.summary, ['accepted', 'acceptedCount'])
    ?? numberFrom(quality, ['accepted', 'acceptedCount'])
    ?? arrayFrom(quality, ['acceptedQuestions', 'acceptedItems']).length
    ?? null;
  const rejected = numberFrom(quality?.summary, ['rejected', 'rejectedCount'])
    ?? numberFrom(quality, ['rejected', 'rejectedCount'])
    ?? arrayFrom(quality, ['rejectedQuestions', 'rejectedItems']).length
    ?? null;

  let currentMessage = '正在接收并检查你上传的材料…';
  if (flags.extracted) currentMessage = '正在读取并整理教材内容…';
  if (flags.profile) currentMessage = unitsFound
    ? `已识别 ${unitsFound} 个内容单元，正在分析每个单元适合怎样学习…`
    : '正在理解材料结构和章节关系…';
  if (flags.claims) currentMessage = '正在把材料内容转化为可以检查的学习目标…';
  if (flags.blueprint) currentMessage = '正在为本课设计引导练习、独立练习和应用任务…';
  if (flags.questionBank) currentMessage = candidatesGenerated
    ? `已生成 ${candidatesGenerated} 道候选题，正在检查每道题的材料依据…`
    : '正在生成题目候选，并为每道题补充材料依据…';
  if (flags.quality) currentMessage = '正在筛除重复、过于简单或缺少材料依据的题目…';
  if (flags.lesson) currentMessage = '正在把讲解、示范和练习组装成第一课…';
  if (flags.assessment) currentMessage = '正在检查题目答案、提示和评分规则…';
  if (ready) currentMessage = '课程已准备好';
  if (failed) currentMessage = '课程创建没有完成，请返回课程库后重试';

  const ordered = [
    ['upload', '材料上传完成', flags.uploaded],
    ['extract', '读取并整理材料', flags.extracted],
    ['profile', unitsFound ? `识别 ${unitsFound} 个内容单元` : '理解材料结构', flags.profile],
    ['claims', claimsFound ? `确定 ${claimsFound} 个学习目标` : '确定学习目标', flags.claims],
    ['blueprint', '设计练习路线', flags.blueprint],
    ['questions', candidatesGenerated ? `生成 ${candidatesGenerated} 道候选题` : '生成题目候选', flags.questionBank],
    ['quality', accepted || rejected
      ? `筛选题目质量${accepted ? `，保留 ${accepted} 道` : ''}${rejected ? `，移除 ${rejected} 道` : ''}`
      : '筛选题目质量', flags.quality],
    ['lesson', '组装第一课', flags.lesson],
    ['validate', '检查课程文件', flags.ready],
  ];

  const firstIncomplete = ordered.findIndex(([, , done]) => !done);
  const history = ordered.map(([id, label, done], index) => ({
    id,
    label,
    state: stepState(done, !failed && index === firstIncomplete),
  }));

  if (failed && firstIncomplete >= 0) {
    history[firstIncomplete] = {
      ...history[firstIncomplete],
      state: 'error',
      label: '课程生成在这一步停止',
    };
  }

  return {
    progress,
    phase: PHASE_BY_VARIANT[canvasVariant] || null,
    currentMessage,
    canvasVariant,
    history,
    preview: {
      unitsFound,
      claimsFound,
      candidatesGenerated,
      accepted,
      rejected,
    },
  };
}

module.exports = { deriveGenerationStatus };
