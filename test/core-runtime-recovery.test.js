'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('EPUB waits for essential open state and text count remains numeric', () => {
  const source = read('public/source-viewer.js');
  assert.match(source, /withTimeout\(book\.opened, 30000, 'EPUB 结构解析超时'\)/);
  assert.doesNotMatch(source, /withTimeout\(book\.ready/);
  assert.match(source, /Math\.max\(1, text\.length\)\.toLocaleString\(\)/);
});

test('note selection guards non-Element event targets', () => {
  const source = read('public/margin-notes.js');
  assert.match(source, /event\.target instanceof Element/);
  assert.match(source, /eventTarget\?\.closest\?\./);
  assert.doesNotMatch(source, /if \(event\.target\.closest\('/);
});
