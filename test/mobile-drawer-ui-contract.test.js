'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const course = fs.readFileSync(path.join(root, 'public', 'course.html'), 'utf8');
const glue = fs.readFileSync(path.join(root, 'public', 'glue.js'), 'utf8');

test('next lesson action cannot collapse into vertical Chinese text', () => {
  assert.match(course, /class="pill next-lesson-action"/);
  assert.doesNotMatch(course, /class="pill primary next-lesson-action"/);
  assert.match(course, /white-space:\s*nowrap/);
  assert.match(course, /word-break:\s*keep-all/);
  assert.match(course, /writing-mode:\s*horizontal-tb/);
  assert.match(course, /aria-label="生成下一课"/);
  assert.match(course, /m9 6 6 6-6 6/);
  assert.doesNotMatch(glue, /nextButton\.textContent = `生成中/);
  assert.match(glue, /next-lesson-spinner/);
});

test('mobile context and Tutor use one overlay drawer contract', () => {
  assert.match(course, /id="mobileDrawerScrim"/);
  assert.match(course, /inset:\s*var\(--topbar\) 0 0/);
  assert.match(course, /leftPanel\.classList\.add\('mobile-open'\)/);
  assert.match(course, /assistantPanel\.classList\.remove\('mobile-open'\)/);
  assert.match(course, /document\.getElementById\('coursePanel'\)\?\.toggleAttribute\('inert', anyOpen\)/);
  assert.match(course, /event\.key === 'Escape'/);
  assert.match(course, /overscroll-behavior:\s*contain/);
});
