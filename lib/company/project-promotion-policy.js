'use strict';

const SAFE_ID = /^[a-zA-Z0-9_-]+$/;

function requiredId(value, label) {
  const id = typeof value === 'string' ? value.trim() : '';
  if (!id || !SAFE_ID.test(id)) throw new Error(`Invalid ${label}: ${value}`);
  return id;
}

function normalizeRelatedWorkIds(anchorWorkId, values) {
  if (values == null) return [];
  if (!Array.isArray(values)) throw new Error('relatedWorkIds must be an array');
  const ids = values.map((value) => requiredId(value, 'related Work id'));
  const unique = [...new Set(ids.filter((id) => id !== anchorWorkId))];
  return unique;
}

function normalizeFrontier(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function evaluateProjectPromotion(input = {}) {
  const anchorWorkId = requiredId(input.anchorWorkId, 'anchor Work id');
  const relatedWorkIds = normalizeRelatedWorkIds(anchorWorkId, input.relatedWorkIds);
  const artifactReferenceCount = Number.isSafeInteger(input.artifactReferenceCount) && input.artifactReferenceCount > 0
    ? input.artifactReferenceCount
    : 0;
  const explicitOngoingIntent = input.explicitOngoingIntent === true;
  const persistentObjective = input.persistentObjective === true || explicitOngoingIntent;
  const frontier = normalizeFrontier(input.frontier);
  const multiStage = input.multiStage === true;
  const longRunning = input.longRunning === true;
  const hasContinuitySignal = relatedWorkIds.length > 0 || multiStage || longRunning;
  const eligible = persistentObjective && Boolean(frontier) && hasContinuitySignal;
  const reasonCodes = [];

  if (artifactReferenceCount > 0) reasonCodes.push('artifact-reuse-present');
  if (relatedWorkIds.length > 0) reasonCodes.push('repeated-related-work');
  if (multiStage) reasonCodes.push('multi-stage-work');
  if (longRunning) reasonCodes.push('long-running-work');
  if (persistentObjective) reasonCodes.push('persistent-objective');
  else reasonCodes.push('no-persistent-objective');
  if (explicitOngoingIntent) reasonCodes.push('explicit-ongoing-intent');
  if (frontier) reasonCodes.push('unresolved-frontier');
  else reasonCodes.push('no-unresolved-frontier');
  if (!hasContinuitySignal) reasonCodes.push('single-lightweight-work');

  return Object.freeze({
    schemaVersion: 1,
    decision: eligible ? 'eligible' : 'stay-work',
    projectAction: eligible ? 'propose' : 'none',
    reversible: true,
    anchorWorkId,
    workIds: Object.freeze([anchorWorkId, ...relatedWorkIds]),
    signals: Object.freeze({
      relatedWorkCount: relatedWorkIds.length,
      artifactReferenceCount,
      persistentObjective,
      explicitOngoingIntent,
      frontierPresent: Boolean(frontier),
      multiStage,
      longRunning,
    }),
    frontier,
    reasonCodes: Object.freeze(reasonCodes),
    preserves: Object.freeze({
      workIds: true,
      artifactIds: true,
    }),
  });
}

module.exports = {
  evaluateProjectPromotion,
};
