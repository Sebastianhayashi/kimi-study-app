'use strict';

const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { computeBundleRootDigest } = require('../skill-bundle-materializer');
const { APPROVED_SKILL_BUNDLE_MANIFESTS } = require('../skill-bundle-providers');
const { createSkillBundleStore } = require('../skill-bundle-store');
const { APPROVED_MODEL_ID, APPROVED_REASONING_EFFORT } = require('./codex-profile');

function createLineParser(onLine) {
  let buffer = '';
  return {
    push(chunk) {
      buffer += chunk.toString();
      let index;
      while ((index = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, index).trim();
        buffer = buffer.slice(index + 1);
        if (line) onLine(line);
      }
    },
    flush() {
      const line = buffer.trim();
      buffer = '';
      if (line) onLine(line);
    },
  };
}

function text(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function reasoningEffortId(value) {
  if (typeof value === 'string') return text(value);
  if (!value || typeof value !== 'object') return null;
  return text(value.effort) || text(value.id) || text(value.value) || text(value.name);
}

function sanitizeModel(model) {
  const serviceTiers = Array.isArray(model && model.serviceTiers) ? model.serviceTiers : [];
  const supportedReasoningEfforts = Array.isArray(model && model.supportedReasoningEfforts)
    ? model.supportedReasoningEfforts.map(reasoningEffortId).filter(Boolean)
    : [];
  return {
    id: text(model && model.id),
    model: text(model && model.model),
    displayName: text(model && model.displayName),
    isDefault: Boolean(model && model.isDefault),
    supportedReasoningEfforts,
    defaultServiceTier: model && Object.prototype.hasOwnProperty.call(model, 'defaultServiceTier')
      ? model.defaultServiceTier
      : null,
    additionalSpeedTiers: Array.isArray(model && model.additionalSpeedTiers)
      ? model.additionalSpeedTiers.filter(text)
      : [],
    serviceTierIds: serviceTiers.map((tier) => tier && text(tier.id)).filter(Boolean),
  };
}

function sanitizePermissionProfile(profile) {
  return {
    id: text(profile && profile.id),
    description: text(profile && profile.description),
    allowed: Boolean(profile && profile.allowed),
  };
}

async function inspectCodexHost({
  cwd,
  expectedModelId = APPROVED_MODEL_ID,
  spawnImpl = spawn,
  now = () => new Date().toISOString(),
} = {}) {
  if (typeof spawnImpl !== 'function') throw new Error('Codex host diagnostic requires spawnImpl');
  if (!text(cwd)) throw new Error('Codex host diagnostic cwd is required');
  const modelId = text(expectedModelId);
  if (!modelId) throw new Error('Codex host diagnostic expectedModelId is required');

  const child = spawnImpl('codex', ['app-server'], { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
  const pending = new Map();
  let requestId = 0;
  let stderr = '';
  let closed = false;

  function failPending(error) {
    for (const waiter of pending.values()) waiter.reject(error);
    pending.clear();
  }

  function send(message) {
    child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  function rpc(method, params) {
    return new Promise((resolve, reject) => {
      const id = ++requestId;
      pending.set(id, { resolve, reject });
      send({ method, id, params });
    });
  }

  const parser = createLineParser((line) => {
    const message = JSON.parse(line);
    if (!message || message.id == null || !pending.has(message.id)) return;
    const waiter = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(message.error.message || 'Codex diagnostic RPC failed'));
    else waiter.resolve(message.result);
  });

  child.stdout.on('data', (chunk) => {
    try { parser.push(chunk); }
    catch (error) { failPending(error); }
  });
  child.stderr.on('data', (chunk) => { stderr = `${stderr}${chunk}`.slice(-12000); });
  child.on('error', failPending);
  child.on('close', (code) => {
    closed = true;
    try { parser.flush(); }
    catch (error) { failPending(error); return; }
    if (pending.size) failPending(new Error(stderr.trim() || `codex app-server exited with code ${code}`));
  });

  try {
    const initialize = await rpc('initialize', {
      clientInfo: { name: 'lucubro', title: 'Lucubro', version: '0.1.0' },
      capabilities: { experimentalApi: true },
    });
    send({ method: 'initialized', params: {} });

    const modelResult = await rpc('model/list', { includeHidden: true });
    const configResult = await rpc('config/read', { cwd, includeLayers: true });
    const permissionResult = await rpc('permissionProfile/list', { cwd });

    const models = Array.isArray(modelResult && modelResult.data) ? modelResult.data : [];
    const exactMatches = models
      .filter((model) => model && (model.id === modelId || model.model === modelId))
      .map(sanitizeModel)
      .sort((a, b) => String(a.id || '').localeCompare(String(b.id || '')));
    const uniqueModel = exactMatches.length === 1 ? exactMatches[0] : null;
    const config = configResult && configResult.config && typeof configResult.config === 'object'
      ? configResult.config
      : {};
    const profiles = (Array.isArray(permissionResult && permissionResult.data) ? permissionResult.data : [])
      .map(sanitizePermissionProfile)
      .filter((profile) => profile.id)
      .sort((a, b) => a.id.localeCompare(b.id));

    return {
      kind: 'lucubro-codex-host-diagnostic',
      observedAt: now(),
      appServer: {
        userAgent: text(initialize && initialize.userAgent),
        platformFamily: text(initialize && initialize.platformFamily),
        platformOs: text(initialize && initialize.platformOs),
      },
      approvedModel: uniqueModel
        ? {
          expectedModelId: modelId,
          uniqueMatch: true,
          modelId: uniqueModel.id || uniqueModel.model,
          model: uniqueModel.model,
          displayName: uniqueModel.displayName,
          isDefault: uniqueModel.isDefault,
          supportedReasoningEfforts: uniqueModel.supportedReasoningEfforts,
          maxReasoningEffortSupported: uniqueModel.supportedReasoningEfforts.includes(APPROVED_REASONING_EFFORT),
          defaultServiceTier: uniqueModel.defaultServiceTier,
          additionalSpeedTiers: uniqueModel.additionalSpeedTiers,
          serviceTierIds: uniqueModel.serviceTierIds,
        }
        : {
          expectedModelId: modelId,
          uniqueMatch: false,
          modelId: null,
          matches: exactMatches,
          maxReasoningEffortSupported: false,
        },
      effectiveConfig: {
        modelId: text(config.model),
        modelProvider: text(config.model_provider),
        serviceTier: text(config.service_tier),
      },
      permissionProfiles: profiles,
    };
  } finally {
    if (child.stdin && !child.stdin.destroyed) child.stdin.end();
    if (!closed && child && !child.killed) child.kill('SIGTERM');
  }
}

function inspectSkillBundleMaterializations({
  dataDir,
  approvedManifests = APPROVED_SKILL_BUNDLE_MANIFESTS,
} = {}) {
  if (!text(dataDir)) throw new Error('Skill bundle diagnostic dataDir is required');
  const store = createSkillBundleStore({ rootDir: dataDir });

  return approvedManifests.map((approved) => {
    const manifest = store.get(approved.id);
    const rootExists = Boolean(manifest && manifest.materializedRoot && fs.existsSync(manifest.materializedRoot));
    let observedRootDigest = null;
    let digestError = null;
    if (rootExists) {
      try { observedRootDigest = computeBundleRootDigest(manifest.materializedRoot); }
      catch (error) { digestError = error.message; }
    }
    return {
      id: approved.id,
      pinnedCommit: manifest && manifest.pinnedCommit || null,
      approvedPinnedCommit: approved.pinnedCommit,
      pinnedCommitMatchesApproved: Boolean(manifest && manifest.pinnedCommit === approved.pinnedCommit),
      installationState: manifest && manifest.installationState || null,
      active: Boolean(manifest && manifest.installationState === 'active'),
      materializedRoot: manifest && manifest.materializedRoot || null,
      rootExists,
      manifestRootDigest: manifest && manifest.rootDigest || null,
      observedRootDigest,
      digestMatchesManifest: Boolean(
        manifest
        && manifest.rootDigest
        && observedRootDigest
        && manifest.rootDigest === observedRootDigest,
      ),
      digestError,
    };
  });
}

module.exports = {
  inspectCodexHost,
  inspectSkillBundleMaterializations,
  reasoningEffortId,
  sanitizeModel,
  sanitizePermissionProfile,
};