'use strict';

const fs = require('node:fs');
const path = require('node:path');

function normalizeRelative(root, absolute) {
  return path.relative(root, absolute).split(path.sep).join('/');
}

function isInside(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function markdownLinks(content) {
  const refs = [];
  const pattern = /\]\(([^)]+)\)/g;
  let match;
  while ((match = pattern.exec(content))) refs.push(match[1].trim());
  return refs;
}

function inlineCode(content) {
  const refs = [];
  const pattern = /`([^`\n]+)`/g;
  let match;
  while ((match = pattern.exec(content))) refs.push(match[1].trim());
  return refs;
}

function isExternalReference(value) {
  return /^(?:[a-z][a-z0-9+.-]*:|#)/i.test(value);
}

function pathLike(value) {
  if (!value || /\s/.test(value)) return false;
  if (value.startsWith('/')) return value.startsWith('./') || value.startsWith('../');
  return value.startsWith('./') || value.startsWith('../') || value.includes('/');
}

function createSkillDependencyResolver({ bundleStore, catalog } = {}) {
  if (!bundleStore || typeof bundleStore.get !== 'function') {
    throw new Error('Skill dependency resolver requires a bundleStore');
  }
  if (!catalog || typeof catalog.get !== 'function' || typeof catalog.load !== 'function') {
    throw new Error('Skill dependency resolver requires a catalog');
  }

  function resolve(selectedSkillIds = []) {
    if (!Array.isArray(selectedSkillIds) || selectedSkillIds.length === 0) {
      return { skillIds: [], files: [], skillRoots: [], diagnostics: [] };
    }

    const queue = [...selectedSkillIds];
    const resolvedSkillIds = [];
    const seenSkills = new Set();
    const files = new Set();
    const scannedFiles = new Set();
    const diagnostics = [];

    function catalogIdForSlash(bundleId, skillName) {
      const id = `${bundleId}:${skillName}`;
      return catalog.get(id) ? id : null;
    }

    function addFileReference(bundle, fromFile, rawReference) {
      if (!rawReference || isExternalReference(rawReference)) return;
      const reference = rawReference.split('#')[0].split('?')[0];
      if (!reference) return;
      const absolute = path.resolve(path.dirname(fromFile), reference);
      const bundleRoot = path.resolve(bundle.materializedRoot);
      if (!isInside(bundleRoot, absolute)) {
        diagnostics.push({
          type: 'outside-bundle-reference',
          bundleId: bundle.id,
          from: normalizeRelative(bundleRoot, fromFile),
          reference: rawReference,
        });
        return;
      }
      if (!fs.existsSync(absolute)) return;
      const stat = fs.lstatSync(absolute);
      if (stat.isSymbolicLink()) {
        diagnostics.push({
          type: 'symlink-reference-blocked',
          bundleId: bundle.id,
          from: normalizeRelative(bundleRoot, fromFile),
          reference: rawReference,
        });
        return;
      }
      if (stat.isDirectory()) {
        for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
          if (entry.isFile()) addFileReference(bundle, fromFile, path.join(reference, entry.name));
        }
        return;
      }
      if (!stat.isFile()) return;
      files.add(normalizeRelative(bundleRoot, absolute));
      scanResource(bundle, absolute);
    }

    function scanResource(bundle, file) {
      const key = `${bundle.id}:${file}`;
      if (scannedFiles.has(key)) return;
      scannedFiles.add(key);
      if (!/\.(?:md|mdx|txt)$/i.test(file)) return;
      const content = fs.readFileSync(file, 'utf8');
      for (const ref of markdownLinks(content)) addFileReference(bundle, file, ref);
      for (const ref of inlineCode(content)) {
        if (pathLike(ref)) addFileReference(bundle, file, ref);
      }
    }

    while (queue.length > 0) {
      const skillId = queue.shift();
      if (seenSkills.has(skillId)) continue;
      const metadata = catalog.get(skillId);
      if (!metadata) throw new Error(`Selected Skill is not indexed: ${skillId}`);
      const loaded = catalog.load(skillId);
      const bundle = bundleStore.get(metadata.bundleId);
      if (!bundle || bundle.installationState !== 'active') {
        throw new Error(`Selected Skill bundle is not active: ${metadata.bundleId}`);
      }

      seenSkills.add(skillId);
      resolvedSkillIds.push(skillId);
      files.add(metadata.skillPath);

      const skillFile = path.join(bundle.materializedRoot, ...metadata.skillPath.split('/'));
      scanResource(bundle, skillFile);

      for (const token of inlineCode(loaded.body)) {
        const match = /^\/([a-z][a-z0-9-]*)$/i.exec(token);
        if (!match) continue;
        const dependencyId = catalogIdForSlash(metadata.bundleId, match[1]);
        if (dependencyId && !seenSkills.has(dependencyId)) queue.push(dependencyId);
      }
    }

    const orderedRoots = resolvedSkillIds.map((id) => {
      const metadata = catalog.get(id);
      const root = path.posix.dirname(metadata.skillPath);
      return root === '.' ? '.' : root;
    });

    return {
      skillIds: resolvedSkillIds,
      files: [...files].sort(),
      skillRoots: [...new Set(orderedRoots)],
      diagnostics,
    };
  }

  return { resolve };
}

module.exports = {
  createSkillDependencyResolver,
};
