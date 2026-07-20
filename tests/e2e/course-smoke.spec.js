'use strict';

const { test, expect } = require('../support/test-fixtures');

test('课程外壳与课节 iframe 一起加载', async ({ page }) => {
  await page.goto('/course/readycourse');
  await expect(page.locator('.course-name')).toHaveText('Ready Course Fixture');
  await expect(page.locator('.current-lesson')).toContainText('Lesson 1');

  const frame = page.frameLocator('#lessonFrame');
  await expect(frame.getByRole('heading', { name: '稳定化测试课节' })).toBeVisible();
  await expect(frame.locator('[data-kimi-activity="activity-1"]')).toBeVisible();
  await expect(frame.locator('html')).toHaveAttribute('data-kimi-source-viewer-bound', 'true');
});
