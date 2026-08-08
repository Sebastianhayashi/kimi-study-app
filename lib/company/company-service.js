const crypto = require('crypto');

function createCompanyService({
  workStore,
  runStore,
  runOrchestrator,
  createWorkId = () => `work_${crypto.randomUUID()}`,
}) {
  if (!workStore || !runStore || !runOrchestrator) throw new Error('Company service requires WorkStore, RunStore, and RunOrchestrator');
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

  async function createCodingWork({
    brief,
    repoDir,
    runtime,
    employeeId = 'ben',
    model = null,
    delegationEnvelope = { allow: ['workspace.read', 'workspace.write', 'shell.execute'] },
  }) {
    if (!brief || !String(brief).trim()) throw new Error('Work brief is required');
    if (!repoDir || !String(repoDir).trim()) throw new Error('repoDir is required');
    if (!runtime || !String(runtime).trim()) throw new Error('runtime is required');

    const workId = createWorkId();
    const work = workStore.create({
      id: workId,
      brief: String(brief).trim(),
      assignedEmployeeId: employeeId,
      status: 'starting',
      repoDir,
      runtime,
    });

    try {
      const run = await runOrchestrator.start({
        workId,
        employeeId,
        runtime,
        repoDir,
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
    createCodingWork,
    observeRun,
    decideWork,
    getWork: (id) => workStore.get(id),
    listWorks: () => workStore.list(),
  };
}

module.exports = { createCompanyService };
