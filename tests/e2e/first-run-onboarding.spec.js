'use strict';

const { test, expect } = require('../support/test-fixtures');

function onboardingRecord(state, overrides = {}) {
  return {
    version: 1,
    state,
    courseId: 'firstrunfixture',
    createdAt: '2026-07-21T00:00:00.000Z',
    updatedAt: '2026-07-21T00:00:00.000Z',
    source: {
      originalFilename: '学习材料.txt',
      storedFilename: 'book.txt',
      mimeType: 'text/plain',
      sizeBytes: 262144,
      format: 'text',
      extension: '.txt',
      sha256: 'fixture',
    },
    inspection: {
      status: 'complete',
      format: 'text',
      inspectedAt: '2026-07-21T00:00:00.000Z',
      errorCode: null,
      errorMessage: null,
    },
    mission: {
      version: 1,
      outcome: null,
      learningStyle: null,
      sessionLength: null,
      completedAt: null,
    },
    generation: {
      attempts: state === 'awaiting_mission' ? 0 : 1,
      activeRunId: state === 'generating' || state === 'ready' ? 'first-run-test' : null,
      startedAt: state === 'generating' || state === 'ready' ? '2026-07-21T00:00:01.000Z' : null,
      readyAt: state === 'ready' ? '2026-07-21T00:00:03.000Z' : null,
      failedAt: null,
      errorCode: null,
      errorMessage: null,
    },
    ...overrides,
  };
}

async function installSilentEventSource(page) {
  await page.addInitScript(() => {
    class SilentEventSource {
      constructor(url) { this.url = url; this.readyState = 1; }
      addEventListener() {}
      removeEventListener() {}
      close() { this.readyState = 2; }
    }
    window.EventSource = SilentEventSource;
  });
}

test('真实上传进度、Mission 卡片过渡、学习设置与 ready 交接形成完整首次建课旅程', async ({ page }) => {
  await installSilentEventSource(page);

  let state = 'awaiting_mission';
  let mission = null;
  let lessons = 0;

  await page.route('**/api/course-onboarding', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'firstrunfixture', onboarding: onboardingRecord('awaiting_mission') }),
    });
  });

  await page.route('**/api/courses/firstrunfixture/onboarding', async (route) => {
    const record = onboardingRecord(state, mission ? {
      mission: {
        version: 1,
        ...mission,
        completedAt: '2026-07-21T00:00:01.000Z',
      },
    } : {});
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'firstrunfixture',
        onboarding: record,
        generation: { stage: state === 'ready' ? 'ready' : state === 'generating' ? 'understanding' : 'idle', runId: 'first-run-test', busy: state === 'generating', lessons },
      }),
    });
  });

  await page.route('**/api/courses/firstrunfixture/mission', async (route) => {
    mission = route.request().postDataJSON().mission;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'firstrunfixture', onboarding: onboardingRecord('awaiting_mission', { mission }) }),
    });
  });

  await page.route('**/api/courses/firstrunfixture/start', async (route) => {
    state = 'generating';
    await route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'firstrunfixture', onboarding: onboardingRecord('generating'), generation: { stage: 'understanding', runId: 'first-run-test', busy: true, lessons: 0 }, reused: false }),
    });
  });

  await page.route('**/api/courses/firstrunfixture/status', async (route) => {
    const ready = state === 'ready';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        stage: ready ? 'ready' : 'generating',
        runId: 'first-run-test',
        progress: ready ? 100 : 40,
        phase: ready ? 'complete' : 'claims',
        canvasVariant: ready ? 'ready' : 'claims',
        lessons,
        busy: !ready,
        currentMessage: ready ? '课程已准备好' : '正在把材料内容转化为可以检查的学习目标…',
        history: ready
          ? [{ id: 'validate', label: '检查课程文件', state: 'complete' }]
          : [{ id: 'claims', label: '确定学习目标', state: 'active' }],
      }),
    });
  });

  await page.route('**/api/courses/firstrunfixture/info', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ title: '学习材料' }),
  }));

  await page.route('**/course/firstrunfixture', (route) => route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: '<!doctype html><title>第一课</title><main>第一课</main>',
  }));

  await page.goto('/new-course');
  await expect(page.locator('[data-stage="upload"]')).toHaveClass(/is-visible/);
  await expect(page.locator('#fileInput')).toHaveAttribute('accept', '.epub,.pdf,.txt,.md,.markdown');
  await expect(page.locator('body')).not.toContainText('Word');

  await page.locator('#fileInput').setInputFiles({
    name: '学习材料.txt',
    mimeType: 'text/plain',
    buffer: Buffer.alloc(256 * 1024, 'a'),
  });
  await page.locator('#uploadContinue').click();

  await expect(page.locator('#uploadTransfer')).toBeVisible();
  await expect(page.locator('#uploadProgressLabel')).toContainText(/上传|检查/);
  await expect(page.locator('#uploadProgressValue')).toHaveText('100%');
  await expect(page.locator('#missionCardVisual')).toBeVisible();
  await expect(page.locator('#readingTitle')).toHaveText('正在准备学习设置');

  await expect(page.locator('[data-stage="mission"]')).toHaveClass(/is-visible/);
  await expect(page.getByRole('radiogroup')).toBeVisible();
  await page.getByRole('radio', { name: /理解主要观点/ }).click();
  await page.locator('#missionNext').click();
  await page.getByRole('radio', { name: /短讲解后马上练习/ }).click();
  await page.locator('#missionNext').click();
  await page.getByRole('radio', { name: /15 到 25 分钟/ }).click();
  await page.locator('#missionNext').click();

  await expect.poll(() => mission).toEqual({
    outcome: 'understand_main_ideas',
    learningStyle: 'explain_then_practice',
    sessionLength: 'minutes_15_25',
  });
  await expect(page.locator('[data-stage="loading"]')).toHaveClass(/is-visible/);
  await expect(page.locator('#progressValue')).toHaveText('40%');
  await expect(page.locator('#statusLine')).toContainText('学习目标');

  state = 'ready';
  lessons = 1;
  await expect(page.locator('[data-stage="ready"]')).toHaveClass(/is-visible/, { timeout: 5000 });
  await expect(page.locator('#readyCourseTitle')).toHaveText('学习材料');
  await expect(page.locator('#readyCourseSubtitle')).toContainText('1 节课');
  await page.waitForURL('**/course/firstrunfixture', { timeout: 5000 });
});

