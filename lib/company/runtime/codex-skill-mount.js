'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function requiredText(value, label) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new Error(`${label} is required`);
  return text;
}

function isInside(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function hashFile(file) {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;
}

function normalizeExpectedSkill(mountRoot, input = {}) {
  const skillId = requiredText(input.skillId, 'mount expected skillId');
  const name = requiredText(input.name, 'mount expected skill name');
  const skillPath = path.resolve(requiredText(input.skillPath, `mount skillPath for ${name}`));
  if (!isInside(mountRoot, skillPath)) throw new Error(`Expected Skill path is outside mount root: ${name}`);
  if (!fs.existsSync(skillPath) || !fs.statSync(skillPath).isFile()) {
    throw new Error(`Expected Skill file is missing before mount: ${name}`);
  }
  const expectedHash = requiredText(input.contentHash, `mount contentHash for ${name}`);
  const observedHash = hashFile(skillPath);
  if (observedHash !== expectedHash) {
    throw new Error(`Skill content hash mismatch before mount: ${name}`);
  }
  return {
    skillId,
    bundleId: requiredText(input.bundleId, `mount bundleId for ${name}`),
    bundleCommit: requiredText(input.bundleCommit, `mount bundleCommit for ${name}`),
    name,
    contentHash: expectedHash,
    skillPath,
    activation: requiredText(input.activation, `mount activation for ${name}`),
    userIntentEvidence: input.userIntentEvidence == null ? null : String(input.userIntentEvidence),
    overlay: input.overlay == null ? null : JSON.parse(JSON.stringify(input.overlay)),
  };
}

async function establishCodexSkillMount({ rpc, cwd, mount } = {}) {
  if (typeof rpc !== 'function') throw new Error('Codex Skill mount requires an RPC function');
  const workCwd = requiredText(cwd, 'Codex Skill mount cwd');
  if (!mount || typeof mount !== 'object') throw new Error('Codex Skill mount request is required');
  const requestedRoot = requiredText(mount.root, 'Codex Skill mount root');
  if (!path.isAbsolute(requestedRoot)) throw new Error('Codex Skill mount root must be absolute');
  if (!fs.existsSync(requestedRoot) || !fs.statSync(requestedRoot).isDirectory()) {
    throw new Error('Codex Skill mount root must be an existing directory');
  }
  const mountRoot = fs.realpathSync(requestedRoot);
  const expectedInputs = Array.isArray(mount.expectedSkills) ? mount.expectedSkills : [];
  if (expectedInputs.length === 0) throw new Error('Codex Skill mount requires at least one expected Skill');
  const expectedSkills = expectedInputs.map((input) => normalizeExpectedSkill(mountRoot, input));
  const names = new Set();
  for (const expected of expectedSkills) {
    if (names.has(expected.name)) throw new Error(`Duplicate Skill name in run-scoped mount: ${expected.name}`);
    names.add(expected.name);
  }

  await rpc('skills/extraRoots/set', { extraRoots: [mountRoot] });
  const listed = await rpc('skills/list', { cwds: [workCwd], forceReload: true });
  const entries = Array.isArray(listed && listed.data) ? listed.data : [];
  const entry = entries.find((candidate) => candidate && candidate.cwd === workCwd) || null;
  if (!entry) throw new Error(`Codex skills/list did not return cwd: ${workCwd}`);
  if (Array.isArray(entry.errors) && entry.errors.length > 0) {
    throw new Error(`Codex skills/list reported errors for mounted Skills: ${JSON.stringify(entry.errors)}`);
  }

  const observedSkills = Array.isArray(entry.skills) ? entry.skills : [];
  const observedInsideRoot = observedSkills.filter((skill) => {
    if (!skill || typeof skill.path !== 'string' || !path.isAbsolute(skill.path)) return false;
    return isInside(mountRoot, path.resolve(skill.path));
  });
  const expectedPaths = new Set(expectedSkills.map((skill) => path.resolve(skill.skillPath)));

  for (const observed of observedInsideRoot) {
    const observedPath = path.resolve(observed.path);
    if (!expectedPaths.has(observedPath)) {
      throw new Error(`Unexpected Skill visible inside mount root: ${observed.name || observedPath}`);
    }
  }

  const receiptSkills = expectedSkills.map((expected) => {
    const observed = observedInsideRoot.find((skill) => path.resolve(skill.path) === path.resolve(expected.skillPath));
    if (!observed) throw new Error(`Expected Skill is missing from Codex mount: ${expected.name}`);
    if (observed.name !== expected.name) {
      throw new Error(`Codex mounted Skill name mismatch at ${expected.skillPath}: expected ${expected.name}, observed ${observed.name}`);
    }
    if (observed.enabled !== true) throw new Error(`Expected Skill is not enabled in Codex mount: ${expected.name}`);
    return {
      skillId: expected.skillId,
      bundleId: expected.bundleId,
      bundleCommit: expected.bundleCommit,
      name: expected.name,
      contentHash: expected.contentHash,
      skillPath: expected.skillPath,
      activation: expected.activation,
      userIntentEvidence: expected.userIntentEvidence,
      overlay: expected.overlay,
      observedPath: observed.path,
      scope: observed.scope || null,
      enabled: true,
    };
  });

  return {
    kind: 'codex-skill-mount-receipt',
    verified: true,
    mountRoot,
    method: 'skills/extraRoots/set+skills/list',
    skills: receiptSkills,
  };
}

module.exports = {
  establishCodexSkillMount,
};
