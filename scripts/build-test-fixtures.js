#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { resolveFixtureDir } = require('../lib/runtime-config');

const ROOT = path.resolve(__dirname, '..');
const FIXTURE_DIR = (() => {
  const index = process.argv.indexOf('--output');
  if (index >= 0 && process.argv[index + 1]) return path.resolve(process.argv[index + 1]);
  return resolveFixtureDir({ root: ROOT });
})();
const SOURCE_DIR = path.join(FIXTURE_DIR, 'sources');
const COURSE_DIR = path.join(FIXTURE_DIR, 'courses');
const FIXED_TIME = '2026-01-15T08:00:00.000Z';

function ensureDir(target) {
  fs.mkdirSync(target, { recursive: true });
}

function write(file, value) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, value);
}

function writeJson(file, value) {
  write(file, `${JSON.stringify(value, null, 2)}\n`);
}

function copy(source, destination) {
  ensureDir(path.dirname(destination));
  fs.copyFileSync(source, destination);
}

function pdfEscape(value) {
  return String(value).replace(/([\\()])/g, '\\$1');
}

function createPdf({ pages, landscape = false, outline = false, imageOnly = false }) {
  const pageWidth = landscape ? 792 : 612;
  const pageHeight = landscape ? 612 : 792;
  const pageCount = Math.max(1, pages.length);
  const catalogId = 1;
  const pagesId = 2;
  const fontId = 3;
  const firstPageId = 4;
  const outlinesRootId = firstPageId + pageCount * 2;
  const outlineItemId = outlinesRootId + 1;
  const objects = new Map();
  const pageIds = [];

  for (let index = 0; index < pageCount; index += 1) {
    const pageId = firstPageId + index * 2;
    const contentId = pageId + 1;
    pageIds.push(pageId);
    const text = pages[index] || `Page ${index + 1}`;
    const stream = imageOnly
      ? 'q\n0.93 0.95 0.98 rg\n72 144 468 504 re f\n0.35 0.40 0.48 RG\n72 144 468 504 re S\nQ\n'
      : `BT\n/F1 18 Tf\n72 ${pageHeight - 96} Td\n(${pdfEscape(text)}) Tj\n0 -34 Td\n/F1 11 Tf\n(Kimi Study deterministic PDF fixture - page ${index + 1}) Tj\nET\n`;
    objects.set(pageId, `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    objects.set(contentId, `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`);
  }

  const outlinePart = outline
    ? ` /Outlines ${outlinesRootId} 0 R /PageMode /UseOutlines`
    : '';
  objects.set(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R${outlinePart} >>`);
  objects.set(pagesId, `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`);
  objects.set(fontId, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

  if (outline) {
    const destination = pageIds[Math.min(1, pageIds.length - 1)];
    objects.set(outlinesRootId, `<< /Type /Outlines /First ${outlineItemId} 0 R /Last ${outlineItemId} 0 R /Count 1 >>`);
    objects.set(outlineItemId, `<< /Title (Fixture chapter) /Parent ${outlinesRootId} 0 R /Dest [${destination} 0 R /Fit] >>`);
  }

  const maxId = Math.max(...objects.keys());
  const chunks = [Buffer.from('%PDF-1.7\n%\xE2\xE3\xCF\xD3\n', 'binary')];
  const offsets = new Array(maxId + 1).fill(0);
  let position = chunks[0].length;
  for (let id = 1; id <= maxId; id += 1) {
    const body = objects.get(id);
    if (!body) throw new Error(`missing PDF object ${id}`);
    offsets[id] = position;
    const chunk = Buffer.from(`${id} 0 obj\n${body}\nendobj\n`, 'binary');
    chunks.push(chunk);
    position += chunk.length;
  }
  const xrefPosition = position;
  let xref = `xref\n0 ${maxId + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= maxId; id += 1) xref += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  xref += `trailer\n<< /Size ${maxId + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefPosition}\n%%EOF\n`;
  chunks.push(Buffer.from(xref, 'binary'));
  return Buffer.concat(chunks);
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let value = n;
    for (let k = 0; k < 8; k += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[n] = value >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value, 0);
  return buffer;
}

function u32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0, 0);
  return buffer;
}

function createStoredZip(entries) {
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name.replace(/\\/g, '/'));
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(String(entry.data));
    const crc = crc32(data);
    const localHeader = Buffer.concat([
      u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name,
    ]);
    localParts.push(localHeader, data);

    const centralHeader = Buffer.concat([
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0),
      u16(0), u16(0), u32(0), u32(localOffset), name,
    ]);
    centralParts.push(centralHeader);
    localOffset += localHeader.length + data.length;
  }

  const central = Buffer.concat(centralParts);
  const end = Buffer.concat([
    u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length),
    u32(central.length), u32(localOffset), u16(0),
  ]);
  return Buffer.concat([...localParts, central, end]);
}

function createEpub({ version = 3, title, language = 'zh-CN', missingResource = false }) {
  const container = `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`;
  const chapter1 = `<!doctype html><html xmlns="http://www.w3.org/1999/xhtml" lang="${language}"><head><title>第一章</title></head><body><h1>第一章</h1><p>Kimi Study EPUB fixture chapter one.</p><p>用于验证搜索、目录和字体调整。</p></body></html>`;
  const chapter2 = `<!doctype html><html xmlns="http://www.w3.org/1999/xhtml" lang="${language}"><head><title>第二章</title></head><body><h1>第二章</h1><p>Kimi Study EPUB fixture chapter two.</p><p>这是跨章节搜索目标：稳定化。</p></body></html>`;
  const identifier = version === 2 ? 'urn:kimi:fixture:epub2' : 'urn:kimi:fixture:epub3';
  const entries = [
    { name: 'mimetype', data: 'application/epub+zip' },
    { name: 'META-INF/container.xml', data: container },
  ];

  if (version === 2) {
    const opf = `<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" unique-identifier="book-id" version="2.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${title}</dc:title><dc:identifier id="book-id">${identifier}</dc:identifier><dc:language>${language}</dc:language></metadata><manifest><item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/><item id="c1" href="chapter1.xhtml" media-type="application/xhtml+xml"/><item id="c2" href="${missingResource ? 'missing.xhtml' : 'chapter2.xhtml'}" media-type="application/xhtml+xml"/></manifest><spine toc="ncx"><itemref idref="c1"/><itemref idref="c2"/></spine></package>`;
    const ncx = `<?xml version="1.0"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="${identifier}"/></head><docTitle><text>${title}</text></docTitle><navMap><navPoint id="n1" playOrder="1"><navLabel><text>第一章</text></navLabel><content src="chapter1.xhtml"/></navPoint><navPoint id="n2" playOrder="2"><navLabel><text>第二章</text></navLabel><content src="${missingResource ? 'missing.xhtml' : 'chapter2.xhtml'}"/></navPoint></navMap></ncx>`;
    entries.push({ name: 'OEBPS/content.opf', data: opf }, { name: 'OEBPS/toc.ncx', data: ncx }, { name: 'OEBPS/chapter1.xhtml', data: chapter1 });
    if (!missingResource) entries.push({ name: 'OEBPS/chapter2.xhtml', data: chapter2 });
  } else {
    const opf = `<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" unique-identifier="book-id" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${title}</dc:title><dc:identifier id="book-id">${identifier}</dc:identifier><dc:language>${language}</dc:language><meta property="dcterms:modified">2026-01-15T08:00:00Z</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="c1" href="chapter1.xhtml" media-type="application/xhtml+xml"/><item id="c2" href="${missingResource ? 'missing.xhtml' : 'chapter2.xhtml'}" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c1"/><itemref idref="c2"/></spine></package>`;
    const nav = `<!doctype html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>目录</title></head><body><nav epub:type="toc"><h1>目录</h1><ol><li><a href="chapter1.xhtml">第一章</a></li><li><a href="${missingResource ? 'missing.xhtml' : 'chapter2.xhtml'}">第二章</a></li></ol></nav></body></html>`;
    entries.push({ name: 'OEBPS/content.opf', data: opf }, { name: 'OEBPS/nav.xhtml', data: nav }, { name: 'OEBPS/chapter1.xhtml', data: chapter1 });
    if (!missingResource) entries.push({ name: 'OEBPS/chapter2.xhtml', data: chapter2 });
  }
  return createStoredZip(entries);
}

const LESSON_HTML = `<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>稳定化测试课节</title></head>
<body>
  <main style="max-width:760px;margin:0 auto;padding:48px;font:18px/1.8 system-ui,sans-serif">
    <h1>稳定化测试课节</h1>
    <p id="selection-target">限制并不只是阻碍，它也可能创造新的行动空间。</p>
    <p>这段文字用于验证划词、引用、笔记锚点和刷新恢复。</p>
    <p><a href="../book.pdf">打开原始 PDF</a> · <a href="../sources/sample.epub">打开 EPUB</a></p>
    <div data-kimi-activity="activity-1"></div>
    <div style="height:900px"></div>
    <h2 id="scroll-target">滚动位置目标</h2>
  </main>
</body>
</html>\n`;

const VALID_ASSESSMENT = {
  schemaVersion: 1,
  lessonId: 'fixture-lesson-1',
  title: '稳定化测试课节',
  claims: [{
    id: 'claim-1',
    label: '理解限制可能创造行动空间',
    sourceRefs: ['book.txt#selection-target'],
    mastery: { requiredPassed: 1, requiredStages: ['guided'] },
  }],
  activities: [{
    id: 'activity-1',
    type: 'single-choice',
    claimId: 'claim-1',
    stage: 'guided',
    prompt: '这段材料认为限制可能带来什么？',
    sourceRefs: ['book.txt#selection-target'],
    options: [
      { id: 'a', label: '新的行动空间' },
      { id: 'b', label: '完全没有作用', misconceptionId: 'm-1' },
    ],
    correctOptionId: 'a',
    misconceptions: [{ id: 'm-1', feedback: '材料并没有说限制完全没有作用。' }],
    feedback: { correct: '正确，你抓住了核心判断。', incorrect: '再读一次原文中的“创造新的行动空间”。' },
    hints: ['关注“也可能”后面的内容。'],
  }],
};

function createCourse(id, options = {}) {
  const target = path.join(COURSE_DIR, id);
  ensureDir(target);
  writeJson(path.join(target, 'meta.json'), { title: options.title || `Fixture ${id}`, archived: false });
  writeJson(path.join(target, 'job.json'), options.job || { stage: 'ready', updatedAt: FIXED_TIME });
  write(path.join(target, 'book.txt'), '限制并不只是阻碍，它也可能创造新的行动空间。\n');
  if (options.withLesson !== false) {
    write(path.join(target, 'lessons', '0001-stabilization-fixture.html'), LESSON_HTML);
    writeJson(path.join(target, 'assessments', '0001-stabilization-fixture.json'), options.assessment || VALID_ASSESSMENT);
    writeJson(path.join(target, 'learning-progress', '0001-stabilization-fixture.json'), { schemaVersion: 1, attempts: [] });
  }
  writeJson(path.join(target, 'map.json'), {
    mission: { title: '验证现有产品旅途', copy: '只用于自动化测试。', criteria: ['完成核心旅途'], constraints: ['不调用真实 Kimi'] },
    promise: '固定、可复现的课程工作区。',
    material: '使用无版权、最小化测试材料。',
    methods: [{ name: '状态验证', when: '检查交互时', boundary: '不评价真实教学质量' }],
    path: ['打开课程', '查看原文', '完成练习'],
  });
  writeJson(path.join(target, 'notes.json'), options.notes || []);
  writeJson(path.join(target, 'chat.json'), options.chat || []);
  return target;
}

function buildSources() {
  ensureDir(SOURCE_DIR);
  write(path.join(SOURCE_DIR, 'text-pdf.pdf'), createPdf({ pages: ['Kimi Study PDF search target', 'Second PDF page'] }));
  write(path.join(SOURCE_DIR, 'outline-pdf.pdf'), createPdf({ pages: ['Outline PDF page one', 'Outline PDF page two'], outline: true }));
  write(path.join(SOURCE_DIR, 'landscape-pdf.pdf'), createPdf({ pages: ['Landscape PDF fixture'], landscape: true }));
  write(path.join(SOURCE_DIR, 'scanned-pdf.pdf'), createPdf({ pages: [''], imageOnly: true }));
  write(path.join(SOURCE_DIR, 'broken-pdf.pdf'), Buffer.from('not a pdf fixture'));
  write(path.join(SOURCE_DIR, 'epub2.epub'), createEpub({ version: 2, title: 'EPUB 2 Fixture' }));
  write(path.join(SOURCE_DIR, 'epub3.epub'), createEpub({ version: 3, title: 'EPUB 3 Fixture' }));
  write(path.join(SOURCE_DIR, 'chinese.epub'), createEpub({ version: 3, title: '中文 EPUB 测试', language: 'zh-CN' }));
  write(path.join(SOURCE_DIR, 'missing-resource.epub'), createEpub({ version: 3, title: 'Missing Resource Fixture', missingResource: true }));
  write(path.join(SOURCE_DIR, 'broken.epub'), Buffer.from('not an epub fixture'));
  write(path.join(SOURCE_DIR, 'sample.txt'), 'Kimi Study text fixture\n搜索目标：稳定化\n');
  write(path.join(SOURCE_DIR, 'sample.md'), '# Markdown Fixture\n\n- 目录\n- 搜索\n- 字体调整\n');
  write(path.join(SOURCE_DIR, 'sample.html'), '<!doctype html><html><body><h1>HTML Fixture</h1><p>稳定化搜索目标</p><script>window.__fixtureScriptRan=true</script></body></html>');
  write(path.join(SOURCE_DIR, 'sample.png'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl9nOQAAAAASUVORK5CYII=', 'base64'));
}

function attachSourceSet(course) {
  copy(path.join(SOURCE_DIR, 'text-pdf.pdf'), path.join(course, 'book.pdf'));
  for (const name of ['epub2.epub', 'epub3.epub', 'sample.txt', 'sample.md', 'sample.html', 'sample.png']) {
    copy(path.join(SOURCE_DIR, name), path.join(course, 'sources', name));
  }
}

function buildCourses() {
  const ready = createCourse('readycourse', { title: 'Ready Course Fixture' });
  attachSourceSet(ready);

  const notes = createCourse('notescourse', {
    title: 'Notes Course Fixture',
    notes: [{
      id: 'note-fixture-1',
      anchor: {
        exact: '限制并不只是阻碍，它也可能创造新的行动空间。',
        prefix: '',
        suffix: '这段文字用于验证',
        position: { start: 0, end: 24 },
      },
      section: '稳定化测试课节',
      question: '',
      answer: '',
      custom: '这是刷新后必须继续存在的测试笔记。',
      side: 'right',
      kind: 'user',
      createdAt: 1768464000000,
      updatedAt: 1768464000000,
    }],
    chat: [
      { role: 'user', text: '这段话是什么意思？' },
      { role: 'assistant', text: '它说明限制有时也会产生新的行动可能。', suggestions: [{ label: '举个例子', prompt: '举一个生活中的例子' }] },
    ],
  });
  attachSourceSet(notes);

  const invalid = createCourse('invalidassessment', {
    title: 'Invalid Assessment Fixture',
    assessment: { schemaVersion: 0, lessonId: '', claims: [], activities: [] },
  });
  attachSourceSet(invalid);

  const generating = createCourse('generatingcourse', {
    title: 'Generating Course Fixture',
    withLesson: false,
    job: { stage: 'generating', runId: 'fixture-run-generating', startedAt: FIXED_TIME, updatedAt: FIXED_TIME },
  });
  copy(path.join(SOURCE_DIR, 'epub3.epub'), path.join(generating, 'book.epub'));
  writeJson(path.join(generating, 'source-profile.json'), { units: [{ id: 'u1' }, { id: 'u2' }] });
  writeJson(path.join(generating, 'learning-claims.json'), { claims: [{ id: 'c1' }, { id: 'c2' }] });
  writeJson(path.join(generating, 'assessment-blueprint.json'), { plans: [{ claimId: 'c1' }] });
  writeJson(path.join(generating, 'question-bank.json'), { questions: [{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }] });
  write(path.join(generating, 'generation-events.jsonl'), [
    { id: 1, runId: 'fixture-run-generating', kind: 'run-start', key: 'run:fixture-run-generating', state: 'active', message: '正在开始创建课程…' },
    { id: 2, runId: 'fixture-run-generating', kind: 'phase', key: 'phase:claims', phase: 'claims', state: 'complete', message: '已确定 2 个学习目标' },
    { id: 3, runId: 'fixture-run-generating', kind: 'phase', key: 'phase:questions', phase: 'questions', state: 'active', message: '正在生成 3 道候选题' },
  ].map((item) => JSON.stringify(item)).join('\n') + '\n');

  const interrupted = createCourse('interruptedcourse', {
    title: 'Interrupted Course Fixture',
    withLesson: false,
    job: { stage: 'generating', runId: 'fixture-run-interrupted', startedAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z' },
  });
  write(path.join(interrupted, 'generation-events.jsonl'), `${JSON.stringify({ id: 1, runId: 'fixture-run-interrupted', kind: 'run-start', state: 'active', message: '正在生成课程…' })}\n`);
  fs.utimesSync(path.join(interrupted, 'job.json'), new Date('2025-01-01T00:00:00Z'), new Date('2025-01-01T00:00:00Z'));

  createCourse('failedcourse', {
    title: 'Failed Course Fixture',
    withLesson: false,
    job: { stage: 'failed', error: '固定测试失败', failedAt: FIXED_TIME, updatedAt: FIXED_TIME },
  });

  createCourse('emptycourse', {
    title: 'Empty Course Fixture',
    withLesson: false,
    job: { stage: 'ready', updatedAt: FIXED_TIME },
  });
}

function buildManifest() {
  writeJson(path.join(FIXTURE_DIR, 'manifest.json'), {
    schemaVersion: 1,
    generatedAt: FIXED_TIME,
    courses: {
      readycourse: { expectedStage: 'ready', lessons: 1 },
      notescourse: { expectedStage: 'ready', lessons: 1, notes: 1 },
      invalidassessment: { expectedStage: 'ready', lessons: 1, activitiesStatus: 422 },
      generatingcourse: { expectedStage: 'generating', lessons: 0 },
      interruptedcourse: { expectedStage: 'failed-after-status-check', lessons: 0 },
      failedcourse: { expectedStage: 'failed', lessons: 0 },
      emptycourse: { expectedStage: 'ready-without-lessons', lessons: 0 },
    },
    sources: [
      'text-pdf.pdf', 'outline-pdf.pdf', 'landscape-pdf.pdf', 'scanned-pdf.pdf', 'broken-pdf.pdf',
      'epub2.epub', 'epub3.epub', 'chinese.epub', 'missing-resource.epub', 'broken.epub',
      'sample.txt', 'sample.md', 'sample.html', 'sample.png',
    ],
  });
}

fs.rmSync(FIXTURE_DIR, { recursive: true, force: true });
ensureDir(FIXTURE_DIR);
buildSources();
buildCourses();
buildManifest();
console.log(`Built deterministic stabilization fixtures at ${FIXTURE_DIR}`);
