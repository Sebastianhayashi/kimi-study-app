'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { APPROVED_SKILL_BUNDLE_MANIFESTS } = require('../skill-bundle-providers');
const { createApprovedCodexProfile, verifyCodexProfile } = require('./codex-profile');

const RECEIPT_KIND = 'lucubro-codex-admission';
const RECEIPT_SCHEMA_VERSION = 1;
const AUTHORITY_BOUNDARY_ID = 'systemd-user-codex-v1';
const SHA256_DIGEST = /^sha256:[a-f0-9]{64}$/;
const REQUIRED_AUTHORITY_PROBES = Object.freeze([
  'workspaceEscapeBlocked',
  'networkDenyBlocked',
  'destructiveDenyBlocked',
  'gitPushDenyBlocked',
]);

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

function defaultTierWithFastDisabled(value) {
  return value == null || value === 'default';
}

function failedResult({ unknown = [], mismatches = [], reason = null } = {}) {
  return {
    admitted: false,
    modelId: null,
    reasoningEffort: null,
    mode: null,
    fast: null,
    permissionProfile: null,
    providerPermissionProfileId: null,
    unknown: [...unknown],
    mismatches: clone(mismatches),
    bundleDigests: {},
    authority: null,
    reason: reason || 'Codex admission receipt did not satisfy the approved gpt-5.6-luna max-effort runtime gate.',
  };
}

