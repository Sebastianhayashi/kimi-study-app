'use strict';

const REQUIRED_FIELDS = Object.freeze(['modelId', 'mode', 'fast', 'permissionProfile']);

function createApprovedCodexProfile({ modelId } = {}) {
  const normalizedModelId = typeof modelId === 'string' ? modelId.trim() : '';
  if (!normalizedModelId) throw new Error('Luna Max model id is required');
  return {
    profileName: 'Luna Max',
    modelId: normalizedModelId,
    mode: 'default',
    fast: false,
    permissionProfile: 'full-access',
  };
}

function verifyCodexProfile({ policy, observed } = {}) {
  if (!policy || typeof policy !== 'object') throw new Error('Codex profile policy is required');
  const actual = observed && typeof observed === 'object' ? observed : {};
  const unknown = [];
  const mismatches = [];

  for (const field of REQUIRED_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(actual, field) || actual[field] == null) {
      unknown.push(field);
      continue;
    }
    if (!Object.is(actual[field], policy[field])) {
      mismatches.push({ field, expected: policy[field], observed: actual[field] });
    }
  }

  return {
    admitted: unknown.length === 0 && mismatches.length === 0,
    profileName: policy.profileName || 'Luna Max',
    requested: { ...policy },
    observed: { ...actual },
    unknown,
    mismatches,
  };
}

module.exports = {
  REQUIRED_FIELDS,
  createApprovedCodexProfile,
  verifyCodexProfile,
};
