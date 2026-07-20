'use strict';

const { test, expect } = require('../support/test-fixtures');
const {
  installMockEventSource,
  emitGenerationEvent,
  disconnectGenerationEvents,
  reconnectGenerationEvents,
} = require('../support/mock-event-source');
const {
  installFastGenerationTimers,
  createStatusController,
  interceptNextLesson,
  writeSecondLesson,
  removeSecondLesson,
} = require('../support/generation-controller');

const activeStatus = (overrides = {}) => ({
  stage: 'generating',
  runId: 'run-current',
  progress: 40,
  lessons: 0,
  busy: true,
  currentMessage: '正在创建课程…',
  history: [],
  canvasVariant: 'questions',
  ...overrides,
});

const readyStatus = (overrides = {}) => ({
  stage: 'ready',
  runId: 'run-current',
  progress: 100,
  lessons: 1,
  busy: false,
  currentMessage: '课程已经准备好',
  history: [],
  canvasVariant: 'ready',
  ...overrides,
});

const failedStatus = (overrides = {}) => ({
  stage: 'failed',
  runId: 'run-current',
  progress: 68,
  lessons: 0,
  busy: false,
  error: '课程生成已中断，请重试',
  currentMessage: '课程生成已中断，请重试',
  history: [],
  canvasVariant: 'error',
  ...overrides,
});

async function prepareGenerationPage(page) {
  await installFastGenerationTimers(page);
  await installMockEventSource(page);
}

test.describe.configure({ mode: 'serial' });

test.afterEach(() => {
  removeSecondLesson('readycourse');
});

test('ready 课程直接显示课节、进度和下一课，不闪现生成覆盖层', async ({ page }) => {
  await prepareGenerationPage(page);
  await page.goto('/course/readycourse');

  await expect(page.locator('.ks-generation-preview')).toBeHidden();
  await expect(page.frameLocator('#lessonFrame').getByRole('heading', { name: '稳定化测试课节' })).toBeVisible();
  await expect(page.locator('.compact-progress > span')).toHaveText('1 / 1');
  await expect(page.locator('#nextLessonButton')).toBeEnabled();
});

test('首课生成从轮询和真实事件进入 ready，并且只重新加载一次', async ({ page }) => {
  await prepareGenerationPage(page);
  const status = await createStatusController(page, 'readycourse', activeStatus({
    stage: 'understanding',
    progress: 15,
    currentMessage: '正在读取材料…',
    canvasVariant: 'material',
  }));
  const navigations = [];
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame() && /\/course\/readycourse$/.test(frame.url())) navigations.push(frame.url());
  });

  await page.goto('/course/readycourse');
  const preview = page.locator('.ks-generation-preview');
  const progress = preview.locator('.ks-generation-progress');
  await expect(preview).toBeVisible();
  await expect(progress).toHaveAttribute('aria-valuenow', '15');

  await emitGenerationEvent(page, {
    id: 1,
    runId: 'run-current',
    kind: 'phase',
    key: 'phase:claims',
    phase: 'claims',
    state: 'complete',
    message: '已确定 4 个学习目标',
  });
  status.set(activeStatus({ progress: 53, currentMessage: '正在设计练习路线…', canvasVariant: 'practice' }));
  await expect(progress).toHaveAttribute('aria-valuenow', '53');

  await emitGenerationEvent(page, {
    id: 2,
    runId: 'run-current',
    kind: 'phase',
    key: 'phase:questions',
    phase: 'questions',
    state: 'active',
    message: '正在生成候选题',
  });
  await preview.locator('.ks-generation-summary').click();
  await expect(preview.locator('.ks-generation-history')).toContainText('已确定 4 个学习目标');
  await expect(preview.locator('.ks-generation-history')).toContainText('正在生成候选题');

  const reloaded = page.waitForEvent('framenavigated', {
    predicate: (frame) => frame === page.mainFrame() && /\/course\/readycourse$/.test(frame.url()),
  });
  status.set(readyStatus());
  await expect(progress).toHaveAttribute('aria-valuenow', '100');
  await reloaded;

  await expect(page.locator('.ks-generation-preview')).toBeHidden();
  await expect(page.frameLocator('#lessonFrame').getByRole('heading', { name: '稳定化测试课节' })).toBeVisible();
  await expect(page.locator('#nextLessonButton')).toBeEnabled();
  await expect.poll(() => navigations.length).toBe(2);
});

test('failed 终止状态不会被同一轮迟到的 active 事件改写', async ({ page }) => {
  await prepareGenerationPage(page);
  const status = await createStatusController(page, 'readycourse', activeStatus());
  await page.goto('/course/readycourse');

  await emitGenerationEvent(page, {
    id: 1,
    runId: 'run-current',
    kind: 'phase',
    key: 'phase:questions',
    phase: 'questions',
    state: 'active',
    message: '正在生成候选题',
  });
  status.set(failedStatus());
  const preview = page.locator('.ks-generation-preview');
  await expect(preview).toHaveClass(/is-error/);
  await expect(preview.locator('.ks-generation-message')).toContainText('中断');

  await emitGenerationEvent(page, {
    id: 2,
    runId: 'run-current',
    kind: 'phase',
    key: 'phase:late-tool',
    phase: 'assembling',
    state: 'active',
    message: '迟到的工具事件不应恢复动画',
  });

  await expect(preview).toHaveClass(/is-error/);
  await expect(preview.locator('.ks-generation-message')).toContainText('中断');
  await expect(preview.locator('.ks-generation-scan')).toHaveCSS('display', 'none');
});

