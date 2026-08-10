'use strict';

const SAFE_ID = /^[a-zA-Z0-9_-]+$/;

function optionalId(value, label) {
  if (value == null || value === '') return null;
  const id = typeof value === 'string' ? value.trim() : '';
  if (!id || !SAFE_ID.test(id)) throw new Error(`Invalid ${label}: ${value}`);
  return id;
}

function requiredId(value, label) {
  const id = optionalId(value, label);
  if (!id) throw new Error(`${label} is required`);
  return id;
}

function evaluateIssueProposal(input = {}) {
  const workId = requiredId(input.workId, 'Work id');
  const projectId = optionalId(input.projectId, 'Project id');
  const frontier = typeof input.frontier === 'string' && input.frontier.trim() ? input.frontier.trim() : null;
  const independentlyTrackable = input.independentlyTrackable === true;
  const trackerConfigured = input.trackerConfigured === true;
  const trackerAuthorityGranted = input.trackerAuthorityGranted === true;
  const artifactCount = Number.isSafeInteger(input.artifactCount) && input.artifactCount > 0 ? input.artifactCount : 0;
  const eligible = Boolean(projectId && frontier && independentlyTrackable);
  const reasonCodes = [];

  if (artifactCount > 0) reasonCodes.push('artifact-output-is-not-issue-signal');
  if (projectId) reasonCodes.push('project-context-present');
  else reasonCodes.push('no-project-context');
  if (frontier) reasonCodes.push('project-frontier');
  else reasonCodes.push('no-project-frontier');
  if (independentlyTrackable) reasonCodes.push('independently-trackable');
  else reasonCodes.push('not-independently-trackable');
  if (trackerConfigured) reasonCodes.push('tracker-configured');
  else reasonCodes.push('tracker-not-configured');
  if (trackerAuthorityGranted) reasonCodes.push('tracker-authority-present');
  else if (eligible) reasonCodes.push('tracker-authority-required');

  return Object.freeze({
    schemaVersion: 1,
    workId,
    projectId,
    frontier,
    eligible,
    issueAction: eligible ? 'propose' : 'none',
    requiresTrackerAuthority: eligible && !trackerAuthorityGranted,
    reasonCodes: Object.freeze(reasonCodes),
  });
}

module.exports = {
  evaluateIssueProposal,
};
