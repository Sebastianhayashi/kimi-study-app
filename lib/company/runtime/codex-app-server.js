const { spawn } = require('child_process');
const { codexSandboxPolicy, capabilityForCommand } = require('../delegation-envelope');
const { createCodexAppServerPreflight } = require('./codex-app-server-preflight');
const { establishCodexSkillMount } = require('./codex-skill-mount');
const { prepareAuthorityBoundary } = require('./authority-boundary');

function createLineParser(onLine) {
  let buffer = '';
  return {
    push(chunk) {
      buffer += chunk.toString();
      let index;
      while ((index = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, index).trim();
        buffer = buffer.slice(index + 1);
        if (line) onLine(line);
      }
    },
    flush() {
      const line = buffer.trim();
      buffer = '';
      if (line) onLine(line);
    },
  };
}

function createAsyncQueue() {
  const values = [];
  const waiters = [];
  let closed = false;
  let failure = null;
  function settle() {
    while (waiters.length && values.length) waiters.shift().resolve({ value: values.shift(), done: false });
    if (!closed || values.length) return;
    while (waiters.length) {
      const waiter = waiters.shift();
      if (failure) waiter.reject(failure);
      else waiter.resolve({ value: undefined, done: true });
    }
  }
  return {
    push(value) { if (!closed) { values.push(value); settle(); } },
    end() { closed = true; settle(); },
    fail(error) { failure = error; closed = true; settle(); },
    [Symbol.asyncIterator]() {
      return {
        next() {
          if (values.length) return Promise.resolve({ value: values.shift(), done: false });
          if (closed) return failure ? Promise.reject(failure) : Promise.resolve({ value: undefined, done: true });
          return new Promise((resolve, reject) => waiters.push({ resolve, reject }));
        },
      };
    },
  };
}

