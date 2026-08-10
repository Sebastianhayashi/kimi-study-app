'use strict';

const { normalizeArtifactBlockProposal } = require('./canvas-artifact-proposal');
const {
  findRequestedFileDeliverable,
  normalizeRelativeDeliverablePath,
} = require('./file-deliverable');

const PROJECT_MEMORY_MUTATION_KEYS = new Set([
  'objective',
  'report',
  'factsUpsert',
  'preferencesUpsert',
  'decisionsUpsert',
  'frontiersUpsert',
  'sourceWorkIdsAdd',
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

function normalizeStringRefs(values, label) {
  if (values == null) return [];
  if (!Array.isArray(values) || values.some((value) => !nonEmptyString(value))) {
    throw new Error(`${label} must be an array of non-empty ids.`);
  }
  return [...new Set(values.map((value) => value.trim()))];
}

function normalizeProjectMemoryPatch(output) {
  if (!nonEmptyString(output.summary)) throw new Error('Project Memory patch requires a summary.');
  if (!output.mutation || typeof output.mutation !== 'object' || Array.isArray(output.mutation)) {
    throw new Error('Project Memory patch requires a mutation object.');
  }
  const keys = Object.keys(output.mutation);
  if (keys.length === 0) throw new Error('Project Memory patch mutation cannot be empty.');
  const unknown = keys.filter((key) => !PROJECT_MEMORY_MUTATION_KEYS.has(key));
  if (unknown.length) throw new Error(`Unsupported Project Memory mutation field(s): ${unknown.join(', ')}.`);

  if (Object.prototype.hasOwnProperty.call(output.mutation, 'objective') && !nonEmptyString(output.mutation.objective)) {
    throw new Error('Project Memory objective mutation must be non-empty text.');
  }
  if (Object.prototype.hasOwnProperty.call(output.mutation, 'report')) {
    const report = output.mutation.report;
    if (!report || typeof report !== 'object' || Array.isArray(report)) throw new Error('Project Memory report mutation must be an object.');
    const allowed = new Set(['title', 'summary', 'changed', 'nextAction', 'artifactId']);
    const unknownReport = Object.keys(report).filter((key) => !allowed.has(key));
    if (unknownReport.length) throw new Error(`Unsupported Project Memory report field(s): ${unknownReport.join(', ')}.`);
  }
  for (const key of ['factsUpsert', 'preferencesUpsert', 'decisionsUpsert', 'frontiersUpsert', 'sourceWorkIdsAdd']) {
    if (Object.prototype.hasOwnProperty.call(output.mutation, key) && !Array.isArray(output.mutation[key])) {
      throw new Error(`Project Memory ${key} must be an array.`);
    }
  }

  return {
    summary: output.summary.trim(),
    evidenceRefs: normalizeStringRefs(output.evidenceRefs, 'Project Memory evidenceRefs'),
    mutation: clone(output.mutation),
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
    try {
      const block = normalizeArtifactBlockProposal(output.block);
      return {
        classification: 'artifact-content',
        requiresEvidence: block.material === true && block.evidenceRefs.length === 0,
        block,
      };
    } catch (error) {
      return unsupported(error.message, output);
    }
  }

  if (output.type === 'project.memory.patch') {
    try {
      const proposal = normalizeProjectMemoryPatch(output);
      return {
        classification: 'project-memory',
        requiresEvidence: false,
        ...proposal,
      };
    } catch (error) {
      return unsupported(error.message, output);
    }
  }

  if (output.type === 'file.deliverable') {
    const file = output.file;
    if (!file || typeof file !== 'object' || Array.isArray(file)) {
      return unsupported('File deliverable output requires a file object.', output);
    }
    let filePath;
    try {
      filePath = normalizeRelativeDeliverablePath(file.path);
    } catch (error) {
      return unsupported(error.message, { type: output.type, path: file.path || null });
    }
    if (file.content == null && file.contentBase64 == null) {
      return unsupported('File deliverable output requires durable file content.', { type: output.type, path: filePath });
    }
    if (file.contentBase64 != null && !nonEmptyString(file.contentBase64)) {
      return unsupported('File deliverable contentBase64 must be a non-empty string.', { type: output.type, path: filePath });
    }
    return {
      classification: 'file-deliverable',
      requiresEvidence: false,
      file: {
        path: filePath,
        label: nonEmptyString(file.label) ? file.label.trim() : null,
        mimeType: nonEmptyString(file.mimeType) ? file.mimeType.trim().toLowerCase() : null,
        content: file.content == null ? null : String(file.content),
        contentBase64: file.contentBase64 == null ? null : String(file.contentBase64),
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

function createSkillOutputIngestor({ evidenceStore, approvalBroker } = {}) {
  if (!evidenceStore || typeof evidenceStore.create !== 'function' || typeof evidenceStore.get !== 'function') {
    throw new Error('Skill output ingestor requires EvidenceStore');
  }
  if (!approvalBroker || typeof approvalBroker.request !== 'function') {
    throw new Error('Skill output ingestor requires ApprovalBroker');
  }

  function provenance(input) {
    return {
      skillId: input.skillId || null,
      subrunId: input.subrunId || null,
    };
  }

  function persistEvidence(input, evidence, metadata = {}) {
    return evidenceStore.create({
      runId: input.runId,
      workId: input.workId,
      workerId: input.workerId,
      kind: evidence.kind,
      label: evidence.label,
      mimeType: evidence.mimeType || 'application/octet-stream',
      source: evidence.source || 'skill-output',
      metadata: {
        ...(evidence.metadata && typeof evidence.metadata === 'object' && !Array.isArray(evidence.metadata) ? clone(evidence.metadata) : {}),
        ...provenance(input),
        ...clone(metadata),
      },
      content: evidence.content == null ? '' : evidence.content,
    });
  }

  function inspectEvidenceRefs(workId, evidenceRefs) {
    const missingEvidenceRefs = [];
    const foreignEvidenceRefs = [];
    for (const evidenceId of evidenceRefs) {
      const evidence = evidenceStore.get(evidenceId);
      if (!evidence) {
        missingEvidenceRefs.push(evidenceId);
        continue;
      }
      if (evidence.workId !== workId) foreignEvidenceRefs.push(evidenceId);
    }
    return { missingEvidenceRefs, foreignEvidenceRefs };
  }

  function decodeFileContent(file) {
    if (file.contentBase64 != null) return Buffer.from(file.contentBase64, 'base64');
    return Buffer.from(file.content == null ? '' : file.content, 'utf8');
  }

  async function ingest(input = {}) {
    const classified = classifySkillOutput(input.output);

    if (classified.classification === 'evidence') {
      const evidence = persistEvidence(input, classified.evidence);
      return {
        classification: 'evidence',
        requiresEvidence: false,
        event: { type: 'evidence.produced', evidence },
      };
    }

    if (classified.classification === 'artifact-content') {
      const evidenceRefs = classified.block.evidenceRefs || [];
      const { missingEvidenceRefs, foreignEvidenceRefs } = inspectEvidenceRefs(input.workId, evidenceRefs);
      const blocked = classified.requiresEvidence || missingEvidenceRefs.length > 0 || foreignEvidenceRefs.length > 0;
      if (blocked) {
        return {
          classification: 'artifact-content',
          requiresEvidence: true,
          accepted: false,
          event: {
            type: 'artifact.content.blocked',
            reason: classified.requiresEvidence
              ? 'Material Artifact content requires inspectable Evidence.'
              : 'Artifact Evidence references must exist in the owning Work.',
            missingEvidenceRefs,
            foreignEvidenceRefs,
            ...provenance(input),
          },
        };
      }
      return {
        classification: 'artifact-content',
        requiresEvidence: false,
        accepted: true,
        event: {
          type: 'artifact.content.proposed',
          block: clone(classified.block),
          requiresEvidence: false,
          ...provenance(input),
        },
      };
    }

    if (classified.classification === 'project-memory') {
      const { missingEvidenceRefs, foreignEvidenceRefs } = inspectEvidenceRefs(input.workId, classified.evidenceRefs);
      if (missingEvidenceRefs.length || foreignEvidenceRefs.length) {
        return {
          classification: 'project-memory',
          requiresEvidence: false,
          accepted: false,
          event: {
            type: 'project.memory.blocked',
            reason: 'Project Memory Evidence references must exist in the owning Work.',
            missingEvidenceRefs,
            foreignEvidenceRefs,
            ...provenance(input),
          },
        };
      }
      return {
        classification: 'project-memory',
        requiresEvidence: false,
        accepted: true,
        event: {
          type: 'project.memory.proposed',
          summary: classified.summary,
          evidenceRefs: [...classified.evidenceRefs],
          mutation: clone(classified.mutation),
          ...provenance(input),
        },
      };
    }

    if (classified.classification === 'file-deliverable') {
      const requested = findRequestedFileDeliverable(input.fileDeliverables, classified.file.path);
      if (!requested) {
        return {
          classification: 'file-deliverable',
          requiresEvidence: false,
          accepted: false,
          event: {
            type: 'file.deliverable.blocked',
            path: classified.file.path,
            reason: 'File was not explicitly requested by the owning Work.',
            ...provenance(input),
          },
        };
      }
      const content = decodeFileContent(classified.file);
      const evidence = persistEvidence(input, {
        kind: 'deliverable-file',
        label: requested.label,
        mimeType: requested.mimeType || classified.file.mimeType || 'application/octet-stream',
        source: 'skill-output',
        content,
        metadata: {
          path: requested.path,
          requested: true,
          userIntentEvidence: requested.userIntentEvidence,
        },
      });
      return {
        classification: 'file-deliverable',
        requiresEvidence: false,
        accepted: true,
        event: {
          type: 'file.deliverable.produced',
          file: {
            path: requested.path,
            label: requested.label,
            mimeType: evidence.mimeType,
            evidenceId: evidence.id,
            byteLength: evidence.byteLength,
            sha256: evidence.sha256,
          },
          ...provenance(input),
        },
      };
    }

    if (classified.classification === 'workspace-mutation') {
      const evidence = classified.diff
        ? persistEvidence(input, {
          kind: 'diff',
          label: 'Skill workspace mutation',
          mimeType: 'text/x-diff',
          source: 'skill-output',
          content: classified.diff,
          metadata: { changedFiles: classified.changedFiles },
        })
        : null;
      return {
        classification: 'workspace-mutation',
        requiresEvidence: false,
        event: {
          type: 'workspace.mutation.reported',
          changedFiles: [...classified.changedFiles],
          evidenceId: evidence ? evidence.id : null,
          evidence,
          ...provenance(input),
        },
      };
    }

    if (classified.classification === 'authority-request') {
      const decision = await approvalBroker.request({
        runId: input.runId,
        envelope: input.delegationEnvelope,
        request: {
          capability: classified.capability,
          reason: classified.reason,
          detail: classified.detail,
          provider: 'skill-output',
        },
      });
      return {
        classification: 'authority-request',
        requiresEvidence: false,
        decision,
        event: null,
      };
    }

    if (classified.classification === 'transient-note') {
      return {
        classification: 'transient-note',
        requiresEvidence: false,
        event: null,
      };
    }

    return {
      classification: 'unsupported',
      requiresEvidence: false,
      event: {
        type: 'skill.output.unsupported',
        reason: classified.reason,
        ...provenance(input),
      },
    };
  }

  return { ingest };
}

module.exports = {
  classifySkillOutput,
  createSkillOutputIngestor,
  normalizeProjectMemoryPatch,
};
