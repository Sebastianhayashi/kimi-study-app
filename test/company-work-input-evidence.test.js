'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  extractWorkInputEvidence,
  MAX_INPUT_LINKS,
} = require('../lib/company/work-input-evidence');

test('pasted HTTP(S) links become bounded de-duplicated user-input Evidence proposals', () => {
  const items = extractWorkInputEvidence({
    brief: [
      'Compare https://item.taobao.com/item.htm?id=12345, with the current plan.',
      'The same link again: https://item.taobao.com/item.htm?id=12345.',
      'Also see https://example.com/reference?q=sofa).',
      'Ignore ftp://example.com/file and javascript:alert(1).',
    ].join(' '),
    projectId: 'project_home_refresh',
  });

  assert.equal(items.length, 2);
  assert.deepEqual(items[0], {
    kind: 'link',
    label: 'Shared link · item.taobao.com',
    mimeType: 'text/uri-list',
    source: 'user-input',
    metadata: {
      url: 'https://item.taobao.com/item.htm?id=12345',
      origin: 'work-brief',
      projectId: 'project_home_refresh',
    },
    content: 'https://item.taobao.com/item.htm?id=12345\n',
  });
  assert.equal(items[1].metadata.url, 'https://example.com/reference?q=sofa');
});

test('link extraction caps count and ignores overlong URLs instead of creating unbounded Evidence', () => {
  const urls = Array.from({ length: MAX_INPUT_LINKS + 3 }, (_, index) => `https://example.test/item/${index}`);
  const overlong = `https://example.test/${'x'.repeat(3000)}`;
  const items = extractWorkInputEvidence({
    brief: `${urls.join(' ')} ${overlong}`,
  });

  assert.equal(items.length, MAX_INPUT_LINKS);
  assert.equal(items[0].metadata.url, 'https://example.test/item/0');
  assert.equal(items.at(-1).metadata.url, `https://example.test/item/${MAX_INPUT_LINKS - 1}`);
});
