'use strict';

const { test, expect } = require('../support/test-fixtures');

async function visibleControlNames(page) {
  return page.locator('button:visible, a[href]:visible').evaluateAll((controls) => controls.map((control) => ({
    tag: control.tagName,
    id: control.id,
    className: control.className,
    name: control.getAttribute('aria-label') || control.getAttribute('title') || control.innerText.trim(),
  })).filter((control) => !control.name));
}

async function mockShelfOnboardingHealth(page) {
  await page.route(/\/api\/courses\/[^/]+\/onboarding(?:\?.*)?$/, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: '{}',
  }));
}

test('landing stays static-first and reveals later sections once', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.hero h1')).toBeVisible();
  await expect(page.locator('.hero-actions .button-primary')).toBeVisible();
  await expect(page.locator('[data-sample-journey]')).toHaveAttribute('href', '/app?sample=1');
  await expect(page.locator('html')).toHaveClass(/motion-ready/);
  const target = page.locator('.story [data-reveal]').first();
  await target.scrollIntoViewIfNeeded();
  await expect(target).toHaveClass(/is-visible/);
  await page.evaluate(() => scrollTo(0, 0));
  await target.scrollIntoViewIfNeeded();
  await expect(target).toHaveClass(/is-visible/);
});

test('reduced motion keeps landing content visible and native', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('html')).not.toHaveClass(/motion-ready/);
  await expect(page.locator('[data-reveal]').first()).toBeVisible();
  const state = await page.locator('[data-reveal]').first().evaluate((node) => ({
    transform: getComputedStyle(node).transform,
    opacity: getComputedStyle(node).opacity,
    lenis: Boolean(window.__lucubroLandingLenis),
  }));
  expect(state.transform).toBe('none');
  expect(state.opacity).toBe('1');
  expect(state.lenis).toBe(false);
});

test('sample journey resolves an existing ready course without a fixed id', async ({ page }) => {
  await mockShelfOnboardingHealth(page);
  await page.goto('/app?sample=1');
  const sample = page.locator('#sampleJourney');
  await expect(sample).toBeVisible();
  const action = page.locator('#sampleJourneyAction');
  await expect(action).toHaveAttribute('data-course-id', /.+/);
  const href = await action.getAttribute('href');
  expect(href).toMatch(/^\/course\//);
  expect(href).not.toContain('undefined');

  const language = page.locator('select[aria-label="Language"]');
  const expected = {
    en: ['Sample journey', 'See one finished learning workspace', 'Open sample lesson'],
    'zh-CN': ['示例旅程', '查看一个完整的学习工作区', '打开示例课节'],
    ja: ['サンプルの流れ', '完成済みの学習ワークスペースを見る', 'サンプルレッスンを開く'],
  };
  for (const [locale, copy] of Object.entries(expected)) {
    await language.selectOption(locale);
    await expect(sample.locator('.sample-journey-kicker')).toHaveText(copy[0]);
    await expect(sample.locator('h1')).toHaveText(copy[1]);
    await expect(action).toContainText(copy[2]);
  }
});

test('current learning strip updates from real practice outcomes', async ({ page }) => {
  await page.goto('/course/readycourse');
  const strip = page.locator('#currentLearningStrip');
  await expect(strip).toBeVisible();
  await expect(page.locator('#currentLearningAction')).toBeEnabled();
  await expect(page.locator('#currentLearningResume')).toContainText(/1/);

  const frame = page.frameLocator('#lessonFrame');
  await frame.locator('input[value="b"]').check();
  const retryRefresh = page.waitForResponse((response) => response.url().endsWith('/progress') && response.status() === 200, { timeout: 3_000 });
  await frame.getByRole('button', { name: /检查答案|Check answer|答えを確認/ }).click();
  await expect(page.locator('#currentLearningEvidence')).toContainText(/再试|another attempt|もう一度/);
  await retryRefresh;
  await expect(page.locator('#currentLearningEvidence')).toContainText(/再试|another attempt|もう一度/);

  await frame.locator('input[value="a"]').check();
  await frame.getByRole('button', { name: /检查答案|Check answer|答えを確認/ }).click();
  await expect(page.locator('#currentLearningEvidence')).toContainText(/完成本课练习|completed in this lesson|練習を完了/);
  await expect(strip).toHaveAttribute('role', 'status');

  const language = page.locator('select[aria-label="Language"]');
  const expectedLabels = {
    en: ['Current objective', 'Latest evidence', 'Resume point', 'Continue current lesson'],
    'zh-CN': ['当前目标', '最近证据', '继续位置', '继续当前课节'],
    ja: ['現在の目標', '最新の学習証拠', '再開位置', '現在のレッスンを続ける'],
  };
  for (const [locale, copy] of Object.entries(expectedLabels)) {
    await language.selectOption(locale);
    await expect(strip.locator('.current-learning-label')).toHaveText(copy[0]);
    await expect(strip.locator('dt').nth(0)).toHaveText(copy[1]);
    await expect(strip.locator('dt').nth(1)).toHaveText(copy[2]);
    await expect(page.locator('#currentLearningAction')).toHaveText(copy[3]);
  }
});

test('five critical routes expose named controls, live status, and only real account targets', async ({ page }) => {
  await mockShelfOnboardingHealth(page);
  const routes = [
    ['/', '#landingToast'],
    ['/app', '#toast'],
    ['/notes', '.notes-summary'],
    ['/new-course', '#uploadTransfer'],
    ['/course/readycourse', '#currentLearningStrip'],
  ];
  for (const [route, statusSelector] of routes) {
    await page.goto(route);
    expect(await visibleControlNames(page), `${route} has unnamed visible controls`).toEqual([]);
    await expect(page.locator('.landing-avatar, .appbar-avatar')).toHaveCount(0);
    await expect(page.locator(statusSelector)).toHaveCount(1);
  }
});

test('current learning strip responds to the course panel width at split-pane desktop sizes', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 750 });
  await page.goto('/course/readycourse');
  const layout = await page.locator('#currentLearningStrip').evaluate((node) => ({
    stripWidth: node.getBoundingClientRect().width,
    objectiveWidth: node.querySelector('.current-learning-objective').getBoundingClientRect().width,
    factsWidth: node.querySelector('.current-learning-facts').getBoundingClientRect().width,
    actionWidth: node.querySelector('.current-learning-action').getBoundingClientRect().width,
  }));
  expect(layout.stripWidth).toBeLessThan(600);
  expect(layout.objectiveWidth).toBeGreaterThan(180);
  expect(layout.factsWidth).toBeGreaterThan(220);
  expect(layout.actionWidth).toBeGreaterThanOrEqual(150);
});

test('current learning strip remains usable at 390px in dark mode', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.goto('/course/readycourse');
  const strip = page.locator('#currentLearningStrip');
  await expect(strip).toBeVisible();
  const action = page.locator('#currentLearningAction');
  const box = await action.boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(await strip.evaluate((node) => getComputedStyle(node).animationName)).toBe('none');
});
