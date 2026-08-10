'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SAFE_ID = /^[a-zA-Z0-9_-]+$/;
const MEMORY_LIMITS = Object.freeze({
  objectiveBytes: 8 * 1024,
  reportFieldBytes: 12 * 1024,
  itemTextBytes: 8 * 1024,
  facts: 64,
  preferences: 48,
  decisions: 64,
  frontiers: 32,
  sourceWorkIds: 64,
  evidenceIds: 64,
});

function assertId(id) {
  if (typeof id !== 'string' || !SAFE_ID.test(id)) throw new Error(`Invalid Project id: ${id}`);
  return id;
}

function writeJsonAtomic(file, value) {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, file);
}

function truncateUtf8(value, maxBytes) {
  const text = String(value || '');
  const buffer = Buffer.from(text, 'utf8');
  if (buffer.length <= maxBytes) return text;
  let truncated = buffer.subarray(0, maxBytes).toString('utf8');
  if (truncated.endsWith('\uFFFD')) truncated = truncated.slice(0, -1);
  return truncated;
}

function boundedText(value, maxBytes) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text ? truncateUtf8(text, maxBytes) : null;
}

function normalizeSources(sources) {
  if (!Array.isArray(sources)) return [];
  return sources
    .filter((source) => source && typeof source.kind === 'string' && typeof source.path === 'string')
    .map((source) => ({
      kind: source.kind,
      path: source.path,
      ...(typeof source.fingerprint === 'string' ? { fingerprint: source.fingerprint } : {}),
      ...(Number.isSafeInteger(source.bytes) && source.bytes >= 0 ? { bytes: source.bytes } : {}),
    }));
}

function normalizeSourceSnapshot(sources) {
  if (!Array.isArray(sources)) return [];
  return sources
    .filter((source) => source && typeof source.kind === 'string' && typeof source.path === 'string' && typeof source.fingerprint === 'string')
    .map((source) => ({
      kind: source.kind,
      path: source.path,
      fingerprint: source.fingerprint,
    }));
}

function normalizeCheckpoint(input, previous = null) {
  if (!input) return previous;
  return {
    status: input.status || null,
    scope: input.scope || null,
    exactTarget: input.exactTarget || null,
    completed: Array.isArray(input.completed) ? input.completed : [],
    evidence: Array.isArray(input.evidence) ? input.evidence : [],
    mutations: Array.isArray(input.mutations) ? input.mutations : [],
    unfinished: Array.isArray(input.unfinished) ? input.unfinished : [],
    nextSafeAction: input.nextSafeAction || null,
    exactReferences: Array.isArray(input.exactReferences) ? input.exactReferences : [],
    suggestedSkills: Array.isArray(input.suggestedSkills) ? input.suggestedSkills : [],
    doNotRepeat: Array.isArray(input.doNotRepeat) ? input.doNotRepeat : [],
    sourceSnapshot: normalizeSourceSnapshot(input.sourceSnapshot),
  };
}

function normalizeKind(value, previous = null) {
  if (value === undefined) return previous;
  if (value === null) return null;
  const kind = typeof value === 'string' ? value.trim() : '';
  if (!kind) throw new Error('Project kind must be a non-empty string when provided');
  return kind;
}

function normalizeReferenceIds(values, limit = MEMORY_LIMITS.evidenceIds) {
  if (!Array.isArray(values)) return [];
  const result = [];
  for (const value of values) {
    const id = typeof value === 'string' ? value.trim() : '';
    if (!id || !SAFE_ID.test(id) || result.includes(id)) continue;
    result.push(id);
    if (result.length >= limit) break;
  }
  return result;
}

function normalizeMemoryItems(values, limit, mapper) {
  if (!Array.isArray(values)) return [];
  const output = [];
  const ids = new Set();
  for (const value of values) {
    if (!value || typeof value !== 'object') continue;
    const id = typeof value.id === 'string' ? value.id.trim() : '';
    if (!id || !SAFE_ID.test(id) || ids.has(id)) continue;
    const item = mapper(value, id);
    if (!item) continue;
    ids.add(id);
    output.push(item);
    if (output.length >= limit) break;
  }
  return output;
}

