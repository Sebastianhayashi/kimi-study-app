const crypto = require('crypto');
const path = require('node:path');
const { captureSourceSnapshot, reconcileProjectSources } = require('./project-continuation');
const { compileProjectContinuationContext } = require('./project-context');
const { extractWorkInputEvidence } = require('./work-input-evidence');

function normalizeExplicitInputEvidence(values) {
  if (values == null) return [];
  if (!Array.isArray(values)) throw new Error('Work input Evidence must be an array');
  return values.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Work input Evidence item must be an object');
    return {
      ...item,
      metadata: item.metadata && typeof item.metadata === 'object' && !Array.isArray(item.metadata)
        ? { ...item.metadata }
        : {},
      content: Buffer.isBuffer(item.content) ? Buffer.from(item.content) : item.content,
    };
  });
}

function createCompanyService({
  workStore,
  runStore,
  runOrchestrator,
  projectStore = null,
  projectDiscovery = null,
  projectContextCompiler = compileProjectContinuationContext,
  projectMemoryService = null,
  workPlanner = null,
  defaultWorkerId = 'worker_local',
  createWorkId = () => `work_${crypto.randomUUID()}`,
  createProjectId = () => `project_${crypto.randomUUID()}`,
}) {
  if (!workStore || !runStore || !runOrchestrator) throw new Error('Company service requires WorkStore, RunStore, and RunOrchestrator');
  if (workPlanner && typeof workPlanner.plan !== 'function') throw new Error('Company service workPlanner must expose plan()');
  if (projectMemoryService && typeof projectMemoryService.commit !== 'function') throw new Error('Company service projectMemoryService must expose commit()');
  if (!defaultWorkerId || !String(defaultWorkerId).trim()) throw new Error('Company service requires a default Worker id');
  const subscriptions = new Map();

  function commitRunProjectMemory(work, runId) {
    if (!projectMemoryService || !work || !work.projectId) return [];
    const proposals = runStore.readEvents(runId).filter((event) => event.type === 'project.memory.proposed');
    const commits = [];
    for (const proposal of proposals) {
      const mutation = proposal.mutation && typeof proposal.mutation === 'object' && !Array.isArray(proposal.mutation)
        ? JSON.parse(JSON.stringify(proposal.mutation))
        : {};
      const sourceWorkIdsAdd = Array.isArray(mutation.sourceWorkIdsAdd) ? [...mutation.sourceWorkIdsAdd] : [];
      if (!sourceWorkIdsAdd.includes(work.id)) sourceWorkIdsAdd.push(work.id);
      mutation.sourceWorkIdsAdd = sourceWorkIdsAdd;
      commits.push(projectMemoryService.commit({
        projectId: work.projectId,
        sourceWorkId: work.id,
        sourceRunId: runId,
        evidenceIds: Array.isArray(proposal.evidenceRefs) ? proposal.evidenceRefs : [],
        summary: proposal.summary,
        mutation,
      }));
    }
    return commits;
  }

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
      if (event.type === 'run.completed') {
        try {
          commitRunProjectMemory(work, runId);
          workStore.update(workId, { status: 'review', memoryCommitError: null });
        } catch (error) {
          workStore.update(workId, { status: 'failed', memoryCommitError: error.message });
        }
      }
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

  function isMemoryProject(project) {
    return Boolean(
      project
      && !project.repoDir
      && project.kind === 'work-context'
      && project.memory
      && typeof project.memory === 'object'
    );
  }

  function readContinuationState(project) {
    if (project.repoDir) {
      requireProjectDependencies();
      const discovered = projectDiscovery({ repoDir: project.repoDir });
      const checkpoint = project.checkpoint || null;
      return {
        currentSources: discovered.sources,
        reconciliation: reconcileProjectSources({
          checkpointSnapshot: checkpoint ? checkpoint.sourceSnapshot : null,
          currentSources: discovered.sources,
        }),
        discovered,
      };
    }
    if (isMemoryProject(project)) {
      return {
        currentSources: [],
        reconciliation: {
          status: project.checkpoint ? 'fresh' : 'uncheckpointed',
          stale: false,
          changed: [],
          missing: [],
          added: [],
        },
        discovered: null,
      };
    }
    throw new Error(`Project has no repository sources or durable Project Memory: ${project.id}`);
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
    const project = requireProject(projectId);
    const state = readContinuationState(project);
    if (!state.discovered) {
      return projectStore.update(project.id, {
        checkpoint: {
          ...(checkpoint || {}),
          sourceSnapshot: [],
        },
      });
    }
    return projectStore.update(project.id, {
      isGitRepository: state.discovered.isGitRepository,
      sources: state.discovered.sources,
      checkpoint: {
        ...(checkpoint || {}),
        sourceSnapshot: captureSourceSnapshot(state.discovered.sources),
      },
    });
  }

  function inspectProjectContinuation(projectId) {
    const project = requireProject(projectId);
    const state = readContinuationState(project);
    return {
      projectId: project.id,
      checkpoint: project.checkpoint,
      currentSources: state.currentSources,
      reconciliation: state.reconciliation,
      ...(isMemoryProject(project) ? { memory: project.memory } : {}),
    };
  }

  function compileExecutionContext({ project, objective, delegationEnvelope }) {
    const state = readContinuationState(project);
    return projectContextCompiler({
      project,
      objective,
      currentSources: state.currentSources,
      checkpoint: project.checkpoint || null,
      reconciliation: state.reconciliation,
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
    inputEvidence: explicitInputEvidence = [],
  }) {
    if (!brief || !String(brief).trim()) throw new Error('Work brief is required');
    if (!runtime || !String(runtime).trim()) throw new Error('runtime is required');
    if (!workerId || !String(workerId).trim()) throw new Error('workerId is required');

    const normalizedBrief = String(brief).trim();
    const project = projectId ? requireProject(projectId) : null;
    const effectiveRepoDir = project ? project.repoDir : (repoDir && String(repoDir).trim() ? String(repoDir).trim() : null);
    if (requireRepo && !effectiveRepoDir) throw new Error('repoDir is required');
    const inputEvidence = [
      ...extractWorkInputEvidence({
        brief: normalizedBrief,
        projectId: project ? project.id : null,
      }),
      ...normalizeExplicitInputEvidence(explicitInputEvidence),
    ];

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
        inputEvidence,
        ...(plan ? {
          skillSelections: plan.skillSelections,
          fileDeliverables: Array.isArray(plan.fileDeliverables) ? plan.fileDeliverables : [],
        } : {}),
      });
      workStore.update(workId, { activeRunId: run.id, status: 'in-progress' });
      observeRun(workId, run.id);
      void runOrchestrator.wait(run.id).then((finalRun) => {
        const current = workStore.get(workId);
        if (!current || current.activeRunId !== run.id || current.status === 'failed') return;
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

module.exports = { createCompanyService, normalizeExplicitInputEvidence };
