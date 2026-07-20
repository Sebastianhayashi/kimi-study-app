'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const RUNTIME_COURSES = path.join(ROOT, 'tests', '.runtime', 'courses');

async function installFastGenerationTimers(page) {
  await page.addInitScript(() => {
    const nativeSetTimeout = window.setTimeout.bind(window);
    const nativeSetInterval = window.setInterval.bind(window);
    const timeoutMap = new Map([[1800, 60]]);
    const intervalMap = new Map([[4000, 80]]);
    window.setTimeout = (handler, delay = 0, ...args) => nativeSetTimeout(
      handler,
      timeoutMap.get(Number(delay)) ?? delay,
      ...args,
    );
    window.setInterval = (handler, delay = 0, ...args) => nativeSetInterval(
      handler,
      intervalMap.get(Number(delay)) ?? delay,
      ...args,
    );
  });
}

async function createStatusController(page, courseId, initialStatus) {
  let current = { ...initialStatus };
  const queue = [];
  let calls = 0;

  await page.route(`**/api/courses/${courseId}/status`, async (route) => {
    calls += 1;
    const next = queue.length ? queue.shift() : current;
    if (next?.abort) {
      await route.abort(next.abort === true ? 'failed' : next.abort);
      return;
    }
    const response = next?.body ? next : { body: next };
    await route.fulfill({
      status: response.status || 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify(response.body),
    });
  });

  return {
    set(status) {
      current = { ...status };
    },
    enqueue(...statuses) {
      queue.push(...statuses);
    },
    calls() {
      return calls;
    },
  };
}

async function interceptNextLesson(page, courseId, onRequest = () => {}) {
  await page.route(`**/api/courses/${courseId}/lessons/next`, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    await onRequest();
    await route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify({ ok: true }),
    });
  });
}

function writeSecondLesson(courseId, {
  filename = '0002-generation-journey.html',
  title = '生成旅途第二课',
} = {}) {
  const courseDir = path.join(RUNTIME_COURSES, courseId);
  const lessonFile = path.join(courseDir, 'lessons', filename);
  const assessmentFile = path.join(courseDir, 'assessments', filename.replace(/\.html$/i, '.json'));
  fs.mkdirSync(path.dirname(lessonFile), { recursive: true });
  fs.mkdirSync(path.dirname(assessmentFile), { recursive: true });
  fs.writeFileSync(lessonFile, `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>${title}</title></head>
<body><main style="max-width:760px;margin:0 auto;padding:48px;font:18px/1.8 system-ui,sans-serif">
<h1>${title}</h1><p>这节课由生成旅途测试在隔离目录中写入。</p></main></body></html>\n`);
  fs.writeFileSync(assessmentFile, `${JSON.stringify({
    schemaVersion: 1,
    lessonId: 'fixture-lesson-2',
    title,
    claims: [{
      id: 'claim-2',
      label: '验证下一课已经出现',
      sourceRefs: ['book.txt'],
      mastery: { requiredPassed: 1, requiredStages: ['guided'] },
    }],
    activities: [{
      id: 'activity-2',
      type: 'single-choice',
      claimId: 'claim-2',
      stage: 'guided',
      prompt: '第二课是否已经加载？',
      sourceRefs: ['book.txt'],
      options: [{ id: 'yes', label: '是' }, { id: 'no', label: '否' }],
      correctOptionId: 'yes',
      feedback: { correct: '正确。', incorrect: '请等待课节加载完成。' },
      hints: [],
    }],
  }, null, 2)}\n`);
  return { filename, lessonFile, assessmentFile };
}

function removeSecondLesson(courseId, filename = '0002-generation-journey.html') {
  const courseDir = path.join(RUNTIME_COURSES, courseId);
  fs.rmSync(path.join(courseDir, 'lessons', filename), { force: true });
  fs.rmSync(path.join(courseDir, 'assessments', filename.replace(/\.html$/i, '.json')), { force: true });
  fs.rmSync(path.join(courseDir, 'learning-progress', filename.replace(/\.html$/i, '.json')), { force: true });
}

module.exports = {
  RUNTIME_COURSES,
  installFastGenerationTimers,
  createStatusController,
  interceptNextLesson,
  writeSecondLesson,
  removeSecondLesson,
};
