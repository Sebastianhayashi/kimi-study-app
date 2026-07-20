'use strict';

const { test, expect } = require('../support/test-fixtures');

test('书架加载隔离课程并可进入课程工作区', async ({ page }) => {
  await page.goto('/app');
  const card = page.locator('.course-card').filter({ hasText: 'Ready Course Fixture' }).first();
  await expect(card).toBeVisible();
  await card.click();
  await expect(page).toHaveURL(/\/course\/readycourse$/);
  await expect(page.locator('.course-name')).toHaveText('Ready Course Fixture');
});
