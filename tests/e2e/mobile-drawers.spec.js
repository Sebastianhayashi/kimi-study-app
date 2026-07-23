'use strict';

const { test, expect } = require('../support/test-fixtures');

test.use({ viewport: { width: 390, height: 844 } });

test('mobile drawers overlay the lesson and the next action stays compact', async ({ page }) => {
  await page.goto('/course/readycourse');

  const course = page.locator('#coursePanel');
  const left = page.locator('#leftPanel');
  const assistant = page.locator('#assistantPanel');
  const scrim = page.locator('#mobileDrawerScrim');
  const next = page.locator('#nextLessonButton');

  await expect(course).toBeVisible();
  await expect(page.frameLocator('#lessonFrame').getByRole('heading', { name: '稳定化测试课节' })).toBeVisible();

  const nextMetrics = await next.evaluate((element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
      writingMode: style.writingMode,
      labelVisible: getComputedStyle(element.querySelector('.next-lesson-label')).position !== 'absolute',
    };
  });
  expect(nextMetrics.width).toBeGreaterThanOrEqual(43);
  expect(nextMetrics.height).toBeGreaterThanOrEqual(43);
  expect(nextMetrics.writingMode).toBe('horizontal-tb');
  expect(nextMetrics.labelVisible).toBe(false);
  await expect(next).toHaveAttribute('aria-label', '生成下一课');

  await page.locator('#mobileContextButton').click();
  await expect(left).toHaveClass(/mobile-open/);
  await expect(assistant).not.toHaveClass(/mobile-open/);
  await expect(scrim).toBeVisible();
  await expect(course).toBeVisible();
  const leftBox = await left.boundingBox();
  const topbarBox = await page.locator('.topbar').boundingBox();
  expect(leftBox.y).toBeGreaterThanOrEqual(topbarBox.height);
  expect(leftBox.width).toBeLessThan(390);

  await scrim.click({ position: { x: 385, y: 200 } });
  await expect(left).not.toHaveClass(/mobile-open/);
  await expect(scrim).toBeHidden();
  await expect(page.locator('#mobileContextButton')).toBeFocused();

  await page.locator('#mobileContextButton').click();
  await page.locator('#mobileAssistantButton').click();
  await expect(left).not.toHaveClass(/mobile-open/);
  await expect(assistant).toHaveClass(/mobile-open/);
  await expect(course).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(assistant).not.toHaveClass(/mobile-open/);
  await expect(scrim).toBeHidden();
  await expect(page.locator('#mobileAssistantButton')).toBeFocused();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
