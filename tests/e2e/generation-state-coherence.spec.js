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

  await expect(page.locator('.current-lesson')).toHaveText(/第一课正在生成 · \d{2}:\d{2}$/);
  await expect(page.locator('#left-overview .side-section').first().locator('.side-title')).toHaveText('课程创建进度');
  await expect(page.locator('#left-overview .side-section').first().locator('.progress-value')).toHaveText('阶段 1 / 1');
  await expect(page.locator('.compact-progress > span')).toHaveText(/阶段 1 \/ 1 · \d{2}:\d{2}$/);
  await expect(page.locator('#nextLessonButton')).toBeHidden();
  await expect(page.locator('#left-overview .record-list')).toContainText('正在创建课程');
  await expect(page.locator('#left-overview .record-list')).not.toContainText('正在学习 Lesson 1');
  await expect(page.locator('.compact-progress .progress-track')).toBeHidden();
  await expect(page.locator('#left-overview .side-section').first().locator('.progress-track')).toBeHidden();
  await expect(page.locator('[role="progressbar"]:visible')).toHaveCount(1);
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
  await expect(page.locator('#left-overview .side-section').first().locator('.progress-value')).toHaveText(/^(已完成|100%)$/);
  await expect(page.locator('.compact-progress > span')).toHaveText(/^(已完成|100%)$/);
  await expect(page.locator('.current-lesson')).toHaveText('课程已准备好');
  await expect(page.locator('#nextLessonButton')).toBeHidden();
});

test('失败终态停止外围运行文案，并只保留一个主进度面', async ({ page }) => {
  await page.goto('/course/failedcourse');

  await expect(page.locator('.ks-generation-preview')).toHaveClass(/is-error/);
  await expect(page.locator('.current-lesson')).toHaveText('课程创建未完成');
  await expect(page.locator('#left-overview .side-section').first().locator('.side-title')).toHaveText('课程创建未完成');
  await expect(page.locator('#left-overview .side-section').first().locator('.side-note')).toHaveText('已停止');
  await expect(page.locator('.context-bar')).toHaveText('当前上下文：课程创建未完成');
  await expect(page.locator('#left-overview .record-list')).toContainText('课程创建未完成');
  await expect(page.locator('#left-overview .record-list')).not.toContainText('正在创建课程');
  await expect(page.locator('.compact-progress .progress-track')).toBeHidden();
  await expect(page.locator('#left-overview .side-section').first().locator('.progress-track')).toBeHidden();
  await expect(page.locator('[role="progressbar"]:visible')).toHaveCount(1);
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

test('生成一致性人工截图', async ({ page }, testInfo) => {
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
  const p1 = testInfo.outputPath('coherence-extracting.png');
  await page.screenshot({ path: p1 });
  await testInfo.attach('coherence-extracting', { path: p1, contentType: 'image/png' });

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
  const p2 = testInfo.outputPath('coherence-structure.png');
  await page.screenshot({ path: p2 });
  await testInfo.attach('coherence-structure', { path: p2, contentType: 'image/png' });

  // 3. coherence-complete.png
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
  await expect(page.locator('.ks-generation-preview')).toHaveClass(/is-complete/);
  
  const p3 = testInfo.outputPath('coherence-complete.png');
  await page.screenshot({ path: p3 });
  await testInfo.attach('coherence-complete', { path: p3, contentType: 'image/png' });

  const exitDuration = await page.evaluate(() => window.KimiGenerationPreview?.successExitMs || 1520);
  await page.waitForTimeout(exitDuration + 100);

  // 4. coherence-ready-course.png
  await page.goto('/course/readycourse');
  await page.waitForTimeout(800);
  const p4 = testInfo.outputPath('coherence-ready-course.png');
  await page.screenshot({ path: p4 });
  await testInfo.attach('coherence-ready-course', { path: p4, contentType: 'image/png' });
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

test('在 1366x768 响应式断点下验证生成状态', async ({ page }, testInfo) => {
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

  // 1. 验证没有水平页面滚动
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const innerWidth = await page.evaluate(() => window.innerWidth);
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth);

  // 2. 验证顶部生成状态可见
  const compactProgress = page.locator('.compact-progress');
  await expect(compactProgress).toBeVisible();

  // 3. 验证 .ks-generation-paper-activity 可见
  const activityBar = page.locator('.ks-generation-paper-activity');
  await expect(activityBar).toBeVisible();

  // 4. 验证 overflow note 不被 activity bar 遮挡 (保留现有 8px 几何断言)
  const overflowNote = page.locator('.ks-fidelity-chapter-overflow');
  await expect(overflowNote).toBeVisible();
  const noteBox = await overflowNote.boundingBox();
  const barBox = await activityBar.boundingBox();
  expect(noteBox).not.toBeNull();
  expect(barBox).not.toBeNull();
  expect(noteBox.y + noteBox.height).toBeLessThanOrEqual(barBox.y - 8);

  // 5. 验证实际中央生成区域的滚动容器
  const viewport = page.locator('.ks-generation-canvas-viewport');
  await expect(viewport).toBeVisible();

  // - scrollHeight >= clientHeight
  const scrollHeight = await viewport.evaluate((el) => el.scrollHeight);
  const clientHeight = await viewport.evaluate((el) => el.clientHeight);
  expect(scrollHeight).toBeGreaterThanOrEqual(clientHeight);

  // - 设置 scrollTop = scrollHeight 后能够接近最大 scrollTop
  const maxScrollTop = scrollHeight - clientHeight;
  const actualScrollTop = await viewport.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
    return el.scrollTop;
  });
  expect(actualScrollTop).toBeGreaterThanOrEqual(maxScrollTop - 2);

  // - 纸张底部能够进入中央容器可视区域
  const updatedNoteBox = await overflowNote.boundingBox();
  const viewportBox = await viewport.boundingBox();
  expect(updatedNoteBox).not.toBeNull();
  expect(viewportBox).not.toBeNull();
  const noteBottom = updatedNoteBox.y + updatedNoteBox.height;
  const viewportBottom = viewportBox.y + viewportBox.height;
  expect(noteBottom).toBeLessThanOrEqual(viewportBottom);

  // 6. 验证生成过程按钮可点击并打开日志抽屉
  const summaryBtn = page.locator('.ks-generation-summary');
  await expect(summaryBtn).toBeVisible();
  await summaryBtn.click();
  await expect(summaryBtn).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');

  // 7. 切换到 complete 状态并验证完成标题可见
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

  const p = testInfo.outputPath('responsive-1366x768.png');
  await page.screenshot({ path: p, fullPage: true });
  await testInfo.attach('responsive-1366x768', { path: p, contentType: 'image/png' });
});
