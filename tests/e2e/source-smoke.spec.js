'use strict';

const { test, expect } = require('../support/test-fixtures');

test('来源清单只暴露允许预览的材料', async ({ request }) => {
  const response = await request.get('/api/courses/readycourse/sources');
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.sources.some((item) => item.path === 'book.pdf')).toBeTruthy();
  expect(body.sources.some((item) => item.path === 'sources/sample.txt')).toBeTruthy();
  expect(body.sources.some((item) => /assessment|learning-progress|MISSION|RESOURCES/i.test(item.path))).toBeFalsy();
});

test('原文阅读器打开文本资源并无损返回课节', async ({ page }) => {
  await page.goto('/course/readycourse');
  const frame = page.frameLocator('#lessonFrame');
  await expect(frame.getByRole('heading', { name: '稳定化测试课节' })).toBeVisible();

  const materials = page.locator('.ks-materials-trigger');
  await expect(materials).toBeVisible();
  await materials.click();
  const launch = page.locator('.ks-source-launch');
  await expect(launch).toBeVisible();
  await launch.click();
  const viewer = page.locator('.ks-source-viewer');
  await expect(viewer).toBeVisible();
  await expect(viewer).toHaveClass(/is-ready/);

  await viewer.locator('.ks-source-select').selectOption('sources/sample.txt');
  await expect(viewer.locator('.ks-source-document')).toContainText('Lucubro text fixture');
  await expect(viewer.locator('.ks-source-status')).toContainText('sample.txt');

  await viewer.locator('.ks-source-close').click();
  await expect(viewer).toBeHidden();
  await expect(frame.getByRole('heading', { name: '稳定化测试课节' })).toBeVisible();
  await expect(page.locator('.current-lesson')).toContainText('Lesson 1');
});
