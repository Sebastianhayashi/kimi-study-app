'use strict';

function isIgnoredConsole(message) {
  const text = message.text();
  return message.type() === 'warning' && /favicon|source map/i.test(text);
}

function isIgnoredRequestFailure(request) {
  const failure = request.failure();
  return /ERR_ABORTED|NS_BINDING_ABORTED|cancelled/i.test(failure?.errorText || '');
}

function installBrowserGuards(page) {
  const errors = [];

  page.on('pageerror', (error) => {
    errors.push(`pageerror: ${error.message}`);
  });
  page.on('console', (message) => {
    if (message.type() === 'error' && !isIgnoredConsole(message)) {
      errors.push(`console.error: ${message.text()}`);
    }
  });
  page.on('requestfailed', (request) => {
    if (!isIgnoredRequestFailure(request)) {
      errors.push(`requestfailed: ${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`);
    }
  });
  page.on('response', (response) => {
    const status = response.status();
    if (status >= 500) errors.push(`http ${status}: ${response.request().method()} ${response.url()}`);
  });

  return {
    errors,
    assertClean() {
      if (errors.length) throw new Error(`Unexpected browser failures:\n${errors.join('\n')}`);
    },
  };
}

module.exports = { installBrowserGuards };
