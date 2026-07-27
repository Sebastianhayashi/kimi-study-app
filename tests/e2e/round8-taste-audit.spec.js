'use strict';

const { test, expect } = require('../support/test-fixtures');

async function useEnglish(page) {
  await page.evaluate(() => window.LucubroI18n?.setLocale('en'));
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
}

test('small-phone library keeps every filter visible and courses in one readable column', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route(/\/api\/courses\/[^/]+\/onboarding(?:\?.*)?$/, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: '{}',
  }));
  await page.goto('/app');
  await useEnglish(page);

  const tabs = page.locator('.tab:visible');
  await expect(tabs).toHaveCount(4);
  const layout = await page.locator('.tabs').evaluate((node) => ({
    columns: getComputedStyle(node).gridTemplateColumns,
    viewport: innerWidth,
    tabs: [...node.querySelectorAll('.tab')].map((tab) => {
      const rect = tab.getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: rect.width, height: rect.height };
    }),
  }));
  expect(layout.columns.trim().split(/\s+/)).toHaveLength(2);
  for (const tab of layout.tabs) {
    expect(tab.left).toBeGreaterThanOrEqual(0);
    expect(tab.right).toBeLessThanOrEqual(layout.viewport);
    expect(tab.height).toBeGreaterThanOrEqual(44);
  }

  const grid = page.locator('.course-grid');
  await expect(grid).toBeVisible();
  const gridColumns = await grid.evaluate((node) => getComputedStyle(node).gridTemplateColumns.trim().split(/\s+/));
  expect(gridColumns).toHaveLength(1);
  const cards = page.locator('.course-grid .course-card:visible');
  expect(await cards.count()).toBeGreaterThan(1);
  const first = await cards.nth(0).boundingBox();
  const second = await cards.nth(1).boundingBox();
  expect(first).not.toBeNull();
  expect(second).not.toBeNull();
  expect(Math.abs(first.x - second.x)).toBeLessThan(1);
  expect(second.y).toBeGreaterThan(first.y + first.height - 1);
});

test('notes heatmap uses one roving tab stop with 24px cells and grid keyboard movement', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/notes');
  await useEnglish(page);

  const days = page.locator('.activity-day');
  expect(await days.count()).toBeGreaterThan(350);
  await expect(page.locator('.activity-day[tabindex="0"]')).toHaveCount(1);
  await expect(page.locator('#activityScrollHint')).toBeVisible();
  await expect(page.locator('#activityScrollHint')).toContainText('Scroll horizontally');

  const activeTabStop = page.locator('.activity-day[tabindex="0"]');
  const box = await activeTabStop.boundingBox();
  expect(box).not.toBeNull();
  expect(box.width).toBeGreaterThanOrEqual(24);
  expect(box.height).toBeGreaterThanOrEqual(24);

  const before = await activeTabStop.getAttribute('data-day');
  await activeTabStop.press('ArrowLeft');
  const focused = page.locator('.activity-day:focus');
  await expect(focused).toHaveCount(1);
  const after = await focused.getAttribute('data-day');
  expect(after).not.toBe(before);
  await expect(page.locator('.activity-day[tabindex="0"]')).toHaveCount(1);
  await focused.press('Home');
  await expect(page.locator('.activity-day:focus')).toHaveCount(1);
  await page.locator('.activity-day:focus').click();
  await expect(page.locator('.activity-day:focus')).toHaveAttribute('aria-selected', 'true');
});

test('mobile course creation keeps all three localized step labels visible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/new-course');
  await useEnglish(page);

  const labels = page.locator('.top-step-label');
  await expect(labels).toHaveCount(3);
  await expect(labels.nth(0)).toHaveText('Upload material');
  await expect(labels.nth(1)).toHaveText('Set goal');
  await expect(labels.nth(2)).toHaveText('Create course');
  for (let index = 0; index < 3; index += 1) {
    await expect(labels.nth(index)).toBeVisible();
    const rect = await labels.nth(index).boundingBox();
    expect(rect).not.toBeNull();
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.width).toBeLessThanOrEqual(390);
  }
});

test('mobile course opens a real source through the visible materials control', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/course/readycourse');
  await useEnglish(page);

  const materials = page.locator('.ks-materials-trigger');
  const notes = page.locator('.kn-notes-toggle');
  await expect(materials).toBeVisible();
  await expect(notes).toBeVisible();
  for (const control of [materials, notes]) {
    const rect = await control.boundingBox();
    expect(rect).not.toBeNull();
    expect(rect.width).toBeGreaterThanOrEqual(44);
    expect(rect.height).toBeGreaterThanOrEqual(44);
  }

  await materials.click();
  const source = page.locator('.ks-source-launch');
  await expect(source).toBeVisible();
  await expect(source.locator('.lesson-resource-tool-label')).toBeVisible();
  await expect(source).toContainText('Original material');
  const sourceBox = await source.boundingBox();
  expect(sourceBox).not.toBeNull();
  expect(sourceBox.height).toBeGreaterThanOrEqual(44);
  await source.click();
  const viewer = page.locator('.ks-source-viewer');
  await expect(viewer).toBeVisible();
  await expect(viewer).toHaveClass(/is-ready/);
  await viewer.locator('.ks-source-close').click();
  await expect(viewer).toBeHidden();
});

test('paper reader is default and mobile dark reader persists with localized activity surfaces', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('lucubro-locale', 'en'));
  await page.goto('/course/readycourse');
  await page.evaluate(() => {
    localStorage.removeItem('lucubro:reader-theme');
  });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  const readerButton = page.locator('#readerThemeButton');
  await expect(readerButton).toHaveAttribute('aria-pressed', 'false');
  await expect(readerButton).toHaveAttribute('aria-label', 'Use dark reading theme');
  expect(await page.evaluate(() => localStorage.getItem('lucubro:reader-theme'))).toBeNull();

  const more = page.locator('.ks-course-more-trigger');
  const moreBox = await more.boundingBox();
  expect(moreBox).not.toBeNull();
  expect(moreBox.width).toBeGreaterThanOrEqual(44);
  expect(moreBox.height).toBeGreaterThanOrEqual(44);
  await more.click();
  const themeItem = page.locator('[data-action="reader-theme"]');
  await expect(themeItem).toBeVisible();
  await expect(themeItem).toContainText('Use dark reading theme');
  await themeItem.click();

  await expect(readerButton).toHaveAttribute('aria-pressed', 'true');
  await expect(readerButton).toHaveAttribute('aria-label', 'Use paper reading theme');
  expect(await page.evaluate(() => localStorage.getItem('lucubro:reader-theme'))).toBe('dark');
  const frame = page.frameLocator('#lessonFrame');
  await expect(frame.locator('html')).toHaveClass(/ks-reader-dark/);
  const activityStyle = await frame.locator('.kimi-activity').evaluate((node) => ({
    background: getComputedStyle(node).backgroundColor,
    color: getComputedStyle(node).color,
    border: getComputedStyle(node).borderColor,
  }));
  expect(activityStyle.background).toBe('rgb(32, 33, 36)');
  expect(activityStyle.color).toBe('rgb(232, 234, 237)');
  expect(activityStyle.border).toBe('rgb(60, 64, 67)');

  await page.reload();
  await expect(readerButton).toHaveAttribute('aria-pressed', 'true');
  await expect(frame.locator('html')).toHaveClass(/ks-reader-dark/);
});
