'use strict';

const { test, expect } = require('../support/test-fixtures');

const ACTIVE_STATUS = {
  stage: 'generating',
  runId: 'fixture-run-generating',
  progress: 40,
  lessons: 0,
  busy: true,
  currentMessage: '正在把教材转化为课程…',
  history: [],
  canvasVariant: 'questions',
};

const PHASE_TO_VARIANT = {
  extracting: 'material',
  profiling: 'structure',
  claims: 'claims',
  blueprint: 'practice',
  questions: 'questions',
  quality: 'quality',
  assembling: 'assembly',
  validating: 'validation',
  complete: 'ready',
};

async function preparePreview(page, status = ACTIVE_STATUS) {
  page._mockStatus = { ...status };
  await page.addInitScript(() => {
    class SilentEventSource {
      constructor(url) {
        this.url = url;
        this.readyState = 1;
      }
      addEventListener() {}
      removeEventListener() {}
      close() { this.readyState = 2; }
    }
    window.EventSource = SilentEventSource;
  });
  await page.route('**/api/courses/generatingcourse/status', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(page._mockStatus) });
  });
}

async function previewCall(page, method, payload) {
  await page.evaluate(({ methodName, value }) => {
    const preview = window.KimiGenerationPreview?.current;
    if (!preview || typeof preview[methodName] !== 'function') throw new Error(`missing preview method: ${methodName}`);
    preview[methodName](value);
  }, { methodName: method, value: payload });
}

async function emitPhase(page, phase, message, metrics = {}) {
  const variant = PHASE_TO_VARIANT[phase] || 'material';
  if (page._mockStatus) {
    page._mockStatus.phase = phase;
    page._mockStatus.canvasVariant = variant;
    page._mockStatus.currentMessage = message;
    page._mockStatus.runId = 'fidelity-run';
    page._mockStatus = { ...page._mockStatus, ...metrics };
  }
  await previewCall(page, 'appendEvent', {
    id: `${phase}-${Date.now()}`,
    runId: 'fidelity-run',
    kind: 'phase',
    key: `phase:${phase}`,
    phase,
    state: 'active',
    message,
    metrics,
  });
}

async function startFidelityRun(page) {
  if (page._mockStatus) {
    page._mockStatus.runId = 'fidelity-run';
    page._mockStatus.canvasVariant = 'material';
  }
  await previewCall(page, 'appendEvent', {
    id: 'run-start',
    runId: 'fidelity-run',
    kind: 'run-start',
    key: 'run:fidelity-run',
    state: 'active',
    message: '正在开始创建课程…',
  });
}

test('中央生成画布使用预览稿的 paper、header、双进度与扫描结构', async ({ page }) => {
  await preparePreview(page);
  await page.goto('/course/generatingcourse');

  const preview = page.locator('.ks-generation-preview.ks-generation-fidelity');
  await expect(preview).toBeVisible();
  await expect(preview.locator('.ks-generation-shell')).toBeVisible();
  await expect(preview.locator('.ks-generation-meta')).toBeVisible();
  await expect(preview.locator('.ks-generation-canvas-wrap')).toBeVisible();
  await expect(preview.locator('.ks-generation-course-paper')).toBeVisible();
  await expect(preview.locator('.ks-generation-paper-header')).toBeVisible();
  await expect(preview.locator('.ks-generation-canvas-content')).toBeVisible();

  const geometry = await preview.evaluate((root) => {
    const paper = root.querySelector('.ks-generation-course-paper');
    const header = root.querySelector('.ks-generation-paper-header');
    const content = root.querySelector('.ks-generation-canvas-content');
    const topProgress = root.querySelector('.ks-generation-progress > span');
    const paperProgress = root.querySelector('.ks-generation-paper-mini-progress > span');
    const pulse = root.querySelector('.ks-generation-status-pulse');
    return {
      paperWidth: paper.getBoundingClientRect().width,
      canvasWidth: root.querySelector('.ks-generation-canvas-wrap').getBoundingClientRect().width,
      paperRadius: getComputedStyle(paper).borderRadius,
      headerHeight: getComputedStyle(header).height,
      contentWidth: content.getBoundingClientRect().width,
      topProgress: topProgress.style.width,
      paperProgress: paperProgress.style.width,
      pulseAnimation: getComputedStyle(pulse).animationName,
    };
  });

  expect(geometry.paperWidth / geometry.canvasWidth).toBeGreaterThanOrEqual(0.94);
  expect(geometry.paperWidth).toBeLessThanOrEqual(920);
  expect(geometry.paperRadius).toBe('14px');
  expect(geometry.headerHeight).toBe('48px');
  expect(geometry.contentWidth).toBeLessThanOrEqual(760);
  expect(geometry.topProgress).toBe('0%');
  expect(geometry.paperProgress).toBe('0%');
  expect(geometry.pulseAnimation).toContain('ksFidelityStatusPulse');
});

