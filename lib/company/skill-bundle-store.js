'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SAFE_ID = /^[a-zA-Z0-9_-]+$/;
const SAFE_HOST_VARIANT = /^[a-zA-Z0-9._-]+$/;
const COMMIT_SHA = /^[0-9a-f]{7,64}$/i;
const INSTALLATION_STATES = new Set(['registered', 'materialized', 'active', 'inactive', 'failed']);

function assertNonEmpty(value, label) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new Error(`${label} is required`);
  return text;
}

function assertId(id) {
  const text = assertNonEmpty(id, 'Skill bundle id');
  if (!SAFE_ID.test(text)) throw new Error(`Invalid Skill bundle id: ${id}`);
  return text;
}

function assertCommit(commit) {
  const text = assertNonEmpty(commit, 'pinnedCommit');
  if (!COMMIT_SHA.test(text)) throw new Error(`Invalid pinnedCommit: ${commit}`);
  return text;
}

function assertHostVariant(value) {
  const text = assertNonEmpty(value, 'hostVariant');
  if (!SAFE_HOST_VARIANT.test(text)) throw new Error(`Invalid hostVariant: ${value}`);
  return text;
}

function normalizeSource(source) {
  if (!source || typeof source !== 'object') throw new Error('Skill bundle source is required');
  return {
    provider: assertNonEmpty(source.provider, 'source.provider'),
    repository: assertNonEmpty(source.repository, 'source.repository'),
  };
}

function normalizeLicense(license) {
  if (!license || typeof license !== 'object') throw new Error('Skill bundle license provenance is required');
  return {
    spdx: assertNonEmpty(license.spdx, 'license.spdx'),
    sourcePath: assertNonEmpty(license.sourcePath, 'license.sourcePath'),
  };
}

function normalizeRootDigest(value) {
  if (value == null) return null;
  const digest = assertNonEmpty(value, 'rootDigest');
  if (!/^sha256:[0-9a-f]{64}$/i.test(digest)) throw new Error(`Invalid rootDigest: ${value}`);
  return digest.toLowerCase();
}

function writeJsonAtomic(file, value) {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, file);
}

function createSkillBundleStore({ rootDir, now = () => new Date().toISOString() } = {}) {
  if (!rootDir) throw new Error('Skill bundle store rootDir is required');
  const storeRoot = path.join(rootDir, 'skill-bundles');
  const manifestsDir = path.join(storeRoot, 'manifests');
  const materializedDir = path.join(storeRoot, 'materialized');
  fs.mkdirSync(manifestsDir, { recursive: true });
  fs.mkdirSync(materializedDir, { recursive: true });

  const fileFor = (id) => path.join(manifestsDir, `${assertId(id)}.json`);

  function register(input = {}) {
    const id = assertId(input.id);
    const file = fileFor(id);
    if (fs.existsSync(file)) throw new Error(`Skill bundle already exists: ${id}`);

    const pinnedCommit = assertCommit(input.pinnedCommit);
    const pinnedRef = assertNonEmpty(input.pinnedRef || pinnedCommit, 'pinnedRef');
    const hostVariant = assertHostVariant(input.hostVariant);
    const installationState = input.installationState || 'registered';
    if (!INSTALLATION_STATES.has(installationState)) {
      throw new Error(`Invalid installationState: ${installationState}`);
    }
    const rootDigest = normalizeRootDigest(input.rootDigest);
    if (installationState === 'active' && !rootDigest) {
      throw new Error('rootDigest is required before a Skill bundle can be active');
    }

    const timestamp = now();
    const bundle = {
      id,
      source: normalizeSource(input.source),
      pinnedRef,
      pinnedCommit,
      license: normalizeLicense(input.license),
      hostVariant,
      rootDigest,
      installationState,
      materializedRoot: path.join(materializedDir, id, pinnedCommit, hostVariant),
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    writeJsonAtomic(file, bundle);
    return bundle;
  }

  function get(id) {
    const file = fileFor(id);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }

  function setInstallationState(id, installationState) {
    if (!INSTALLATION_STATES.has(installationState)) {
      throw new Error(`Invalid installationState: ${installationState}`);
    }
    const current = get(id);
    if (!current) throw new Error(`Skill bundle not found: ${id}`);
    if (installationState === 'active' && !current.rootDigest) {
      throw new Error('rootDigest is required before a Skill bundle can be active');
    }
    const next = {
      ...current,
      installationState,
      updatedAt: now(),
    };
    writeJsonAtomic(fileFor(id), next);
    return next;
  }

  function activateMaterialization(id, { rootDigest } = {}) {
    const current = get(id);
    if (!current) throw new Error(`Skill bundle not found: ${id}`);
    const observedDigest = normalizeRootDigest(rootDigest);
    if (!observedDigest) throw new Error('rootDigest is required to activate materialization');
    if (current.rootDigest && current.rootDigest !== observedDigest) {
      throw new Error(`Skill bundle digest mismatch: expected ${current.rootDigest}, observed ${observedDigest}`);
    }
    const next = {
      ...current,
      rootDigest: observedDigest,
      installationState: 'active',
      updatedAt: now(),
    };
    writeJsonAtomic(fileFor(id), next);
    return next;
  }

  function list() {
    return fs.readdirSync(manifestsDir)
      .filter((name) => name.endsWith('.json'))
      .map((name) => JSON.parse(fs.readFileSync(path.join(manifestsDir, name), 'utf8')))
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  return {
    register,
    get,
    list,
    setInstallationState,
    activateMaterialization,
  };
}

module.exports = {
  createSkillBundleStore,
};
