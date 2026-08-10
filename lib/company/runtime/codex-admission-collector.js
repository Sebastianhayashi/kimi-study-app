'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { APPROVED_SKILL_BUNDLE_MANIFESTS } = require('../skill-bundle-providers');
const { createApprovedCodexProfile } = require('./codex-profile');
const {
  RECEIPT_KIND,
  RECEIPT_SCHEMA_VERSION,
  verifyCodexAdmissionReceipt,
} = require('./codex-admission-receipt');

function text(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function requiredText(value, label) {
  const result = text(value);
  if (!result) throw new Error(`${label} is required`);
  return result;
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function requireBundleObservation(observation, manifest) {
  if (!observation) throw new Error(`Approved Skill bundle observation is missing: ${manifest.id}`);
  if (observation.active !== true || observation.installationState !== 'active' || observation.rootExists !== true) {
    throw new Error(`Approved Skill bundle observation is not active: ${manifest.id}`);
  }
  if (observation.pinnedCommitMatchesApproved !== true
    || observation.pinnedCommit !== manifest.pinnedCommit
    || observation.approvedPinnedCommit !== manifest.pinnedCommit) {
    throw new Error(`Approved Skill bundle commit does not match manifest: ${manifest.id}`);
  }
  if (observation.digestMatchesManifest !== true) {
    throw new Error(`Approved Skill bundle digest does not match manifest: ${manifest.id}`);
  }
  const manifestDigest = requiredText(observation.manifestRootDigest, `${manifest.id} manifestRootDigest`);
  const observedDigest = requiredText(observation.observedRootDigest, `${manifest.id} observedRootDigest`);
  if (manifestDigest !== observedDigest) {
    throw new Error(`Approved Skill bundle digest does not match manifest: ${manifest.id}`);
  }
  if (observation.digestError) throw new Error(`Approved Skill bundle digest failed: ${manifest.id}: ${observation.digestError}`);
  return {
    id: manifest.id,
    pinnedCommit: manifest.pinnedCommit,
    rootDigest: observedDigest,
    installationState: observation.installationState,
    active: true,
    rootExists: true,
    pinnedCommitMatchesApproved: true,
    manifestRootDigest: manifestDigest,
    observedRootDigest: observedDigest,
    digestMatchesManifest: true,
  };
}

function buildCodexAdmissionReceipt({
  expectedRepo,
  expectedCommit,
  observedAt = new Date().toISOString(),
  hostDiagnostic,
  threadObservation,
  authorityObservation,
  bundleObservations,
  bundleManifests = APPROVED_SKILL_BUNDLE_MANIFESTS,
} = {}) {
  const repo = requiredText(expectedRepo, 'expectedRepo');
  const commit = requiredText(expectedCommit, 'expectedCommit');
  if (!hostDiagnostic || typeof hostDiagnostic !== 'object') throw new Error('hostDiagnostic is required');
  if (!threadObservation || typeof threadObservation !== 'object') throw new Error('threadObservation is required');
  if (!authorityObservation || typeof authorityObservation !== 'object') throw new Error('authorityObservation is required');
  if (!Array.isArray(bundleObservations)) throw new Error('bundleObservations must be an array');
  if (!Array.isArray(bundleManifests)) throw new Error('bundleManifests must be an array');

  const profile = createApprovedCodexProfile();
  const approvedModel = hostDiagnostic.approvedModel && typeof hostDiagnostic.approvedModel === 'object'
    ? hostDiagnostic.approvedModel
    : {};
  const appServer = hostDiagnostic.appServer && typeof hostDiagnostic.appServer === 'object'
    ? hostDiagnostic.appServer
    : {};
  const effectiveConfig = hostDiagnostic.effectiveConfig && typeof hostDiagnostic.effectiveConfig === 'object'
    ? hostDiagnostic.effectiveConfig
    : {};
  const permissionProfiles = Array.isArray(hostDiagnostic.permissionProfiles) ? hostDiagnostic.permissionProfiles : [];
  const activePermissionProfileId = text(threadObservation.activePermissionProfileId);
  const providerPermission = permissionProfiles.find((entry) => entry && text(entry.id) === activePermissionProfileId) || {};

  const bundles = bundleManifests
    .filter((manifest) => manifest && text(manifest.id) && text(manifest.pinnedCommit))
    .map((manifest) => requireBundleObservation(
      bundleObservations.find((observation) => observation && observation.id === manifest.id),
      manifest,
    ));

  const supportedReasoningEfforts = Array.isArray(approvedModel.supportedReasoningEfforts)
    ? approvedModel.supportedReasoningEfforts.map(text).filter(Boolean)
    : [];
  const catalogModelId = text(approvedModel.modelId);
  const receipt = {
    kind: RECEIPT_KIND,
    schemaVersion: RECEIPT_SCHEMA_VERSION,
    observedAt: requiredText(observedAt, 'observedAt'),
    source: { repo, commit },
    appServer: {
      userAgent: text(appServer.userAgent),
      platformFamily: text(appServer.platformFamily),
      platformOs: text(appServer.platformOs),
    },
    catalogDiagnostic: {
      modelId: catalogModelId,
      exactModelIdMatch: Boolean(
        approvedModel.uniqueMatch === true
        && catalogModelId
        && catalogModelId === profile.modelId,
      ),
      supportedReasoningEfforts,
      maxReasoningEffortSupported: Boolean(
        approvedModel.maxReasoningEffortSupported === true
        && supportedReasoningEfforts.includes(profile.reasoningEffort),
      ),
      providerDisplayName: text(approvedModel.displayName),
      effectiveConfigModelId: text(effectiveConfig.modelId),
      note: 'Provider display text is diagnostic only; exact model id and supported reasoning efforts are authoritative.',
    },
    profile: clone(profile),
    thread: {
      modelId: text(threadObservation.modelId),
      modelProvider: text(threadObservation.modelProvider),
      serviceTier: Object.prototype.hasOwnProperty.call(threadObservation, 'serviceTier')
        ? threadObservation.serviceTier
        : undefined,
      requestedServiceTier: Object.prototype.hasOwnProperty.call(threadObservation, 'requestedServiceTier')
        ? threadObservation.requestedServiceTier
        : undefined,
      collaborationMode: profile.mode,
      collaborationModeSource: 'lucubro-runtime-contract',
      activePermissionProfileId,
      providerFallbackDisabled: threadObservation.providerFallbackDisabled === true,
      ephemeral: threadObservation.ephemeral === true,
    },
    permissionProfile: {
      providerId: activePermissionProfileId,
      normalized: profile.permissionProfile,
      allowed: providerPermission.allowed === true,
    },
    authority: {
      enforced: authorityObservation.enforced === true,
      boundaryId: text(authorityObservation.boundaryId),
      probes: clone(authorityObservation.probes || {}),
    },
    bundles,
  };

  const admission = verifyCodexAdmissionReceipt(receipt, {
    expectedRepo: repo,
    expectedCommit: commit,
    bundleManifests,
  });
  if (!admission.admitted) {
    const details = JSON.stringify({ unknown: admission.unknown, mismatches: admission.mismatches });
    throw new Error(`Codex admission receipt failed verification: ${details}`);
  }
  return receipt;
}

function writeVerifiedCodexAdmissionReceipt({ filePath, ...input } = {}) {
  const target = requiredText(filePath, 'filePath');
  if (!path.isAbsolute(target)) throw new Error('Codex admission receipt filePath must be absolute');
  const receipt = buildCodexAdmissionReceipt(input);
  const admission = verifyCodexAdmissionReceipt(receipt, {
    expectedRepo: input.expectedRepo,
    expectedCommit: input.expectedCommit,
    bundleManifests: input.bundleManifests,
  });
  if (!admission.admitted) throw new Error('Codex admission receipt failed verification before write');

  const directory = path.dirname(target);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const temporary = `${target}.tmp-${process.pid}-${Date.now()}`;
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(receipt, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    });
    fs.chmodSync(temporary, 0o600);
    fs.renameSync(temporary, target);
    fs.chmodSync(target, 0o600);
  } catch (error) {
    fs.rmSync(temporary, { force: true });
    throw error;
  }

  return { filePath: target, receipt, admission };
}

module.exports = {
  buildCodexAdmissionReceipt,
  requireBundleObservation,
  writeVerifiedCodexAdmissionReceipt,
};
