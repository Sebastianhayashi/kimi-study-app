'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { normalizeRelativeDeliverablePath } = require('./file-deliverable');

const SAFE_ID = /^[a-zA-Z0-9_-]+$/;
const SEMANTIC_BLOCK_TYPES = new Set([
  'heading',
  'paragraph',
  'claim',
  'quote',
  'list',
  'table',
  'image',
  'callout',
  'code',
  'interaction',
  'file-reference',
]);
const STATIC_FALLBACK_TYPES = new Set([
  'heading',
  'paragraph',
  'claim',
  'quote',
  'list',
  'table',
  'image',
  'callout',
  'code',
  'file-reference',
]);
const RENDERER_OWNED_FIELDS = new Set([
  'html',
  'markdown',
  'jsx',
  'react',
  'component',
  'renderer',
  'dom',
  'css',
  'template',
]);
const REFERENCE_MODES = new Set(['snapshot', 'link']);

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function requiredText(value, label) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new Error(`${label} is required`);
  return text;
}

function assertId(value, label) {
  const id = requiredText(value, label);
  if (!SAFE_ID.test(id)) throw new Error(`Invalid ${label}: ${id}`);
  return id;
}

function assertNoRendererOwnedFields(value, label = 'Canvas Artifact') {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoRendererOwnedFields(item, `${label}[${index}]`));
    return;
  }
  for (const [key, nested] of Object.entries(value)) {
    if (RENDERER_OWNED_FIELDS.has(key)) {
      throw new Error(`${label} contains renderer-owned field: ${key}`);
    }
    assertNoRendererOwnedFields(nested, `${label}.${key}`);
  }
}

function writeAtomic(file, value) {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, file);
}

function normalizeTextContent(content, label) {
  if (!content || typeof content !== 'object' || Array.isArray(content)) throw new Error(`${label} content must be an object`);
  return { ...clone(content), text: requiredText(content.text, `${label} text`) };
}

function normalizeListContent(content, label) {
  if (!content || typeof content !== 'object' || Array.isArray(content)) throw new Error(`${label} content must be an object`);
  if (!Array.isArray(content.items) || content.items.length === 0) throw new Error(`${label} items are required`);
  const items = content.items.map((item) => requiredText(item, `${label} item`));
  return { ...clone(content), items };
}

function normalizeGenericContent(content, label) {
  if (!content || typeof content !== 'object' || Array.isArray(content)) throw new Error(`${label} content must be an object`);
  if (Object.keys(content).length === 0) throw new Error(`${label} content cannot be empty`);
  return clone(content);
}

function normalizeContent(type, content, label) {
  if (['heading', 'paragraph', 'claim', 'quote', 'callout'].includes(type)) return normalizeTextContent(content, label);
  if (type === 'list') return normalizeListContent(content, label);
  if (type === 'code') {
    const normalized = normalizeGenericContent(content, label);
    normalized.text = requiredText(content.text, `${label} text`);
    return normalized;
  }
  if (type === 'interaction') {
    const normalized = normalizeGenericContent(content, label);
    normalized.kind = requiredText(content.kind, `${label} interaction kind`);
    normalized.prompt = requiredText(content.prompt, `${label} interaction prompt`);
    return normalized;
  }
  if (type === 'file-reference') {
    const normalized = normalizeGenericContent(content, label);
    normalized.path = normalizeRelativeDeliverablePath(content.path);
    normalized.label = requiredText(content.label, `${label} file label`);
    normalized.mimeType = requiredText(content.mimeType, `${label} file mimeType`).toLowerCase();
    normalized.evidenceId = assertId(content.evidenceId, `${label} file Evidence id`);
    return normalized;
  }
  return normalizeGenericContent(content, label);
}

function normalizeReference(reference, label) {
  if (!reference || typeof reference !== 'object' || Array.isArray(reference)) throw new Error(`${label} reference must be an object`);
  const mode = requiredText(reference.mode || 'snapshot', `${label} reference mode`);
  if (!REFERENCE_MODES.has(mode)) throw new Error(`${label} reference mode is unsupported: ${mode}`);
  return {
    artifactId: assertId(reference.artifactId, `${label} reference Artifact id`),
    blockId: assertId(reference.blockId, `${label} reference block id`),
    mode,
  };
}

