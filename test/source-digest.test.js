'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const JSZip = require('jszip');

const { buildSourceDigest, DIGEST_FILE } = require('../lib/source-digest');
const { initialMissionPrompt } = require('../lib/standard-teach-mission');

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'kimi-study-digest-'));
}

async function writeTinyEpub(file) {
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip');
  zip.file('META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
  zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>测试之书</dc:title><dc:creator>某作者</dc:creator><dc:language>zh-CN</dc:language>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/>
    <item id="c2" href="c2.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine><itemref idref="c1"/><itemref idref="c2"/></spine>
</package>`);
  zip.file('OEBPS/nav.xhtml', '<html><body><nav><ol><li><a href="c1.xhtml">第一章 起步</a></li><li><a href="c2.xhtml">第二章 深入</a></li></ol></nav></body></html>');
  zip.file('OEBPS/c1.xhtml', '<html><body><h1>第一章 起步</h1><p>这是第一章的开头内容，用于验证摘要抽取。</p></body></html>');
  zip.file('OEBPS/c2.xhtml', '<html><body><h1>第二章 深入</h1><p>第二章讨论更复杂的主题。</p></body></html>');
  fs.writeFileSync(file, await zip.generateAsync({ type: 'nodebuffer' }));
}

test('builds a structural digest for epub with metadata, toc and snippets', async () => {
  const root = tempRoot();
  const courseDir = path.join(root, 'course');
  fs.mkdirSync(courseDir, { recursive: true });
  await writeTinyEpub(path.join(courseDir, 'book.epub'));

  const digest = await buildSourceDigest(courseDir, { format: 'epub', storedFilename: 'book.epub', sha256: 'abc' });
  assert.ok(digest.text.includes('书名: 测试之书'));
  assert.ok(digest.text.includes('作者: 某作者'));
  assert.ok(digest.text.includes('第一章 起步'));
  assert.ok(digest.text.includes('第二章 深入'));
  assert.ok(digest.text.includes('用于验证摘要抽取'));

  // second call serves the persisted cache
  const again = await buildSourceDigest(courseDir, { format: 'epub', storedFilename: 'book.epub', sha256: 'abc' });
  assert.equal(again.text, digest.text);
  assert.ok(fs.existsSync(path.join(courseDir, DIGEST_FILE)));
  fs.rmSync(root, { recursive: true, force: true });
});

test('builds heading-aware digest for markdown and skips pdf', async () => {
  const root = tempRoot();
  const courseDir = path.join(root, 'course');
  fs.mkdirSync(courseDir, { recursive: true });
  fs.writeFileSync(path.join(courseDir, 'book.md'), '# 主题\n\n第一段内容。\n\n## 小节一\n\n细节。\n');

  const digest = await buildSourceDigest(courseDir, { format: 'md', storedFilename: 'book.md', sha256: 'x' });
  assert.ok(digest.text.includes('主题'));
  assert.ok(digest.text.includes('小节一'));
  assert.ok(digest.text.includes('第一段内容'));

  const pdf = await buildSourceDigest(courseDir, { format: 'pdf', storedFilename: 'book.pdf', sha256: 'x' });
  assert.equal(pdf, null);
  fs.rmSync(root, { recursive: true, force: true });
});

test('mission prompt embeds the digest and forbids re-reading the book', () => {
  const withDigest = initialMissionPrompt('.epub', '书名: 测试之书\n目录:\n- 第一章');
  assert.ok(withDigest.includes('<material-digest>'));
  assert.ok(withDigest.includes('书名: 测试之书'));
  assert.match(withDigest, /不要再去打开、遍历或深读/);

  const without = initialMissionPrompt('.epub');
  assert.ok(!without.includes('<material-digest>'));
  assert.match(without, /少量代表性片段/);
});
