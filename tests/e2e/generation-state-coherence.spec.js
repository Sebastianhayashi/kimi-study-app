'use strict';

const { test, expect } = require('../support/test-fixtures');

async function prepareControlledStatus(page, initialStatus) {
  let status = { ...initialStatus };
  await page.addInitScript(() => {
    const nativeSetTimeout = window.setTimeout.bind(window);
    window.setTimeout = (callback, delay, ...args) => nativeSetTimeout(callback, delay === 1800 ? 45 : delay, ...args);
    class SilentEventSource {
      constructor(url) { this.url = url; this.readyState = 1; }
      addEventListener() {}
      removeEventListener() {}
      close() { this.readyState = 2; }
    }
    window.EventSource = SilentEventSource;
  });
  await page.route('**/api/courses/generatingcourse/status', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(status),
  }));
  return {
    set(next) { status = { ...status, ...next }; },
  };
}

test('明确阶段优先于过期 canvasVariant，生成状态在课程外壳中保持一致', async ({ page }) => {
  await prepareControlledStatus(page, {
    stage: 'generating',
    runId: 'coherence-run',
    progress: 12,
    phase: 'extracting',
    canvasVariant: 'questions',
    lessons: 0,
    busy: true,
    currentMessage: '正在读取教材内容…',
    history: [{ id: 'extract', label: '读取并整理材料', state: 'active' }],
  });

  await page.goto('/course/generatingcourse');
  const preview = page.locator('.ks-generation-preview');
  const canvas = preview.locator('.ks-generation-canvas');

  await expect(canvas).toHaveAttribute('data-phase', 'extracting');
  await expect(canvas).toHaveAttribute('data-variant', 'material');
  await expect(preview.locator('.ks-generation-paper-stage-label')).toHaveText('读取教材内容');
  await expect(preview.locator('.ks-generation-canvas-content')).toContainText('材料内容');
  await expect(preview.locator('.ks-generation-canvas-content')).not.toContainText('候选题目');

  await expect(page.locator('.current-lesson')).toHaveText('第一课正在生成');
  await expect(page.locator('#left-overview .side-section').first().locator('.side-title')).toHaveText('课程创建进度');
  await expect(page.locator('#left-overview .side-section').first().locator('.progress-value')).toHaveText('12%');
  await expect(page.locator('.compact-progress > span')).toHaveText('12%');
  await expect(page.locator('#nextLessonButton')).toBeHidden();
  await expect(page.locator('#left-overview .record-list')).toContainText('正在创建课程');
  await expect(page.locator('#left-overview .record-list')).not.toContainText('正在学习 Lesson 1');
});

test('单元总数超过画布容量时明确说明剩余数量', async ({ page }) => {
  await prepareControlledStatus(page, {
    stage: 'generating',
    runId: 'coherence-units',
    progress: 27,
    phase: 'profiling',
    canvasVariant: 'questions',
    lessons: 0,
    busy: true,
    currentMessage: '已识别 8 个内容单元，正在分析结构…',
    history: [{ id: 'profile', label: '识别 8 个内容单元', state: 'active' }],
    preview: { unitsFound: 8 },
  });

  await page.goto('/course/generatingcourse');
  const content = page.locator('.ks-generation-canvas-content');
  await expect(page.locator('.ks-generation-canvas')).toHaveAttribute('data-variant', 'structure');
  await expect(content.locator('.ks-fidelity-chapter-row')).toHaveCount(5);
  await expect(content).toContainText('教材结构 · 8 个单元 · 展示前 5 个');
  await expect(content).toContainText('还有 3 个单元已识别');

  const overflowNote = page.locator('.ks-fidelity-chapter-overflow');
  const activityBar = page.locator('.ks-generation-paper-activity');
  await expect(overflowNote).toBeVisible();
  await expect(activityBar).toBeVisible();

  const noteBox = await overflowNote.boundingBox();
  const barBox = await activityBar.boundingBox();

  expect(noteBox).not.toBeNull();
  expect(barBox).not.toBeNull();

  const noteBottom = noteBox.y + noteBox.height;
  const barTop = barBox.y;

  expect(noteBottom).toBeLessThanOrEqual(barTop - 8);
});

