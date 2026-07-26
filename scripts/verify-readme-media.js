#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const mediaRoot = path.join(ROOT, 'docs', 'media', 'readme');
const manifestPath = path.join(mediaRoot, 'manifest.json');

function pngSize(buffer) {
  if (buffer.toString('ascii', 1, 4) !== 'PNG') return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function webpSize(buffer) {
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') return null;
  const kind = buffer.toString('ascii', 12, 16);
  if (kind === 'VP8X') return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) };
  if (kind === 'VP8 ') return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
  if (kind === 'VP8L') {
    const bits = buffer.readUInt32LE(21);
    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
  }
  return null;
}

function svgSize(text) {
  const width = Number(text.match(/\bwidth="(\d+)"/)?.[1]);
  const height = Number(text.match(/\bheight="(\d+)"/)?.[1]);
  return width && height ? { width, height } : null;
}

if (!fs.existsSync(manifestPath)) throw new Error('README media manifest is missing');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const architectureFlow = {
  en: 'problem → material → action → evidence → adjustment',
  'zh-CN': '问题 → 材料 → 行动 → 证据 → 调整',
  ja: '課題 → 教材 → 行動 → 証拠 → 調整',
};
for (const locale of ['en', 'zh-CN', 'ja']) {
  const entries = manifest.assets?.[locale];
  if (!Array.isArray(entries) || !entries.length) throw new Error(`No media entries for ${locale}`);
  for (const entry of entries) {
    const file = path.join(mediaRoot, locale, entry.name);
    if (!fs.existsSync(file)) throw new Error(`Missing ${file}`);
    const stat = fs.statSync(file);
    if (stat.size > entry.byteBudget) throw new Error(`${entry.name} exceeds byte budget: ${stat.size} > ${entry.byteBudget}`);
    const buffer = fs.readFileSync(file);
    const size = entry.type === 'png' ? pngSize(buffer) : entry.type === 'webp' ? webpSize(buffer) : svgSize(buffer.toString('utf8'));
    if (!size || size.width !== entry.width || size.height !== entry.height) {
      throw new Error(`${locale}/${entry.name} has ${size?.width || '?'}x${size?.height || '?'}, expected ${entry.width}x${entry.height}`);
    }
    if (entry.name === 'architecture.svg') {
      const text = buffer.toString('utf8');
      if (!text.includes(architectureFlow[locale])) {
        throw new Error(`${locale}/architecture.svg does not use the locale-matched outcome flow`);
      }
    }
  }
}
console.log('README media verification passed for en, zh-CN, and ja.');
