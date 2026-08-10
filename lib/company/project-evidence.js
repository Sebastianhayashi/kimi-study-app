'use strict';

function collectReferenceIds(memory) {
  const ids = [];
  const seen = new Set();
  const collections = [memory && memory.facts, memory && memory.decisions, memory && memory.frontiers];
  for (const collection of collections) {
    for (const item of Array.isArray(collection) ? collection : []) {
      for (const id of Array.isArray(item && item.evidenceIds) ? item.evidenceIds : []) {
        if (typeof id !== 'string' || !id.trim() || seen.has(id)) continue;
        seen.add(id);
        ids.push(id);
      }
    }
  }
  return ids;
}

function projectEvidence(project, evidenceStore) {
  if (!project || !project.id || !project.memory || !evidenceStore || typeof evidenceStore.get !== 'function') return [];
  const sourceWorkIds = new Set(Array.isArray(project.memory.sourceWorkIds) ? project.memory.sourceWorkIds : []);
  return collectReferenceIds(project.memory)
    .map((id) => evidenceStore.get(id))
    .filter((item) => item && sourceWorkIds.has(item.workId));
}

module.exports = { collectReferenceIds, projectEvidence };
