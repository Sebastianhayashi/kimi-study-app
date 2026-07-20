'use strict';

function isIgnoredConsole(message) {
  const text = message.text();
  return message.type() === 'warning' && /favicon|source map/i.test(text);
}

function isIgnoredRequestFailure(request) {
  const failure = request.failure();
  return /ERR_ABORTED|NS_BINDING_ABORTED|cancelled/i.test(failure?.errorText || '');
}

function matches(matcher, text) {
  if (typeof matcher === 'function') return matcher(text);
  if (matcher instanceof RegExp) {
    matcher.lastIndex = 0;
    return matcher.test(text);
  }
  return text.includes(String(matcher));
}

function installBrowserGuards(page) {
  const errors = [];
  const allowed = [];
  const record = (text) => {
    if (!allowed.some((matcher) => matches(matcher, text))) errors.push(text);
  };

  page.on('pageerror', (error) => {
    record(`pageerror: ${error.message}`);
  });
  page.on('console', (message) => {
    if (message.type() === 'error' && !isIgnoredConsole(message)) {
      record(`console.error: ${message.text()}`);
    }
  });
  page.on('requestfailed', (request) => {
    if (!isIgnoredRequestFailure(request)) {
      record(`requestfailed: ${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`);
    }
  });
  page.on('response', (response) => {
    const status = response.status();
    if (status >= 500) record(`http ${status}: ${response.request().method()} ${response.url()}`);
  });

  return {
    errors,
    allow(matcher) {
      allowed.push(matcher);
    },
    assertClean() {
      if (errors.length) throw new Error(`Unexpected browser failures:\n${errors.join('\n')}`);
    },
  };
}

module.exports = { installBrowserGuards };
