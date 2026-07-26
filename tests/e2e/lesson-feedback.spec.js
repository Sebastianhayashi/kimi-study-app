'use strict';

const { test, expect } = require('../support/test-fixtures');

async function routeActivity(page, handler) {
  await page.route('**/api/courses/readycourse/activity', async (route) => {
    const payload = route.request().postDataJSON();
    if (payload?.type === 'lesson-feedback') return handler(route, payload);
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });
}

test('feedback POST completes before next-lesson request', async ({ page, browserGuard }) => {
  browserGuard.allow(/status of 409/);
  const order = [];
  let feedbackPayload = null;
  await routeActivity(page, async (route, payload) => {
    feedbackPayload = payload;
    order.push('feedback-start');
    await new Promise((resolve) => setTimeout(resolve, 120));
    order.push('feedback-end');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });
  await page.route('**/api/courses/readycourse/lessons/next', async (route) => {
    order.push('next-start');
    await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'busy' }) });
  });

  await page.goto('/course/readycourse');
  await page.locator('#nextLessonButton').click();
  const sheet = page.locator('.lesson-feedback-sheet');
  await expect(sheet).toBeVisible();
  await expect(sheet.locator('[data-feedback-signal="aligned"]')).toBeFocused();
  await sheet.locator('textarea').fill('  Keep the concrete example  ');
  await sheet.locator('[data-feedback-signal="aligned"]').click();

  await expect.poll(() => order.join(',')).toBe('feedback-start,feedback-end,next-start');
  expect(feedbackPayload).toEqual({
    type: 'lesson-feedback',
    lessonFile: '0001-stabilization-fixture.html',
    signal: 'aligned',
    detail: 'Keep the concrete example',
  });
  await expect(page.locator('.lesson-feedback-layer')).toHaveCount(0);
});

test('dismiss skips persistence but still continues', async ({ page }) => {
  let feedbackPosts = 0;
  let nextPosts = 0;
  await routeActivity(page, async (route) => {
    feedbackPosts += 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });
  await page.route('**/api/courses/readycourse/lessons/next', async (route) => {
    nextPosts += 1;
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'busy' }) });
  });

  await page.goto('/course/readycourse');
  await page.locator('#nextLessonButton').click();
  await expect(page.locator('.lesson-feedback-sheet')).toBeVisible();
  await page.keyboard.press('Escape');

  await expect.poll(() => nextPosts).toBe(1);
  expect(feedbackPosts).toBe(0);
  await expect(page.locator('.lesson-feedback-layer')).toHaveCount(0);
});

test('feedback failure is non-blocking and mobile drawer is closed first', async ({ page, browserGuard }) => {
  browserGuard.allow(/http 500: POST .*\/api\/courses\/readycourse\/activity/);
  browserGuard.allow(/status of (409|500)/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let nextPosts = 0;
  await routeActivity(page, async (route) => {
    await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'write failed' }) });
  });
  await page.route('**/api/courses/readycourse/lessons/next', async (route) => {
    nextPosts += 1;
    await new Promise((resolve) => setTimeout(resolve, 400));
    await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'busy' }) });
  });

  await page.goto('/course/readycourse');
  await page.locator('#mobileContextButton').click();
  await expect(page.locator('#leftPanel')).toHaveClass(/mobile-open/);
  await page.evaluate(() => document.querySelector('#nextLessonButton').click());

  await expect(page.locator('#leftPanel')).not.toHaveClass(/mobile-open/);
  const sheet = page.locator('.lesson-feedback-sheet');
  await expect(sheet).toBeVisible();
  await expect(sheet).toHaveCSS('animation-name', 'none');
  await sheet.locator('[data-feedback-signal="deeper"]').click();

  // 保存失败提示在 next 请求发出前同步展示；409 busy 提示随后会覆盖它，
  // 所以先断言保存失败提示，再等 next 请求完成。
  await expect(page.locator('.toast')).toContainText('反馈暂时未保存');
  await expect.poll(() => nextPosts).toBe(1);
});
