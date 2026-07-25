'use strict';

const base = require('@playwright/test');
const { installBrowserGuards } = require('./browser-guards');

const test = base.test.extend({
  localePreference: [async ({ page }, use) => {
    await page.addInitScript(() => {
      localStorage.setItem('lucubro-locale', 'zh-CN');
    });
    await use();
  }, { auto: true }],
  browserGuard: [async ({ page }, use) => {
    const guard = installBrowserGuards(page);
    await use(guard);
    guard.assertClean();
  }, { auto: true }],
});

module.exports = { test, expect: base.expect };
