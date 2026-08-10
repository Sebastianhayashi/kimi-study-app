'use strict';

const STATUSES = new Set(['native', 'overlay-required', 'blocked']);

function requiredText(value, label) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new Error(`${label} is required`);
  return text;
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeDecision(input, fallbackStatus) {
  const status = input && input.status ? input.status : fallbackStatus;
  if (!STATUSES.has(status)) throw new Error(`Invalid Skill compatibility status: ${status}`);
  const reason = input && input.reason ? String(input.reason) : null;
  const overlay = input && input.overlay ? clone(input.overlay) : null;
  if (status === 'overlay-required' && !overlay) {
    throw new Error('overlay-required compatibility requires an overlay');
  }
  return { status, reason, overlay };
}

function createSkillCompatibilityRegistry({ host, policies = [] } = {}) {
  const targetHost = requiredText(host, 'Compatibility host');
  const policyMap = new Map();

  for (const input of policies) {
    const bundleId = requiredText(input && input.bundleId, 'policy.bundleId');
    const bundleCommit = requiredText(input && input.bundleCommit, 'policy.bundleCommit');
    const defaultStatus = input.defaultStatus || 'blocked';
    if (!STATUSES.has(defaultStatus)) throw new Error(`Invalid default compatibility status: ${defaultStatus}`);
    const key = `${bundleId}@${bundleCommit}`;
    if (policyMap.has(key)) throw new Error(`Duplicate Skill compatibility policy: ${key}`);
    const overrides = new Map();
    for (const [skillName, decision] of Object.entries(input.overrides || {})) {
      overrides.set(skillName, normalizeDecision(decision, defaultStatus));
    }
    policyMap.set(key, { bundleId, bundleCommit, defaultStatus, overrides });
  }

  function resolve(metadata = {}) {
    const skillId = requiredText(metadata.id, 'Skill id');
    const bundleId = requiredText(metadata.bundleId, 'Skill bundleId');
    const bundleCommit = requiredText(metadata.bundleCommit, 'Skill bundleCommit');
    const skillName = requiredText(metadata.name, 'Skill name');
    const policy = policyMap.get(`${bundleId}@${bundleCommit}`);
    if (!policy) {
      return {
        host: targetHost,
        skillId,
        bundleId,
        bundleCommit,
        status: 'blocked',
        overlay: null,
        reason: 'No compatible policy for this exact bundle commit.',
      };
    }

    const override = policy.overrides.get(skillName);
    const decision = override || normalizeDecision(null, policy.defaultStatus);
    return {
      host: targetHost,
      skillId,
      bundleId,
      bundleCommit,
      status: decision.status,
      overlay: clone(decision.overlay),
      reason: decision.reason,
    };
  }

  return { resolve };
}

module.exports = {
  createSkillCompatibilityRegistry,
};
