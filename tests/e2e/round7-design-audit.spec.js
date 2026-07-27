'use strict';

const { test, expect } = require('../support/test-fixtures');

const json = (route, body, status = 200) => route.fulfill({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
});

test('route metadata follows the requested locale on all five product routes', async ({ page }) => {
  await page.route(/\/api\/courses\/[^/]+\/onboarding(?:\?.*)?$/, (route) => json(route, {}));
  const routes = [
    ['/?lang=ja', 'Lucubro | 目標に沿った学習コース'],
    ['/app?lang=ja', 'マイコース | Lucubro'],
    ['/notes?lang=ja', 'ノート | Lucubro'],
    ['/new-course?lang=ja', 'コースを作成 | Lucubro'],
    ['/course/readycourse?lang=ja', '学習ワークスペース | Lucubro'],
  ];
  for (const [route, title] of routes) {
    await page.goto(route);
    await expect(page).toHaveTitle(title);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /[ぁ-んァ-ン一-龯]/);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /[ぁ-んァ-ン一-龯]/);
    await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', /[ぁ-んァ-ン一-龯]/);
  }
});

test('stalled course cards expose retry and confirmed delete without server changes', async ({ page }) => {
  let retried = false;
  let deleted = false;
  const now = Date.now();
  const courses = () => [
    {
      id: 'stalledretry', title: 'Retry course', cover: null, ext: 'PDF', lessons: 0,
      lessonFiles: [], stage: 'queued', onboardingState: null,
      updated: retried ? Date.now() : now - 11 * 60 * 1000,
    },
    ...(!deleted ? [{
      id: 'stalleddelete', title: 'Delete course', cover: null, ext: 'TXT', lessons: 0,
      lessonFiles: [], stage: 'failed', onboardingState: null, updated: now,
    }] : []),
  ];

  await page.route(/\/api\/courses(?:\?.*)?$/, (route) => json(route, courses()));
  await page.route('**/api/courses/stalledretry/onboarding', (route) => {
    if (retried) return json(route, { state: 'generating' });
    return json(route, { error: 'not found' }, 404);
  });
  await page.route('**/api/courses/stalledretry/retry', (route) => {
    retried = true;
    return json(route, { ok: true }, 202);
  });
  await page.route('**/api/courses/stalleddelete', (route) => {
    if (route.request().method() !== 'DELETE') return route.continue();
    deleted = true;
    return json(route, { ok: true });
  });
  page.on('dialog', (dialog) => dialog.accept());

  await page.goto('/app?lang=en');

  const retryCard = page.locator('[data-course-id="stalledretry"]');
  await expect(retryCard).toHaveClass(/is-stalled/);
  await expect(retryCard).toContainText('Creation stalled');
  await retryCard.getByRole('button', { name: 'Retry' }).click();
  await expect.poll(() => retried).toBe(true);
  await expect(retryCard).not.toHaveClass(/is-stalled/);
  await expect(retryCard).toContainText('Creating');

  const deleteCard = page.locator('[data-course-id="stalleddelete"]');
  await expect(deleteCard).toHaveClass(/is-stalled/);
  await deleteCard.getByRole('button', { name: 'Delete' }).click();
  await expect.poll(() => deleted).toBe(true);
  await expect(deleteCard).toHaveCount(0);
});

test('mobile landing retains app navigation and disabled primary actions look muted', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?lang=en');
  const menu = page.locator('.mobile-nav');
  await expect(menu).toBeVisible();
  await menu.locator('summary').click();
  await expect(menu.getByRole('link', { name: 'My courses' })).toBeVisible();
  await expect(menu.getByRole('link', { name: 'Notes' })).toBeVisible();

  await page.goto('/new-course?lang=en');
  const disabled = page.locator('.primary-button:disabled').first();
  await expect(disabled).toBeVisible();
  const styles = await disabled.evaluate((node) => {
    const css = getComputedStyle(node);
    return { color: css.color, background: css.backgroundColor, opacity: css.opacity };
  });
  expect(styles.opacity).toBe('1');
  expect(styles.color).not.toBe('rgb(255, 255, 255)');
  expect(styles.background).not.toBe('rgb(11, 87, 208)');
});
