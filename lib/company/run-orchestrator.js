const crypto = require('crypto');
const { createDelegationEnvelope } = require('./delegation-envelope');

function createRunOrchestrator({
  runStore,
  approvalBroker,
  runtimeRegistry,
  worktreeManager,
  createId = () => `run_${crypto.randomUUID()}`,
}) {
  if (!runStore || !approvalBroker || !runtimeRegistry || !worktreeManager) {
    throw new Error('Run orchestrator requires store, approval broker, runtime registry, and worktree manager');
  }
  const tasks = new Map();

  async function execute(runId, input) {
    try {
      const worktree = await worktreeManager.create({ repoDir: input.repoDir, runId, baseRef: input.baseRef || 'HEAD' });
      runStore.update(runId, { status: 'running', cwd: worktree.cwd, branch: worktree.branch });
      runStore.appendEvent(runId, { type: 'run.running', cwd: worktree.cwd, branch: worktree.branch });

      const runtime = runtimeRegistry.get(input.runtime);
      if (!runtime) throw new Error(`Runtime not registered: ${input.runtime}`);
      const envelope = createDelegationEnvelope(input.delegationEnvelope);
      let terminal = null;

      for await (const event of runtime.run({
        runId,
        workId: input.workId,
        employeeId: input.employeeId,
        cwd: worktree.cwd,
        prompt: input.prompt,
        model: input.model,
        providerSessionId: input.providerSessionId || null,
        delegationEnvelope: envelope,
        requestApproval: (request) => approvalBroker.request({ runId, envelope, request }),
      })) {
        if (!event || !event.type) continue;
        if (event.type === 'run.started' && event.providerSessionId) {
          runStore.update(runId, { providerSessionId: event.providerSessionId });
        }
        if (event.type === 'run.completed') {
          terminal = event;
          continue;
        }
        if (event.type === 'run.failed' || event.type === 'run.cancelled') terminal = event;
        runStore.appendEvent(runId, event);
      }

      if (terminal && terminal.type !== 'run.completed') {
        const status = terminal.type === 'run.cancelled' ? 'cancelled' : 'failed';
        return runStore.update(runId, { status, error: terminal.error || null });
      }

      const inspection = await worktreeManager.inspect({ cwd: worktree.cwd });
      if (inspection.diff || inspection.changedFiles.length) {
        runStore.appendEvent(runId, {
          type: 'artifact.produced',
          kind: 'diff',
          diff: inspection.diff,
          changedFiles: inspection.changedFiles,
        });
      }

      const completion = terminal || { type: 'run.completed', summary: null };
      runStore.appendEvent(runId, completion);
      return runStore.update(runId, {
        status: 'completed',
        summary: completion.summary || null,
        changedFiles: inspection.changedFiles,
      });
    } catch (error) {
      runStore.appendEvent(runId, { type: 'run.failed', error: error.message });
      return runStore.update(runId, { status: 'failed', error: error.message });
    }
  }

  async function start(input) {
    const id = createId();
    const run = runStore.create({
      id,
      workId: input.workId,
      employeeId: input.employeeId,
      workerId: input.workerId,
      runtime: input.runtime,
    });
    const task = execute(id, input).finally(() => tasks.delete(id));
    tasks.set(id, task);
    return run;
  }

  function wait(runId) {
    return tasks.get(runId) || Promise.resolve(runStore.get(runId));
  }

  return { start, wait };
}

module.exports = { createRunOrchestrator };
