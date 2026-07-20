const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isScrollable,
  findNativeScrollTarget,
} = require('../public/lesson-scroll-policy.js');

function element({ parent = null, matches = false, scrollHeight = 100, clientHeight = 100, overflowY = 'visible' } = {}) {
  return {
    nodeType: 1,
    parentElement: parent,
    scrollHeight,
    clientHeight,
    matches: () => matches,
    ownerDocument: { defaultView: { getComputedStyle: () => ({ overflowY }) } },
  };
}

test('detects a genuinely scrollable nested element', () => {
  const node = element({ scrollHeight: 300, clientHeight: 100, overflowY: 'auto' });
  assert.equal(isScrollable(node), true);
});

test('does not hijack notes, inputs, or explicitly native regions', () => {
  const boundary = element();
  const note = element({ parent: boundary, matches: true });
  const child = element({ parent: note });
  assert.equal(findNativeScrollTarget(child, boundary), note);
});

test('lets the lesson page use Lenis when no nested native region exists', () => {
  const boundary = element();
  const paragraph = element({ parent: boundary });
  assert.equal(findNativeScrollTarget(paragraph, boundary), null);
});
