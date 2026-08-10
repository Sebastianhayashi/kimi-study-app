'use strict';

const crypto = require('node:crypto');
const { normalizeMemory } = require('./project-store');

function requiredText(value, label) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new Error(`${label} is required`);
  return text;
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function mergeById(current, updates) {
  const result = Array.isArray(current) ? current.map(clone) : [];
  const index = new Map(result.map((item, position) => [item && item.id, position]));
  for (const update of Array.isArray(updates) ? updates : []) {
    if (!update || typeof update !== 'object') continue;
    const id = typeof update.id === 'string' ? update.id.trim() : '';
    if (!id) continue;
    if (index.has(id)) {
      const position = index.get(id);
      result[position] = { ...result[position], ...clone(update), id };
    } else {
      index.set(id, result.length);
      result.push({ ...clone(update), id });
    }
  }
  return result;
}

function addUnique(current, additions) {
  const result = Array.isArray(current) ? [...current] : [];
  for (const value of Array.isArray(additions) ? additions : []) {
    if (!result.includes(value)) result.push(value);
  }
  return result;
}

function applyProjectMemoryMutation(currentMemory, mutation = {}) {
  if (!currentMemory || typeof currentMemory !== 'object') throw new Error('Project Memory mutation requires existing Project Memory');
  if (!mutation || typeof mutation !== 'object' || Array.isArray(mutation)) throw new Error('Project Memory mutation must be an object');
  const next = clone(currentMemory);
  if (Object.prototype.hasOwnProperty.call(mutation, 'objective')) next.objective = mutation.objective;
  if (mutation.report && typeof mutation.report === 'object' && !Array.isArray(mutation.report)) {
    next.report = { ...(next.report || {}), ...clone(mutation.report) };
  }
  next.facts = mergeById(next.facts, mutation.factsUpsert);
  next.preferences = mergeById(next.preferences, mutation.preferencesUpsert);
  next.decisions = mergeById(next.decisions, mutation.decisionsUpsert);
  next.frontiers = mergeById(next.frontiers, mutation.frontiersUpsert);
  next.sourceWorkIds = addUnique(next.sourceWorkIds, mutation.sourceWorkIdsAdd);
  return normalizeMemory(next, currentMemory);
}

function memoryDigest(memory) {
  const normalized = normalizeMemory(memory, null);
  if (!normalized) throw new Error('Project Memory digest requires memory');
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex')}`;
}

function createProjectMemoryService({
  projectStore,
  revisionStore,
  createRevisionId = () => `revision_${crypto.randomUUID()}`,
} = {}) {
  if (!projectStore || typeof projectStore.get !== 'function' || typeof projectStore.update !== 'function') {
    throw new Error('Project Memory service requires ProjectStore');
  }
  if (!revisionStore || typeof revisionStore.create !== 'function' || typeof revisionStore.discardUncommitted !== 'function') {
    throw new Error('Project Memory service requires ProjectRevisionStore');
  }

  function commit({
    projectId,
    sourceWorkId = null,
    sourceRunId = null,
    evidenceIds = [],
    summary,
    mutation,
  } = {}) {
    const id = requiredText(projectId, 'Project id');
    const current = projectStore.get(id);
    if (!current) throw new Error(`Project not found: ${id}`);
    if (!current.memory || typeof current.memory !== 'object') throw new Error(`Project has no durable Project Memory: ${id}`);
    const nextMemory = applyProjectMemoryMutation(current.memory, mutation);
    const revisionId = requiredText(createRevisionId(), 'Project Revision id');
    const revision = revisionStore.create({
      id: revisionId,
      projectId: current.id,
      parentRevisionId: current.memoryRevisionId || null,
      sourceWorkId,
      sourceRunId,
      evidenceIds,
      summary: requiredText(summary, 'Project Revision summary'),
      stateDigest: memoryDigest(nextMemory),
    });

    let project;
    try {
      project = projectStore.update(current.id, {
        memory: nextMemory,
        memoryRevisionId: revision.id,
      });
    } catch (error) {
      revisionStore.discardUncommitted(revision.id);
      throw error;
    }
    return { project, revision };
  }

  return { commit };
}

module.exports = {
  applyProjectMemoryMutation,
  createProjectMemoryService,
  memoryDigest,
};
