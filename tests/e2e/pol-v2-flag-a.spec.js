'use strict';

const { test, expect } = require('@playwright/test');
const { resolveE2EPort } = require('../../lib/runtime-config');

const polPort = Number(process.env.LUCUBRO_POL_E2E_PORT || (resolveE2EPort() + 1));
const polBase = `http://127.0.0.1:${polPort}`;

async function loadPolPage(page, pathname) {
  await page.goto(`${polBase}${pathname}`);
}

const artifactInput = (storage = 'local-body') => ({
  taskType: 'zhihu-answer',
  title: storage === 'local-body' ? 'Flag A local artifact' : 'Flag A private artifact',
  audience: 'Product managers',
  contentStorage: storage,
  rubric: [
    { id: 'r_claim', label: 'Central claim', minimum: 'State one falsifiable claim', source: 'user' },
    { id: 'r_evidence', label: 'Evidence', minimum: 'Use source evidence', source: 'user' },
    { id: 'r_action', label: 'Actionability', minimum: 'Give a usable decision rule', source: 'user' },
  ],
});

test('Flag-A remains unreachable on the default flag-off server', async ({ request }) => {
  const page = await request.get('/artifact/new');
  const api = await request.get('/api/artifacts');
  expect(page.status()).toBe(404);
  expect(api.status()).toBe(404);
});

test('Flag-A local artifact route renders real data without a productized editor', async ({ page, request }) => {
  await page.addInitScript(() => localStorage.setItem('lucubro-locale', 'en'));
  const created = await request.post(`${polBase}/api/artifacts`, { data: artifactInput() });
  expect(created.status()).toBe(201);
  const { artifact } = await created.json();

  await loadPolPage(page, `/artifact/${artifact.id}`);
  await expect(page.getByRole('heading', { name: artifact.title })).toBeVisible();
  await expect(page.getByLabel('Current local draft')).toBeVisible();
  await expect(page.getByLabel('Current local draft')).toHaveAttribute('readonly', '');
  await expect(page.getByText('Flag-A provides a safe route and real data only. Autosave and the productized writing workspace are not enabled.')).toBeVisible();
  await expect(page.locator('button', { hasText: /save|critique|next lesson/i })).toHaveCount(0);
  await expect(page.locator('html')).not.toHaveClass(/overflow/);
});

test('Flag-A mobile creation skeleton is localized, keyboard reachable, and structure-only hides body storage', async ({ page, request }) => {
  await page.addInitScript(() => localStorage.setItem('lucubro-locale', 'zh-CN'));
  await page.setViewportSize({ width: 390, height: 844 });
  await loadPolPage(page, '/artifact/new');
  await expect(page.getByRole('heading', { name: '开始一篇知乎回答' })).toBeVisible();
  await page.getByLabel('知乎问题').fill('为什么实验复盘经常混淆相关与因果？');
  await page.getByLabel('目标读者').fill('产品经理');
  const rubric = page.locator('input[name="rubric"]');
  await rubric.nth(0).fill('中心结论明确');
  await rubric.nth(1).fill('关键结论有材料证据');
  await rubric.nth(2).fill('给出可执行的判断规则');
  await page.getByLabel('只保存结构化证据').check();

  const targets = page.locator('input:not([type=radio]), select, button, .artifact-nav a, label.artifact-radio');
  for (let index = 0; index < await targets.count(); index += 1) {
    const target = targets.nth(index);
    if (!(await target.isVisible())) continue;
    const box = await target.boundingBox();
    expect(box && box.height, `target ${index} height`).toBeGreaterThanOrEqual(44);
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  await expect(page.getByRole('button', { name: '创建作品' })).toBeEnabled();
  const created = await request.post(`${polBase}/api/artifacts`, { data: artifactInput('structure-only') });
  expect(created.status()).toBe(201);
  const { artifact } = await created.json();
  await loadPolPage(page, `/artifact/${artifact.id}`);
  await expect(page.getByText('此作品不保存正文。仅在请求 critique 时临时粘贴片段。')).toBeVisible();
  await expect(page.getByLabel('当前本地草稿')).toBeHidden();
});

test('Flag-A exposes error recovery and preserves the legacy course escape hatch', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('lucubro-locale', 'zh-CN'));
  await loadPolPage(page, '/artifact/a_1234567890abcdef');
  await expect(page.getByRole('heading', { name: '作品不可用' })).toBeVisible();
  await expect(page.getByRole('button', { name: '重试' })).toBeVisible();

  await page.goto(`${polBase}/app?view=courses`);
  await expect(page.getByRole('heading', { name: /课程|My courses/i }).first()).toBeVisible();
  await expect(page.locator('[data-artifact-home], #artifactHome')).toHaveCount(0);
});