test('真实生成阶段逐一切换为预览稿对应的中央动画内容', async ({ page }) => {
  await preparePreview(page, { ...ACTIVE_STATUS, progress: 7, canvasVariant: 'material' });
  await page.goto('/course/generatingcourse');
  await startFidelityRun(page);

  const preview = page.locator('.ks-generation-preview');
  const canvas = preview.locator('.ks-generation-canvas');
  const content = preview.locator('.ks-generation-canvas-content');

  await emitPhase(page, 'profiling', '已识别 8 个单元', { units: 8 });
  await expect(canvas).toHaveAttribute('data-variant', 'structure');
  await expect(content).toContainText('教材结构 · 8 个单元');
  await expect(content.locator('.ks-fidelity-chapter-row')).toHaveCount(5);

  await emitPhase(page, 'claims', '已确定 4 个学习目标', { claims: 4 });
  await expect(canvas).toHaveAttribute('data-variant', 'claims');
  await expect(content).toContainText('本课学习目标 · 4 个');
  await expect(content.locator('.ks-fidelity-objective-card')).toHaveCount(4);

  await emitPhase(page, 'blueprint', '正在设计练习路线');
  await expect(canvas).toHaveAttribute('data-variant', 'practice');
  await expect(content).toContainText('练习路线 · 引导 → 独立 → 应用');
  await expect(content.locator('.ks-fidelity-exercise-card')).toHaveCount(3);

  await emitPhase(page, 'questions', '已生成 11 道候选题', { candidates: 11 });
  await expect(canvas).toHaveAttribute('data-variant', 'questions');
  await expect(content).toContainText('候选题目 · 11 道');
  await expect(content.locator('.ks-fidelity-exercise-card')).toHaveCount(3);

  await emitPhase(page, 'quality', '已保留 9 道题，移除 2 道', { accepted: 9, rejected: 2 });
  await expect(canvas).toHaveAttribute('data-variant', 'quality');
  await expect(content).toContainText('题目质量检查 · 保留 9 / 移除 2');
  await expect(content.locator('.ks-fidelity-quality-check')).toHaveCount(5);
  await expect(content.locator('.ks-fidelity-quality-state')).toContainText(['检查中', '比较中']);
  await expect(content).not.toContainText('已移除');

  await emitPhase(page, 'assembling', '正在组装第一课', { lessonNumber: 1 });
  await expect(canvas).toHaveAttribute('data-variant', 'assembly');
  await expect(content.locator('h1', { hasText: '第 1 课正在形成' })).toBeVisible();
  await expect(content.locator('.ks-fidelity-vocab-card')).toHaveCount(6);

  await emitPhase(page, 'validating', '正在验证互动课程');
  await expect(canvas).toHaveAttribute('data-variant', 'validation');
  await expect(content).toContainText('正在连接答案、提示与评分规则');
  await expect(content).not.toContainText('答案、提示与评分规则已连接');

  await previewCall(page, 'complete', {
    runId: 'fidelity-run',
    progress: 100,
    currentMessage: '第一课已准备好',
  });
  await expect(preview).toHaveClass(/is-complete/);
  await expect(canvas).toHaveAttribute('data-variant', 'ready');
  await expect(content.locator('h1', { hasText: '课程已准备好' })).toBeVisible();
  await expect(content).toContainText('课程可以开始');
});

