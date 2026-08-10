'use strict';

const fs = require('node:fs');
const { computeBundleRootDigest, createSkillBundleMaterializer } = require('./skill-bundle-materializer');
const { APPROVED_SKILL_BUNDLE_MANIFESTS } = require('./skill-bundle-providers');
const { createSkillBundleStore } = require('./skill-bundle-store');

function text(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function compareId(a, b) {
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

function sourceRootFor(sources, bundleId) {
  const value = sources && typeof sources === 'object' ? sources[bundleId] : null;
  const root = text(value);
  if (!root || !fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error(`Approved Skill bundle source root is required for ${bundleId}.`);
  }
  return root;
}

function assertExistingManifestMatches(existing, approved) {
  if (existing.pinnedCommit !== approved.pinnedCommit) {
    throw new Error(`Approved Skill bundle pinned commit mismatch for ${approved.id}: expected ${approved.pinnedCommit}, observed ${existing.pinnedCommit}.`);
  }
  if (existing.hostVariant !== approved.hostVariant) {
    throw new Error(`Approved Skill bundle host variant mismatch for ${approved.id}.`);
  }
  if (!existing.source || existing.source.repository !== approved.source.repository || existing.source.provider !== approved.source.provider) {
    throw new Error(`Approved Skill bundle source mismatch for ${approved.id}.`);
  }
}

function inspectApprovedSkillBundleMaterializations({
  dataDir,
  approvedManifests = APPROVED_SKILL_BUNDLE_MANIFESTS,
} = {}) {
  const root = text(dataDir);
  if (!root) throw new Error('Approved Skill bundle inspection dataDir is required.');
  if (!Array.isArray(approvedManifests) || approvedManifests.length === 0) {
    throw new Error('approvedManifests must contain at least one bundle.');
  }

  const store = createSkillBundleStore({ rootDir: root });
  return approvedManifests.map((approved) => {
    const existing = store.get(approved.id);
    const materializedRoot = existing && text(existing.materializedRoot);
    const rootExists = Boolean(
      materializedRoot
      && fs.existsSync(materializedRoot)
      && fs.statSync(materializedRoot).isDirectory(),
    );
    let observedRootDigest = null;
    let digestError = null;
    if (rootExists) {
      try {
        observedRootDigest = computeBundleRootDigest(materializedRoot);
      } catch (error) {
        digestError = error && error.message ? error.message : String(error);
      }
    }
    const manifestRootDigest = existing ? text(existing.rootDigest) : null;
    return {
      id: approved.id,
      pinnedCommit: existing ? text(existing.pinnedCommit) : null,
      approvedPinnedCommit: text(approved.pinnedCommit),
      pinnedCommitMatchesApproved: Boolean(
        existing
        && text(existing.pinnedCommit)
        && text(existing.pinnedCommit) === text(approved.pinnedCommit),
      ),
      installationState: existing ? text(existing.installationState) : null,
      active: Boolean(existing && existing.installationState === 'active'),
      materializedRoot,
      rootExists,
      manifestRootDigest,
      observedRootDigest,
      digestMatchesManifest: Boolean(
        manifestRootDigest
        && observedRootDigest
        && manifestRootDigest === observedRootDigest,
      ),
      digestError,
    };
  }).sort(compareId);
}

function materializeApprovedSkillBundles({
  dataDir,
  sources,
  approvedManifests = APPROVED_SKILL_BUNDLE_MANIFESTS,
} = {}) {
  const root = text(dataDir);
  if (!root) throw new Error('Approved Skill bundle materialization dataDir is required.');
  if (!Array.isArray(approvedManifests) || approvedManifests.length === 0) {
    throw new Error('approvedManifests must contain at least one bundle.');
  }

  for (const approved of approvedManifests) sourceRootFor(sources, approved.id);

  const store = createSkillBundleStore({ rootDir: root });
  const materializer = createSkillBundleMaterializer({ bundleStore: store });
  const receipts = [];

  for (const approved of approvedManifests) {
    const existing = store.get(approved.id);
    if (existing) assertExistingManifestMatches(existing, approved);
    else store.register(approved);

    const result = materializer.importFromDirectory(approved.id, {
      sourceRoot: sourceRootFor(sources, approved.id),
    });
    const active = store.get(approved.id);
    if (!active || active.installationState !== 'active' || active.rootDigest !== result.rootDigest) {
      throw new Error(`Approved Skill bundle did not activate cleanly: ${approved.id}.`);
    }
    receipts.push({
      id: approved.id,
      source: { ...approved.source },
      pinnedCommit: approved.pinnedCommit,
      hostVariant: approved.hostVariant,
      installationState: active.installationState,
      materializedRoot: active.materializedRoot,
      rootDigest: active.rootDigest,
      reused: result.reused === true,
    });
  }

  return receipts.sort(compareId);
}

module.exports = {
  assertExistingManifestMatches,
  inspectApprovedSkillBundleMaterializations,
  materializeApprovedSkillBundles,
};