test('书架课程卡根据 onboarding 状态恢复首次建课或进入现有课程', async ({ page }) => {
  await page.route('**/api/courses', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([
      { id: 'missioncourse', title: '待设置课程', cover: null, ext: 'TXT', lessons: 0, stage: 'idle', onboardingState: 'awaiting_mission', onboardingErrorCode: null },
      { id: 'readycourse', title: '现有课程', cover: null, ext: 'PDF', lessons: 1, stage: 'ready', onboardingState: 'ready', onboardingErrorCode: null },
    ]),
  }));
  await page.route('**/api/courses/missioncourse/onboarding', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      id: 'missioncourse',
      onboarding: onboardingRecord('awaiting_mission', { courseId: 'missioncourse' }),
      generation: { stage: 'idle', runId: null, busy: false, lessons: 0 },
    }),
  }));

  await page.goto('/app');
  await page.getByRole('heading', { name: '待设置课程' }).click();
  await expect(page).toHaveURL(/\/new-course\?course=missioncourse$/);

  await page.goto('/app');
  await page.getByRole('heading', { name: '现有课程' }).click();
  await expect(page).toHaveURL(/\/course\/readycourse$/);
});

test('1366×768 与 reduced motion 下首次建课页面无水平溢出且核心控件可访问', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/new-course');

  await expect(page.locator('#uploadZone')).toBeVisible();
  await expect(page.locator('#uploadContinue')).toBeVisible();
  await expect(page.locator('#cancelUpload')).toBeVisible();
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
  const uploadContinue = page.locator('#uploadContinue');
  await page.locator('#fileInput').setInputFiles({
    name: 'keyboard-focus.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('keyboard focus'),
  });
  await expect(uploadContinue).toBeEnabled();
  await uploadContinue.focus();
  await expect(uploadContinue).toBeFocused();
});
