const crypto = require('crypto');
const path = require('node:path');
const { captureSourceSnapshot, reconcileProjectSources } = require('./project-continuation');
const { compileProjectContinuationContext } = require('./project-context');

function createCompanyService({
  workStore,
  runStore,
  runOrchestrator,
  projectStore = null,
  projectDiscovery = null,
  projectContextCompiler = compileProjectContinuationContext,
  workPlanner = null,
  defaultWorkerId = 'worker_local',
  createWorkId = () => `work_${crypto.randomUUID()}`,
  createProjectId = () => `project_${crypto.randomUUID()}`,
}) {
  if (!workStore || !runStore || !runOrchestrator) throw new Error('Company service requires WorkStore, RunStore, and RunOrchestrator');
  if (workPlanner && typeof workPlanner.plan !== 'function') throw new Error('Company service workPlanner must expose plan()');
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

  function requireProject(projectId) {
    if (!projectStore) throw new Error('Project persistence is not configured');
    const project = projectStore.get(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);
    return project;
  }

  function adoptProject({ repoDir, name = null }) {
    requireProjectDependencies();
    const discovered = projectDiscovery({ repoDir });
    const requestedName = name == null ? null : String(name).trim();
    const existing = projectStore.list().find((project) => project.repoDir === discovered.repoDir);
    if (existing) {
      return projectStore.update(existing.id, {
        name: requestedName || existing.name,
        isGitRepository: discovered.isGitRepository,
        sources: discovered.sources,
      });
    }
    return projectStore.create({
      id: createProjectId(),
      name: requestedName || path.basename(discovered.repoDir) || 'Project',
      repoDir: discovered.repoDir,
      isGitRepository: discovered.isGitRepository,
      sources: discovered.sources,
    });
  }

  function checkpointProject({ projectId, checkpoint }) {
    requireProjectDependencies();
    const project = requireProject(projectId);
    const discovered = projectDiscovery({ repoDir: project.repoDir });
    return projectStore.update(project.id, {
      isGitRepository: discovered.isGitRepository,
      sources: discovered.sources,
      checkpoint: {
        ...(checkpoint || {}),
        sourceSnapshot: captureSourceSnapshot(discovered.sources),
      },
    });
  }

  function inspectProjectContinuation(projectId) {
    requireProjectDependencies();
    const project = requireProject(projectId);
    const discovered = projectDiscovery({ repoDir: project.repoDir });
    const checkpointSnapshot = project.checkpoint ? project.checkpoint.sourceSnapshot : null;
    return {
      projectId: project.id,
      checkpoint: project.checkpoint,
      currentSources: discovered.sources,
      reconciliation: reconcileProjectSources({
        checkpointSnapshot,
        currentSources: discovered.sources,
      }),
    };
  }

  function compileExecutionContext({ project, objective, delegationEnvelope }) {
    requireProjectDependencies();
    const discovered = projectDiscovery({ repoDir: project.repoDir });
    const checkpoint = project.checkpoint || null;
    const reconciliation = reconcileProjectSources({
      checkpointSnapshot: checkpoint ? checkpoint.sourceSnapshot : null,
      currentSources: discovered.sources,
    });
    return projectContextCompiler({
      project,
      objective,
      currentSources: discovered.sources,
      checkpoint,
      reconciliation,
      delegationEnvelope,
    });
  }

  async function createExecutableWork({
    brief,
    repoDir = null,
    projectId = null,
    runtime,
    employeeId = 'ben',
    workerId = defaultWorkerId,
    model = null,
    delegationEnvelope = { allow: ['workspace.read', 'workspace.write', 'shell.execute'] },
    requireRepo = false,
  }) {
    if (!brief || !String(brief).trim()) throw new Error('Work brief is required');
    if (!runtime || !String(runtime).trim()) throw new Error('runtime is required');
    if (!workerId || !String(workerId).trim()) throw new Error('workerId is required');

    const normalizedBrief = String(brief).trim();
    const project = projectId ? requireProject(projectId) : null;
    const effectiveRepoDir = project ? project.repoDir : (repoDir && String(repoDir).trim() ? String(repoDir).trim() : null);
    if (requireRepo && !effectiveRepoDir) throw new Error('repoDir is required');

    const plan = workPlanner
      ? await workPlanner.plan({ intent: normalizedBrief, relatedWork: [], project })
      : null;
    const continuation = project
      ? compileExecutionContext({ project, objective: normalizedBrief, delegationEnvelope })
      : null;
    const prompt = continuation ? `${normalizedBrief}\n\n${continuation.text}` : normalizedBrief;

    const workId = createWorkId();
    workStore.create({
      id: workId,
      brief: normalizedBrief,
      projectId: project ? project.id : null,
      assignedEmployeeId: employeeId,
      status: 'starting',
      repoDir: effectiveRepoDir,
      runtime,
      plan,
    });

    try {
      const run = await runOrchestrator.start({
        workId,
        employeeId,
        workerId: String(workerId).trim(),
        runtime,
        repoDir: effectiveRepoDir,
        prompt,
        model,
        delegationEnvelope,
        ...(plan ? {
          skillSelections: plan.skillSelections,
          fileDeliverables: Array.isArray(plan.fileDeliverables) ? plan.fileDeliverables : [],
        } : {}),
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

  function createWork(input) {
    return createExecutableWork({ ...input, requireRepo: false });
  }

  function createCodingWork(input) {
    return createExecutableWork({ ...input, requireRepo: true });
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
    checkpointProject,
    inspectProjectContinuation,
    createWork,
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
