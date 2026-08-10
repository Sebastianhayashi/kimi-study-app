'use strict';

function requiredText(value, label) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new Error(`${label} is required`);
  return text;
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeSubruns(subruns) {
  if (!Array.isArray(subruns)) throw new Error('Specialist subruns must be an array');
  const seen = new Set();
  const normalized = subruns.map((input) => {
    if (!input || typeof input !== 'object') throw new Error('Specialist subrun must be an object');
    const id = requiredText(input.id, 'Specialist schedule id');
    if (seen.has(id)) throw new Error(`Duplicate specialist schedule id: ${id}`);
    seen.add(id);
    const dependsOn = input.dependsOn == null ? [] : input.dependsOn;
    if (!Array.isArray(dependsOn)) throw new Error(`Specialist dependsOn must be an array: ${id}`);
    const normalizedDependencies = dependsOn.map((dependency) => requiredText(dependency, `Specialist dependency for ${id}`));
    if (new Set(normalizedDependencies).size !== normalizedDependencies.length) {
      throw new Error(`Duplicate specialist dependency for ${id}`);
    }
    return {
      id,
      role: requiredText(input.role, `Specialist role for ${id}`),
      objective: requiredText(input.objective, `Specialist objective for ${id}`),
      skillIds: Array.isArray(input.skillIds) ? input.skillIds.map((skillId) => requiredText(skillId, `Specialist skillId for ${id}`)) : [],
      dependsOn: normalizedDependencies,
      delegationEnvelope: clone(input.delegationEnvelope),
      runtime: input.runtime || null,
      workerId: input.workerId || null,
      model: input.model || null,
    };
  });

  for (const subrun of normalized) {
    for (const dependency of subrun.dependsOn) {
      if (!seen.has(dependency)) throw new Error(`Unknown specialist dependency: ${dependency}`);
    }
  }

  const byId = new Map(normalized.map((subrun) => [subrun.id, subrun]));
  const visiting = new Set();
  const visited = new Set();
  function visit(id) {
    if (visited.has(id)) return;
    if (visiting.has(id)) throw new Error(`Specialist subrun dependency cycle: ${id}`);
    visiting.add(id);
    for (const dependency of byId.get(id).dependsOn) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  }
  for (const subrun of normalized) visit(subrun.id);
  return { graph: normalized, byId };
}

function createSpecialistSubrunScheduler({ specialistOrchestrator } = {}) {
  if (!specialistOrchestrator || typeof specialistOrchestrator.start !== 'function' || typeof specialistOrchestrator.wait !== 'function') {
    throw new Error('Specialist subrun scheduler requires a specialist orchestrator');
  }

  async function run({ parentRunId, subruns } = {}) {
    const parentId = requiredText(parentRunId, 'parentRunId');
    const { graph, byId } = normalizeSubruns(subruns);
    const tasks = new Map();

    function execute(id) {
      if (tasks.has(id)) return tasks.get(id);
      const subrun = byId.get(id);
      const task = (async () => {
        const dependencies = await Promise.all(subrun.dependsOn.map((dependency) => execute(dependency)));
        const failedDependency = dependencies.find((result) => result.status !== 'completed');
        if (failedDependency) {
          return {
            id: subrun.id,
            role: subrun.role,
            subrunId: null,
            childRunId: null,
            status: 'blocked',
            summary: null,
            error: null,
            reason: `Dependency did not complete successfully: ${failedDependency.id} (${failedDependency.status})`,
          };
        }

        try {
          const started = await specialistOrchestrator.start({
            parentRunId: parentId,
            role: subrun.role,
            objective: subrun.objective,
            skillIds: [...subrun.skillIds],
            delegationEnvelope: clone(subrun.delegationEnvelope),
            ...(subrun.runtime ? { runtime: subrun.runtime } : {}),
            ...(subrun.workerId ? { workerId: subrun.workerId } : {}),
            ...(subrun.model ? { model: subrun.model } : {}),
          });
          const finalRun = await specialistOrchestrator.wait(started.run.id);
          return {
            id: subrun.id,
            role: subrun.role,
            subrunId: started.subrunId,
            childRunId: started.run.id,
            status: finalRun && finalRun.status || 'failed',
            summary: finalRun && finalRun.summary || null,
            error: finalRun && finalRun.error || null,
            reason: null,
          };
        } catch (error) {
          return {
            id: subrun.id,
            role: subrun.role,
            subrunId: null,
            childRunId: null,
            status: 'failed',
            summary: null,
            error: error.message,
            reason: null,
          };
        }
      })();
      tasks.set(id, task);
      return task;
    }

    const ordered = await Promise.all(graph.map((subrun) => execute(subrun.id)));
    return {
      status: ordered.every((result) => result.status === 'completed') ? 'completed' : 'failed',
      subruns: ordered,
    };
  }

  return { run };
}

module.exports = {
  createSpecialistSubrunScheduler,
};
