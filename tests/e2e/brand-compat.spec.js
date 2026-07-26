'use strict';

const { test, expect } = require('../support/test-fixtures');

test('legacy notes-panel storage is migrated before app business scripts run', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('kimi-study-notes-panel', 'expanded');
  });
  await page.goto('/app');

  const values = await page.evaluate(() => ({
    legacy: localStorage.getItem('kimi-study-notes-panel'),
    current: localStorage.getItem('lucubro-notes-panel'),
  }));
  expect(values.legacy).toBeNull();
  expect(values.current).toBe('expanded');
});

for (const route of ['/', '/app', '/new-course']) {
  test(`${route} exposes Lucubro without visible Kimi Study product text`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator('body')).toContainText('Lucubro');
    await expect(page.locator('body')).not.toContainText('Kimi Study');
    if (route === '/') {
      await expect(page.locator('.landing-avatar')).toBeVisible();
      await expect(page.locator('.live-dot')).toHaveCount(0);
      await page.evaluate(() => window.scrollTo(0, 1500));
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(1400);
      await page.getByRole('link', { name: /How it works|如何工作|使い方/ }).click();
      await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#how');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.reload();
      await expect.poll(() => page.evaluate(() => Boolean(window.__lucubroLandingLenis))).toBe(false);
    }
  });
}
