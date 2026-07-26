#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('@playwright/test');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(ROOT, 'docs', 'media', 'readme');
const PORT = Number(process.env.LUCUBRO_README_MEDIA_PORT || 3132);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const LOCALES = ['en', 'zh-CN', 'ja'];
const executablePath = process.env.LUCUBRO_CAPTURE_EXECUTABLE || undefined;
const command = 'node scripts/capture-readme-media.js';

const slots = [
  { name: 'hero-workspace.webp', width: 1440, height: 900, type: 'webp', byteBudget: 400_000 },
  { name: 'journey-storyboard.webp', width: 1280, height: 720, type: 'webp', byteBudget: 2_500_000 },
  { name: 'library.webp', width: 1200, height: 750, type: 'webp', byteBudget: 300_000 },
  { name: 'mission.webp', width: 720, height: 900, type: 'webp', byteBudget: 300_000 },
  { name: 'lesson-practice.webp', width: 1200, height: 750, type: 'webp', byteBudget: 350_000 },
  { name: 'notes-source.webp', width: 1200, height: 750, type: 'webp', byteBudget: 350_000 },
  { name: 'architecture.svg', width: 1200, height: 660, type: 'svg', byteBudget: 120_000 },
  { name: 'social-preview.png', width: 1280, height: 640, type: 'png', byteBudget: 1_500_000 },
];

