'use strict';

const { test, expect } = require('../support/test-fixtures');

test('书架加载隔离课程并可进入课程工作区', async ({ page }) => {
  await page.goto('/app');
  const continueCard = page.locator('.ks-continue-card');
  await expect(continueCard.locator('.ks-continue-title')).toHaveText('Ready Course Fixture');
  await continueCard.locator('.ks-continue-action').click();
  await expect(page).toHaveURL(/\/course\/readycourse$/);
  await expect(page.locator('.course-name')).toHaveText('Ready Course Fixture');
});
