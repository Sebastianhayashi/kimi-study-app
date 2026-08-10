'use strict';

const APPROVED_MODEL_ID = 'gpt-5.6-luna';
const APPROVED_REASONING_EFFORT = 'max';
const APPROVED_MODE = 'default';
const APPROVED_PERMISSION_PROFILE = 'full-access';
const REQUIRED_FIELDS = Object.freeze([
  'modelId',
  'reasoningEffort',
  'mode',
  'fast',
  'permissionProfile',
]);

function createApprovedCodexProfile() {
  return {
    modelId: APPROVED_MODEL_ID,
    reasoningEffort: APPROVED_REASONING_EFFORT,
    mode: APPROVED_MODE,
    fast: false,
    permissionProfile: APPROVED_PERMISSION_PROFILE,
  };
}

function verifyCodexProfile({ policy = createApprovedCodexProfile(), observed } = {}) {
  if (!policy || typeof policy !== 'object') throw new Error('Codex execution profile policy is required');
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
    requested: { ...policy },
    observed: { ...actual },
    unknown,
    mismatches,
  };
}

function isApprovedCodexProfile(observed) {
  return verifyCodexProfile({ observed }).admitted;
}

module.exports = {
  APPROVED_MODEL_ID,
  APPROVED_MODE,
  APPROVED_PERMISSION_PROFILE,
  APPROVED_REASONING_EFFORT,
  REQUIRED_FIELDS,
  createApprovedCodexProfile,
  isApprovedCodexProfile,
  verifyCodexProfile,
};