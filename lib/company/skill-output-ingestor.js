'use strict';

const SEMANTIC_ARTIFACT_BLOCK_TYPES = new Set([
  'paragraph',
  'heading',
  'list',
  'claim',
  'quote',
  'code',
  'image',
  'table',
  'callout',
]);

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function unsupported(reason, output = null) {
  return {
    classification: 'unsupported',
    reason,
    output: clone(output),
  };
}

function classifySkillOutput(output) {
  if (!output || typeof output !== 'object' || Array.isArray(output)) {
    return unsupported('Skill output must be a normalized object.', output);
  }

  if (output.type === 'evidence') {
    const evidence = output.evidence;
    if (!evidence || typeof evidence !== 'object' || !nonEmptyString(evidence.kind) || !nonEmptyString(evidence.label)) {
      return unsupported('Evidence output requires evidence kind and label.', output);
    }
    return {
      classification: 'evidence',
      requiresEvidence: false,
      evidence: clone(evidence),
    };
  }

  if (output.type === 'artifact.block') {
    const block = output.block;
    if (!block || typeof block !== 'object' || !nonEmptyString(block.type)) {
      return unsupported('Artifact output requires a semantic Artifact block.', output);
    }
    if (!SEMANTIC_ARTIFACT_BLOCK_TYPES.has(block.type)) {
      return unsupported(`Artifact output must use a semantic Artifact block, not renderer-owned ${block.type}.`, output);
    }
    if (block.type !== 'image' && block.type !== 'table' && !nonEmptyString(block.text) && !Array.isArray(block.items) && !nonEmptyString(block.code)) {
      return unsupported('Semantic Artifact block is missing content.', output);
    }
    const evidenceRefs = Array.isArray(block.evidenceRefs)
      ? block.evidenceRefs.filter(nonEmptyString)
      : [];
    return {
      classification: 'artifact-content',
      requiresEvidence: block.material === true && evidenceRefs.length === 0,
      block: {
        ...clone(block),
        evidenceRefs,
      },
    };
  }

  if (output.type === 'workspace.diff') {
    if (!Array.isArray(output.changedFiles) || output.changedFiles.some((file) => !nonEmptyString(file))) {
      return unsupported('Workspace mutation requires changedFiles as an array of paths.', output);
    }
    if (!nonEmptyString(output.diff) && output.changedFiles.length === 0) {
      return unsupported('Workspace mutation requires a diff or changed file.', output);
    }
    return {
      classification: 'workspace-mutation',
      requiresEvidence: false,
      changedFiles: [...output.changedFiles],
      diff: typeof output.diff === 'string' ? output.diff : '',
    };
  }

  if (output.type === 'authority.request') {
    if (!nonEmptyString(output.capability)) {
      return unsupported('Authority request requires a capability.', output);
    }
    return {
      classification: 'authority-request',
      requiresEvidence: false,
      capability: output.capability.trim(),
      reason: nonEmptyString(output.reason) ? output.reason.trim() : null,
      detail: clone(output.detail || null),
    };
  }

  if (output.type === 'note') {
    if (output.persistence !== 'transient' || !nonEmptyString(output.text)) {
      return unsupported('Notes are ingestible only as explicit transient notes.', output);
    }
    return {
      classification: 'transient-note',
      requiresEvidence: false,
      text: output.text.trim(),
    };
  }

  if (output.type === 'host.raw') {
    return unsupported('Raw host output must be adapted before Lucubro ingestion.', output);
  }

  return unsupported(`Unsupported normalized Skill output type: ${String(output.type || 'missing')}.`, output);
}

module.exports = {
  classifySkillOutput,
};
