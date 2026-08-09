'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { computeBundleRootDigest } = require('./skill-bundle-materializer');

function normalizeRelative(root, absolute) {
  return path.relative(root, absolute).split(path.sep).join('/');
}

function findSkillFiles(root) {
  const files = [];

  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile() && entry.name === 'SKILL.md') files.push(absolute);
    }
  }

  visit(root);
  return files.sort((a, b) => normalizeRelative(root, a).localeCompare(normalizeRelative(root, b)));
}

function unquote(value) {
  const text = String(value || '').trim();
  if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) {
    try { return JSON.parse(text); } catch { return text.slice(1, -1); }
  }
  if (text.length >= 2 && text.startsWith("'") && text.endsWith("'")) {
    return text.slice(1, -1).replace(/''/g, "'");
  }
  return text;
}

function parseSkillFrontmatter(content) {
  const lines = String(content || '').split(/\r?\n/);
  if (lines[0] !== '---') return null;
  const end = lines.indexOf('---', 1);
  if (end < 0) return null;
  const values = new Map();
  for (let index = 1; index < end; index += 1) {
    const line = lines[index];
    if (!line || /^\s/.test(line)) continue;
    const match = /^([a-zA-Z0-9_-]+):\s*(.*)$/.exec(line);
    if (!match || !match[2]) continue;
    values.set(match[1], unquote(match[2]));
  }
  const name = values.get('name');
  const description = values.get('description');
  if (!name || !description) return null;
  return {
    name,
    description,
    version: values.get('version') || null,
  };
}

function hashSkillContent(content) {
  return `sha256:${crypto.createHash('sha256').update(content).digest('hex')}`;
}

function createSkillCatalog({ bundleStore } = {}) {
  if (!bundleStore || typeof bundleStore.list !== 'function') {
    throw new Error('Skill Catalog requires a bundleStore');
  }

  let entries = new Map();
  let filesById = new Map();

  function refresh() {
    const next = new Map();
    const nextFiles = new Map();
    const diagnostics = [];
    let scannedBundles = 0;

    for (const bundle of bundleStore.list()) {
      if (bundle.installationState !== 'active') continue;
      scannedBundles += 1;
      if (!fs.existsSync(bundle.materializedRoot)) {
        diagnostics.push({ bundleId: bundle.id, type: 'missing-root', path: bundle.materializedRoot });
        continue;
      }
      const observedDigest = computeBundleRootDigest(bundle.materializedRoot);
      if (observedDigest !== bundle.rootDigest) {
        diagnostics.push({
          bundleId: bundle.id,
          type: 'digest-mismatch',
          expected: bundle.rootDigest,
          observed: observedDigest,
        });
        continue;
      }

      for (const file of findSkillFiles(bundle.materializedRoot)) {
        const content = fs.readFileSync(file, 'utf8');
        const frontmatter = parseSkillFrontmatter(content);
        const skillPath = normalizeRelative(bundle.materializedRoot, file);
        if (!frontmatter) {
          diagnostics.push({ bundleId: bundle.id, type: 'ineligible-skill', skillPath });
          continue;
        }
        const id = `${bundle.id}:${frontmatter.name}`;
        if (next.has(id)) throw new Error(`Duplicate Skill identity in bundle catalog: ${id}`);
        const metadata = {
          id,
          bundleId: bundle.id,
          bundleCommit: bundle.pinnedCommit,
          name: frontmatter.name,
          description: frontmatter.description,
          version: frontmatter.version,
          skillPath,
          contentHash: hashSkillContent(content),
        };
        next.set(id, metadata);
        nextFiles.set(id, file);
      }
    }

    entries = next;
    filesById = nextFiles;
    return { scannedBundles, indexedSkills: entries.size, diagnostics };
  }

  function get(id) {
    const entry = entries.get(id);
    return entry ? { ...entry } : null;
  }

  function list() {
    return [...entries.values()]
      .map((entry) => ({ ...entry }))
      .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  }

  function load(id) {
    const entry = entries.get(id);
    const file = filesById.get(id);
    if (!entry || !file) return null;
    const body = fs.readFileSync(file, 'utf8');
    const contentHash = hashSkillContent(body);
    if (contentHash !== entry.contentHash) {
      throw new Error(`Skill content changed after catalog indexing: ${id}`);
    }
    return { ...entry, body };
  }

  return { refresh, get, list, load };
}

module.exports = {
  createSkillCatalog,
  parseSkillFrontmatter,
};
