const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const Core = require('../public/margin-notes-core.js');

test('quote anchoring chooses the occurrence whose surrounding context matches', () => {
  const text = '前文 A 相同句子 后文 A。前文 B 相同句子 后文 B。';
  const result = Core.findBestQuoteOffset(text, {
    exact: '相同句子',
    prefix: '前文 B ',
    suffix: ' 后文 B',
  });
  assert.equal(text.slice(result.start, result.end), '相同句子');
  assert.equal(result.start, text.lastIndexOf('相同句子'));
});

test('text position wins when it still points at the exact quote', () => {
  const text = 'alpha quote beta quote gamma';
  const start = text.lastIndexOf('quote');
  const result = Core.findBestQuoteOffset(text, {
    textQuote: { exact: 'quote', prefix: '', suffix: '' },
    textPosition: { start, end: start + 5 },
  });
  assert.equal(result.start, start);
});

test('stacking preserves anchor order and prevents overlap', () => {
  const placed = Core.stackPlacements([
    { id: 'b', top: 105, height: 80 },
    { id: 'a', top: 100, height: 70 },
    { id: 'c', top: 300, height: 40 },
  ], 10);
  assert.deepEqual(placed.map((item) => [item.id, item.y]), [
    ['a', 100],
    ['b', 180],
    ['c', 300],
  ]);
});

test('legacy notes are normalized without losing user or assistant content', () => {
  const note = Core.normalizeNote({
    id: 'n1',
    anchor: { exact: '重点', prefix: '这里是', suffix: '内容' },
    question: '为什么？',
    answer: '因为如此。',
    custom: '我的改写',
    collapsed: true,
    createdAt: 1,
  }, 0);
  assert.equal(note.kind, 'assistant');
  assert.equal(note.custom, '我的改写');
  assert.equal(note.anchor.textQuote.exact, '重点');
  assert.equal('collapsed' in note, false);
});

test('server injects the replacement margin-note runtime in dependency order', () => {
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const select = fs.readFileSync(path.join(ROOT, 'public', 'select.js'), 'utf8');
  assert.match(server, /margin-notes\.css/);
  assert.match(server, /margin-notes-core\.js[\s\S]*margin-notes\.js[\s\S]*study-cards\.js[\s\S]*select\.js/);
  assert.match(select, /KimiMarginNotes\.mount/);
  assert.doesNotMatch(select, /function relayout|className = 'kn-ui kn-card'/);
});

test('rail selection reserves a margin only when no natural gutter is available', () => {
  assert.equal(Core.chooseRailMode({
    viewportWidth: 1600,
    contentLeft: 390,
    contentRight: 1210,
    cardWidth: 272,
    gap: 14,
  }), 'both');
  assert.equal(Core.chooseRailMode({
    viewportWidth: 1100,
    contentLeft: 40,
    contentRight: 1040,
    cardWidth: 272,
    gap: 14,
  }), 'reserve-right');
  assert.equal(Core.chooseRailMode({
    viewportWidth: 640,
    contentLeft: 20,
    contentRight: 620,
    cardWidth: 272,
    gap: 14,
  }), 'drawer');
});