test('等待动画可以循环，但阶段和文案只能由真实后端事件推进', async ({ page }) => {
  await preparePreview(page, { ...ACTIVE_STATUS, progress: 7, canvasVariant: 'material', currentMessage: '正在读取材料' });
  await page.goto('/course/generatingcourse');

  const preview = page.locator('.ks-generation-preview');
  const canvas = preview.locator('.ks-generation-canvas');
  await expect(canvas).toHaveAttribute('data-variant', 'material');
  await page.waitForTimeout(3900);
  await expect(canvas).toHaveAttribute('data-variant', 'material');
  await expect(preview.locator('.ks-generation-message')).toHaveText('正在读取材料');

  await previewCall(page, 'appendEvent', {
    id: 'tool-read-1',
    runId: 'fixture-run-generating',
    kind: 'tool',
    key: 'tool:read-1',
    state: 'active',
    message: '正在定位并阅读与本课相关的材料…',
  });
  await expect(canvas).toHaveAttribute('data-variant', 'material');
  await expect(preview.locator('.ks-generation-event-log')).toContainText('实际工具调用');
  await expect(preview.locator('.ks-generation-event-log')).toContainText('正在定位并阅读与本课相关的材料');

  await previewCall(page, 'appendEvent', {
    id: 'phase-profile-1',
    runId: 'fixture-run-generating',
    kind: 'phase',
    key: 'phase:profiling',
    phase: 'profiling',
    state: 'active',
    message: '已识别 8 个内容单元，正在分析结构',
    metrics: { units: 8 },
  });
  await expect(canvas).toHaveAttribute('data-variant', 'structure');
  await expect(preview.locator('.ks-generation-canvas-content')).toContainText('教材结构 · 8 个单元');
  await expect(preview.locator('.ks-generation-history')).toContainText('不会展示或推测隐藏推理');
});

test('扫描只在阶段切换时运行，失败后停止且迟到事件不能恢复', async ({ page }) => {
  await preparePreview(page);
  await page.goto('/course/generatingcourse');
  await startFidelityRun(page);
  await emitPhase(page, 'questions', '正在生成候选题', { candidates: 11 });

  const preview = page.locator('.ks-generation-preview');
  const scan = preview.locator('.ks-generation-scan');
  await expect(scan).toHaveClass(/is-running/);
  await expect.poll(() => scan.evaluate((node) => getComputedStyle(node).animationName)).toContain('ksFidelityScanCourse');

  await previewCall(page, 'fail', {
    runId: 'fidelity-run',
    currentMessage: '课程生成已中断，请重试',
    progress: 70,
  });
  await expect(preview).toHaveClass(/is-error/);
  await expect(preview.locator('.ks-generation-message')).toContainText('中断');
  await expect(scan).toHaveCSS('display', 'none');

  await emitPhase(page, 'assembling', '迟到事件不应恢复动画');
  await expect(preview).toHaveClass(/is-error/);
  await expect(preview.locator('.ks-generation-message')).toContainText('中断');
  await expect(scan).toHaveCSS('display', 'none');
});

test('新 run 可以重新开始，但旧 run 的迟到事件不能接管中央画布', async ({ page }) => {
  await preparePreview(page);
  await page.goto('/course/generatingcourse');

  await previewCall(page, 'appendEvent', {
    id: 1,
    runId: 'run-a',
    kind: 'run-start',
    key: 'run:run-a',
    state: 'active',
    message: 'Run A 开始',
  });
  await previewCall(page, 'fail', { runId: 'run-a', currentMessage: 'Run A 失败' });

  await previewCall(page, 'appendEvent', {
    id: 2,
    runId: 'run-b',
    kind: 'run-start',
    key: 'run:run-b',
    state: 'active',
    message: 'Run B 开始',
  });
  await previewCall(page, 'appendEvent', {
    id: 3,
    runId: 'run-b',
    kind: 'phase',
    key: 'phase:profiling',
    phase: 'profiling',
    state: 'active',
    message: 'Run B 正在分析结构',
    metrics: { units: 6 },
  });

  const preview = page.locator('.ks-generation-preview');
  await expect(preview).not.toHaveClass(/is-error/);
  await expect(preview.locator('.ks-generation-message')).toHaveText('Run B 正在分析结构');
  await expect(preview.locator('.ks-generation-canvas')).toHaveAttribute('data-variant', 'structure');

  await previewCall(page, 'appendEvent', {
    id: 4,
    runId: 'run-a',
    kind: 'phase',
    key: 'phase:late-old-run',
    phase: 'assembling',
    state: 'active',
    message: 'Run A 迟到事件',
  });

  await expect(preview.locator('.ks-generation-message')).toHaveText('Run B 正在分析结构');
  await expect(preview.locator('.ks-generation-canvas')).toHaveAttribute('data-variant', 'structure');
});

