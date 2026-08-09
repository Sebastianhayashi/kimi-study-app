'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { inspectApprovedSkillBundleMaterializations } = require('../approved-skill-bundle-materialization');
const { writeVerifiedCodexAdmissionReceipt } = require('./codex-admission-collector');
const { inspectCodexHost } = require('./codex-host-diagnostic');
const { APPROVED_MODEL_ID, APPROVED_REASONING_EFFORT } = require('./codex-profile');
const { probeCodexThreadProfile } = require('./codex-thread-profile-probe');

const TRUSTED_REPOSITORY = 'Sebastianhayashi/lucubro';
const GIT_SHA = /^[a-f0-9]{40}$/;

function text(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function requiredText(value, label) {
  const result = text(value);
  if (!result) throw new Error(`${label} is required`);
  return result;
}

function requiredAbsolutePath(value, label) {
  const result = requiredText(value, label);
  if (!path.isAbsolute(result)) throw new Error(`${label} must be an absolute path`);
  return result;
}

function normalizeGitHubRepository(remote) {
  const value = text(remote);
  if (!value) return null;
  const patterns = [
    /^https:\/\/github\.com\/([^/]+\/[^/]+?)(?:\.git)?\/?$/i,
    /^git@github\.com:([^/]+\/[^/]+?)(?:\.git)?$/i,
    /^ssh:\/\/git@github\.com\/([^/]+\/[^/]+?)(?:\.git)?\/?$/i,
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function runGit({ cwd, gitExecutable, args, spawnSyncImpl = spawnSync }) {
  const result = spawnSyncImpl(gitExecutable, ['-C', cwd, ...args], {
    cwd,
    encoding: 'utf8',
    timeout: 30_000,
    maxBuffer: 1024 * 1024,
  });
  if (!result || result.error) throw new Error(`git ${args.join(' ')} failed: ${result && result.error ? result.error.message : 'unknown error'}`);
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${text(result.stderr) || `exit ${result.status}`}`);
  return requiredText(result.stdout, `git ${args.join(' ')} output`);
}

function readGitIdentity({ cwd, gitExecutable, spawnSyncImpl = spawnSync } = {}) {
  const checkout = requiredAbsolutePath(cwd, 'cwd');
  const git = requiredAbsolutePath(gitExecutable, 'gitExecutable');
  const commit = runGit({ cwd: checkout, gitExecutable: git, args: ['rev-parse', 'HEAD'], spawnSyncImpl });
  if (!GIT_SHA.test(commit)) throw new Error(`Trusted checkout commit is not a full Git SHA: ${commit}`);
  const remote = runGit({ cwd: checkout, gitExecutable: git, args: ['remote', 'get-url', 'origin'], spawnSyncImpl });
  const repo = normalizeGitHubRepository(remote);
  if (!repo) throw new Error(`Trusted checkout origin is not a canonical GitHub repository: ${remote}`);
  return { repo, commit, remote };
}

function selectApprovedLunaCatalog(hostDiagnostic) {
  const approvedModel = hostDiagnostic && hostDiagnostic.approvedModel && typeof hostDiagnostic.approvedModel === 'object'
    ? hostDiagnostic.approvedModel
    : {};
  const supportedReasoningEfforts = Array.isArray(approvedModel.supportedReasoningEfforts)
    ? approvedModel.supportedReasoningEfforts.map(text).filter(Boolean)
    : [];
  const valid = approvedModel.uniqueMatch === true
    && text(approvedModel.modelId) === APPROVED_MODEL_ID
    && approvedModel.maxReasoningEffortSupported === true
    && supportedReasoningEfforts.includes(APPROVED_REASONING_EFFORT);
  if (!valid) {
    throw new Error(
      `Approved Luna catalog proof is required before thread creation: expected ${APPROVED_MODEL_ID} with ${APPROVED_REASONING_EFFORT} reasoning effort.`,
    );
  }
  return {
    modelId: APPROVED_MODEL_ID,
    reasoningEffort: APPROVED_REASONING_EFFORT,
    supportedReasoningEfforts,
  };
}

function selectFullAccessPermissionProfile(permissionProfiles) {
  const profiles = Array.isArray(permissionProfiles) ? permissionProfiles : [];
  const candidates = profiles.filter((profile) => {
    if (!profile || profile.allowed !== true) return false;
    const identity = `${text(profile.id) || ''} ${text(profile.description) || ''}`;
    return /(?:danger[-_:]?full[-_]?access|full[\s_-]*access)/i.test(identity);
  });
  if (candidates.length === 0) throw new Error('No allowed full-access provider profile was observed from Codex App Server.');
  if (candidates.length !== 1) throw new Error(`Expected exactly one full-access provider profile, observed ${candidates.length}.`);
  return candidates[0];
}

function runSystemdAuthorityProbe({
  cwd,
  systemdRunExecutable,
  gitExecutable,
  scratchRoot,
  spawnSyncImpl = spawnSync,
} = {}) {
  const checkout = requiredAbsolutePath(cwd, 'cwd');
  const systemdRun = requiredAbsolutePath(systemdRunExecutable, 'systemdRunExecutable');
  const git = requiredAbsolutePath(gitExecutable, 'gitExecutable');
  const scratch = requiredAbsolutePath(scratchRoot, 'scratchRoot');
  fs.mkdirSync(scratch, { recursive: true, mode: 0o700 });
  const probeRoot = fs.mkdtempSync(path.join(scratch, 'codex-authority-'));
  const workspace = path.join(probeRoot, 'workspace');
  const state = path.join(probeRoot, 'state');
  const protectedRoot = path.join(probeRoot, 'protected');
  const script = path.join(checkout, 'scripts', 'systemd-authority-probe.js');
  if (!fs.existsSync(script)) throw new Error(`Systemd authority probe script not found: ${script}`);

  try {
    const result = spawnSyncImpl(process.execPath, [
      script,
      '--systemd-run', systemdRun,
      '--git', git,
      '--workspace', workspace,
      '--state', state,
      '--protected-root', protectedRoot,
    ], {
      cwd: checkout,
      encoding: 'utf8',
      timeout: 180_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    if (!result || result.error) throw new Error(`Systemd authority probe failed: ${result && result.error ? result.error.message : 'unknown error'}`);
    if (result.status !== 0) throw new Error(`Systemd authority probe failed: ${text(result.stderr) || `exit ${result.status}`}`);
    let parsed;
    try {
      parsed = JSON.parse(requiredText(result.stdout, 'Systemd authority probe stdout'));
    } catch (error) {
      throw new Error(`Systemd authority probe returned invalid JSON: ${error.message}`);
    }
    return parsed;
  } finally {
    fs.rmSync(probeRoot, { recursive: true, force: true });
  }
}

async function collectCodexAdmissionOnMachine(input = {}, dependencies = {}) {
  const cwd = requiredAbsolutePath(input.cwd, 'cwd');
  const dataDir = requiredAbsolutePath(input.dataDir, 'dataDir');
  const receiptFile = requiredAbsolutePath(input.receiptFile, 'receiptFile');
  const systemdRunExecutable = requiredAbsolutePath(input.systemdRunExecutable, 'systemdRunExecutable');
  const gitExecutable = requiredAbsolutePath(input.gitExecutable, 'gitExecutable');
  const scratchRoot = requiredAbsolutePath(input.scratchRoot, 'scratchRoot');

  const readGitIdentityImpl = dependencies.readGitIdentityImpl || readGitIdentity;
  const inspectHostImpl = dependencies.inspectHostImpl || inspectCodexHost;
  const probeThreadImpl = dependencies.probeThreadImpl || probeCodexThreadProfile;
  const runAuthorityProbeImpl = dependencies.runAuthorityProbeImpl || runSystemdAuthorityProbe;
  const inspectBundlesImpl = dependencies.inspectBundlesImpl || inspectApprovedSkillBundleMaterializations;
  const writeReceiptImpl = dependencies.writeReceiptImpl || writeVerifiedCodexAdmissionReceipt;

  const identity = await readGitIdentityImpl({ cwd, gitExecutable });
  if (!identity || identity.repo !== TRUSTED_REPOSITORY) {
    throw new Error(`Trusted Lucubro repository required: expected ${TRUSTED_REPOSITORY}, observed ${identity && identity.repo ? identity.repo : 'unknown'}.`);
  }
  const commit = requiredText(identity.commit, 'trusted checkout commit');
  if (!GIT_SHA.test(commit)) throw new Error(`Trusted checkout commit is not a full Git SHA: ${commit}`);

  const hostDiagnostic = await inspectHostImpl({ cwd });
  const approvedCatalog = selectApprovedLunaCatalog(hostDiagnostic);
  const fullAccessProfile = selectFullAccessPermissionProfile(hostDiagnostic && hostDiagnostic.permissionProfiles);
  const threadObservation = await probeThreadImpl({
    cwd,
    modelId: approvedCatalog.modelId,
    permissionProfileId: requiredText(fullAccessProfile.id, 'full-access provider profile id'),
  });
  const authorityObservation = await runAuthorityProbeImpl({
    cwd,
    systemdRunExecutable,
    gitExecutable,
    scratchRoot,
  });
  const bundleObservations = await inspectBundlesImpl({ dataDir });

  return writeReceiptImpl({
    filePath: receiptFile,
    expectedRepo: TRUSTED_REPOSITORY,
    expectedCommit: commit,
    hostDiagnostic,
    threadObservation,
    authorityObservation,
    bundleObservations,
  });
}

module.exports = {
  TRUSTED_REPOSITORY,
  collectCodexAdmissionOnMachine,
  normalizeGitHubRepository,
  readGitIdentity,
  runSystemdAuthorityProbe,
  selectApprovedLunaCatalog,
  selectFullAccessPermissionProfile,
};
