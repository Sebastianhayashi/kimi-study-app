'use strict';

// Regression: a fast 422 after upload must return the user to the upload
// stage with the error visible instead of leaving the reading stage stuck
// (queued stage transition raced the error transition).
const { test, expect } = require('@playwright/test');

test('无效 EPUB 上传后回到上传阶段并显示原因', async ({ page }) => {
  await page.goto('/new-course');
  await expect(page.locator('[data-stage="upload"]')).toHaveClass(/is-visible/);

  await page.locator('#fileInput').setInputFiles({
    name: 'broken.epub',
    mimeType: 'application/epub+zip',
    buffer: Buffer.from('not a real epub archive'),
  });
  await page.locator('#uploadContinue').click();

  await expect(page.locator('[data-stage="upload"]')).toHaveClass(/is-visible/, { timeout: 10000 });
  await expect(page.locator('#uploadError')).toBeVisible();
  await expect(page.locator('#uploadError')).toContainText(/EPUB|上传|检查/);
  await expect(page.locator('[data-stage="reading"]')).not.toHaveClass(/is-visible/);
});
