'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function assertDirectory(root, label) {
  if (!root) throw new Error(`${label} is required`);
  const resolved = fs.realpathSync(root);
  if (!fs.statSync(resolved).isDirectory()) throw new Error(`${label} must be a directory`);
  return resolved;
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function safeSymlinkTarget(root, absolute) {
  const target = fs.readlinkSync(absolute);
  if (path.isAbsolute(target)) {
    throw new Error(`Skill bundle symlink must be relative and stay inside bundle root: ${absolute}`);
  }
  const lexicalTarget = path.resolve(path.dirname(absolute), target);
  if (!isInside(root, lexicalTarget)) {
    throw new Error(`Skill bundle symlink escapes bundle root: ${absolute}`);
  }
  let realTarget;
  try {
    realTarget = fs.realpathSync(absolute);
  } catch (error) {
    throw new Error(`Skill bundle symlink target must exist inside bundle root: ${absolute}: ${error.message}`);
  }
  if (!isInside(root, realTarget)) {
    throw new Error(`Skill bundle symlink final target escapes bundle root: ${absolute}`);
  }
  return target;
}

function collectEntries(root) {
  const entries = [];

  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute).split(path.sep).join('/');
      if (entry.isSymbolicLink()) {
        entries.push({ kind: 'symlink', relative, target: safeSymlinkTarget(root, absolute) });
      } else if (entry.isDirectory()) {
        visit(absolute);
      } else if (entry.isFile()) {
        entries.push({ kind: 'file', relative });
      } else {
        throw new Error(`Unsupported Skill bundle entry: ${absolute}`);
      }
    }
  }

  visit(root);
  return entries.sort((a, b) => a.relative.localeCompare(b.relative));
}

function computeBundleRootDigest(rootDir) {
  const root = assertDirectory(rootDir, 'Skill bundle root');
  const hash = crypto.createHash('sha256');
  for (const entry of collectEntries(root)) {
    if (entry.kind === 'file') {
      const body = fs.readFileSync(path.join(root, entry.relative));
      hash.update(`${entry.relative}\0${body.length}\0`);
      hash.update(body);
      hash.update('\0');
      continue;
    }
    const target = Buffer.from(entry.target, 'utf8');
    hash.update(`${entry.relative}\0symlink\0${target.length}\0`);
    hash.update(target);
    hash.update('\0');
  }
  return `sha256:${hash.digest('hex')}`;
}

function copyTree(sourceRoot, destinationRoot, bundleRoot = sourceRoot) {
  fs.mkdirSync(destinationRoot, { recursive: true });
  for (const entry of fs.readdirSync(sourceRoot, { withFileTypes: true })) {
    const source = path.join(sourceRoot, entry.name);
    const destination = path.join(destinationRoot, entry.name);
    if (entry.isSymbolicLink()) {
      const target = safeSymlinkTarget(bundleRoot, source);
      fs.symlinkSync(target, destination);
    } else if (entry.isDirectory()) {
      copyTree(source, destination, bundleRoot);
    } else if (entry.isFile()) {
      fs.copyFileSync(source, destination);
    } else {
      throw new Error(`Unsupported Skill bundle entry: ${source}`);
    }
  }
}

function createSkillBundleMaterializer({ bundleStore } = {}) {
  if (!bundleStore || typeof bundleStore.get !== 'function' || typeof bundleStore.activateMaterialization !== 'function') {
    throw new Error('Skill bundle materializer requires a bundleStore');
  }

  function importFromDirectory(bundleId, { sourceRoot } = {}) {
    const manifest = bundleStore.get(bundleId);
    if (!manifest) throw new Error(`Skill bundle not found: ${bundleId}`);
    const source = assertDirectory(sourceRoot, 'sourceRoot');
    const sourceDigest = computeBundleRootDigest(source);
    if (manifest.rootDigest && sourceDigest !== manifest.rootDigest) {
      throw new Error(`Skill bundle digest mismatch: expected ${manifest.rootDigest}, observed ${sourceDigest}`);
    }

    const destination = manifest.materializedRoot;
    fs.mkdirSync(path.dirname(destination), { recursive: true });

    if (fs.existsSync(destination)) {
      const currentDigest = computeBundleRootDigest(destination);
      if (manifest.rootDigest && currentDigest !== manifest.rootDigest) {
        throw new Error(`Existing materialized Skill bundle digest mismatch: expected ${manifest.rootDigest}, observed ${currentDigest}`);
      }
      if (currentDigest !== sourceDigest) {
        throw new Error(`Materialized Skill bundle differs from source: materialized ${currentDigest}, source ${sourceDigest}`);
      }
      bundleStore.activateMaterialization(bundleId, { rootDigest: currentDigest });
      return { bundleId, materializedRoot: destination, rootDigest: currentDigest, reused: true };
    }

    const staging = `${destination}.staging-${process.pid}-${Date.now()}`;
    fs.rmSync(staging, { recursive: true, force: true });
    try {
      copyTree(source, staging);
      const stagedDigest = computeBundleRootDigest(staging);
      if (stagedDigest !== sourceDigest) {
        throw new Error(`Skill bundle digest mismatch after copy: source ${sourceDigest}, staged ${stagedDigest}`);
      }
      if (manifest.rootDigest && stagedDigest !== manifest.rootDigest) {
        throw new Error(`Skill bundle digest mismatch after copy: expected ${manifest.rootDigest}, observed ${stagedDigest}`);
      }
      fs.renameSync(staging, destination);
      try {
        bundleStore.activateMaterialization(bundleId, { rootDigest: stagedDigest });
      } catch (error) {
        fs.rmSync(destination, { recursive: true, force: true });
        throw error;
      }
      return { bundleId, materializedRoot: destination, rootDigest: stagedDigest, reused: false };
    } catch (error) {
      fs.rmSync(staging, { recursive: true, force: true });
      throw error;
    }
  }

  return { importFromDirectory };
}

module.exports = {
  computeBundleRootDigest,
  createSkillBundleMaterializer,
  safeSymlinkTarget,
};