const MEDIA_COURSE = path.join(ROOT, 'tests', '.runtime', 'courses', 'readycourse');
const MEDIA_LESSON = '0001-stabilization-fixture.html';
const MEDIA_FIXTURES = {
  en: {
    lang: 'en',
    title: 'Learning from Constraints',
    lessonTitle: 'How constraints create room to act',
    lessonLead: 'A constraint is not only an obstacle. It can define a useful space for action.',
    lessonDetail: 'Use the source, capture an anchored note, and test the claim with one guided practice.',
    lessonTransfer: 'The goal is to choose one practical next action without losing the source context.',
    openPdf: 'Open source PDF',
    openEpub: 'Open EPUB',
    missionTitle: 'Use constraints to choose a useful next action',
    missionCopy: 'Practice identifying the material, rule, and action space in a real situation.',
    criteria: ['Explain how a constraint can create options', 'Apply the idea to one practical situation'],
    constraints: ['Stay grounded in the supplied source'],
    promise: 'Move from source material to one observable learning action.',
    material: 'A short source passage with one testable claim.',
    method: 'Source-grounded practice',
    methodWhen: 'When an idea needs to become usable',
    methodBoundary: 'Do not invent evidence beyond the source',
    path: ['Read the claim', 'Try the guided practice', 'Record one anchored note'],
    claim: 'Understand how constraints can create action space',
    prompt: 'What can a constraint create according to the source?',
    optionA: 'A useful space for action',
    optionB: 'No effect at all',
    misconception: 'The source does not say constraints have no effect.',
    correct: 'Correct. You identified the main claim.',
    incorrect: 'Look again for the phrase about creating room to act.',
    hint: 'Focus on what the constraint makes possible.',
    note: 'A clear constraint can narrow the next useful action.',
  },
  'zh-CN': {
    lang: 'zh-CN',
    title: '从限制中学习',
    lessonTitle: '限制如何创造行动空间',
    lessonLead: '限制不只是阻碍，它也能界定一个可用的行动空间。',
    lessonDetail: '对照原文，记录一条带锚点的笔记，再用引导练习检验理解。',
    lessonTransfer: '目标是在保留材料上下文的同时，选出一个现实中的下一步行动。',
    openPdf: '打开原始 PDF',
    openEpub: '打开 EPUB',
    missionTitle: '用限制帮助自己选择下一步行动',
    missionCopy: '在真实情境中识别材料、规则和可操作空间。',
    criteria: ['解释限制如何带来新的选择', '把观点应用到一个现实情境'],
    constraints: ['所有判断都以提供的材料为依据'],
    promise: '把材料中的观点转化为一个可观察的学习行动。',
    material: '一段包含可检验主张的短材料。',
    method: '基于原文的练习',
    methodWhen: '需要把观点变成可用方法时',
    methodBoundary: '不补写材料之外的证据',
    path: ['阅读核心主张', '完成引导练习', '记录一条锚定笔记'],
    claim: '理解限制如何创造行动空间',
    prompt: '根据原文，限制可能创造什么？',
    optionA: '可用的行动空间',
    optionB: '完全没有作用',
    misconception: '原文并没有说限制完全没有作用。',
    correct: '正确，你识别出了核心主张。',
    incorrect: '再看一次关于创造行动空间的句子。',
    hint: '关注限制让什么成为可能。',
    note: '明确的限制可以帮助我们收敛到下一步行动。',
  },
  ja: {
    lang: 'ja',
    title: '制約から学ぶ',
    lessonTitle: '制約が行動の余地を生む仕組み',
    lessonLead: '制約は障害だけではありません。役に立つ行動の余地を定めることもできます。',
    lessonDetail: '原文を確認し、根拠に結び付いたノートを残して、ガイド付き練習で理解を確かめます。',
    lessonTransfer: '資料の文脈を保ちながら、現実で試せる次の一歩を選ぶことが目標です。',
    openPdf: '原文 PDF を開く',
    openEpub: 'EPUB を開く',
    missionTitle: '制約を使って次の有用な行動を選ぶ',
    missionCopy: '現実の状況で、素材、規則、行動できる余地を見つける練習をします。',
    criteria: ['制約が選択肢を生む理由を説明する', '考え方を一つの現実的な状況に適用する'],
    constraints: ['判断は提供された資料に基づける'],
    promise: '資料の主張を、観察できる一つの学習行動へつなげます。',
    material: '検証できる主張を含む短い資料です。',
    method: '原文に基づく練習',
    methodWhen: '考え方を使える形にしたいとき',
    methodBoundary: '資料にない根拠を作らない',
    path: ['中心となる主張を読む', 'ガイド付き練習に答える', '根拠に結び付いたノートを残す'],
    claim: '制約が行動の余地を生む仕組みを理解する',
    prompt: '原文によると、制約は何を生み出せますか？',
    optionA: '役に立つ行動の余地',
    optionB: '何の効果もない',
    misconception: '原文は、制約に何の効果もないとは述べていません。',
    correct: '正解です。中心となる主張を捉えています。',
    incorrect: '行動の余地を生むという箇所をもう一度確認してください。',
    hint: '制約によって何が可能になるかに注目してください。',
    note: '明確な制約は、次の有用な行動を絞り込む助けになります。',
  },
};

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function applyMediaFixture(locale) {
  const copy = MEDIA_FIXTURES[locale];
  if (!copy) throw new Error(`Unsupported README media locale: ${locale}`);
  const lessonPath = path.join(MEDIA_COURSE, 'lessons', MEDIA_LESSON);
  const assessmentPath = path.join(MEDIA_COURSE, 'assessments', MEDIA_LESSON.replace(/\.html$/i, '.json'));
  const progressPath = path.join(MEDIA_COURSE, 'learning-progress', MEDIA_LESSON.replace(/\.html$/i, '.json'));
  if (!fs.existsSync(MEDIA_COURSE)) throw new Error(`README media fixture is missing: ${MEDIA_COURSE}`);

  writeJson(path.join(MEDIA_COURSE, 'meta.json'), { title: copy.title, archived: false });
  writeJson(path.join(MEDIA_COURSE, 'map.json'), {
    mission: { title: copy.missionTitle, copy: copy.missionCopy, criteria: copy.criteria, constraints: copy.constraints },
    promise: copy.promise,
    material: copy.material,
    methods: [{ name: copy.method, when: copy.methodWhen, boundary: copy.methodBoundary }],
    path: copy.path,
  });
  fs.writeFileSync(path.join(MEDIA_COURSE, 'book.txt'), `${copy.lessonLead}\n${copy.lessonDetail}\n`);
  fs.writeFileSync(lessonPath, `<!doctype html>
<html lang="${copy.lang}">
<head><meta charset="utf-8"><title>${copy.lessonTitle}</title></head>
<body>
  <main data-lesson-root style="max-width:760px;margin:0 auto;padding:48px;font:18px/1.8 system-ui,sans-serif">
    <h1>${copy.lessonTitle}</h1>
    <p id="selection-target">${copy.lessonLead}</p>
    <p>${copy.lessonDetail}</p>
    <p>${copy.lessonTransfer}</p>
    <p><a href="../book.pdf">${copy.openPdf}</a> / <a href="../sources/epub3.epub">${copy.openEpub}</a></p>
    <div data-kimi-activity="activity-1"></div>
    <div style="height:720px"></div>
    <h2 id="scroll-target">${copy.lessonTitle}</h2>
  </main>
</body>
</html>\n`);
  writeJson(assessmentPath, {
    schemaVersion: 1,
    lessonId: 'fixture-lesson-1',
    title: copy.lessonTitle,
    claims: [{
      id: 'claim-1',
      label: copy.claim,
      sourceRefs: ['book.txt#selection-target'],
      mastery: { requiredPassed: 1, requiredStages: ['guided'] },
    }],
    activities: [{
      id: 'activity-1',
      type: 'single-choice',
      claimId: 'claim-1',
      stage: 'guided',
      prompt: copy.prompt,
      sourceRefs: ['book.txt#selection-target'],
      options: [
        { id: 'a', label: copy.optionA },
        { id: 'b', label: copy.optionB, misconceptionId: 'm-1' },
      ],
      correctOptionId: 'a',
      misconceptions: [{ id: 'm-1', feedback: copy.misconception }],
      feedback: { correct: copy.correct, incorrect: copy.incorrect },
      hints: [copy.hint],
    }],
  });
  writeJson(progressPath, { schemaVersion: 1, attempts: [] });
  writeJson(path.join(MEDIA_COURSE, 'notes.json'), [{
    id: `readme-note-${locale}`,
    anchor: {
      exact: copy.lessonLead,
      prefix: '',
      suffix: copy.lessonDetail.slice(0, 32),
      position: { start: 0, end: copy.lessonLead.length },
    },
    section: copy.lessonTitle,
    question: '',
    answer: '',
    custom: copy.note,
    side: 'right',
    kind: 'user',
    lessonFile: MEDIA_LESSON,
    createdAt: 1768464000000,
    updatedAt: 1768464000000,
  }]);
  writeJson(path.join(MEDIA_COURSE, 'chat.json'), []);
  writeJson(path.join(MEDIA_COURSE, 'learning-activity.json'), [{
    id: `readme-open-${locale}`,
    type: 'lesson-opened',
    lessonFile: MEDIA_LESSON,
    timestamp: 1768464000000,
  }]);
}

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function waitForServer() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE_URL}/app`);
      if (response.ok) return;
    } catch {}
    await sleep(180);
  }
  throw new Error(`README media server did not become ready at ${BASE_URL}`);
}

async function stable(page, selector = 'body') {
  await page.locator(selector).first().waitFor({ state: 'visible', timeout: 15_000 });
  await page.evaluate(async () => {
    const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
    if (document.fonts?.ready) await Promise.race([document.fonts.ready, delay(4_000)]);
    const imageTasks = [...document.images].map((image) => {
      if (image.complete) return Promise.resolve();
      return new Promise((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          image.removeEventListener('load', finish);
          image.removeEventListener('error', finish);
          resolve();
        };
        const timer = setTimeout(finish, 3_000);
        image.addEventListener('load', finish, { once: true });
        image.addEventListener('error', finish, { once: true });
      });
    });
    await Promise.race([Promise.all(imageTasks), delay(4_000)]);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

async function encodeWebp(page, pngBuffer, quality = 0.78) {
  const dataUrl = await page.evaluate(async ({ base64, qualityValue }) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Canvas 2D context is unavailable');
    context.drawImage(image, 0, 0);
    return canvas.toDataURL('image/webp', qualityValue);
  }, { base64: pngBuffer.toString('base64'), qualityValue: quality });
  if (!dataUrl.startsWith('data:image/webp;base64,')) throw new Error('Chromium could not encode WebP');
  return Buffer.from(dataUrl.slice('data:image/webp;base64,'.length), 'base64');
}

async function screenshotPage(page, route, file, options = {}) {
  await page.setViewportSize({ width: options.width, height: options.height });
  await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded' });
  await stable(page, options.initialWaitFor || 'body');
  if (options.before) await options.before(page);
  await stable(page, options.waitFor || 'body');
  const requestedType = options.type || 'webp';
  const pngBuffer = await page.screenshot({ type: 'png', fullPage: false });
  const buffer = requestedType === 'webp'
    ? await encodeWebp(page, pngBuffer, (options.quality || 78) / 100)
    : pngBuffer;
  fs.writeFileSync(file, buffer);
  return buffer;
}

function architectureSvg(locale) {
  const copy = {
    en: {
      flow: 'problem → material → action → evidence → adjustment',
      nodes: ['Material', 'Teach Mission', 'Course plan', 'Lesson and practice', 'Evidence and adjustment'],
    },
    'zh-CN': {
      flow: '问题 → 材料 → 行动 → 证据 → 调整',
      nodes: ['学习材料', 'Teach Mission', '课程计划', '课节与练习', '证据与调整'],
    },
    ja: {
      flow: '課題 → 教材 → 行動 → 証拠 → 調整',
      nodes: ['教材', 'Teach Mission', 'コース計画', 'レッスンと練習', '証拠と調整'],
    },
  }[locale];
  const nodes = copy.nodes.map((label, index) => {
    const x = 55 + index * 226;
    return `<g><rect x="${x}" y="245" width="188" height="124" rx="16" fill="#ffffff" stroke="#c5cfdd"/><text x="${x + 94}" y="315" text-anchor="middle" font-family="system-ui,sans-serif" font-size="22" font-weight="650" fill="#172033">${label}</text></g>`;
  }).join('');
  const arrows = Array.from({ length: 4 }, (_, index) => {
    const x = 244 + index * 226;
    return `<path d="M${x} 307h30" stroke="#0b57d0" stroke-width="4" stroke-linecap="round"/><path d="m${x + 24} 299 9 8-9 8" fill="none" stroke="#0b57d0" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="660" viewBox="0 0 1200 660"><rect width="1200" height="660" fill="#f5f7fa"/><text x="600" y="110" text-anchor="middle" font-family="system-ui,sans-serif" font-size="44" font-weight="700" fill="#172033">Lucubro</text><text x="600" y="156" text-anchor="middle" font-family="system-ui,sans-serif" font-size="20" fill="#526078">${copy.flow}</text>${nodes}${arrows}</svg>`;
}

async function composeStoryboard(page, buffers, output) {
  const images = buffers.map((buffer) => `data:image/png;base64,${buffer.toString('base64')}`);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.setContent(`<!doctype html><style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#edf1f6;display:grid;grid-template-columns:1fr 1fr;gap:18px}figure{margin:0;overflow:hidden;border:1px solid #c5cfdd;border-radius:18px;background:#fff;box-shadow:0 12px 30px rgba(24,39,75,.1)}img{width:100%;height:100%;object-fit:cover;object-position:top;display:block}</style>${images.map((src) => `<figure><img src="${src}"></figure>`).join('')}`);
  await stable(page);
  const pngBuffer = await page.screenshot({ type: 'png' });
  fs.writeFileSync(output, await encodeWebp(page, pngBuffer, 0.76));
}

