const crypto = require('crypto');
const path = require('node:path');

function createCompanyService({
  workStore,
  runStore,
  runOrchestrator,
  projectStore = null,
  projectDiscovery = null,
  defaultWorkerId = 'worker_local',
  createWorkId = () => `work_${crypto.randomUUID()}`,
  createProjectId = () => `project_${crypto.randomUUID()}`,
}) {
  if (!workStore || !runStore || !runOrchestrator) throw new Error('Company service requires WorkStore, RunStore, and RunOrchestrator');
  if (!defaultWorkerId || !String(defaultWorkerId).trim()) throw new Error('Company service requires a default Worker id');
  const subscriptions = new Map();

  function observeRun(workId, runId) {
    const key = `${workId}:${runId}`;
    if (subscriptions.has(key)) return subscriptions.get(key);
    const unsubscribe = runStore.subscribe(runId, (event) => {
      const work = workStore.get(workId);
      if (!work || work.activeRunId !== runId) return;
      if (event.type === 'approval.requested') workStore.update(workId, { status: 'needs-you' });
      if (event.type === 'approval.resolved') workStore.update(workId, { status: 'in-progress' });
      if (event.type === 'run.failed') workStore.update(workId, { status: 'failed' });
      if (event.type === 'run.cancelled') workStore.update(workId, { status: 'held' });
      if (event.type === 'run.completed') workStore.update(workId, { status: 'review' });
    });
    subscriptions.set(key, unsubscribe);
    return unsubscribe;
  }

  function requireProjectDependencies() {
    if (!projectStore || !projectDiscovery) throw new Error('Project persistence is not configured');
  }

  function adoptProject({ repoDir, name = null }) {
    requireProjectDependencies();
    const discovered = projectDiscovery({ repoDir });
    const existing = projectStore.list().find((project) => project.repoDir === discovered.repoDir);
    if (existing) {
      return projectStore.update(existing.id, {
        name: name ? String(name).trim() : existing.name,
        sources: discovered.sources,
      });
    }
    return projectStore.create({
      id: createProjectId(),
      name: String(name || path.basename(discovered.repoDir) || 'Project').trim(),
      repoDir: discovered.repoDir,
      sources: discovered.sources,
    });
  }

  async function createCodingWork({
    brief,
    repoDir,
    projectId = null,
    runtime,
    employeeId = 'ben',
    workerId = defaultWorkerId,
    model = null,
    delegationEnvelope = { allow: ['workspace.read', 'workspace.write', 'shell.execute'] },
  }) {
    if (!brief || !String(brief).trim()) throw new Error('Work brief is required');
    if (!runtime || !String(runtime).trim()) throw new Error('runtime is required');
    if (!workerId || !String(workerId).trim()) throw new Error('workerId is required');

    let project = null;
    if (projectId) {
      if (!projectStore) throw new Error('Project persistence is not configured');
      project = projectStore.get(projectId);
      if (!project) throw new Error(`Project not found: ${projectId}`);
    }
    const effectiveRepoDir = project ? project.repoDir : repoDir;
    if (!effectiveRepoDir || !String(effectiveRepoDir).trim()) throw new Error('repoDir is required');

    const workId = createWorkId();
    const work = workStore.create({
      id: workId,
      brief: String(brief).trim(),
      projectId: project ? project.id : null,
      assignedEmployeeId: employeeId,
      status: 'starting',
      repoDir: effectiveRepoDir,
      runtime,
    });

    try {
      const run = await runOrchestrator.start({
        workId,
        employeeId,
        workerId: String(workerId).trim(),
        runtime,
        repoDir: effectiveRepoDir,
        prompt: work.brief,
        model,
        delegationEnvelope,
      });
      workStore.update(workId, { activeRunId: run.id, status: 'in-progress' });
      observeRun(workId, run.id);
      void runOrchestrator.wait(run.id).then((finalRun) => {
        const current = workStore.get(workId);
        if (!current || current.activeRunId !== run.id) return;
        if (finalRun && finalRun.status === 'completed') workStore.update(workId, { status: 'review' });
        else if (finalRun && finalRun.status === 'failed') workStore.update(workId, { status: 'failed' });
      });
      return { work: workStore.get(workId), run };
    } catch (error) {
      workStore.update(workId, { status: 'failed' });
      throw error;
    }
  }

  function decideWork({ workId, decision }) {
    const work = workStore.get(workId);
    if (!work) throw new Error(`Work not found: ${workId}`);
    if (work.status !== 'review') throw new Error(`Work is not ready for review: ${workId}`);
    if (decision === 'accept') return workStore.update(workId, { status: 'accepted' });
    if (decision === 'rework') return workStore.update(workId, { status: 'needs-rework' });
    throw new Error(`Invalid Work decision: ${decision}`);
  }

  return {
    adoptProject,
    createCodingWork,
    observeRun,
    decideWork,
    getProject: (id) => projectStore ? projectStore.get(id) : null,
    listProjects: () => projectStore ? projectStore.list() : [],
    getWork: (id) => workStore.get(id),
    listWorks: () => workStore.list(),
  };
}

module.exports = { createCompanyService };
