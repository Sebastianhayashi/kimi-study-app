'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SAFE_ID = /^[a-zA-Z0-9_-]+$/;
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const MAX_SUMMARY_BYTES = 8 * 1024;
const MAX_EVIDENCE_IDS = 64;

function requiredId(value, label) {
  const id = typeof value === 'string' ? value.trim() : '';
  if (!id || !SAFE_ID.test(id)) throw new Error(`${label} must be a safe identifier`);
  return id;
}

function optionalId(value, label) {
  if (value == null || value === '') return null;
  return requiredId(value, label);
}

function truncateUtf8(value, maxBytes) {
  const text = String(value || '');
  const buffer = Buffer.from(text, 'utf8');
  if (buffer.length <= maxBytes) return text;
  let truncated = buffer.subarray(0, maxBytes).toString('utf8');
  if (truncated.endsWith('\uFFFD')) truncated = truncated.slice(0, -1);
  return truncated;
}

function requiredSummary(value) {
  const summary = typeof value === 'string' ? value.trim() : '';
  if (!summary) throw new Error('Project Revision summary is required');
  return truncateUtf8(summary, MAX_SUMMARY_BYTES);
}

function normalizeEvidenceIds(values) {
  if (!Array.isArray(values)) return [];
  const result = [];
  for (const value of values) {
    const id = typeof value === 'string' ? value.trim() : '';
    if (!id || !SAFE_ID.test(id) || result.includes(id)) continue;
    result.push(id);
    if (result.length >= MAX_EVIDENCE_IDS) break;
  }
  return result;
}

function writeJsonAtomic(file, value) {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, file);
}

function createProjectRevisionStore({ rootDir, now = () => new Date().toISOString() } = {}) {
  if (!rootDir) throw new Error('Project Revision store rootDir is required');
  const revisionsDir = path.join(rootDir, 'project-revisions');
  fs.mkdirSync(revisionsDir, { recursive: true });
  const fileFor = (id) => path.join(revisionsDir, `${requiredId(id, 'Project Revision id')}.json`);

  function create(input = {}) {
    const id = requiredId(input.id, 'Project Revision id');
    const file = fileFor(id);
    if (fs.existsSync(file)) throw new Error(`Project Revision already exists: ${id}`);
    const projectId = requiredId(input.projectId, 'Project Revision projectId');
    const stateDigest = typeof input.stateDigest === 'string' ? input.stateDigest.trim() : '';
    if (!DIGEST.test(stateDigest)) throw new Error('Project Revision stateDigest must be sha256:<64 hex>');
    const revision = {
      id,
      projectId,
      parentRevisionId: optionalId(input.parentRevisionId, 'Project Revision parentRevisionId'),
      sourceWorkId: optionalId(input.sourceWorkId, 'Project Revision sourceWorkId'),
      sourceRunId: optionalId(input.sourceRunId, 'Project Revision sourceRunId'),
      evidenceIds: normalizeEvidenceIds(input.evidenceIds),
      summary: requiredSummary(input.summary),
      stateDigest,
      createdAt: now(),
    };
    writeJsonAtomic(file, revision);
    return revision;
  }

  function get(id) {
    const file = fileFor(id);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }

  function listByProject(projectId) {
    const id = requiredId(projectId, 'Project id');
    return fs.readdirSync(revisionsDir)
      .filter((name) => name.endsWith('.json'))
      .map((name) => JSON.parse(fs.readFileSync(path.join(revisionsDir, name), 'utf8')))
      .filter((revision) => revision.projectId === id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  }

  function discardUncommitted(id) {
    const file = fileFor(id);
    if (!fs.existsSync(file)) return false;
    fs.unlinkSync(file);
    return true;
  }

  return { create, get, listByProject, discardUncommitted };
}

module.exports = {
  createProjectRevisionStore,
};
