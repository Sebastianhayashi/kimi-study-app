'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const JSZip = require('jszip');

const { validateEpubArchive } = require('../lib/onboarding');

function tempFile(name, content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kimi-study-epub-'));
  const file = path.join(dir, name);
  fs.writeFileSync(file, content);
  return file;
}

async function tinyEpubBuffer({ withMimetype = true, deflate = true } = {}) {
  const zip = new JSZip();
  if (withMimetype) zip.file('mimetype', 'application/epub+zip');
  zip.file('META-INF/container.xml', '<?xml version="1.0"?><container/>');
  return zip.generateAsync({
    type: 'nodebuffer',
    compression: deflate ? 'DEFLATE' : 'STORE',
  });
}

test('accepts an epub whose mimetype entry is deflated and not first', async () => {
  const file = tempFile('book.epub', await tinyEpubBuffer({ deflate: true }));
  assert.equal(await validateEpubArchive(file), true);
});

test('rejects a non-zip file with a learner-facing error', async () => {
  const file = tempFile('book.epub', Buffer.from('definitely not a zip archive'));
  await assert.rejects(validateEpubArchive(file), (error) => {
    assert.equal(error.code, 'INVALID_EPUB');
    assert.doesNotMatch(error.message, /spawn|ENOENT|stack/i);
    return true;
  });
});

test('rejects a zip archive without a mimetype declaration', async () => {
  const file = tempFile('book.epub', await tinyEpubBuffer({ withMimetype: false }));
  await assert.rejects(validateEpubArchive(file), (error) => error.code === 'INVALID_EPUB');
});