test('生成过程弹层固定展示九个阶段，并支持 Escape 关闭和焦点返回', async ({ page }) => {
  await preparePreview(page);
  await page.goto('/course/generatingcourse');

  const summary = page.locator('.ks-generation-summary');
  const history = page.locator('.ks-generation-history');
  await summary.click();
  await expect(summary).toHaveAttribute('aria-expanded', 'true');
  await expect(history).toBeVisible();
  await expect(history.locator('.ks-generation-process-step')).toHaveCount(9);
  await expect(history).toContainText('读取教材内容');
  await expect(history).toContainText('课程准备完成');

  await page.keyboard.press('Escape');
  await expect(history).toBeHidden();
  await expect(summary).toBeFocused();
});

test('减少动态效果时不运行扫描并把动画压缩为单次极短状态', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await preparePreview(page, { ...ACTIVE_STATUS, progress: 24, canvasVariant: 'structure' });
  await page.goto('/course/generatingcourse');

  const preview = page.locator('.ks-generation-preview');
  const motion = await preview.evaluate((root) => {
    const pulse = root.querySelector('.ks-generation-status-pulse');
    const scan = root.querySelector('.ks-generation-scan');
    return {
      pulseDuration: parseFloat(getComputedStyle(pulse).animationDuration),
      pulseIterations: getComputedStyle(pulse).animationIterationCount,
      scanRunning: scan.classList.contains('is-running'),
    };
  });

  expect(motion.pulseDuration).toBeLessThanOrEqual(0.01);
  expect(motion.pulseIterations).toBe('1');
  expect(motion.scanRunning).toBe(false);
});

test('生成人工视觉对比核对截图', async ({ page }, testInfo) => {
  await preparePreview(page);
  await page.goto('/course/generatingcourse');
  await startFidelityRun(page);

  // 1. extracting/material
  await emitPhase(page, 'extracting', '正在读取教材内容…');
  await page.waitForTimeout(500);
  const p1 = testInfo.outputPath('extracting-material.png');
  await page.screenshot({ path: p1 });
  await testInfo.attach('extracting-material', { path: p1, contentType: 'image/png' });

  // 2. profiling/structure (real units metric)
  await emitPhase(page, 'profiling', '已识别 8 个单元', { units: 8 });
  await page.waitForTimeout(500);
  const p2 = testInfo.outputPath('profiling-structure.png');
  await page.screenshot({ path: p2 });
  await testInfo.attach('profiling-structure', { path: p2, contentType: 'image/png' });

  // 3. questions or quality (no fictional questions)
  await emitPhase(page, 'quality', '已保留 9 道题，移除 2 道', { accepted: 9, rejected: 2 });
  await page.waitForTimeout(500);
  const p3 = testInfo.outputPath('questions-quality.png');
  await page.screenshot({ path: p3 });
  await testInfo.attach('questions-quality', { path: p3, contentType: 'image/png' });

  // 4. complete success state/before exit
  await previewCall(page, 'complete', {
    runId: 'fidelity-run',
    progress: 100,
    currentMessage: '课程准备完成！',
    lessons: 1,
  });
  await expect(page.locator('.ks-generation-preview')).toHaveClass(/is-complete/);
  
  const p4 = testInfo.outputPath('complete.png');
  await page.screenshot({ path: p4 });
  await testInfo.attach('complete', { path: p4, contentType: 'image/png' });

  const exitDuration = await page.evaluate(() => window.KimiGenerationPreview?.successExitMs || 1520);
  await page.waitForTimeout(exitDuration + 100);
});
