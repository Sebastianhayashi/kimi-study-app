'use strict';

const crypto = require('node:crypto');

function requiredText(value, label) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new Error(`${label} is required`);
  return text;
}

function seedProjectMemory({ projectName, works, workIds, policyDecision }) {
  const anchor = works[0];
  const objective = requiredText(anchor.brief || anchor.title, 'anchor Work brief');
  const frontier = requiredText(policyDecision.frontier, 'Project frontier');
  return {
    objective,
    report: {
      title: `${projectName} report`,
      summary: objective,
      changed: 'This ongoing Work now has durable Project continuity.',
      nextAction: frontier,
    },
    facts: [],
    preferences: [],
    decisions: [],
    frontiers: [{
      id: 'frontier_primary',
      title: 'Current frontier',
      status: 'active',
      summary: frontier,
      nextAction: frontier,
    }],
    sourceWorkIds: workIds,
  };
}

function createWorkContextProjectPromotionService({
  workStore,
  projectStore,
  createProjectId = () => `project_${crypto.randomUUID()}`,
} = {}) {
  if (!workStore || typeof workStore.get !== 'function' || typeof workStore.list !== 'function' || typeof workStore.update !== 'function') {
    throw new Error('Work-context Project promotion requires WorkStore');
  }
  if (!projectStore || typeof projectStore.create !== 'function' || typeof projectStore.get !== 'function' || typeof projectStore.remove !== 'function') {
    throw new Error('Work-context Project promotion requires ProjectStore with remove()');
  }

  function apply({ name, policyDecision } = {}) {
    const projectName = requiredText(name, 'Project name');
    if (!policyDecision || policyDecision.decision !== 'eligible' || policyDecision.projectAction !== 'propose') {
      throw new Error('Project promotion policy decision is not eligible');
    }
    if (!Array.isArray(policyDecision.workIds) || policyDecision.workIds.length === 0) {
      throw new Error('Project promotion policy must identify Work ids');
    }
    const workIds = [...new Set(policyDecision.workIds.map((id) => requiredText(id, 'Work id')))];
    const works = workIds.map((workId) => {
      const work = workStore.get(workId);
      if (!work) throw new Error(`Work not found: ${workId}`);
      if (work.projectId) throw new Error(`Work already belongs to Project: ${workId}`);
      return work;
    });
    const projectId = requiredText(createProjectId(), 'Project id');
    const project = projectStore.create({
      id: projectId,
      name: projectName,
      kind: 'work-context',
      repoDir: null,
      isGitRepository: false,
      sources: [],
      memory: seedProjectMemory({ projectName, works, workIds, policyDecision }),
    });

    const updated = [];
    try {
      for (const work of works) {
        workStore.update(work.id, { projectId: project.id });
        updated.push(work.id);
      }
    } catch (error) {
      for (const workId of updated) workStore.update(workId, { projectId: null });
      projectStore.remove(project.id);
      throw error;
    }

    return {
      project: projectStore.get(project.id),
      workIds,
      reversible: true,
      policyDecision,
    };
  }

  function undo({ projectId } = {}) {
    const id = requiredText(projectId, 'Project id');
    const project = projectStore.get(id);
    if (!project) throw new Error(`Project not found: ${id}`);
    if (project.kind !== 'work-context') throw new Error(`Project is not a reversible work-context promotion: ${id}`);
    const workIds = workStore.list()
      .filter((work) => work.projectId === project.id)
      .map((work) => work.id);
    const updated = [];
    try {
      for (const workId of workIds) {
        workStore.update(workId, { projectId: null });
        updated.push(workId);
      }
      projectStore.remove(project.id);
    } catch (error) {
      for (const workId of updated) workStore.update(workId, { projectId: project.id });
      throw error;
    }
    return { projectId: project.id, workIds, undone: true };
  }

  return { apply, undo };
}

module.exports = {
  createWorkContextProjectPromotionService,
  seedProjectMemory,
};