async function captureLocale(browser, locale) {
  applyMediaFixture(locale);
  const directory = path.join(OUTPUT, locale);
  fs.mkdirSync(directory, { recursive: true });
  const context = await browser.newContext({
    locale: locale === 'zh-CN' ? 'zh-CN' : locale,
    colorScheme: 'light',
    reducedMotion: 'reduce',
    viewport: { width: 1440, height: 900 },
  });
  await context.addInitScript((value) => localStorage.setItem('lucubro-locale', value), locale);
  const page = await context.newPage();
  const frames = [];

  await screenshotPage(page, '/course/readycourse', path.join(directory, 'hero-workspace.webp'), { width: 1440, height: 900, waitFor: '#lessonFrame' });
  await screenshotPage(page, '/app', path.join(directory, 'library.webp'), { width: 1200, height: 750, waitFor: '.ks-continue-card' });
  await screenshotPage(page, '/course/readycourse', path.join(directory, 'mission.webp'), {
    width: 720,
    height: 900,
    waitFor: '.mission-title',
    before: async (activePage) => {
      await activePage.locator('#mobileContextButton').click();
      await activePage.locator('#leftPanel.ks-learning-context').waitFor({ state: 'visible' });
      await activePage.locator('[data-left-tab="overview"]').click();
    },
  });
  await screenshotPage(page, '/course/readycourse', path.join(directory, 'lesson-practice.webp'), { width: 1200, height: 750, waitFor: '#currentLearningStrip' });
  await screenshotPage(page, '/notes?course=readycourse', path.join(directory, 'notes-source.webp'), { width: 1200, height: 750, waitFor: '.notes-shell, main' });
  await screenshotPage(page, '/', path.join(directory, 'social-preview.png'), { width: 1280, height: 640, type: 'png', waitFor: '.hero' });

  for (const route of ['/', '/app?sample=1', '/new-course', '/course/readycourse']) {
    await page.setViewportSize({ width: 640, height: 360 });
    await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded' });
    await stable(page);
    frames.push(await page.screenshot({ type: 'png' }));
  }
  await composeStoryboard(page, frames, path.join(directory, 'journey-storyboard.webp'));
  fs.writeFileSync(path.join(directory, 'architecture.svg'), architectureSvg(locale));
  await context.close();
}