test('完成状态把所有生成进度统一为 100%，隐藏下一课并使用同一成功文案', async ({ page }) => {
  const controller = await prepareControlledStatus(page, {
    stage: 'generating',
    runId: 'coherence-complete',
    progress: 79,
    phase: 'quality',
    canvasVariant: 'quality',
    lessons: 0,
    busy: true,
    currentMessage: '正在筛选题目质量…',
    history: [{ id: 'quality', label: '筛选题目质量', state: 'active' }],
  });

  await page.goto('/course/generatingcourse');
  controller.set({
    stage: 'ready',
    progress: 100,
    phase: 'complete',
    canvasVariant: 'ready',
    lessons: 1,
    busy: false,
    currentMessage: '课程已准备好',
    history: [{ id: 'validate', label: '检查课程文件', state: 'complete' }],
  });

  const preview = page.locator('.ks-generation-preview');
  await expect(preview).toHaveClass(/is-complete/);
  await expect(preview.locator('.ks-generation-message')).toHaveText('课程已准备好');
  await expect(preview.locator('.ks-fidelity-lesson-title')).toHaveText('课程已准备好');
  await expect(preview.locator('.ks-generation-progress')).toHaveAttribute('aria-valuenow', '100');
  await expect(page.locator('#left-overview .side-section').first().locator('.progress-value')).toHaveText('100%');
  await expect(page.locator('.compact-progress > span')).toHaveText('100%');
  await expect(page.locator('.current-lesson')).toHaveText('课程已准备好');
  await expect(page.locator('#nextLessonButton')).toBeHidden();
});

test('正常 ready 课程不显示生成覆盖层，并恢复学习态控件', async ({ page }) => {
  await page.goto('/course/readycourse');
  await expect(page.locator('.ks-generation-preview')).toBeHidden();
  await expect(page.locator('#left-overview .side-section').first().locator('.side-title')).toHaveText('课程进度');
  await expect(page.locator('.compact-progress > span')).toHaveText('1 / 1');
  await expect(page.locator('#nextLessonButton')).toBeVisible();
  await expect(page.locator('#nextLessonButton')).toBeEnabled();
  await expect(page.locator('.current-lesson')).toContainText('Lesson 1');
});

test('生成一致性人工截图', async ({ page }) => {
  // 1. coherence-extracting.png
  const controller = await prepareControlledStatus(page, {
    stage: 'generating',
    runId: 'coherence-run',
    progress: 12,
    phase: 'extracting',
    canvasVariant: 'questions',
    lessons: 0,
    busy: true,
    currentMessage: '正在读取教材内容…',
    history: [{ id: 'extract', label: '读取并整理材料', state: 'active' }],
  });

  await page.goto('/course/generatingcourse');
  await page.waitForTimeout(800);
  await page.screenshot({ path: '/Users/microseyuyu/Downloads/coherence-extracting.png' });

  // 2. coherence-structure.png
  controller.set({
    stage: 'generating',
    runId: 'coherence-units',
    progress: 27,
    phase: 'profiling',
    canvasVariant: 'questions',
    lessons: 0,
    busy: true,
    currentMessage: '已识别 8 个内容单元，正在分析结构…',
    history: [{ id: 'profile', label: '识别 8 个内容单元', state: 'active' }],
    preview: { unitsFound: 8 },
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: '/Users/microseyuyu/Downloads/coherence-structure.png' });

  // 3. coherence-complete.png
  await page.evaluate(() => {
    if (window.KimiGenerationPreview?.current) {
      const origComplete = window.KimiGenerationPreview.current.complete;
      window.KimiGenerationPreview.current.complete = function(status) {
        origComplete(status);
        return new Promise(() => {});
      };
    }
  });
  controller.set({
    stage: 'ready',
    progress: 100,
    phase: 'complete',
    canvasVariant: 'ready',
    lessons: 1,
    busy: false,
    currentMessage: '课程已准备好',
    history: [{ id: 'validate', label: '检查课程文件', state: 'complete' }],
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: '/Users/microseyuyu/Downloads/coherence-complete.png' });

  // 4. coherence-ready-course.png
  await page.goto('/course/readycourse');
  await page.waitForTimeout(800);
  await page.screenshot({ path: '/Users/microseyuyu/Downloads/coherence-ready-course.png' });
});

