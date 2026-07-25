'use strict';
const { test, expect } = require('../support/test-fixtures');
const { writeSecondLesson, removeSecondLesson } = require('../support/generation-controller');

async function waitForLessonFrame(page) {
  const iframe = page.locator('#lessonFrame');
  await expect(iframe).toBeVisible();
  await expect.poll(async () => {
    const handle = await iframe.elementHandle();
    const frame = handle ? await handle.contentFrame() : null;
    return frame?.url() || '';
  }, { timeout: 10_000 }).toMatch(/\/api\/courses\/readycourse\/lessons\//);
  const handle = await iframe.elementHandle();
  const frame = handle ? await handle.contentFrame() : null;
  expect(frame).toBeTruthy();
  return frame;
}

test.beforeEach(async ({ request }) => {
  const response = await request.put('/api/courses/readycourse/study-surface?lesson=0001-stabilization-fixture.html', {
    data: { version: 1, cards: [], strokes: [] },
  });
  expect(response.ok()).toBe(true);
});

async function selectFirstText(page) {
  const frame = await waitForLessonFrame(page);
  await frame.evaluate(() => {
    const target = document.querySelector('p, h1, h2');
    const node = target && [...target.childNodes]
      .find((item) => item.nodeType === Node.TEXT_NODE && item.nodeValue.trim());
    if (!node) throw new Error('fixture has no selectable text');
    const range = document.createRange();
    range.setStart(node, 0);
    range.setEnd(node, Math.min(node.nodeValue.length, 28));
    const selection = getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  });
  return frame;
}

test('selection actions stay contextual, center scratch opens, and Tutor remains intact', async ({ page }) => {
  await page.goto('/course/readycourse');
  await expect(page.locator('#assistantPanel')).toBeVisible();
  await expect(page.locator('#assistantPanel .panel-title')).toContainText('Lucubro');

  await selectFirstText(page);

  const actions = page.frameLocator('#lessonFrame').locator('.ks-context-actions');
  await expect(actions).toBeVisible();
  await expect(actions.locator('button:visible')).toHaveCount(3);
  await actions.getByRole('button', { name: '放到草稿' }).click();

  await expect(page.locator('.ks-study-surface')).toBeVisible();
  await expect(page.locator('.ks-study-card')).toHaveCount(1);
  await expect(page.locator('#assistantPanel')).toBeVisible();
  await expect(page.locator('#assistantPanel .composer')).toBeVisible();
});

test('a delayed learning-action response cannot detach or replace the pressed button', async ({ page }) => {
  await page.route('**/api/courses/readycourse/learning-actions', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 180));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        actions: [
          { id: 'explain', label: '解释' },
          { id: 'note', label: '记笔记' },
          { id: 'scratch', label: '放到草稿' },
        ],
      }),
    });
  });

  await page.goto('/course/readycourse');
  const frame = await selectFirstText(page);
  const actions = page.frameLocator('#lessonFrame').locator('.ks-context-actions');
  const scratch = actions.getByRole('button', { name: '放到草稿' });
  await expect(scratch).toBeVisible();

  const handle = await scratch.elementHandle();
  expect(handle).toBeTruthy();
  await frame.waitForTimeout(240);
  expect(await handle.evaluate((element) => element.isConnected)).toBe(true);
  expect(await handle.evaluate((element) => (
    element === document.querySelector('.ks-context-actions button[data-action="scratch"]')
  ))).toBe(true);

  await scratch.click();
  await expect(page.locator('.ks-study-surface')).toBeVisible();
  await expect(page.locator('.ks-study-card')).toHaveCount(1);
});

test('the fallback action remains usable when the backend responds during pointer activation', async ({ page }) => {
  await page.route('**/api/courses/readycourse/learning-actions', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 70));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        actions: [
          { id: 'explain', label: '解释' },
          { id: 'note', label: '记笔记' },
          { id: 'scratch', label: '放到草稿' },
        ],
      }),
    });
  });

  await page.goto('/course/readycourse');
  const frame = await selectFirstText(page);
  const scratch = page.frameLocator('#lessonFrame').getByRole('button', { name: '放到草稿' });
  await expect(scratch).toBeVisible();

  await scratch.dispatchEvent('pointerdown', { pointerType: 'mouse', button: 0 });
  await frame.waitForTimeout(120);
  await scratch.dispatchEvent('click');

  await expect(page.locator('.ks-study-surface')).toBeVisible();
  await expect(page.locator('.ks-study-card')).toHaveCount(1);
});

test('cross-lesson notes index is in the left rail, never in the Tutor panel', async ({ page }) => {
  await page.goto('/course/readycourse');
  const notesTab = page.locator('.left-tab', { hasText: '笔记' });
  await expect(notesTab).toBeVisible();
  await notesTab.click();
  await expect(page.locator('#left-notes')).toBeVisible();
  await expect(page.locator('#assistantPanel .panel-title')).toContainText('Lucubro');
  await expect(page.locator('#assistantPanel #chatThread')).toBeVisible();
});