function createCanvasArtifactStore({
  rootDir,
  evidenceStore,
  now = () => new Date().toISOString(),
  createArtifactId = () => `artifact_${crypto.randomUUID()}`,
  createBlockId = () => `block_${crypto.randomUUID()}`,
} = {}) {
  if (!rootDir) throw new Error('Canvas Artifact store rootDir is required');
  if (!evidenceStore || typeof evidenceStore.get !== 'function') throw new Error('Canvas Artifact store requires EvidenceStore');
  const artifactsDir = path.join(rootDir, 'canvas-artifacts');
  fs.mkdirSync(artifactsDir, { recursive: true });
  const fileFor = (id) => path.join(artifactsDir, `${assertId(id, 'Canvas Artifact id')}.json`);

  function get(id) {
    const file = fileFor(id);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }

  function validateEvidenceRefs(workId, refs, label) {
    if (!Array.isArray(refs)) throw new Error(`${label} evidenceRefs must be an array`);
    const seen = new Set();
    return refs.map((value) => {
      const evidenceId = assertId(value, `${label} Evidence id`);
      if (seen.has(evidenceId)) throw new Error(`${label} contains duplicate Evidence reference: ${evidenceId}`);
      seen.add(evidenceId);
      const evidence = evidenceStore.get(evidenceId);
      if (!evidence) throw new Error(`Evidence not found for ${label}: ${evidenceId}`);
      if (evidence.workId !== workId) throw new Error(`${label} Evidence must belong to the owning Work: ${evidenceId}`);
      return evidenceId;
    });
  }

  function normalizeStaticFallback(fallback, workId, label) {
    if (!fallback || typeof fallback !== 'object' || Array.isArray(fallback)) throw new Error(`${label} interaction requires a static fallback`);
    assertNoRendererOwnedFields(fallback, `${label} static fallback`);
    const type = requiredText(fallback.type, `${label} static fallback type`);
    if (!STATIC_FALLBACK_TYPES.has(type)) throw new Error(`${label} static fallback must use a semantic block type`);
    const evidenceRefs = validateEvidenceRefs(workId, Array.isArray(fallback.evidenceRefs) ? fallback.evidenceRefs : [], `${label} static fallback`);
    return {
      type,
      content: normalizeContent(type, fallback.content, `${label} static fallback`),
      evidenceRefs,
    };
  }

  function normalizeBlock(input, workId, index) {
    const label = `Canvas Artifact block ${index + 1}`;
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error(`${label} must be an object`);
    assertNoRendererOwnedFields(input, label);
    const type = requiredText(input.type, `${label} type`);
    if (!SEMANTIC_BLOCK_TYPES.has(type)) throw new Error(`${label} must use a semantic block type: ${type}`);
    const id = input.id == null ? assertId(createBlockId(), `${label} id`) : assertId(input.id, `${label} id`);
    const evidenceRefs = validateEvidenceRefs(workId, Array.isArray(input.evidenceRefs) ? input.evidenceRefs : [], label);
    const references = (Array.isArray(input.references) ? input.references : []).map((reference) => normalizeReference(reference, label));
    const material = input.material === true;
    if (material && evidenceRefs.length === 0) throw new Error(`${label} material content requires Evidence`);
    const content = normalizeContent(type, input.content, label);

    if (type === 'file-reference') {
      if (!evidenceRefs.includes(content.evidenceId)) throw new Error(`${label} file Evidence must appear in evidenceRefs`);
      const evidence = evidenceStore.get(content.evidenceId);
      if (!evidence || evidence.kind !== 'deliverable-file') throw new Error(`${label} must reference a deliverable-file Evidence receipt`);
      const receiptPath = evidence.metadata && evidence.metadata.path;
      if (receiptPath && receiptPath !== content.path) throw new Error(`${label} file path does not match its Evidence receipt`);
    }

    const block = {
      id,
      type,
      material,
      content,
      evidenceRefs,
      references,
    };
    if (type === 'interaction') block.staticFallback = normalizeStaticFallback(input.staticFallback, workId, label);
    return block;
  }

  function create(input = {}) {
    assertNoRendererOwnedFields(input);
    const id = assertId(createArtifactId(), 'Canvas Artifact id');
    if (get(id)) throw new Error(`Canvas Artifact already exists: ${id}`);
    const workId = assertId(input.workId, 'Work id');
    const projectId = input.projectId == null ? null : assertId(input.projectId, 'Project id');
    const title = requiredText(input.title, 'Canvas Artifact title');
    if (!Array.isArray(input.blocks)) throw new Error('Canvas Artifact blocks must be an array');
    const blocks = input.blocks.map((block, index) => normalizeBlock(block, workId, index));
    const blockIds = new Set();
    for (const block of blocks) {
      if (blockIds.has(block.id)) throw new Error(`Duplicate Canvas Artifact block id: ${block.id}`);
      blockIds.add(block.id);
    }
    const timestamp = now();
    const artifact = {
      schemaVersion: 1,
      id,
      workId,
      projectId,
      title,
      revision: 1,
      blocks,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    writeAtomic(fileFor(id), artifact);
    return clone(artifact);
  }

  function listByWork(workId) {
    const safeWorkId = assertId(workId, 'Work id');
    return fs.readdirSync(artifactsDir)
      .filter((name) => name.endsWith('.json'))
      .map((name) => JSON.parse(fs.readFileSync(path.join(artifactsDir, name), 'utf8')))
      .filter((artifact) => artifact.workId === safeWorkId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  return {
    create,
    get,
    listByWork,
  };
}

module.exports = {
  createCanvasArtifactStore,
  SEMANTIC_BLOCK_TYPES,
};