test('验证 renderLearningRecords() 防御 HTML 注入 (XSS)', async ({ page }) => {
  const xssTitle = '01-<img src=x onerror="window.__lessonTitleXss=1">.html';
  await page.route('**/api/courses/readycourse/lessons', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([xssTitle]),
    });
  });

  await page.route('**/api/courses/readycourse/lessons/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<html><body>Mock Lesson</body></html>',
    });
  });

  await page.goto('/course/readycourse');

  const xssTriggered = await page.evaluate(() => typeof window.__lessonTitleXss !== 'undefined');
  expect(xssTriggered).toBe(false);

  const recordMeta = page.locator('#left-overview .record-list .record:nth-child(2) .record-meta');
  await expect(recordMeta).toContainText('<img src=x onerror="window.__lessonTitleXss=1">');

  const hasXssElements = await recordMeta.evaluate((el) => {
    return el.querySelector('img') !== null || el.querySelector('svg') !== null || el.querySelector('script') !== null;
  });
  expect(hasXssElements).toBe(false);
});

test('在 1366x768 响应式断点下验证生成状态', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });

  const controller = await prepareControlledStatus(page, {
    stage: 'generating',
    runId: 'responsive-units',
    progress: 27,
    phase: 'profiling',
    canvasVariant: 'questions',
    lessons: 0,
    busy: true,
    currentMessage: '已识别 8 个内容单元，正在分析结构…',
    history: [{ id: 'profile', label: '识别 8 个内容单元', state: 'active' }],
    preview: { unitsFound: 8 },
  });

  await page.goto('/course/generatingcourse');
  await page.waitForTimeout(500);

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const innerWidth = await page.evaluate(() => window.innerWidth);
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth);

  const compactProgress = page.locator('.compact-progress');
  await expect(compactProgress).toBeVisible();

  const activityBar = page.locator('.ks-generation-paper-activity');
  await expect(activityBar).toBeVisible();

  const overflowNote = page.locator('.ks-fidelity-chapter-overflow');
  await expect(overflowNote).toBeVisible();
  const noteBox = await overflowNote.boundingBox();
  const barBox = await activityBar.boundingBox();
  expect(noteBox).not.toBeNull();
  expect(barBox).not.toBeNull();
  expect(noteBox.y + noteBox.height).toBeLessThanOrEqual(barBox.y - 8);

  const summaryBtn = page.locator('.ks-generation-summary');
  await expect(summaryBtn).toBeVisible();
  await summaryBtn.click();
  await expect(summaryBtn).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');

  controller.set({
    stage: 'ready',
    progress: 100,
    phase: 'complete',
    canvasVariant: 'ready',
    lessons: 1,
    busy: false,
    currentMessage: '课程已准备好',
    history: [{ id: 'validate', label: '检查课程文件', state: 'complete' }],
  });
  await page.waitForTimeout(500);

  const successTitle = page.locator('.ks-fidelity-lesson-title');
  await expect(successTitle).toBeVisible();
  await expect(successTitle).toHaveText('课程已准备好');

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const isAtBottom = await page.evaluate(() => {
    const scrollY = window.scrollY;
    const visibleHeight = window.innerHeight;
    const totalHeight = document.body.scrollHeight;
    return scrollY + visibleHeight >= totalHeight - 2;
  });
  expect(isAtBottom).toBe(true);

  await page.screenshot({ path: '/Users/microseyuyu/Downloads/responsive-1366x768.png', fullPage: true });
});
