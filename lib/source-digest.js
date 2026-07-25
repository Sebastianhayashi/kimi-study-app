'use strict';

// Local structural digest for uploaded materials.
//
// The mission interview only needs the material's shape: metadata, table of
// contents, and a few representative openings. Parsing that locally costs less
// than a second and keeps the model from crawling the whole book with tool
// calls before it can ask the first question. The digest is persisted next to
// the course so later stages can reuse it.

const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const MAX_DIGEST_CHARS = 6000;
const MAX_CHAPTER_SNIPPETS = 6;
const CHAPTER_SNIPPET_CHARS = 400;
const MAX_TOC_ENTRIES = 40;
const TEXT_HEAD_CHARS = 2500;
const MAX_HEADING_LINES = 30;
const DIGEST_FILE = 'source-digest.json';

function collapseWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function stripHtml(html) {
  return collapseWhitespace(
    String(html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'"),
  );
}

function xmlTag(xml, tag) {
  const match = String(xml || '').match(new RegExp(`<(?:[a-z]+:)?${tag}[^>]*>([\\s\\S]*?)</(?:[a-z]+:)?${tag}>`, 'i'));
  return match ? collapseWhitespace(stripHtml(match[1])) : '';
}

function xmlAttr(tag, name) {
  const match = String(tag || '').match(new RegExp(`${name}\\s*=\\s*"([^"]+)"`, 'i'));
  return match ? match[1] : '';
}

async function epubDigest(file) {
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  const containerEntry = zip.file('META-INF/container.xml');
  if (!containerEntry) throw new Error('EPUB 缺少 container.xml');
  const container = await containerEntry.async('string');
  const opfPath = xmlAttr(container.match(/<rootfile\s[^>]+>/i)?.[0], 'full-path');
  const opfEntry = opfPath && zip.file(opfPath);
  if (!opfEntry) throw new Error('EPUB 缺少 OPF 包文件');
  const opf = await opfEntry.async('string');
  const opfDir = path.posix.dirname(opfPath) === '.' ? '' : `${path.posix.dirname(opfPath)}/`;

  const title = xmlTag(opf, 'title');
  const creator = xmlTag(opf, 'creator');
  const language = xmlTag(opf, 'language');

  const manifest = new Map();
  for (const item of opf.match(/<item\b[^>]*>/gi) || []) {
    manifest.set(xmlAttr(item, 'id'), { href: xmlAttr(item, 'href'), mediaType: xmlAttr(item, 'media-type') });
  }
  const spine = [];
  for (const ref of opf.match(/<itemref\b[^>]*>/gi) || []) {
    const idref = xmlAttr(ref, 'idref');
    if (idref && manifest.has(idref)) spine.push(manifest.get(idref).href);
  }

  const tocLabels = [];
  const navItem = [...manifest.values()].find((item) => /nav/i.test(item.href));
  const ncxItem = [...manifest.values()].find((item) => /\.ncx$/i.test(item.href));
  const tocItem = navItem || ncxItem;
  if (tocItem) {
    const tocFile = zip.file(opfDir + tocItem.href);
    if (tocFile) {
      const tocXml = await tocFile.async('string');
      const labels = ncxItem && !navItem
        ? [...tocXml.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/gi)].map((m) => stripHtml(m[1]))
        : [...tocXml.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)].map((m) => stripHtml(m[1]));
      for (const label of labels) {
        if (label && tocLabels.length < MAX_TOC_ENTRIES) tocLabels.push(label);
      }
    }
  }

  const snippets = [];
  for (const href of spine.slice(0, MAX_CHAPTER_SNIPPETS)) {
    const chapterFile = zip.file(opfDir + href);
    if (!chapterFile) continue;
    const text = stripHtml(await chapterFile.async('string')).slice(0, CHAPTER_SNIPPET_CHARS);
    if (text) snippets.push({ href: path.posix.basename(href), text });
  }

  return { title, creator, language, toc: tocLabels, chapters: spine.length, snippets };
}

function textDigest(file, format) {
  const content = fs.readFileSync(file, 'utf8');
  const head = content.slice(0, TEXT_HEAD_CHARS);
  const headings = [];
  if (format === 'md' || format === 'markdown') {
    for (const line of content.split('\n')) {
      const match = line.match(/^#{1,4}\s+(.+)$/);
      if (match && headings.length < MAX_HEADING_LINES) headings.push(match[1].trim());
    }
  }
  return { head: collapseWhitespace(head), headings };
}

function formatDigest(format, parsed) {
  const lines = [];
  if (format === 'epub') {
    if (parsed.title) lines.push(`书名: ${parsed.title}`);
    if (parsed.creator) lines.push(`作者: ${parsed.creator}`);
    if (parsed.language) lines.push(`语言: ${parsed.language}`);
    lines.push(`章节文档数: ${parsed.chapters}`);
    if (parsed.toc.length) {
      lines.push('目录:');
      for (const label of parsed.toc) lines.push(`- ${label}`);
    }
    for (const snippet of parsed.snippets) {
      lines.push(`片段（${snippet.href}）: ${snippet.text}`);
    }
  } else {
    if (parsed.headings && parsed.headings.length) {
      lines.push('标题结构:');
      for (const heading of parsed.headings) lines.push(`- ${heading}`);
    }
    lines.push(`开头内容: ${parsed.head}`);
  }
  return lines.join('\n').slice(0, MAX_DIGEST_CHARS);
}

// Returns { text, format } or null when the format has no cheap local digest.
async function buildSourceDigest(courseDir, source = {}) {
  const format = String(source.format || '').toLowerCase();
  if (!format || format === 'pdf') return null;

  const storedName = String(source.storedFilename || `book.${format === 'markdown' ? 'md' : format}`);
  const file = path.join(courseDir, storedName);
  const sha = String(source.sha256 || '');
  const cacheFile = path.join(courseDir, DIGEST_FILE);
  try {
    const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    if (cached && cached.sha256 === sha && cached.text) return { text: cached.text, format };
  } catch {}

  const parsed = format === 'epub' ? await epubDigest(file) : await textDigest(file, format);
  const text = formatDigest(format, parsed);
  if (!text) return null;
  fs.writeFileSync(cacheFile, JSON.stringify({ sha256: sha, format, text }, null, 2));
  return { text, format };
}

module.exports = { buildSourceDigest, DIGEST_FILE };
