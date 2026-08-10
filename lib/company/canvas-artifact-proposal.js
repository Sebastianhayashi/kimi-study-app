'use strict';

const PROPOSAL_BLOCK_TYPES = new Set([
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

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function requiredText(value, label) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new Error(`${label} is required`);
  return text;
}

function assertNoRendererOwnedFields(value, label) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoRendererOwnedFields(item, `${label}[${index}]`));
    return;
  }
  for (const [key, nested] of Object.entries(value)) {
    if (RENDERER_OWNED_FIELDS.has(key)) throw new Error(`${label} contains renderer-owned field: ${key}`);
    assertNoRendererOwnedFields(nested, `${label}.${key}`);
  }
}

function normalizeEvidenceRefs(value) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new Error('Semantic Artifact block evidenceRefs must be an array');
  const refs = value.map((item) => requiredText(item, 'Semantic Artifact Evidence reference'));
  if (new Set(refs).size !== refs.length) throw new Error('Semantic Artifact block contains duplicate Evidence references');
  return refs;
}

function normalizeReferences(value) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new Error('Semantic Artifact block references must be an array');
  return clone(value);
}

function inputContent(block) {
  return block.content && typeof block.content === 'object' && !Array.isArray(block.content)
    ? clone(block.content)
    : {};
}

function normalizeContent(block, type, label) {
  const content = inputContent(block);

  if (['heading', 'paragraph', 'claim', 'quote', 'callout'].includes(type)) {
    content.text = requiredText(content.text || block.text, `${label} text`);
    return content;
  }

  if (type === 'list') {
    const items = Array.isArray(content.items) ? content.items : block.items;
    if (!Array.isArray(items) || items.length === 0) throw new Error(`${label} items are required`);
    content.items = items.map((item) => requiredText(item, `${label} item`));
    return content;
  }

  if (type === 'code') {
    content.text = requiredText(content.text || block.code || block.text, `${label} code text`);
    if (!content.language && nonEmptyString(block.language)) content.language = block.language.trim();
    return content;
  }

  if (type === 'interaction') {
    if (!block.content || typeof block.content !== 'object' || Array.isArray(block.content)) {
      throw new Error(`${label} interaction content is required`);
    }
    content.kind = requiredText(content.kind, `${label} interaction kind`);
    content.prompt = requiredText(content.prompt, `${label} interaction prompt`);
    return content;
  }

  if (Object.keys(content).length === 0) {
    throw new Error(`${label} content is required`);
  }
  return content;
}

function normalizeStaticFallback(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Semantic Artifact interaction requires a static fallback');
  }
  const type = requiredText(input.type, 'Semantic Artifact static fallback type');
  if (!STATIC_FALLBACK_TYPES.has(type)) {
    throw new Error(`Semantic Artifact static fallback must use a semantic block type: ${type}`);
  }
  assertNoRendererOwnedFields(input, 'Semantic Artifact static fallback');
  return {
    type,
    content: normalizeContent(input, type, 'Semantic Artifact static fallback'),
    evidenceRefs: normalizeEvidenceRefs(input.evidenceRefs),
  };
}

function normalizeArtifactBlockProposal(block) {
  if (!block || typeof block !== 'object' || Array.isArray(block)) {
    throw new Error('Artifact output requires a semantic Artifact block');
  }
  const type = requiredText(block.type, 'Semantic Artifact block type');
  if (!PROPOSAL_BLOCK_TYPES.has(type)) {
    throw new Error(`Artifact output must use a semantic Artifact block, not renderer-owned ${type}`);
  }
  assertNoRendererOwnedFields(block, 'Semantic Artifact block');

  const normalized = {
    type,
    material: block.material === true,
    content: normalizeContent(block, type, 'Semantic Artifact block'),
    evidenceRefs: normalizeEvidenceRefs(block.evidenceRefs),
    references: normalizeReferences(block.references),
  };
  if (type === 'interaction') normalized.staticFallback = normalizeStaticFallback(block.staticFallback);
  return normalized;
}

module.exports = {
  PROPOSAL_BLOCK_TYPES,
  normalizeArtifactBlockProposal,
};
