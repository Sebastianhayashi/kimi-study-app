'use strict';

const crypto = require('node:crypto');
const { restrictDelegationEnvelope } = require('./delegation-envelope');

function requiredText(value, label) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new Error(`${label} is required`);
  return text;
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function createSpecialistSubrunOrchestrator({
  workStore,
  runStore,
  runOrchestrator,
  createSubrunId = () => `subrun_${crypto.randomUUID()}`,
} = {}) {
  if (!workStore || typeof workStore.get !== 'function') throw new Error('Specialist subrun orchestrator requires WorkStore');
  if (!runStore || typeof runStore.get !== 'function' || typeof runStore.appendEvent !== 'function') {
    throw new Error('Specialist subrun orchestrator requires RunStore');
  }
  if (!runOrchestrator || typeof runOrchestrator.start !== 'function' || typeof runOrchestrator.wait !== 'function') {
    throw new Error('Specialist subrun orchestrator requires RunOrchestrator');
  }

  function selectionsFor(work, skillIds) {
    const plan = work && work.plan;
    if (!plan || !Array.isArray(plan.skillSelections)) throw new Error(`Owning Work has no executable Skill plan: ${work && work.id}`);
    const byId = new Map(plan.skillSelections.map((selection) => [selection.skillId, selection]));
    return skillIds.map((skillId) => {
      const selection = byId.get(skillId);
      if (!selection) throw new Error(`Specialist Skill is not selected by the owning Work plan: ${skillId}`);
      return clone(selection);
    });
  }

  function childDelegationEnvelope(parentRun, requested) {
    if (!parentRun.delegationEnvelope) {
      throw new Error(`Parent Run has no durable Delegation Envelope: ${parentRun.id}`);
    }
    try {
      return restrictDelegationEnvelope(parentRun.delegationEnvelope, requested == null ? null : requested);
    } catch (error) {
      throw new Error(`Specialist ${error.message}`);
    }
  }

  async function start({
    parentRunId,
    role,
    objective,
    skillIds,
    runtime = null,
    workerId = null,
    model = null,
    delegationEnvelope = null,
  } = {}) {
    const parentId = requiredText(parentRunId, 'parentRunId');
    const specialistRole = requiredText(role, 'Specialist role');
    const specialistObjective = requiredText(objective, 'Specialist objective');
    if (!Array.isArray(skillIds) || skillIds.length === 0) throw new Error('Specialist skillIds are required');
    const normalizedSkillIds = skillIds.map((skillId) => requiredText(skillId, 'Specialist skillId'));
    if (new Set(normalizedSkillIds).size !== normalizedSkillIds.length) throw new Error('Specialist skillIds must be unique');

    const parentRun = runStore.get(parentId);
    if (!parentRun) throw new Error(`Parent Run not found: ${parentId}`);
    const work = workStore.get(parentRun.workId);
    if (!work) throw new Error(`Owning Work not found: ${parentRun.workId}`);
    const skillSelections = selectionsFor(work, normalizedSkillIds);
    const effectiveDelegationEnvelope = childDelegationEnvelope(parentRun, delegationEnvelope);
    const subrunId = requiredText(createSubrunId(), 'subrunId');

    const run = await runOrchestrator.start({
      parentRunId: parentRun.id,
      subrunId,
      role: specialistRole,
      workId: work.id,
      employeeId: null,
      workerId: workerId || parentRun.workerId,
      runtime: runtime || parentRun.runtime,
      repoDir: work.repoDir || null,
      prompt: specialistObjective,
      model,
      skillSelections,
      delegationEnvelope: effectiveDelegationEnvelope,
    });

    runStore.appendEvent(parentRun.id, {
      type: 'subrun.started',
      subrunId,
      childRunId: run.id,
      role: specialistRole,
      objective: specialistObjective,
      skillIds: [...normalizedSkillIds],
    });

    void runOrchestrator.wait(run.id).then((finalRun) => {
      runStore.appendEvent(parentRun.id, {
        type: 'subrun.completed',
        subrunId,
        childRunId: run.id,
        role: specialistRole,
        status: finalRun && finalRun.status || 'unknown',
        summary: finalRun && finalRun.summary || null,
      });
    });

    return { subrunId, run };
  }

  function wait(runId) {
    return runOrchestrator.wait(runId);
  }

  return { start, wait };
}

module.exports = {
  createSpecialistSubrunOrchestrator,
};
