'use strict';

const { test, expect } = require('../support/test-fixtures');

test('生成中的课程显示真实生成覆盖层', async ({ page }) => {
  await page.goto('/course/generatingcourse');
  const preview = page.locator('.ks-generation-preview');
  await expect(preview).toBeVisible();
  await expect(preview.locator('.ks-generation-message')).toContainText(/候选题|创建课程|生成/);
  await expect(preview.locator('.ks-generation-progress')).toHaveAttribute('aria-valuenow', /\d+/);
});

test('僵死任务进入失败状态而不是无限播放', async ({ page }) => {
  await page.goto('/course/interruptedcourse');
  const preview = page.locator('.ks-generation-preview');
  await expect(preview).toBeVisible();
  await expect(preview).toHaveClass(/is-error/);
  await expect(preview.locator('.ks-generation-message')).toContainText(/中断|重试|没有完成/);
  await expect(preview.locator('.ks-generation-scan')).toHaveCSS('display', 'none');
});

test('明确失败任务停止动画并保留错误状态', async ({ page }) => {
  await page.goto('/course/failedcourse');
  const preview = page.locator('.ks-generation-preview');
  await expect(preview).toBeVisible();
  await expect(preview).toHaveClass(/is-error/);
  await expect(preview.locator('.ks-generation-scan')).toHaveCSS('display', 'none');
});