function verifyCodexAdmissionReceipt(receipt, {
  expectedRepo,
  expectedCommit,
  bundleManifests = APPROVED_SKILL_BUNDLE_MANIFESTS,
} = {}) {
  const repo = requiredText(expectedRepo, 'expectedRepo');
  const commit = requiredText(expectedCommit, 'expectedCommit');
  if (!Array.isArray(bundleManifests)) throw new Error('bundleManifests must be an array');

  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
    return failedResult({ unknown: ['receipt'] });
  }

  const unknown = [];
  const mismatches = [];
  const mismatch = (field, expected, observed) => mismatches.push({
    field,
    expected,
    observed: observed == null ? observed : clone(observed),
  });
  const requireField = (condition, field) => { if (!condition) unknown.push(field); };

  if (receipt.kind !== RECEIPT_KIND) mismatch('kind', RECEIPT_KIND, receipt.kind);
  if (receipt.schemaVersion !== RECEIPT_SCHEMA_VERSION) mismatch('schemaVersion', RECEIPT_SCHEMA_VERSION, receipt.schemaVersion);
  requireField(Boolean(text(receipt.observedAt)), 'observedAt');

  const source = receipt.source && typeof receipt.source === 'object' ? receipt.source : {};
  const observedRepo = text(source.repo);
  const observedCommit = text(source.commit);
  requireField(Boolean(observedRepo), 'source.repo');
  requireField(Boolean(observedCommit), 'source.commit');
  if (observedRepo && observedRepo !== repo) mismatch('source.repo', repo, observedRepo);
  if (observedCommit && observedCommit !== commit) mismatch('source.commit', commit, observedCommit);

  const appServer = receipt.appServer && typeof receipt.appServer === 'object' ? receipt.appServer : {};
  requireField(Boolean(text(appServer.userAgent)), 'appServer.userAgent');
  requireField(Boolean(text(appServer.platformFamily)), 'appServer.platformFamily');
  requireField(Boolean(text(appServer.platformOs)), 'appServer.platformOs');

  const profile = receipt.profile && typeof receipt.profile === 'object' ? receipt.profile : {};
  const approvedProfile = createApprovedCodexProfile();
  const profileResult = verifyCodexProfile({ policy: approvedProfile, observed: profile });
  for (const field of profileResult.unknown) unknown.push(`profile.${field}`);
  for (const entry of profileResult.mismatches) mismatch(`profile.${entry.field}`, entry.expected, entry.observed);
  const profileModelId = text(profile.modelId);

  const catalog = receipt.catalogDiagnostic && typeof receipt.catalogDiagnostic === 'object'
    ? receipt.catalogDiagnostic
    : {};
  const catalogModelId = text(catalog.modelId);
  requireField(Boolean(catalogModelId), 'catalogDiagnostic.modelId');
  if (catalogModelId && catalogModelId !== approvedProfile.modelId) {
    mismatch('catalogDiagnostic.modelId', approvedProfile.modelId, catalogModelId);
  }
  if (!Object.prototype.hasOwnProperty.call(catalog, 'exactModelIdMatch')) {
    unknown.push('catalogDiagnostic.exactModelIdMatch');
  } else if (catalog.exactModelIdMatch !== true) {
    mismatch('catalogDiagnostic.exactModelIdMatch', true, catalog.exactModelIdMatch);
  }
  const supportedReasoningEfforts = Array.isArray(catalog.supportedReasoningEfforts)
    ? catalog.supportedReasoningEfforts.map(text).filter(Boolean)
    : null;
  if (!supportedReasoningEfforts) {
    unknown.push('catalogDiagnostic.supportedReasoningEfforts');
  } else if (!supportedReasoningEfforts.includes(approvedProfile.reasoningEffort)) {
    mismatch('catalogDiagnostic.supportedReasoningEfforts', `includes:${approvedProfile.reasoningEffort}`, supportedReasoningEfforts);
  }
  if (!Object.prototype.hasOwnProperty.call(catalog, 'maxReasoningEffortSupported')) {
    unknown.push('catalogDiagnostic.maxReasoningEffortSupported');
  } else if (catalog.maxReasoningEffortSupported !== true) {
    mismatch('catalogDiagnostic.maxReasoningEffortSupported', true, catalog.maxReasoningEffortSupported);
  }

  const thread = receipt.thread && typeof receipt.thread === 'object' ? receipt.thread : {};
  const threadModelId = text(thread.modelId);
  requireField(Boolean(threadModelId), 'thread.modelId');
  if (threadModelId && profileModelId && threadModelId !== profileModelId) mismatch('thread.modelId', profileModelId, threadModelId);
  if (thread.modelProvider !== 'openai') mismatch('thread.modelProvider', 'openai', thread.modelProvider);
  if (!Object.prototype.hasOwnProperty.call(thread, 'serviceTier')) unknown.push('thread.serviceTier');
  else if (!defaultTierWithFastDisabled(thread.serviceTier)) mismatch('thread.serviceTier', 'default-or-null', thread.serviceTier);
  if (!Object.prototype.hasOwnProperty.call(thread, 'requestedServiceTier')) unknown.push('thread.requestedServiceTier');
  else if (thread.requestedServiceTier !== null) mismatch('thread.requestedServiceTier', null, thread.requestedServiceTier);
  if (thread.collaborationMode !== approvedProfile.mode) mismatch('thread.collaborationMode', approvedProfile.mode, thread.collaborationMode);
  if (thread.providerFallbackDisabled !== true) mismatch('thread.providerFallbackDisabled', true, thread.providerFallbackDisabled);
  if (thread.ephemeral !== true) mismatch('thread.ephemeral', true, thread.ephemeral);

  const permissionProfile = receipt.permissionProfile && typeof receipt.permissionProfile === 'object' ? receipt.permissionProfile : {};
  const providerPermissionId = text(permissionProfile.providerId);
  requireField(Boolean(providerPermissionId), 'permissionProfile.providerId');
  if (permissionProfile.normalized !== approvedProfile.permissionProfile) {
    mismatch('permissionProfile.normalized', approvedProfile.permissionProfile, permissionProfile.normalized);
  }
  if (permissionProfile.allowed !== true) mismatch('permissionProfile.allowed', true, permissionProfile.allowed);
  const activePermissionProfileId = text(thread.activePermissionProfileId);
  requireField(Boolean(activePermissionProfileId), 'thread.activePermissionProfileId');
  if (activePermissionProfileId && providerPermissionId && activePermissionProfileId !== providerPermissionId) {
    mismatch('thread.activePermissionProfileId', providerPermissionId, activePermissionProfileId);
  }

  const authority = receipt.authority && typeof receipt.authority === 'object' ? receipt.authority : {};
  if (authority.enforced !== true) mismatch('authority.enforced', true, authority.enforced);
  const boundaryId = text(authority.boundaryId);
  requireField(Boolean(boundaryId), 'authority.boundaryId');
  if (boundaryId && boundaryId !== AUTHORITY_BOUNDARY_ID) mismatch('authority.boundaryId', AUTHORITY_BOUNDARY_ID, boundaryId);
  const probes = authority.probes && typeof authority.probes === 'object' ? authority.probes : {};
  for (const probe of REQUIRED_AUTHORITY_PROBES) {
    if (!Object.prototype.hasOwnProperty.call(probes, probe)) unknown.push(`authority.probes.${probe}`);
    else if (probes[probe] !== true) mismatch(`authority.probes.${probe}`, true, probes[probe]);
  }

  const bundleDigests = {};
  const bundles = Array.isArray(receipt.bundles) ? receipt.bundles : [];
  for (const manifest of bundleManifests) {
    if (!manifest || typeof manifest !== 'object' || !text(manifest.id) || !text(manifest.pinnedCommit)) continue;
    const observed = bundles.find((bundle) => bundle && bundle.id === manifest.id) || null;
    const prefix = `bundles.${manifest.id}`;
    if (!observed) {
      unknown.push(prefix);
      continue;
    }
    if (observed.pinnedCommit !== manifest.pinnedCommit) mismatch(`${prefix}.pinnedCommit`, manifest.pinnedCommit, observed.pinnedCommit);
    if (observed.installationState !== 'active') mismatch(`${prefix}.installationState`, 'active', observed.installationState);
    if (observed.active !== true) mismatch(`${prefix}.active`, true, observed.active);
    if (observed.rootExists !== true) mismatch(`${prefix}.rootExists`, true, observed.rootExists);
    if (observed.pinnedCommitMatchesApproved !== true) {
      mismatch(`${prefix}.pinnedCommitMatchesApproved`, true, observed.pinnedCommitMatchesApproved);
    }
    if (observed.digestMatchesManifest !== true) mismatch(`${prefix}.digestMatchesManifest`, true, observed.digestMatchesManifest);

    const rootDigest = text(observed.rootDigest);
    const manifestRootDigest = text(observed.manifestRootDigest);
    const observedRootDigest = text(observed.observedRootDigest);
    if (!rootDigest || !SHA256_DIGEST.test(rootDigest)) unknown.push(`${prefix}.rootDigest`);
    if (!manifestRootDigest || !SHA256_DIGEST.test(manifestRootDigest)) unknown.push(`${prefix}.manifestRootDigest`);
    if (!observedRootDigest || !SHA256_DIGEST.test(observedRootDigest)) unknown.push(`${prefix}.observedRootDigest`);
    if (rootDigest && manifestRootDigest && rootDigest !== manifestRootDigest) {
      mismatch(`${prefix}.manifestRootDigest`, rootDigest, manifestRootDigest);
    }
    if (rootDigest && observedRootDigest && rootDigest !== observedRootDigest) {
      mismatch(`${prefix}.observedRootDigest`, rootDigest, observedRootDigest);
    }
    if (rootDigest && SHA256_DIGEST.test(rootDigest)) bundleDigests[manifest.id] = rootDigest;
  }

  const admitted = unknown.length === 0 && mismatches.length === 0 && profileResult.admitted === true;
  return {
    admitted: Boolean(admitted),
    modelId: profileModelId || null,
    reasoningEffort: text(profile.reasoningEffort),
    mode: text(profile.mode),
    fast: typeof profile.fast === 'boolean' ? profile.fast : null,
    permissionProfile: text(profile.permissionProfile),
    providerPermissionProfileId: providerPermissionId || null,
    unknown,
    mismatches,
    bundleDigests,
    authority: boundaryId ? { boundaryId, enforced: authority.enforced === true, probes: clone(probes) } : null,
    reason: admitted ? null : 'Codex admission receipt did not satisfy the approved gpt-5.6-luna max-effort runtime gate.',
  };
}

function loadCodexAdmissionReceipt({ filePath, expectedRepo, expectedCommit, bundleManifests } = {}) {
  const receiptPath = text(filePath);
  if (!receiptPath) return failedResult({ reason: 'Codex admission receipt file is not configured.' });
  if (!path.isAbsolute(receiptPath)) return failedResult({ reason: 'Codex admission receipt path must be absolute.' });
  if (!fs.existsSync(receiptPath)) return failedResult({ reason: `Codex admission receipt not found: ${receiptPath}` });

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
  } catch (error) {
    return failedResult({ reason: `Invalid Codex admission receipt: ${error.message}` });
  }

  try {
    return verifyCodexAdmissionReceipt(parsed, { expectedRepo, expectedCommit, bundleManifests });
  } catch (error) {
    return failedResult({ reason: `Invalid Codex admission receipt policy: ${error.message}` });
  }
}

module.exports = {
  AUTHORITY_BOUNDARY_ID,
  RECEIPT_KIND,
  RECEIPT_SCHEMA_VERSION,
  REQUIRED_AUTHORITY_PROBES,
  defaultTierWithFastDisabled,
  loadCodexAdmissionReceipt,
  verifyCodexAdmissionReceipt,
};