test('新 run 可以从失败状态重新开始，但旧 run 后到事件必须忽略', async ({ page }) => {
  await prepareGenerationPage(page);
  await createStatusController(page, 'readycourse', failedStatus({ runId: 'run-a' }));
  await page.goto('/course/readycourse');
  const preview = page.locator('.ks-generation-preview');

  await emitGenerationEvent(page, {
    id: 1,
    runId: 'run-a',
    kind: 'run-failed',
    key: 'run:run-a',
    state: 'error',
    message: '第一轮生成失败',
  });
  await expect(preview).toHaveClass(/is-error/);

  await emitGenerationEvent(page, {
    id: 2,
    runId: 'run-b',
    kind: 'run-start',
    key: 'run:run-b',
    state: 'active',
    message: '第二轮正在重新生成',
  });
  await expect(preview).not.toHaveClass(/is-error/);
  await expect(preview.locator('.ks-generation-message')).toHaveText('第二轮正在重新生成');

  await emitGenerationEvent(page, {
    id: 3,
    runId: 'run-a',
    kind: 'phase',
    key: 'phase:old-run',
    phase: 'questions',
    state: 'active',
    message: '第一轮迟到事件',
  });

  await expect(preview.locator('.ks-generation-message')).toHaveText('第二轮正在重新生成');
  await expect(preview.locator('.ks-generation-history')).not.toContainText('第一轮迟到事件');
});

test('SSE 重连和事件重放不会重复生成过程记录', async ({ page }) => {
  await prepareGenerationPage(page);
  await createStatusController(page, 'readycourse', activeStatus());
  await page.goto('/course/readycourse');

  const claims = {
    id: 2,
    runId: 'run-current',
    kind: 'phase',
    key: 'phase:claims',
    phase: 'claims',
    state: 'complete',
    message: '已确定学习目标',
  };
  await emitGenerationEvent(page, {
    id: 1,
    runId: 'run-current',
    kind: 'run-start',
    key: 'run:run-current',
    state: 'active',
    message: '正在开始创建课程',
  });
  await emitGenerationEvent(page, claims);
  await disconnectGenerationEvents(page, 'fixture disconnect');
  await reconnectGenerationEvents(page);
  await emitGenerationEvent(page, claims);
  await emitGenerationEvent(page, {
    id: 3,
    runId: 'run-current',
    kind: 'phase',
    key: 'phase:questions',
    phase: 'questions',
    state: 'active',
    message: '正在生成候选题',
  });

  const preview = page.locator('.ks-generation-preview');
  await preview.locator('.ks-generation-summary').click();
  await expect(preview.locator('.ks-generation-process-step').filter({ hasText: '已确定学习目标' })).toHaveCount(1);
  await expect(preview.locator('.ks-generation-process-step').filter({ hasText: '正在生成候选题' })).toHaveCount(1);
  const sources = await page.evaluate(() => window.__kimiTestEventSource.snapshot());
  expect(sources).toHaveLength(1);
  expect(sources[0].closed).toBe(false);
});

test('status 临时断线不会清空已经收到的真实生成事件', async ({ page, browserGuard }) => {
  await prepareGenerationPage(page);
  browserGuard.allow(/requestfailed: GET .*\/api\/courses\/readycourse\/status/);
  browserGuard.allow(/console\.error: Failed to load resource/);
  const status = await createStatusController(page, 'readycourse', activeStatus({ progress: 40 }));
  status.enqueue({ abort: 'failed' });

  await page.goto('/course/readycourse');
  const preview = page.locator('.ks-generation-preview');
  await expect(preview.locator('.ks-generation-message')).toContainText(/连接|创建课程/);

  await emitGenerationEvent(page, {
    id: 1,
    runId: 'run-current',
    kind: 'phase',
    key: 'phase:claims',
    phase: 'claims',
    state: 'complete',
    message: '已确定 3 个学习目标',
  });
  await preview.locator('.ks-generation-summary').click();
  await expect(preview.locator('.ks-generation-history')).toContainText('已确定 3 个学习目标');
  await expect(preview.locator('.ks-generation-progress')).toHaveAttribute('aria-valuenow', '40');
  expect(status.calls()).toBeGreaterThanOrEqual(2);
});

test('生成下一课完成后进入 Lesson 2，并恢复进度和下一课按钮', async ({ page }) => {
  await prepareGenerationPage(page);
  const status = await createStatusController(page, 'readycourse', readyStatus());
  await interceptNextLesson(page, 'readycourse', () => {
    status.set(activeStatus({
      runId: 'run-next',
      progress: 53,
      lessons: 1,
      currentMessage: '正在生成下一课…',
    }));
  });

  await page.goto('/course/readycourse');
  await expect(page.frameLocator('#lessonFrame').getByRole('heading', { name: '稳定化测试课节' })).toBeVisible();
  await page.locator('#nextLessonButton').click();
  await emitGenerationEvent(page, {
    id: 1,
    runId: 'run-next',
    kind: 'run-start',
    key: 'run:run-next',
    state: 'active',
    message: '正在生成下一课',
  });
  await expect(page.locator('.ks-generation-preview')).toBeVisible();
  await expect(page.locator('#nextLessonButton')).toBeDisabled();

  writeSecondLesson('readycourse');
  status.set(readyStatus({ runId: 'run-next', lessons: 2 }));
  await emitGenerationEvent(page, {
    id: 2,
    runId: 'run-next',
    kind: 'run-complete',
    key: 'run:run-next',
    phase: 'complete',
    state: 'complete',
    message: '下一课已经准备好',
  });

  await expect(page.frameLocator('#lessonFrame').getByRole('heading', { name: '生成旅途第二课' })).toBeVisible();
  await expect(page.locator('.current-lesson')).toContainText('Lesson 2');
  await expect(page.locator('.compact-progress > span')).toHaveText('2 / 2');
  await expect(page.locator('#nextLessonButton')).toBeEnabled();
  await expect(page.locator('.ks-generation-preview')).toBeHidden();
});
