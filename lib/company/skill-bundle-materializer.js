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

function collectFiles(root) {
  const files = [];

  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Skill bundle symlinks are not supported: ${absolute}`);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) files.push(path.relative(root, absolute).split(path.sep).join('/'));
      else throw new Error(`Unsupported Skill bundle entry: ${absolute}`);
    }
  }

  visit(root);
  return files.sort();
}

function computeBundleRootDigest(rootDir) {
  const root = assertDirectory(rootDir, 'Skill bundle root');
  const hash = crypto.createHash('sha256');
  for (const relative of collectFiles(root)) {
    const body = fs.readFileSync(path.join(root, relative));
    hash.update(`${relative}\0${body.length}\0`);
    hash.update(body);
    hash.update('\0');
  }
  return `sha256:${hash.digest('hex')}`;
}

function copyTree(sourceRoot, destinationRoot) {
  fs.mkdirSync(destinationRoot, { recursive: true });
  for (const entry of fs.readdirSync(sourceRoot, { withFileTypes: true })) {
    const source = path.join(sourceRoot, entry.name);
    const destination = path.join(destinationRoot, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Skill bundle symlinks are not supported: ${source}`);
    if (entry.isDirectory()) copyTree(source, destination);
    else if (entry.isFile()) fs.copyFileSync(source, destination);
    else throw new Error(`Unsupported Skill bundle entry: ${source}`);
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
};
