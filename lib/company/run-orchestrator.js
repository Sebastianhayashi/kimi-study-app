const crypto = require('crypto');
const { createDelegationEnvelope } = require('./delegation-envelope');

function createRunOrchestrator({
  runStore,
  approvalBroker,
  runtimeRegistry,
  worktreeManager = null,
  workspaceManager = null,
  evidenceStore = null,
  skillMountBuilder = null,
  createId = () => `run_${crypto.randomUUID()}`,
}) {
  const executionWorkspaceManager = workspaceManager || worktreeManager;
  if (!runStore || !approvalBroker || !runtimeRegistry || !executionWorkspaceManager) {
    throw new Error('Run orchestrator requires store, approval broker, runtime registry, and an execution workspace manager');
  }
  if (skillMountBuilder && typeof skillMountBuilder.build !== 'function') {
    throw new Error('Run orchestrator skillMountBuilder must expose build()');
  }
  const tasks = new Map();

  function decodeRuntimeEvidence(event) {
    if (event.contentBase64 != null) return Buffer.from(String(event.contentBase64), 'base64');
    if (event.content != null) return Buffer.isBuffer(event.content) ? Buffer.from(event.content) : Buffer.from(String(event.content), 'utf8');
    return Buffer.alloc(0);
  }

  function persistEvidence(runId, input, event) {
    if (!evidenceStore) return null;
    return evidenceStore.create({
      runId,
      workId: input.workId,
      workerId: input.workerId,
      kind: event.kind,
      label: event.label,
      mimeType: event.mimeType,
      source: event.source || 'runtime',
      metadata: event.metadata || {},
      content: decodeRuntimeEvidence(event),
    });
  }

  function persistArtifactPayload(runId, input, event) {
    if (!evidenceStore || event.diff == null) return null;
    return evidenceStore.create({
      runId,
      workId: input.workId,
      workerId: input.workerId,
      kind: event.kind || 'diff',
      label: event.label || 'Runtime code snapshot',
      mimeType: event.mimeType || 'text/x-diff',
      source: event.source || 'runtime',
      metadata: {
        changedFiles: Array.isArray(event.changedFiles) ? event.changedFiles : [],
        eventType: event.type,
        providerItemId: event.providerItemId || null,
      },
      content: event.diff,
    });
  }

  function publicArtifactEvent(runId, input, event) {
    if (event.diff == null) return event;
    const evidence = persistArtifactPayload(runId, input, event);
    const publicEvent = { ...event };
    delete publicEvent.diff;
    if (evidence) {
      publicEvent.evidenceId = evidence.id;
      publicEvent.evidence = evidence;
    }
    return publicEvent;
  }

  async function execute(runId, input) {
    try {
      const workspace = await executionWorkspaceManager.create({
        repoDir: input.repoDir || null,
        runId,
        baseRef: input.baseRef || 'HEAD',
      });
      runStore.update(runId, {
        status: 'running',
        cwd: workspace.cwd,
        branch: workspace.branch || null,
        workspaceKind: workspace.kind || (input.repoDir ? 'git-worktree' : 'scratch'),
      });
      runStore.appendEvent(runId, {
        type: 'run.running',
        cwd: workspace.cwd,
        branch: workspace.branch || null,
        workspaceKind: workspace.kind || (input.repoDir ? 'git-worktree' : 'scratch'),
      });

      const runtime = runtimeRegistry.get(input.runtime);
      if (!runtime) throw new Error(`Runtime not registered: ${input.runtime}`);
      const envelope = createDelegationEnvelope(input.delegationEnvelope);
      let skillMount = input.skillMount || null;
      if (!skillMount && Array.isArray(input.skillSelections) && input.skillSelections.length > 0) {
        if (!skillMountBuilder) throw new Error('Skill mount builder is required when Work planning selected Skills');
        skillMount = await skillMountBuilder.build({
          runId,
          subrunId: input.subrunId || null,
          selections: input.skillSelections,
        });
      }
      let terminal = null;

      for await (const event of runtime.run({
        runId,
        subrunId: input.subrunId || null,
        workId: input.workId,
        employeeId: input.employeeId,
        cwd: workspace.cwd,
        prompt: input.prompt,
        model: input.model,
        providerSessionId: input.providerSessionId || null,
        skillMount,
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
        if (event.type === 'evidence.produced') {
          const evidence = persistEvidence(runId, input, event);
          runStore.appendEvent(runId, evidence
            ? { type: 'evidence.produced', evidence }
            : { type: 'evidence.produced', evidence: null, kind: event.kind, label: event.label });
          continue;
        }
        if (event.type === 'artifact.updated' || event.type === 'artifact.produced') {
          runStore.appendEvent(runId, publicArtifactEvent(runId, input, event));
          continue;
        }
        runStore.appendEvent(runId, event);
      }

      if (terminal && terminal.type !== 'run.completed') {
        const status = terminal.type === 'run.cancelled' ? 'cancelled' : 'failed';
        return runStore.update(runId, { status, error: terminal.error || null });
      }

      const inspection = await executionWorkspaceManager.inspect(workspace);
      if (inspection.diff || inspection.changedFiles.length) {
        const diffEvidence = evidenceStore ? evidenceStore.create({
          runId,
          workId: input.workId,
          workerId: input.workerId,
          kind: 'diff',
          label: 'Code changes',
          mimeType: 'text/x-diff',
          source: workspace.kind === 'scratch' ? 'execution-workspace' : 'worktree',
          metadata: { changedFiles: inspection.changedFiles, workspaceKind: workspace.kind || null },
          content: inspection.diff || inspection.changedFiles.join('\n'),
        }) : null;
        runStore.appendEvent(runId, {
          type: 'artifact.produced',
          kind: 'diff',
          diff: inspection.changedFiles.join('\n'),
          preview: true,
          changedFiles: inspection.changedFiles,
          evidenceId: diffEvidence ? diffEvidence.id : null,
          evidence: diffEvidence,
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
      parentRunId: input.parentRunId || null,
      subrunId: input.subrunId || null,
      role: input.role || null,
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