async function main() {
  fs.mkdirSync(OUTPUT, { recursive: true });
  const server = spawn(process.execPath, [path.join(ROOT, 'tests', 'support', 'test-server.js')], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), LUCUBRO_E2E_PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.pipe(process.stdout);
  server.stderr.pipe(process.stderr);
  try {
    await waitForServer();
    const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    try {
      for (const locale of LOCALES) await captureLocale(browser, locale);
    } finally {
      await browser.close();
    }

    const assets = {};
    for (const locale of LOCALES) {
      assets[locale] = slots.map((slot) => ({
        ...slot,
        route: slot.name === 'library.webp' ? '/app' : slot.name === 'notes-source.webp' ? '/notes?course=readycourse' : slot.name === 'social-preview.png' ? '/' : '/course/readycourse',
        locale,
        theme: 'light',
        fixture: 'readycourse',
        fixtureProfile: 'locale-matched projection in isolated tests/.runtime data',
        bytes: fs.statSync(path.join(OUTPUT, locale, slot.name)).size,
      }));
    }
    const manifest = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      source: 'Round 5 repository snapshot',
      command,
      baseURL: BASE_URL,
      capture: {
        browser: executablePath ? path.basename(executablePath) : 'Playwright Chromium',
        theme: 'light',
        reducedMotion: 'reduce',
        stableCondition: 'DOM ready, target visible, fonts ready, images complete, two animation frames',
      },
      assets,
    };
    fs.writeFileSync(path.join(OUTPUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  } finally {
    server.kill('SIGTERM');
    await Promise.race([new Promise((resolve) => server.once('exit', resolve)), sleep(2_000)]);
    if (!server.killed) server.kill('SIGKILL');
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
