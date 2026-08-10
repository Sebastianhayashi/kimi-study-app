'use strict';

const { normalizeArtifactBlockProposal } = require('./canvas-artifact-proposal');
const { normalizeRelativeDeliverablePath } = require('./file-deliverable');

function requiredText(value, label) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new Error(`${label} is required`);
  return text;
}

function fileReferenceBlock(event) {
  const file = event && event.file;
  if (!file || typeof file !== 'object' || Array.isArray(file)) {
    throw new Error('Produced file deliverable event requires a file receipt');
  }
  const evidenceId = requiredText(file.evidenceId, 'Produced file Evidence id');
  return {
    type: 'file-reference',
    material: false,
    content: {
      path: normalizeRelativeDeliverablePath(file.path),
      label: requiredText(file.label, 'Produced file label'),
      mimeType: requiredText(file.mimeType, 'Produced file mimeType').toLowerCase(),
      evidenceId,
    },
    evidenceRefs: [evidenceId],
    references: [],
  };
}

function createCanvasArtifactAssembler({ artifactStore } = {}) {
  if (!artifactStore || typeof artifactStore.create !== 'function') {
    throw new Error('Canvas Artifact assembler requires an Artifact store');
  }

  function assemble({ workId, projectId = null, title, events = [] } = {}) {
    if (!Array.isArray(events)) throw new Error('Canvas Artifact assembly events must be an array');
    const blocks = [];

    for (const event of events) {
      if (!event || typeof event !== 'object') continue;
      if (event.type === 'artifact.content.proposed') {
        blocks.push(normalizeArtifactBlockProposal(event.block));
        continue;
      }
      if (event.type === 'file.deliverable.produced') {
        blocks.push(fileReferenceBlock(event));
      }
    }

    if (blocks.length === 0) throw new Error('Canvas Artifact assembly requires at least one accepted semantic output');
    return artifactStore.create({
      workId,
      projectId,
      title,
      blocks,
    });
  }

  return { assemble };
}

module.exports = {
  createCanvasArtifactAssembler,
};
