'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const SAFE_ID = /^[a-zA-Z0-9_-]+$/;
const SAFE_KIND = /^[a-z0-9][a-z0-9._-]*$/;
const DEFAULT_MAX_BYTES = 64 * 1024 * 1024;

function assertId(value, label) {
  if (typeof value !== 'string' || !SAFE_ID.test(value)) throw new Error(`Invalid ${label} id: ${value}`);
  return value;
}

function atomicWrite(file, value) {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, value);
  fs.renameSync(tmp, file);
}

function cloneMetadata(value) {
  if (value == null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('Evidence metadata must be an object');
  return JSON.parse(JSON.stringify(value));
}

function createEvidenceStore({
  rootDir,
  now = () => new Date().toISOString(),
  createId = () => `evidence_${crypto.randomUUID()}`,
  maxBytes = DEFAULT_MAX_BYTES,
} = {}) {
  if (!rootDir) throw new Error('Evidence store rootDir is required');
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw new Error('Evidence maxBytes must be a positive integer');

  const evidenceDir = path.join(rootDir, 'evidence');
  const metadataDir = path.join(evidenceDir, 'metadata');
  const contentDir = path.join(evidenceDir, 'content');
  fs.mkdirSync(metadataDir, { recursive: true });
  fs.mkdirSync(contentDir, { recursive: true });

  const metadataPath = (id) => path.join(metadataDir, `${assertId(id, 'Evidence')}.json`);
  const contentPath = (id) => path.join(contentDir, `${assertId(id, 'Evidence')}.bin`);

  function get(id) {
    const file = metadataPath(id);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }

  function create(input = {}) {
    const id = assertId(input.id || createId(), 'Evidence');
    const runId = assertId(input.runId, 'Run');
    const workId = assertId(input.workId, 'Work');
    const workerId = assertId(input.workerId, 'Worker');
    const kind = String(input.kind || '').trim().toLowerCase();
    if (!SAFE_KIND.test(kind)) throw new Error(`Invalid Evidence kind: ${input.kind}`);
    const label = String(input.label || '').trim();
    if (!label) throw new Error('Evidence label is required');
    const mimeType = String(input.mimeType || 'application/octet-stream').trim().toLowerCase();
    if (!mimeType || mimeType.length > 160 || /[\r\n]/.test(mimeType)) throw new Error('Invalid Evidence mimeType');
    const source = String(input.source || 'runtime').trim();
    if (!source || source.length > 80) throw new Error('Invalid Evidence source');
    if (get(id)) throw new Error(`Evidence already exists: ${id}`);

    const content = Buffer.isBuffer(input.content) ? Buffer.from(input.content) : Buffer.from(input.content == null ? '' : String(input.content), 'utf8');
    if (content.byteLength > maxBytes) throw new Error(`Evidence content exceeds ${maxBytes} byte limit`);

    const record = {
      id,
      runId,
      workId,
      workerId,
      kind,
      label,
      mimeType,
      source,
      metadata: cloneMetadata(input.metadata),
      byteLength: content.byteLength,
      sha256: crypto.createHash('sha256').update(content).digest('hex'),
      createdAt: now(),
    };

    atomicWrite(contentPath(id), content);
    try {
      atomicWrite(metadataPath(id), Buffer.from(`${JSON.stringify(record, null, 2)}\n`, 'utf8'));
    } catch (error) {
      fs.rmSync(contentPath(id), { force: true });
      throw error;
    }
    return record;
  }

  function listMetadata() {
    return fs.readdirSync(metadataDir)
      .filter((name) => name.endsWith('.json'))
      .map((name) => JSON.parse(fs.readFileSync(path.join(metadataDir, name), 'utf8')))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  function listByRun(runId) {
    const safeRunId = assertId(runId, 'Run');
    return listMetadata().filter((item) => item.runId === safeRunId);
  }

  function listByWork(workId) {
    const safeWorkId = assertId(workId, 'Work');
    return listMetadata().filter((item) => item.workId === safeWorkId);
  }

  function readContent(id) {
    const file = contentPath(id);
    if (!fs.existsSync(file)) throw new Error(`Evidence content not found: ${id}`);
    return fs.readFileSync(file);
  }

  return { create, get, listByRun, listByWork, readContent };
}

module.exports = { createEvidenceStore };
