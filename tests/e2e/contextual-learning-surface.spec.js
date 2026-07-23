'use strict';
const { test, expect } = require('../support/test-fixtures');

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
  await expect(page.locator('#assistantPanel .panel-title')).toContainText('Kimi');

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
  await expect(page.locator('#assistantPanel .panel-title')).toContainText('Kimi');
  await expect(page.locator('#assistantPanel #chatThread')).toBeVisible();
});
