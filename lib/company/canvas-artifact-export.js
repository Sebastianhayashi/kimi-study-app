'use strict';

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function requiredText(value, label) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new Error(`${label} is required`);
  return text;
}

function safeExternalUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

function markdownLiteral(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\\/g, '\\\\')
    .replace(/[!\[\]${}@*_`~^]/g, '\\$&')
    .replace(/(^|\n)([ \t]*)([-+*>#])(?=\s|$)/g, '$1$2\\$3')
    .replace(/(^|\n)([ \t]*\d+)\.(?=\s)/g, '$1$2\\.');
}

function markdownCell(value) {
  return markdownLiteral(value)
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, '<br>');
}

function markdownList(items) {
  return (Array.isArray(items) ? items : []).map((item) => `- ${markdownLiteral(item)}`).join('\n');
}

function markdownTable(content) {
  const columns = Array.isArray(content && content.columns) ? content.columns : [];
  const rows = Array.isArray(content && content.rows) ? content.rows : [];
  if (!columns.length) return rows.map((row) => Array.isArray(row) ? row.map(markdownCell).join(' | ') : '').filter(Boolean).join('\n');
  const head = `| ${columns.map(markdownCell).join(' | ')} |`;
  const divider = `| ${columns.map(() => '---').join(' | ')} |`;
  const body = rows
    .filter(Array.isArray)
    .map((row) => `| ${columns.map((_, index) => markdownCell(row[index])).join(' | ')} |`)
    .join('\n');
  return [head, divider, body].filter(Boolean).join('\n');
}

function codeFence(text) {
  const runs = String(text || '').match(/`+/g) || [];
  const longest = runs.reduce((max, run) => Math.max(max, run.length), 0);
  return '`'.repeat(Math.max(3, longest + 1));
}

function codeLanguage(value) {
  const language = typeof value === 'string' ? value.trim() : '';
  return /^[A-Za-z0-9_+.-]+$/.test(language) ? language : '';
}

function sourceOrdinal(document, evidenceId) {
  const index = document.sources.findIndex((source) => source.evidenceId === evidenceId);
  return index >= 0 ? index + 1 : null;
}

function sourceSuffix(document, refs) {
  const ordinals = [...new Set((refs || []).map((id) => sourceOrdinal(document, id)).filter(Boolean))];
  return ordinals.length ? ` [${ordinals.join(', ')}]` : '';
}

function fallbackMarkdown(fallback) {
  if (fallback.type === 'list') return markdownList(fallback.content.items);
  if (fallback.type === 'table') return markdownTable(fallback.content);
  if (fallback.type === 'code') {
    const text = fallback.content && fallback.content.text || '';
    const fence = codeFence(text);
    return `${fence}${codeLanguage(fallback.content && fallback.content.language)}\n${text}\n${fence}`;
  }
  if (fallback.content && typeof fallback.content.text === 'string') return markdownLiteral(fallback.content.text);
  return markdownLiteral(JSON.stringify(fallback.content || {}));
}

