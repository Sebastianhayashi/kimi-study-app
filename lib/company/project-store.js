'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SAFE_ID = /^[a-zA-Z0-9_-]+$/;

function assertId(id) {
  if (typeof id !== 'string' || !SAFE_ID.test(id)) throw new Error(`Invalid Project id: ${id}`);
  return id;
}

function writeJsonAtomic(file, value) {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, file);
}

function normalizeSources(sources) {
  if (!Array.isArray(sources)) return [];
  return sources
    .filter((source) => source && typeof source.kind === 'string' && typeof source.path === 'string')
    .map((source) => ({ kind: source.kind, path: source.path }));
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
    const project = {
      id: input.id,
      name: String(input.name || path.basename(String(input.repoDir || 'Project'))).trim() || input.id,
      repoDir: input.repoDir ? String(input.repoDir) : null,
      sources: normalizeSources(input.sources),
      checkpoint: normalizeCheckpoint(input.checkpoint, null),
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
    const next = {
      ...current,
      ...patch,
      id: current.id,
      sources: patch.sources === undefined ? current.sources : normalizeSources(patch.sources),
      checkpoint: patch.checkpoint === undefined ? current.checkpoint : normalizeCheckpoint(patch.checkpoint, current.checkpoint),
      updatedAt: now(),
    };
    writeJsonAtomic(fileFor(id), next);
    return next;
  }

  function updateCheckpoint(id, checkpoint) {
    return update(id, { checkpoint: normalizeCheckpoint(checkpoint, null) });
  }

  function list() {
    return fs.readdirSync(projectsDir)
      .filter((name) => name.endsWith('.json'))
      .map((name) => JSON.parse(fs.readFileSync(path.join(projectsDir, name), 'utf8')))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  return { create, get, update, updateCheckpoint, list };
}

module.exports = { createProjectStore };
