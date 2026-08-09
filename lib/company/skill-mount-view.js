'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const SAFE_SEGMENT = /^[a-zA-Z0-9._-]+$/;
const SAFE_SKILL_NAME = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

function requiredText(value, label) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new Error(`${label} is required`);
  return text;
}

function safeSegment(value, label) {
  const text = requiredText(value, label);
  if (!SAFE_SEGMENT.test(text) || text === '.' || text === '..') throw new Error(`Invalid ${label}: ${value}`);
  return text;
}

function isInside(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function hashFile(file) {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;
}

function copyTree(sourceRoot, destinationRoot) {
  fs.mkdirSync(destinationRoot, { recursive: true });
  for (const entry of fs.readdirSync(sourceRoot, { withFileTypes: true })) {
    const source = path.join(sourceRoot, entry.name);
    const destination = path.join(destinationRoot, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Skill mount view does not allow symlinks: ${source}`);
    if (entry.isDirectory()) copyTree(source, destination);
    else if (entry.isFile()) fs.copyFileSync(source, destination);
    else throw new Error(`Unsupported Skill mount entry: ${source}`);
  }
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function createSkillMountView({ rootDir, bundleStore, catalog } = {}) {
  if (!rootDir) throw new Error('Skill mount view rootDir is required');
  if (!bundleStore || typeof bundleStore.get !== 'function') throw new Error('Skill mount view requires a bundleStore');
  if (!catalog || typeof catalog.get !== 'function') throw new Error('Skill mount view requires a Skill Catalog');
  const viewsRoot = path.join(rootDir, 'skill-mounts');
  fs.mkdirSync(viewsRoot, { recursive: true });

  function build({ runId, subrunId = null, selections = [] } = {}) {
    const runSegment = safeSegment(runId, 'runId');
    const attemptSegment = subrunId == null ? 'manager' : safeSegment(subrunId, 'subrunId');
    if (!Array.isArray(selections) || selections.length === 0) throw new Error('Skill mount view requires at least one selection');

    const selected = [];
    const names = new Set();
    for (const selection of selections) {
      if (!selection || typeof selection !== 'object') throw new Error('Skill mount selection must be an object');
      const skillId = requiredText(selection.skillId, 'selection.skillId');
      const metadata = catalog.get(skillId);
      if (!metadata) throw new Error(`Selected Skill is not in the current Catalog: ${skillId}`);
      const name = requiredText(metadata.name, `Skill name for ${skillId}`);
      if (!SAFE_SKILL_NAME.test(name)) throw new Error(`Invalid Skill invocation name: ${name}`);
      if (names.has(name)) throw new Error(`Duplicate Skill invocation name in mount view: ${name}`);
      names.add(name);

      const bundle = bundleStore.get(metadata.bundleId);
      if (!bundle || bundle.installationState !== 'active') {
        throw new Error(`Selected Skill bundle is not active: ${metadata.bundleId}`);
      }
      if (bundle.pinnedCommit !== metadata.bundleCommit) {
        throw new Error(`Selected Skill bundle commit drifted: ${skillId}`);
      }
      const sourceSkillFile = path.resolve(bundle.materializedRoot, ...metadata.skillPath.split('/'));
      const bundleRoot = path.resolve(bundle.materializedRoot);
      if (!isInside(bundleRoot, sourceSkillFile)) throw new Error(`Selected Skill path escapes bundle root: ${skillId}`);
      if (!fs.existsSync(sourceSkillFile) || !fs.statSync(sourceSkillFile).isFile()) {
        throw new Error(`Selected Skill file is missing: ${skillId}`);
      }
      if (hashFile(sourceSkillFile) !== metadata.contentHash) {
        throw new Error(`Selected Skill content drifted before mount view build: ${skillId}`);
      }
      selected.push({ selection, metadata, bundle, sourceSkillFile, sourceSkillRoot: path.dirname(sourceSkillFile), name });
    }

    const destinationRoot = path.join(viewsRoot, runSegment, attemptSegment);
    if (fs.existsSync(destinationRoot)) throw new Error(`Skill mount view already exists: ${destinationRoot}`);
    fs.mkdirSync(path.dirname(destinationRoot), { recursive: true });
    const stagingRoot = `${destinationRoot}.staging-${process.pid}-${Date.now()}`;
    fs.rmSync(stagingRoot, { recursive: true, force: true });

    try {
      const expectedSkills = [];
      for (const item of selected) {
        const destinationSkillRoot = path.join(stagingRoot, item.name);
        copyTree(item.sourceSkillRoot, destinationSkillRoot);
        const stagedSkillPath = path.join(destinationSkillRoot, 'SKILL.md');
        const stagedHash = hashFile(stagedSkillPath);
        if (stagedHash !== item.metadata.contentHash) {
          throw new Error(`Skill content hash changed while building mount view: ${item.metadata.id}`);
        }
        expectedSkills.push({
          skillId: item.metadata.id,
          bundleId: item.metadata.bundleId,
          bundleCommit: item.metadata.bundleCommit,
          name: item.name,
          contentHash: item.metadata.contentHash,
          skillPath: path.join(destinationRoot, item.name, 'SKILL.md'),
          activation: requiredText(item.selection.activation, `activation for ${item.metadata.id}`),
          userIntentEvidence: item.selection.userIntentEvidence == null ? null : String(item.selection.userIntentEvidence),
          overlay: clone(item.selection.overlay),
        });
      }
      fs.renameSync(stagingRoot, destinationRoot);
      return {
        root: destinationRoot,
        expectedSkills,
      };
    } catch (error) {
      fs.rmSync(stagingRoot, { recursive: true, force: true });
      fs.rmSync(destinationRoot, { recursive: true, force: true });
      throw error;
    }
  }

  return { build };
}

module.exports = {
  createSkillMountView,
};