function renderCanvasArtifactExportMarkdown(document, { figurePathFor = null } = {}) {
  if (!document || typeof document !== 'object' || !Array.isArray(document.blocks) || !Array.isArray(document.sources)) {
    throw new Error('Canvas Artifact ExportDocument is required');
  }
  if (figurePathFor && typeof figurePathFor !== 'function') throw new Error('figurePathFor must be a function');
  const parts = [`# ${markdownLiteral(requiredText(document.title, 'Canvas Artifact export title'))}`];

  for (const block of document.blocks) {
    if (block.type === 'heading') parts.push(`## ${markdownLiteral(block.text)}${sourceSuffix(document, block.evidenceRefs)}`);
    else if (block.type === 'paragraph') parts.push(`${markdownLiteral(block.text)}${sourceSuffix(document, block.evidenceRefs)}`);
    else if (block.type === 'claim') parts.push(`**Claim.** ${markdownLiteral(block.text)}${sourceSuffix(document, block.evidenceRefs)}`);
    else if (block.type === 'quote') parts.push(`> ${markdownLiteral(block.text).replace(/\r?\n/g, '\n> ')}${sourceSuffix(document, block.evidenceRefs)}`);
    else if (block.type === 'callout') parts.push(`**Note.** ${markdownLiteral(block.text)}${sourceSuffix(document, block.evidenceRefs)}`);
    else if (block.type === 'list') parts.push(`${markdownList(block.items)}${sourceSuffix(document, block.evidenceRefs)}`);
    else if (block.type === 'table') parts.push(`${markdownTable(block.content)}${sourceSuffix(document, block.evidenceRefs)}`);
    else if (block.type === 'code') {
      const text = block.text || '';
      const fence = codeFence(text);
      parts.push(`${fence}${codeLanguage(block.language)}\n${text}\n${fence}${sourceSuffix(document, block.evidenceRefs)}`);
    } else if (block.type === 'figure') {
      const embeddedPath = block.embeddingEligibility === 'embed' && figurePathFor ? figurePathFor(block) : null;
      const alt = markdownLiteral(block.alt);
      const lines = embeddedPath
        ? [`![${alt}](${embeddedPath})${sourceSuffix(document, block.evidenceRefs)}`]
        : [`**Figure: ${alt}.**${sourceSuffix(document, block.evidenceRefs)}`];
      if (block.caption) lines.push(markdownLiteral(block.caption));
      lines.push(`Embedding eligibility: ${markdownLiteral(block.embeddingEligibility)}`);
      if (block.rightsStatus) lines.push(`Rights: ${markdownLiteral(block.rightsStatus)}`);
      if (block.sourcePage) lines.push(`Source page: ${markdownLiteral(block.sourcePage)}`);
      parts.push(lines.join('\n'));
    } else if (block.type === 'static-interaction') {
      parts.push(`**Interactive prompt.** ${markdownLiteral(block.prompt)}\n\nStatic export fallback:\n\n${fallbackMarkdown(block.fallback)}`);
    } else if (block.type === 'file-reference') {
      parts.push(`**File: ${markdownLiteral(block.label)}.** ${markdownLiteral(block.path)}${sourceSuffix(document, block.evidenceRefs)}`);
    }
  }

  if (document.sources.length) {
    const sources = ['## Sources'];
    document.sources.forEach((source, index) => {
      const lines = [`${index + 1}. **${markdownLiteral(source.label)}**`];
      if (source.publisher) lines.push(`Publisher: ${markdownLiteral(source.publisher)}`);
      if (source.sourcePage) lines.push(`Source: ${markdownLiteral(source.sourcePage)}`);
      if (source.originalAsset) lines.push(`Original asset: ${markdownLiteral(source.originalAsset)}`);
      if (source.rightsStatus) lines.push(`Rights: ${markdownLiteral(source.rightsStatus)}`);
      if (source.kind === 'source-image' || String(source.mimeType || '').startsWith('image/')) {
        lines.push(`Embedding eligibility: ${markdownLiteral(source.embeddingEligibility)}`);
      }
      lines.push(`Evidence: ${markdownLiteral(source.evidenceId)} · sha256:${markdownLiteral(source.sha256)}`);
      sources.push(lines.join('\n   '));
    });
    parts.push(sources.join('\n\n'));
  }

  return `${parts.join('\n\n')}\n`;
}

