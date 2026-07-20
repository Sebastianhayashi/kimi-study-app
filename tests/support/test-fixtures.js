'use strict';

const base = require('@playwright/test');
const { installBrowserGuards } = require('./browser-guards');

const test = base.test.extend({
  browserGuard: [async ({ page }, use) => {
    const guard = installBrowserGuards(page);
    await use(guard);
    guard.assertClean();
  }, { auto: true }],
});

module.exports = { test, expect: base.expect };
