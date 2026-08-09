'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function relativePath(root, candidate) {
  return path.relative(root, candidate).split(path.sep).join('/');
}

function safeFile(root, candidate) {
  try {
    const real = fs.realpathSync(candidate);
    if (!isInside(root, real)) return null;
    const stat = fs.statSync(real);
    if (!stat.isFile()) return null;
    return { real, stat };
  } catch {
    return null;
  }
}

function fingerprintFile(real) {
  const hash = crypto.createHash('sha256');
  const fd = fs.openSync(real, 'r');
  const buffer = Buffer.allocUnsafe(64 * 1024);
  try {
    let bytesRead;
    do {
      bytesRead = fs.readSync(fd, buffer, 0, buffer.length, null);
      if (bytesRead) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead);
  } finally {
    fs.closeSync(fd);
  }
  return `sha256:${hash.digest('hex')}`;
}

function describeSource(root, candidate, kind) {
  const safe = safeFile(root, candidate);
  if (!safe) return null;
  return {
    kind,
    path: relativePath(root, candidate),
    fingerprint: fingerprintFile(safe.real),
    bytes: safe.stat.size,
  };
}

function collectMarkdownFiles(root, relativeDir, kind, { maxFiles = 100 } = {}) {
  const start = path.join(root, relativeDir);
  if (!fs.existsSync(start)) return [];

  let realStart;
  try {
    realStart = fs.realpathSync(start);
  } catch {
    return [];
  }
  if (!isInside(root, realStart)) return [];

  const results = [];
  const queue = [realStart];
  while (queue.length && results.length < maxFiles) {
    const current = queue.shift();
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (results.length >= maxFiles) break;
      if (entry.name.startsWith('.')) continue;
      const candidate = path.join(current, entry.name);
      if (entry.isSymbolicLink()) {
        const source = entry.name.toLowerCase().endsWith('.md') ? describeSource(root, candidate, kind) : null;
        if (source) results.push(source);
        continue;
      }
      if (entry.isDirectory()) {
        let real;
        try { real = fs.realpathSync(candidate); } catch { continue; }
        if (isInside(root, real)) queue.push(real);
        continue;
      }
      if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        const source = describeSource(root, candidate, kind);
        if (source) results.push(source);
      }
    }
  }

  return results;
}

function discoverProjectSources({ repoDir }) {
  if (!repoDir || !String(repoDir).trim()) throw new Error('Project discovery requires repoDir');
  const configured = path.resolve(String(repoDir));
  const root = fs.realpathSync(configured);
  if (!fs.statSync(root).isDirectory()) throw new Error('Project repoDir must be a directory');

  const sources = [];
  const addFile = (kind, relative) => {
    const candidate = path.join(root, relative);
    if (!fs.existsSync(candidate)) return;
    const source = describeSource(root, candidate, kind);
    if (source) sources.push(source);
  };

  addFile('instructions', 'AGENTS.md');
  addFile('context', 'CONTEXT.md');
  addFile('context', 'CONTEXT-MAP.md');
  addFile('domain', path.join('docs', 'agents', 'domain.md'));
  addFile('tracker', path.join('docs', 'agents', 'issue-tracker.md'));
  sources.push(...collectMarkdownFiles(root, path.join('docs', 'adr'), 'decision'));
  sources.push(...collectMarkdownFiles(root, path.join('docs', 'specs'), 'spec'));

  const unique = [];
  const seen = new Set();
  for (const source of sources) {
    const key = `${source.kind}:${source.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(source);
  }

  return {
    repoDir: root,
    isGitRepository: fs.existsSync(path.join(root, '.git')),
    sources: unique,
  };
}

module.exports = { discoverProjectSources };