function createCanvasArtifactExporter({ evidenceStore, pdfRenderer = null } = {}) {
  if (!evidenceStore || typeof evidenceStore.get !== 'function') {
    throw new Error('Canvas Artifact exporter requires EvidenceStore');
  }
  if (pdfRenderer && typeof pdfRenderer.render !== 'function') {
    throw new Error('Canvas Artifact pdfRenderer must expose render()');
  }

  function evidenceFor(workId, evidenceId, label) {
    const evidence = evidenceStore.get(requiredText(evidenceId, `${label} Evidence id`));
    if (!evidence) throw new Error(`Evidence not found for ${label}: ${evidenceId}`);
    if (evidence.workId !== workId) throw new Error(`${label} Evidence must belong to the owning Work: ${evidenceId}`);
    return evidence;
  }

  function publicSource(workId, evidenceId) {
    const evidence = evidenceFor(workId, evidenceId, 'Artifact export');
    const metadata = evidence.metadata && typeof evidence.metadata === 'object' && !Array.isArray(evidence.metadata)
      ? evidence.metadata
      : {};
    return {
      evidenceId: evidence.id,
      label: evidence.label,
      kind: evidence.kind,
      mimeType: evidence.mimeType,
      source: evidence.source,
      publisher: typeof metadata.publisher === 'string' && metadata.publisher.trim() ? metadata.publisher.trim() : null,
      sourcePage: safeExternalUrl(metadata.sourcePage || metadata.url || null),
      originalAsset: safeExternalUrl(metadata.originalAsset || null),
      rightsStatus: typeof metadata.rightsStatus === 'string' && metadata.rightsStatus.trim() ? metadata.rightsStatus.trim() : null,
      embeddingEligibility: typeof metadata.embeddingEligibility === 'string' && metadata.embeddingEligibility.trim()
        ? metadata.embeddingEligibility.trim()
        : 'unknown',
      byteLength: evidence.byteLength,
      sha256: evidence.sha256,
    };
  }

  function staticFallback(fallback, workId) {
    if (!fallback || typeof fallback !== 'object') throw new Error('Artifact interaction export requires a static fallback');
    const type = requiredText(fallback.type, 'Artifact interaction static fallback type');
    const refs = Array.isArray(fallback.evidenceRefs) ? fallback.evidenceRefs : [];
    refs.forEach((evidenceId) => evidenceFor(workId, evidenceId, 'Artifact interaction static fallback'));
    return {
      type,
      content: clone(fallback.content || {}),
      evidenceRefs: [...refs],
    };
  }

  function exportBlock(block, artifact) {
    const workId = artifact.workId;
    const evidenceRefs = Array.isArray(block.evidenceRefs) ? [...block.evidenceRefs] : [];
    evidenceRefs.forEach((evidenceId) => evidenceFor(workId, evidenceId, `Artifact block ${block.id || block.type}`));
    const references = Array.isArray(block.references) ? clone(block.references) : [];

    if (block.type === 'heading') return { type: 'heading', text: block.content.text, evidenceRefs, references };
    if (block.type === 'paragraph') return { type: 'paragraph', text: block.content.text, evidenceRefs, references };
    if (block.type === 'claim') return { type: 'claim', text: block.content.text, evidenceRefs, references };
    if (block.type === 'quote') return { type: 'quote', text: block.content.text, evidenceRefs, references };
    if (block.type === 'callout') return { type: 'callout', text: block.content.text, evidenceRefs, references };
    if (block.type === 'list') return { type: 'list', items: clone(block.content.items || []), evidenceRefs, references };
    if (block.type === 'table') return { type: 'table', content: clone(block.content), evidenceRefs, references };
    if (block.type === 'code') {
      return {
        type: 'code',
        text: block.content.text,
        language: block.content.language || null,
        evidenceRefs,
        references,
      };
    }
    if (block.type === 'image') {
      const evidenceId = requiredText(block.content.evidenceId || evidenceRefs[0], 'Artifact image Evidence id');
      const source = publicSource(workId, evidenceId);
      return {
        type: 'figure',
        evidenceId,
        alt: requiredText(block.content.alt || source.label, 'Artifact image alt text'),
        caption: typeof block.content.caption === 'string' && block.content.caption.trim() ? block.content.caption.trim() : null,
        embeddingEligibility: source.embeddingEligibility,
        sourcePage: source.sourcePage,
        originalAsset: source.originalAsset,
        rightsStatus: source.rightsStatus,
        evidenceRefs,
        references,
      };
    }
    if (block.type === 'interaction') {
      return {
        type: 'static-interaction',
        prompt: requiredText(block.content.prompt, 'Artifact interaction prompt'),
        fallback: staticFallback(block.staticFallback, workId),
        evidenceRefs,
        references,
      };
    }
    if (block.type === 'file-reference') {
      const evidenceId = requiredText(block.content.evidenceId, 'Artifact file Evidence id');
      evidenceFor(workId, evidenceId, 'Artifact file reference');
      return {
        type: 'file-reference',
        path: requiredText(block.content.path, 'Artifact file path'),
        label: requiredText(block.content.label, 'Artifact file label'),
        mimeType: requiredText(block.content.mimeType, 'Artifact file mimeType'),
        evidenceId,
        evidenceRefs,
        references,
      };
    }
    throw new Error(`Unsupported Canvas Artifact export block type: ${block.type}`);
  }

  function compile(artifact) {
    if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) throw new Error('Canvas Artifact is required for export');
    const artifactId = requiredText(artifact.id, 'Canvas Artifact id');
    const workId = requiredText(artifact.workId, 'Canvas Artifact Work id');
    const title = requiredText(artifact.title, 'Canvas Artifact title');
    if (!Array.isArray(artifact.blocks)) throw new Error('Canvas Artifact blocks must be an array');

    const blocks = artifact.blocks.map((block) => exportBlock(block, artifact));
    const sourceIds = [];
    const seen = new Set();
    function collect(refs) {
      for (const evidenceId of refs || []) {
        if (seen.has(evidenceId)) continue;
        evidenceFor(workId, evidenceId, 'Artifact export source');
        seen.add(evidenceId);
        sourceIds.push(evidenceId);
      }
    }
    for (const block of blocks) {
      collect(block.evidenceRefs);
      if (block.type === 'static-interaction') collect(block.fallback.evidenceRefs);
    }

    return {
      schemaVersion: 1,
      artifactId,
      workId,
      projectId: artifact.projectId || null,
      title,
      revision: artifact.revision || 1,
      blocks,
      sources: sourceIds.map((evidenceId) => publicSource(workId, evidenceId)),
    };
  }

  function toMarkdown(artifact) {
    return renderCanvasArtifactExportMarkdown(compile(artifact));
  }

  async function toPdf(artifact) {
    if (!pdfRenderer) throw new Error('Canvas Artifact PDF renderer is not configured');
    const bytes = await pdfRenderer.render(compile(artifact));
    const buffer = Buffer.isBuffer(bytes) ? Buffer.from(bytes) : Buffer.from(bytes || []);
    if (buffer.length < 5 || buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
      throw new Error('Canvas Artifact PDF renderer returned invalid PDF bytes');
    }
    return buffer;
  }

  return {
    compile,
    toMarkdown,
    toPdf,
  };
}

module.exports = {
  createCanvasArtifactExporter,
  renderCanvasArtifactExportMarkdown,
  markdownLiteral,
  codeFence,
};