function terminateChild(child) {
  if (!child) return;
  if (child.stdin && !child.stdin.destroyed) child.stdin.end();
  if (!child.killed) child.kill('SIGTERM');
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function admittedProfile(admission) {
  if (!admission) return null;
  if (admission.admitted !== true || admission.profileName !== 'Luna Max') {
    throw new Error(admission.reason || 'Verified Luna Max admission is required for real Codex execution.');
  }
  if (!nonEmptyString(admission.modelId)) throw new Error('Verified Luna Max admission is missing modelId.');
  if (!nonEmptyString(admission.providerPermissionProfileId)) {
    throw new Error('Verified Luna Max admission is missing provider permission profile id.');
  }
  return {
    modelId: admission.modelId.trim(),
    providerPermissionProfileId: admission.providerPermissionProfileId.trim(),
  };
}

function assertRequestUsesAdmission(request, profile) {
  if (!profile) return;
  if (request.model != null && String(request.model).trim() !== profile.modelId) {
    throw new Error(`Codex Run must use admitted Luna Max model ${profile.modelId}.`);
  }
  if (request.providerSessionId) {
    throw new Error('Admitted real Codex uses fresh ephemeral threads; provider session resume is not a durable continuation contract.');
  }
}

function activePermissionProfileId(result) {
  const active = result && result.activePermissionProfile;
  return active && nonEmptyString(active.id) ? active.id.trim() : null;
}

function defaultTierWithFastDisabled(value) {
  return value == null || value === 'default';
}

function assertThreadMatchesAdmission(threadResult, profile) {
  if (!profile) return;
  const observedModel = threadResult && threadResult.model;
  if (observedModel !== profile.modelId) {
    throw new Error(`Codex thread model mismatch: expected admitted Luna Max model ${profile.modelId}, observed ${String(observedModel || 'unknown')}.`);
  }
  if (!threadResult || threadResult.modelProvider !== 'openai') {
    throw new Error(`Codex thread model provider mismatch: expected openai, observed ${String(threadResult && threadResult.modelProvider || 'unknown')}.`);
  }
  if (!Object.prototype.hasOwnProperty.call(threadResult, 'serviceTier') || !defaultTierWithFastDisabled(threadResult.serviceTier)) {
    throw new Error(`Codex thread service tier must be default with Fast disabled; observed ${String(threadResult && threadResult.serviceTier || 'unknown')}.`);
  }
  const observedPermissionProfileId = activePermissionProfileId(threadResult);
  if (observedPermissionProfileId !== profile.providerPermissionProfileId) {
    throw new Error(`Codex thread permission profile mismatch: expected ${profile.providerPermissionProfileId}, observed ${String(observedPermissionProfileId || 'unknown')}.`);
  }
  if (!threadResult.thread || threadResult.thread.ephemeral !== true) {
    throw new Error('Codex admitted thread must be ephemeral so Lucubro persistence never depends on provider session state.');
  }
}

function mapCodexNotification(message) {
  const method = message && message.method;
  const params = (message && message.params) || {};
  if (method === 'item/agentMessage/delta' && typeof params.delta === 'string') return [{ type: 'message.delta', text: params.delta }];
  if (method === 'turn/diff/updated' && typeof params.diff === 'string') return [{ type: 'artifact.updated', kind: 'diff', diff: params.diff }];
  if (method === 'item/started') {
    const item = params.item || {};
    if (item.type === 'commandExecution') return [{ type: 'tool.started', tool: 'command', providerItemId: item.id || null }];
    if (item.type === 'fileChange') return [{ type: 'tool.started', tool: 'file-change', providerItemId: item.id || null }];
  }
  if (method === 'item/completed') {
    const item = params.item || {};
    if (item.type === 'commandExecution' || item.type === 'fileChange') return [{ type: 'tool.completed', tool: item.type, providerItemId: item.id || null, status: item.status || null }];
  }
  if (method === 'turn/completed') {
    const turn = params.turn || {};
    if (turn.status === 'completed') return [{ type: 'run.completed', summary: null }];
    if (turn.status === 'interrupted') return [{ type: 'run.cancelled' }];
    return [{ type: 'run.failed', error: turn.error && turn.error.message ? turn.error.message : 'Codex turn failed' }];
  }
  if (method === 'error') return [{ type: 'runtime.warning', message: (params.error && params.error.message) || 'Codex runtime error' }];
  return [];
}

function approvalRequestFromCodex(message) {
  const params = message.params || {};
  if (message.method === 'item/commandExecution/requestApproval') {
    if (params.networkApprovalContext) return { provider: 'codex', providerRequestId: String(message.id), capability: 'network.access', reason: params.reason || 'Codex requested network access', detail: params.networkApprovalContext };
    return { provider: 'codex', providerRequestId: String(message.id), capability: capabilityForCommand(params.command), reason: params.reason || 'Codex requested command execution', detail: { command: params.command || null, cwd: params.cwd || null } };
  }
  if (message.method === 'item/fileChange/requestApproval') return { provider: 'codex', providerRequestId: String(message.id), capability: 'workspace.write', reason: params.reason || 'Codex requested a file change', detail: { grantRoot: params.grantRoot || null } };
  if (message.method === 'item/permissions/requestApproval') return { provider: 'codex', providerRequestId: String(message.id), capability: 'permission.expand', reason: params.reason || 'Codex requested additional permissions', detail: { permissions: params.permissions || null } };
  return null;
}

function createCodexAppServerRuntime({
  spawnImpl = spawn,
  authorityBoundary = null,
  admission = null,
  codexExecutable = 'codex',
} = {}) {
  const executable = nonEmptyString(codexExecutable) ? codexExecutable.trim() : 'codex';
  const spawnCodex = (command, args, options) => spawnImpl(command === 'codex' ? executable : command, args, options);
  const preflight = createCodexAppServerPreflight({ spawnImpl: spawnCodex });
  return {
    kind: 'codex',
    preflight,
    async available() {
      if (admission && admission.admitted !== true) {
        return { available: false, mode: 'app-server', reason: admission.reason || 'Verified Luna Max admission is required.' };
      }
      return new Promise((resolve) => {
        let settled = false;
        const finish = (result) => { if (!settled) { settled = true; resolve(result); } };
        let child;
        try { child = spawnImpl(executable, ['--version'], { stdio: ['ignore', 'ignore', 'ignore'] }); }
        catch (error) { finish({ available: false, mode: 'app-server', reason: error.message }); return; }
        const timer = setTimeout(() => { if (child && !child.killed) child.kill('SIGTERM'); finish({ available: false, mode: 'app-server', reason: 'codex --version timed out' }); }, 1500);
        timer.unref?.();
        child.on('error', (error) => { clearTimeout(timer); finish({ available: false, mode: 'app-server', reason: error.message }); });
        child.on('close', (code) => { clearTimeout(timer); finish(code === 0 ? { available: true, mode: 'app-server' } : { available: false, mode: 'app-server', reason: `codex exited with ${code}` }); });
      });
    },
    async *run(request) {
      const profile = admittedProfile(admission);
      assertRequestUsesAdmission(request, profile);
      const boundary = await prepareAuthorityBoundary({
        boundary: authorityBoundary,
        cwd: request.cwd,
        workspaceKind: request.workspaceKind || null,
        delegationEnvelope: request.delegationEnvelope,
      });
      let child = null;
      try {
        child = boundary.spawn('codex', ['app-server'], { cwd: request.cwd, stdio: ['pipe', 'pipe', 'pipe'] });
        const queue = createAsyncQueue();
        const pending = new Map();
        let requestId = 0;
        let stderr = '';
        let terminal = false;
        const send = (message) => child.stdin.write(`${JSON.stringify(message)}\n`);
        const rpc = (method, params) => new Promise((resolve, reject) => { const id = ++requestId; pending.set(id, { resolve, reject }); send({ method, id, params }); });
        const notify = (method, params) => send({ method, params });
        const respondToApproval = async (message) => {
          const capabilityRequest = approvalRequestFromCodex(message);
          if (!capabilityRequest) return false;
          try {
            const decision = await request.requestApproval(capabilityRequest);
            if (message.method === 'item/permissions/requestApproval') {
              const requested = (message.params && message.params.permissions) || {};
              send({ id: message.id, result: { permissions: decision === 'allow' ? requested : {}, scope: 'turn' } });
            } else send({ id: message.id, result: { decision: decision === 'allow' ? 'accept' : 'decline' } });
          } catch { send({ id: message.id, result: { decision: 'decline' } }); }
          return true;
        };
        const handle = (message) => {
          if (message && message.id != null && message.method) { void respondToApproval(message); return; }
          if (message && message.id != null && pending.has(message.id)) {
            const waiter = pending.get(message.id); pending.delete(message.id);
            if (message.error) waiter.reject(new Error(message.error.message || 'Codex RPC error')); else waiter.resolve(message.result);
            return;
          }
          for (const event of mapCodexNotification(message)) {
            queue.push(event);
            if (['run.completed', 'run.failed', 'run.cancelled'].includes(event.type)) {
              terminal = true;
              queue.end();
            }
          }
        };
        const parser = createLineParser((line) => { try { handle(JSON.parse(line)); } catch (error) { queue.fail(error); } });
        child.stdout.on('data', (chunk) => parser.push(chunk));
        child.stderr.on('data', (chunk) => { stderr = `${stderr}${chunk}`.slice(-12000); });
        child.on('error', (error) => queue.fail(error));
        child.on('close', (code) => {
          parser.flush();
          if (!terminal && code !== 0) queue.fail(new Error(stderr.trim() || `codex app-server exited with code ${code}`));
          else if (!terminal) queue.end();
        });

        await rpc('initialize', {
          clientInfo: { name: 'lucubro', title: 'Lucubro', version: '0.1.0' },
          ...(profile ? { capabilities: { experimentalApi: true } } : {}),
        });
        notify('initialized', {});
        if (request.skillMount) {
          const mountReceipt = await establishCodexSkillMount({ rpc, cwd: request.cwd, mount: request.skillMount });
          queue.push({
            type: 'skill.mounted',
            receipt: {
              ...mountReceipt,
              runId: request.runId || null,
              subrunId: request.subrunId || null,
            },
          });
        }

        let threadResult;
        if (request.providerSessionId) {
          threadResult = await rpc('thread/resume', profile ? {
            threadId: request.providerSessionId,
            model: profile.modelId,
            cwd: request.cwd,
            serviceTier: null,
            permissions: profile.providerPermissionProfileId,
          } : { threadId: request.providerSessionId });
        } else {
          threadResult = await rpc('thread/start', profile ? {
            model: profile.modelId,
            cwd: request.cwd,
            allowProviderModelFallback: false,
            serviceTier: null,
            permissions: profile.providerPermissionProfileId,
            ephemeral: true,
          } : { ...(request.model ? { model: request.model } : {}) });
        }
        assertThreadMatchesAdmission(threadResult, profile);

        const threadId = request.providerSessionId || (threadResult && threadResult.thread && threadResult.thread.id);
        if (!threadId) throw new Error('Codex app-server did not return a thread id');
        queue.push(profile ? { type: 'run.started' } : { type: 'run.started', providerSessionId: threadId });

        const turnParams = {
          threadId,
          input: [{ type: 'text', text: request.prompt }],
          cwd: request.cwd,
          approvalPolicy: 'unlessTrusted',
          ...(profile ? {
            collaborationMode: {
              mode: 'default',
              settings: {
                model: profile.modelId,
                reasoningEffort: null,
                developerInstructions: null,
              },
            },
          } : {
            sandboxPolicy: codexSandboxPolicy(request.delegationEnvelope, request.cwd),
            ...(request.model ? { model: request.model } : {}),
          }),
        };
        await rpc('turn/start', turnParams);
        for await (const event of queue) yield event;
      } finally {
        terminateChild(child);
      }
    },
  };
}

module.exports = {
  activePermissionProfileId,
  approvalRequestFromCodex,
  assertThreadMatchesAdmission,
  createCodexAppServerRuntime,
  defaultTierWithFastDisabled,
  mapCodexNotification,
};
