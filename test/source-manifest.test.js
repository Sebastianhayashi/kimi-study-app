const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { listCourseSources } = require('../lib/source-manifest');

function fixture() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'kimi-source-manifest-'));
}

test('lists uploaded books and supported reference formats without exposing private workspace files', () => {
  const root = fixture();
  fs.writeFileSync(path.join(root, 'book.pdf'), 'pdf');
  fs.writeFileSync(path.join(root, 'book2.txt'), 'text');
  fs.writeFileSync(path.join(root, 'MISSION.md'), 'private');
  fs.mkdirSync(path.join(root, 'reference'));
  fs.writeFileSync(path.join(root, 'reference', 'chapter.html'), '<h1>Chapter</h1>');
  fs.writeFileSync(path.join(root, 'reference', 'answers.json'), '{}');

  const sources = listCourseSources(root, 'course 1');
  assert.deepEqual(sources.map((item) => item.path), [
    'book.pdf',
    'book2.txt',
    'reference/chapter.html',
  ]);
  assert.equal(sources[0].kind, 'pdf');
  assert.equal(sources[0].primary, true);
  assert.equal(sources[0].url, '/api/courses/course%201/book.pdf');
  assert.equal(sources.some((item) => item.name === 'MISSION.md'), false);
  assert.equal(sources.some((item) => item.name === 'answers.json'), false);
});

test('ignores symlinks and unsupported files', () => {
  const root = fixture();
  fs.writeFileSync(path.join(root, 'book.exe'), 'no');
  fs.writeFileSync(path.join(root, 'outside.pdf'), 'outside');
  fs.mkdirSync(path.join(root, 'sources'));
  try {
    fs.symlinkSync(path.join(root, 'outside.pdf'), path.join(root, 'sources', 'linked.pdf'));
  } catch {}

  assert.deepEqual(listCourseSources(root, 'c1'), []);
});