function normalizeMemory(input, previous = null) {
  if (input === undefined) return previous;
  if (input === null) return null;
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Project memory must be an object when provided');

  const objective = boundedText(input.objective, MEMORY_LIMITS.objectiveBytes);
  const reportInput = input.report && typeof input.report === 'object' && !Array.isArray(input.report) ? input.report : {};
  const report = {
    title: boundedText(reportInput.title, MEMORY_LIMITS.reportFieldBytes),
    summary: boundedText(reportInput.summary, MEMORY_LIMITS.reportFieldBytes),
    changed: boundedText(reportInput.changed, MEMORY_LIMITS.reportFieldBytes),
    nextAction: boundedText(reportInput.nextAction, MEMORY_LIMITS.reportFieldBytes),
    artifactId: boundedText(reportInput.artifactId, 512),
  };

  const facts = normalizeMemoryItems(input.facts, MEMORY_LIMITS.facts, (value, id) => {
    const text = boundedText(value.text, MEMORY_LIMITS.itemTextBytes);
    if (!text) return null;
    return {
      id,
      text,
      status: boundedText(value.status, 128),
      evidenceIds: normalizeReferenceIds(value.evidenceIds),
    };
  });
  const preferences = normalizeMemoryItems(input.preferences, MEMORY_LIMITS.preferences, (value, id) => {
    const text = boundedText(value.text, MEMORY_LIMITS.itemTextBytes);
    return text ? { id, text } : null;
  });
  const decisions = normalizeMemoryItems(input.decisions, MEMORY_LIMITS.decisions, (value, id) => {
    const text = boundedText(value.text, MEMORY_LIMITS.itemTextBytes);
    if (!text) return null;
    return {
      id,
      text,
      status: boundedText(value.status, 128),
      evidenceIds: normalizeReferenceIds(value.evidenceIds),
    };
  });
  const frontiers = normalizeMemoryItems(input.frontiers, MEMORY_LIMITS.frontiers, (value, id) => {
    const title = boundedText(value.title, 1024) || id;
    const summary = boundedText(value.summary, MEMORY_LIMITS.itemTextBytes);
    const nextAction = boundedText(value.nextAction, MEMORY_LIMITS.itemTextBytes);
    return {
      id,
      title,
      status: boundedText(value.status, 128) || 'active',
      summary,
      nextAction,
      evidenceIds: normalizeReferenceIds(value.evidenceIds),
    };
  });

  return {
    schemaVersion: 1,
    objective,
    report,
    facts,
    preferences,
    decisions,
    frontiers,
    sourceWorkIds: normalizeReferenceIds(input.sourceWorkIds, MEMORY_LIMITS.sourceWorkIds),
  };
}

function createProjectStore({ rootDir, now = () => new Date().toISOString() }) {
  if (!rootDir) throw new Error('Project store rootDir is required');
  const projectsDir = path.join(rootDir, 'projects');
  fs.mkdirSync(projectsDir, { recursive: true });
  const fileFor = (id) => path.join(projectsDir, `${assertId(id)}.json`);

  function create(input) {
    assertId(input && input.id);
    const file = fileFor(input.id);
    if (fs.existsSync(file)) throw new Error(`Project already exists: ${input.id}`);
    const timestamp = now();
    const kind = normalizeKind(input.kind, null);
    const memory = normalizeMemory(input.memory, null);
    const project = {
      id: input.id,
      name: String(input.name || path.basename(String(input.repoDir || 'Project'))).trim() || input.id,
      ...(kind ? { kind } : {}),
      repoDir: input.repoDir ? String(input.repoDir) : null,
      isGitRepository: Boolean(input.isGitRepository),
      sources: normalizeSources(input.sources),
      checkpoint: normalizeCheckpoint(input.checkpoint, null),
      ...(memory ? { memory } : {}),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    writeJsonAtomic(file, project);
    return project;
  }

  function get(id) {
    const file = fileFor(id);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }

  function update(id, patch) {
    const current = get(id);
    if (!current) throw new Error(`Project not found: ${id}`);
    const kind = normalizeKind(patch.kind, current.kind || null);
    const memory = patch.memory === undefined ? current.memory : normalizeMemory(patch.memory, current.memory || null);
    const next = {
      ...current,
      ...patch,
      id: current.id,
      ...(kind ? { kind } : {}),
      sources: patch.sources === undefined ? current.sources : normalizeSources(patch.sources),
      checkpoint: patch.checkpoint === undefined ? current.checkpoint : normalizeCheckpoint(patch.checkpoint, current.checkpoint),
      ...(memory ? { memory } : {}),
      updatedAt: now(),
    };
    if (!kind) delete next.kind;
    if (!memory) delete next.memory;
    writeJsonAtomic(fileFor(id), next);
    return next;
  }

  function updateCheckpoint(id, checkpoint) {
    return update(id, { checkpoint: normalizeCheckpoint(checkpoint, null) });
  }

  function updateMemory(id, memory) {
    return update(id, { memory });
  }

  function remove(id) {
    const file = fileFor(id);
    if (!fs.existsSync(file)) return false;
    fs.unlinkSync(file);
    return true;
  }

  function list() {
    return fs.readdirSync(projectsDir)
      .filter((name) => name.endsWith('.json'))
      .map((name) => JSON.parse(fs.readFileSync(path.join(projectsDir, name), 'utf8')))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  return { create, get, update, updateCheckpoint, updateMemory, remove, list };
}

module.exports = { MEMORY_LIMITS, createProjectStore, normalizeMemory };