async function currentLessonFile(page) {
  const iframe = page.locator('#lessonFrame');
  const handle = await iframe.elementHandle();
  const frame = handle ? await handle.contentFrame() : null;
  const url = new URL(frame?.url() || 'http://invalid/');
  return decodeURIComponent(url.pathname.split('/').pop() || '');
}

async function switchToLesson(page, target) {
  const before = await currentLessonFile(page);
  const lessonsView = page.locator('#left-lessons');
  if (!await lessonsView.isVisible()) {
    const lessonsTab = page.locator('[data-left-tab="lessons"]');
    await expect(lessonsTab).toBeVisible();
    await lessonsTab.click();
    await expect(lessonsView).toBeVisible();
  }
  const items = lessonsView.locator('.lesson-item');
  const item = typeof target === 'number'
    ? items.nth(target)
    : items.filter({ hasText: target });
  await expect(item).toBeVisible();
  await item.click();
  await expect.poll(() => currentLessonFile(page), { timeout: 10_000 }).not.toBe(before);
  return currentLessonFile(page);
}

async function addSelectionToScratch(page) {
  await selectFirstText(page);
  const scratch = page.frameLocator('#lessonFrame').getByRole('button', { name: '放到草稿' });
  await expect(scratch).toBeVisible();
  await scratch.click();
  await expect(page.locator('.ks-study-surface')).toBeVisible();
  await expect(page.locator('.ks-study-card')).toHaveCount(1);
}

test('debounced scratch saves remain bound to the lesson where they were created', async ({ page }) => {
  const secondFilename = '0002-contextual-save-race.html';
  writeSecondLesson('readycourse', { filename: secondFilename, title: '草稿切课保存测试' });
  const stored = new Map();
  await page.route('**/api/courses/readycourse/study-surface?lesson=*', async (route) => {
    const request = route.request();
    const lesson = new URL(request.url()).searchParams.get('lesson');
    if (request.method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(stored.get(lesson) || { version: 1, cards: [], strokes: [] }),
      });
    }
    if (request.method() === 'PUT') {
      stored.set(lesson, request.postDataJSON());
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, lesson }) });
    }
    return route.continue();
  });

  try {
    await page.goto('/course/readycourse');
    await waitForLessonFrame(page);
    const lessonA = await currentLessonFile(page);
    const lessonB = await switchToLesson(page, 1);

    await addSelectionToScratch(page);
    await expect.poll(() => stored.get(lessonB)?.cards?.length || 0).toBe(1);

    await switchToLesson(page, 0);
    await addSelectionToScratch(page);
    await switchToLesson(page, 1);

    await expect.poll(() => stored.get(lessonA)?.cards?.length || 0).toBe(1);
    await page.waitForTimeout(400);
    expect(stored.get(lessonB)?.cards?.length).toBe(1);

    await expect(page.locator('.ks-study-reopen')).toBeVisible();
    await page.locator('.ks-study-reopen').click();
    await expect(page.locator('.ks-study-card')).toHaveCount(1);

    await switchToLesson(page, 0);
    await expect(page.locator('.ks-study-reopen')).toBeVisible();
    await page.locator('.ks-study-reopen').click();
    await expect(page.locator('.ks-study-card')).toHaveCount(1);
  } finally {
    removeSecondLesson('readycourse', secondFilename);
  }
});

test('scratch save failures stay visible and retry the same lesson snapshot', async ({ page, browserGuard }) => {
  browserGuard.allow(/^http 503: PUT .*\/study-surface\?lesson=/);
  browserGuard.allow(/^console\.error: Failed to load resource: the server responded with a status of 503/);
  let putCalls = 0;
  await page.route('**/api/courses/readycourse/study-surface?lesson=*', async (route) => {
    const request = route.request();
    if (request.method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ version: 1, cards: [], strokes: [] }),
      });
    }
    if (request.method() === 'PUT') {
      putCalls += 1;
      if (putCalls === 1) {
        return route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'fixture save failure' }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    }
    return route.continue();
  });

  await page.goto('/course/readycourse');
  await addSelectionToScratch(page);
  await expect(page.locator('.ks-study-save-status')).toContainText('保存失败');
  const retry = page.getByRole('button', { name: '重试保存学习草稿' });
  await expect(retry).toBeVisible();
  await retry.click();
  await expect.poll(() => putCalls).toBe(2);
  await expect(page.locator('.ks-study-save-status')).toContainText('已保存');
  await expect(page.locator('.ks-study-card')).toHaveCount(1);
});
