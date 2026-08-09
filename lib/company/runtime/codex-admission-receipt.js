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
    profileName: 'Luna Max',
    modelId: null,
    providerPermissionProfileId: null,
    unknown: [...unknown],
    mismatches: clone(mismatches),
    bundleDigests: {},
    authority: null,
    reason: reason || 'Codex admission receipt did not satisfy the Luna Max runtime gate.',
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
  const profileModelId = text(profile.modelId);
  requireField(Boolean(profileModelId), 'profile.modelId');
  if (profile.profileName !== 'Luna Max') mismatch('profile.profileName', 'Luna Max', profile.profileName);

  let profileResult = null;
  if (profileModelId) {
    const approvedProfile = createApprovedCodexProfile({ modelId: profileModelId });
    profileResult = verifyCodexProfile({ policy: approvedProfile, observed: profile });
    for (const field of profileResult.unknown) unknown.push(`profile.${field}`);
    for (const entry of profileResult.mismatches) mismatch(`profile.${entry.field}`, entry.expected, entry.observed);
  } else {
    for (const field of ['mode', 'fast', 'permissionProfile']) unknown.push(`profile.${field}`);
  }

  const thread = receipt.thread && typeof receipt.thread === 'object' ? receipt.thread : {};
  const threadModelId = text(thread.modelId);
  requireField(Boolean(threadModelId), 'thread.modelId');
  if (threadModelId && profileModelId && threadModelId !== profileModelId) {
    mismatch('thread.modelId', profileModelId, threadModelId);
  }
  if (thread.modelProvider !== 'openai') mismatch('thread.modelProvider', 'openai', thread.modelProvider);
  if (!Object.prototype.hasOwnProperty.call(thread, 'serviceTier')) unknown.push('thread.serviceTier');
  else if (!defaultTierWithFastDisabled(thread.serviceTier)) mismatch('thread.serviceTier', 'default-or-null', thread.serviceTier);
  if (!Object.prototype.hasOwnProperty.call(thread, 'requestedServiceTier')) unknown.push('thread.requestedServiceTier');
  else if (thread.requestedServiceTier !== null) mismatch('thread.requestedServiceTier', null, thread.requestedServiceTier);
  if (thread.collaborationMode !== 'default') mismatch('thread.collaborationMode', 'default', thread.collaborationMode);
  if (thread.providerFallbackDisabled !== true) mismatch('thread.providerFallbackDisabled', true, thread.providerFallbackDisabled);
  if (thread.ephemeral !== true) mismatch('thread.ephemeral', true, thread.ephemeral);

  const permissionProfile = receipt.permissionProfile && typeof receipt.permissionProfile === 'object' ? receipt.permissionProfile : {};
  const providerPermissionId = text(permissionProfile.providerId);
  requireField(Boolean(providerPermissionId), 'permissionProfile.providerId');
  if (permissionProfile.normalized !== 'full-access') mismatch('permissionProfile.normalized', 'full-access', permissionProfile.normalized);
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
    if (!observed) {
      unknown.push(`bundles.${manifest.id}`);
      continue;
    }
    if (observed.pinnedCommit !== manifest.pinnedCommit) {
      mismatch(`bundles.${manifest.id}.pinnedCommit`, manifest.pinnedCommit, observed.pinnedCommit);
    }
    if (!SHA256_DIGEST.test(String(observed.rootDigest || ''))) {
      unknown.push(`bundles.${manifest.id}.rootDigest`);
    } else {
      bundleDigests[manifest.id] = observed.rootDigest;
    }
  }

  const admitted = unknown.length === 0 && mismatches.length === 0 && profileResult && profileResult.admitted === true;
  return {
    admitted: Boolean(admitted),
    profileName: 'Luna Max',
    modelId: profileModelId || null,
    providerPermissionProfileId: providerPermissionId || null,
    unknown,
    mismatches,
    bundleDigests,
    authority: boundaryId
      ? { boundaryId, enforced: authority.enforced === true, probes: clone(probes) }
      : null,
    reason: admitted ? null : 'Codex admission receipt did not satisfy the Luna Max runtime gate.',
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
