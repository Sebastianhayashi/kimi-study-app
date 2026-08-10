'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const SAFE_ID = /^[a-zA-Z0-9_-]+$/;
const SAFE_REASON = /^[a-z0-9][a-z0-9._-]*$/;

function assertId(value, label) {
  const id = typeof value === 'string' ? value.trim() : '';
  if (!id || !SAFE_ID.test(id)) throw new Error(`Invalid ${label}: ${value}`);
  return id;
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function writeJsonAtomic(file, value) {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, file);
}

function createArtifactReferenceStore({
  rootDir,
  workStore,
  artifactStore,
  now = () => new Date().toISOString(),
  createId = () => `reference_${crypto.randomUUID()}`,
} = {}) {
  if (!rootDir) throw new Error('Artifact reference store rootDir is required');
  if (!workStore || typeof workStore.get !== 'function') throw new Error('Artifact reference store requires WorkStore');
  if (!artifactStore || typeof artifactStore.get !== 'function') throw new Error('Artifact reference store requires CanvasArtifactStore');

  const referencesDir = path.join(rootDir, 'artifact-references');
  fs.mkdirSync(referencesDir, { recursive: true });
  const fileFor = (id) => path.join(referencesDir, `${assertId(id, 'Artifact reference id')}.json`);

  function get(id) {
    const file = fileFor(id);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }

  function list() {
    return fs.readdirSync(referencesDir)
      .filter((name) => name.endsWith('.json'))
      .map((name) => JSON.parse(fs.readFileSync(path.join(referencesDir, name), 'utf8')))
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
  }

  function create({
    fromWorkId,
    toArtifactId,
    toBlockId,
    reasonCode,
    mode = 'snapshot',
  } = {}) {
    const sourceWorkId = assertId(fromWorkId, 'source Work id');
    const targetArtifactId = assertId(toArtifactId, 'target Artifact id');
    const targetBlockId = assertId(toBlockId, 'target Artifact block id');
    if (mode !== 'snapshot') throw new Error(`Artifact reference mode is unsupported: ${mode}`);
    const normalizedReason = typeof reasonCode === 'string' ? reasonCode.trim().toLowerCase() : '';
    if (!SAFE_REASON.test(normalizedReason)) throw new Error('Artifact reference reasonCode is required');

    const sourceWork = workStore.get(sourceWorkId);
    if (!sourceWork) throw new Error(`Work not found: ${sourceWorkId}`);
    const artifact = artifactStore.get(targetArtifactId);
    if (!artifact) throw new Error(`Artifact not found: ${targetArtifactId}`);
    const targetWork = workStore.get(artifact.workId);
    if (!targetWork) throw new Error(`Artifact owning Work not found: ${artifact.workId}`);
    const block = Array.isArray(artifact.blocks) ? artifact.blocks.find((item) => item.id === targetBlockId) : null;
    if (!block) throw new Error(`Artifact block not found: ${targetBlockId}`);

    const id = assertId(createId(), 'Artifact reference id');
    if (get(id)) throw new Error(`Artifact reference already exists: ${id}`);
    const snapshot = {
      type: block.type,
      material: block.material === true,
      content: clone(block.content || {}),
      evidenceRefs: Array.isArray(block.evidenceRefs) ? [...block.evidenceRefs] : [],
      references: Array.isArray(block.references) ? clone(block.references) : [],
    };
    if (block.staticFallback) snapshot.staticFallback = clone(block.staticFallback);

    const reference = {
      id,
      fromWorkId: sourceWork.id,
      fromProjectId: sourceWork.projectId || null,
      toWorkId: targetWork.id,
      toProjectId: targetWork.projectId || artifact.projectId || null,
      toArtifactId: artifact.id,
      toBlockId: block.id,
      mode: 'snapshot',
      reasonCode: normalizedReason,
      sourceArtifactRevision: artifact.revision || 1,
      snapshot,
      createdAt: now(),
    };
    writeJsonAtomic(fileFor(id), reference);
    return clone(reference);
  }

  function listByWork(workId) {
    const id = assertId(workId, 'Work id');
    return list().filter((reference) => reference.fromWorkId === id);
  }

  function listByTargetArtifact(artifactId) {
    const id = assertId(artifactId, 'Artifact id');
    return list().filter((reference) => reference.toArtifactId === id);
  }

  return {
    create,
    get,
    list,
    listByWork,
    listByTargetArtifact,
  };
}

module.exports = {
  createArtifactReferenceStore,
};
