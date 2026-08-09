'use strict';

const FORBIDDEN_ATTESTATION_FIELDS = Object.freeze([
  'mountedSkillIds',
  'mountReceipts',
  'runtimeAttestation',
  'runtimeReceipt',
  'providerSessionId',
]);
const FORBIDDEN_REASONING_FIELDS = Object.freeze([
  'chainOfThought',
  'rawReasoning',
  'reasoning',
]);

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function requiredText(value, label) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new Error(`${label} is required`);
  return text;
}

function compactSkill(metadata, compatibility) {
  return {
    id: metadata.id,
    bundleId: metadata.bundleId,
    bundleCommit: metadata.bundleCommit,
    name: metadata.name,
    description: metadata.description,
    version: metadata.version || null,
    triggers: Array.isArray(metadata.triggers) ? [...metadata.triggers] : [],
    allowedTools: Array.isArray(metadata.allowedTools) ? [...metadata.allowedTools] : [],
    invocationPolicy: clone(metadata.invocationPolicy),
    compatibility: {
      status: compatibility.status,
      reason: compatibility.reason || null,
      overlayId: compatibility.overlay && compatibility.overlay.id || null,
      overlayVersion: compatibility.overlay && compatibility.overlay.version || null,
    },
  };
}

function validateProposalShape(proposal) {
  if (!proposal || typeof proposal !== 'object' || Array.isArray(proposal)) {
    throw new Error('Planner proposal must be an object');
  }
  for (const field of FORBIDDEN_ATTESTATION_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(proposal, field)) {
      throw new Error('Planner proposal cannot contain runtime or mount attestation');
    }
  }
  for (const field of FORBIDDEN_REASONING_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(proposal, field)) {
      throw new Error('Planner proposal cannot contain raw model reasoning');
    }
  }
  if (!Array.isArray(proposal.skillSelections)) throw new Error('Planner proposal skillSelections must be an array');
}

function createWorkPlanner({ catalog, compatibility, dependencyResolver, planner } = {}) {
  if (!catalog || typeof catalog.list !== 'function' || typeof catalog.get !== 'function') {
    throw new Error('Work planner requires a Skill Catalog');
  }
  if (!compatibility || typeof compatibility.resolve !== 'function') {
    throw new Error('Work planner requires Skill compatibility resolution');
  }
  if (!dependencyResolver || typeof dependencyResolver.resolve !== 'function') {
    throw new Error('Work planner requires a Skill dependency resolver');
  }
  if (!planner || typeof planner.plan !== 'function') {
    throw new Error('Work planner requires a planner implementation');
  }

  async function plan({ intent, relatedWork = [], project = null } = {}) {
    const currentIntent = requiredText(intent, 'Work intent');
    const routingSurface = catalog.list().map((metadata) => {
      const resolvedCompatibility = compatibility.resolve(metadata);
      return compactSkill(metadata, resolvedCompatibility);
    });

    const proposal = await planner.plan({
      intent: currentIntent,
      skills: clone(routingSurface),
      relatedWork: clone(relatedWork),
      project: clone(project),
    });
    validateProposalShape(proposal);

    const seen = new Set();
    const normalizedSelections = [];
    for (const input of proposal.skillSelections) {
      if (!input || typeof input !== 'object') throw new Error('Skill selection must be an object');
      const skillId = requiredText(input.skillId, 'Skill selection skillId');
      if (seen.has(skillId)) throw new Error(`Duplicate Skill selection: ${skillId}`);
      seen.add(skillId);

      const metadata = catalog.get(skillId);
      if (!metadata) throw new Error(`Planner selected a Skill that is not in the current Catalog: ${skillId}`);
      const resolvedCompatibility = compatibility.resolve(metadata);
      if (!resolvedCompatibility || resolvedCompatibility.status === 'blocked') {
        throw new Error(`Planner selected a blocked Skill: ${skillId}`);
      }

      const activation = requiredText(input.activation, 'Skill selection activation');
      if (!['model', 'user-intent'].includes(activation)) {
        throw new Error(`Invalid Skill activation for ${skillId}: ${activation}`);
      }
      const invocationMode = metadata.invocationPolicy && metadata.invocationPolicy.mode || 'model-or-user';
      if (invocationMode === 'user-only' && activation !== 'user-intent') {
        throw new Error(`user-only Skill cannot be model-activated: ${skillId}`);
      }

      let userIntentEvidence = null;
      if (activation === 'user-intent') {
        userIntentEvidence = requiredText(input.userIntentEvidence, 'userIntentEvidence');
        if (!currentIntent.includes(userIntentEvidence)) {
          throw new Error('userIntentEvidence must be an exact substring of the current user intent');
        }
      }

      normalizedSelections.push({
        skillId,
        activation,
        userIntentEvidence,
        compatibilityStatus: resolvedCompatibility.status,
        overlay: clone(resolvedCompatibility.overlay),
      });
    }

    const closure = dependencyResolver.resolve(normalizedSelections.map((selection) => selection.skillId));
    const selectedById = new Map(normalizedSelections.map((selection) => [selection.skillId, selection]));
    for (const skillId of closure.skillIds || []) {
      const metadata = catalog.get(skillId);
      if (!metadata) throw new Error(`Skill dependency is not in the current Catalog: ${skillId}`);
      const resolvedCompatibility = compatibility.resolve(metadata);
      if (!resolvedCompatibility || resolvedCompatibility.status === 'blocked') {
        throw new Error(`Skill dependency is blocked by compatibility policy: ${skillId}`);
      }
      const invocationMode = metadata.invocationPolicy && metadata.invocationPolicy.mode || 'model-or-user';
      if (invocationMode === 'user-only') {
        const explicitSelection = selectedById.get(skillId);
        if (!explicitSelection || explicitSelection.activation !== 'user-intent') {
          throw new Error(`Skill dependency cannot implicitly invoke user-only Skill: ${skillId}`);
        }
      }
    }

    return {
      complexity: requiredText(proposal.complexity, 'Planner complexity'),
      durability: requiredText(proposal.durability, 'Planner durability'),
      projectAction: requiredText(proposal.projectAction, 'Planner projectAction'),
      issueAction: requiredText(proposal.issueAction, 'Planner issueAction'),
      skillSelections: normalizedSelections,
      skillGraph: {
        skillIds: [...(closure.skillIds || [])],
        files: [...(closure.files || [])],
        skillRoots: [...(closure.skillRoots || [])],
        diagnostics: clone(closure.diagnostics || []),
      },
      staffing: clone(proposal.staffing || { manager: true, specialistSubruns: [] }),
      evidenceRequired: proposal.evidenceRequired === true,
      deliverable: requiredText(proposal.deliverable, 'Planner deliverable'),
      reasonCodes: Array.isArray(proposal.reasonCodes) ? proposal.reasonCodes.filter((value) => typeof value === 'string') : [],
    };
  }

  return { plan };
}

module.exports = {
  createWorkPlanner,
};
