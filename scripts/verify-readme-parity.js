#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const files = ['README.md', 'README.zh-CN.md', 'README.ja.md'];
const expectedSections = ['hero', 'journey', 'difference', 'sample', 'how', 'surfaces', 'limits', 'quality', 'governance'];
const expectedCommands = ['npm ci', 'npm run demo:seed', 'npm run check', 'npm test', 'npx playwright test', 'npm run verify:readme'];
const expectedMedia = ['hero-workspace.webp', 'journey-storyboard.webp', 'architecture.svg', 'library.webp', 'mission.webp', 'lesson-practice.webp', 'notes-source.webp'];

function sections(source) {
  return [...source.matchAll(/<!-- section:([a-z-]+) -->/g)].map((match) => match[1]);
}

function localLinks(source) {
  return [...source.matchAll(/\[[^\]]*\]\(([^)]+)\)|!\[[^\]]*\]\(([^)]+)\)/g)]
    .map((match) => match[1] || match[2])
    .filter((value) => value && !value.startsWith('http') && !value.startsWith('#'))
    .map((value) => value.split('#')[0]);
}

for (const file of files) {
  const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
  if (JSON.stringify(sections(source)) !== JSON.stringify(expectedSections)) throw new Error(`${file} section parity failed`);
  for (const command of expectedCommands) if (!source.includes(command)) throw new Error(`${file} is missing command: ${command}`);
  for (const media of expectedMedia) if (!source.includes(media)) throw new Error(`${file} is missing media slot: ${media}`);
  for (const link of localLinks(source)) {
    if (!fs.existsSync(path.join(ROOT, link))) throw new Error(`${file} has missing local link: ${link}`);
  }
  const badges = (source.match(/shields\.io|actions\/workflows\/ci\.yml\/badge/g) || []).length;
  if (badges > 3) throw new Error(`${file} has more than three badges`);
}
console.log('README structure, command, link, and media parity passed.');
