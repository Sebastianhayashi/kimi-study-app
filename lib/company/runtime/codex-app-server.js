const { spawn } = require('child_process');
const { codexSandboxPolicy, capabilityForCommand } = require('../delegation-envelope');
const { createCodexAppServerPreflight } = require('./codex-app-server-preflight');
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

function createCodexAppServerRuntime({ spawnImpl = spawn, authorityBoundary = null } = {}) {
  const preflight = createCodexAppServerPreflight({ spawnImpl });
  return {
    kind: 'codex',
    preflight,
    async available() {
      return new Promise((resolve) => {
        let settled = false;
        const finish = (result) => { if (!settled) { settled = true; resolve(result); } };
        let child;
        try { child = spawnImpl('codex', ['--version'], { stdio: ['ignore', 'ignore', 'ignore'] }); }
        catch (error) { finish({ available: false, mode: 'app-server', reason: error.message }); return; }
        const timer = setTimeout(() => { if (child && !child.killed) child.kill('SIGTERM'); finish({ available: false, mode: 'app-server', reason: 'codex --version timed out' }); }, 1500);
        timer.unref?.();
        child.on('error', (error) => { clearTimeout(timer); finish({ available: false, mode: 'app-server', reason: error.message }); });
        child.on('close', (code) => { clearTimeout(timer); finish(code === 0 ? { available: true, mode: 'app-server' } : { available: false, mode: 'app-server', reason: `codex exited with ${code}` }); });
      });
    },
    async *run(request) {
      const boundary = await prepareAuthorityBoundary({
        boundary: authorityBoundary,
        cwd: request.cwd,
        delegationEnvelope: request.delegationEnvelope,
      });
      const child = boundary.spawn('codex', ['app-server'], { cwd: request.cwd, stdio: ['pipe', 'pipe', 'pipe'] });
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
            terminal = true; queue.end();
            if (child.stdin && !child.stdin.destroyed) child.stdin.end();
            setTimeout(() => { if (!child.killed) child.kill('SIGTERM'); }, 50).unref?.();
          }
        }
      };
      const parser = createLineParser((line) => { try { handle(JSON.parse(line)); } catch (error) { queue.fail(error); } });
      child.stdout.on('data', (chunk) => parser.push(chunk));
      child.stderr.on('data', (chunk) => { stderr = `${stderr}${chunk}`.slice(-12000); });
      child.on('error', (error) => queue.fail(error));
      child.on('close', (code) => { parser.flush(); if (!terminal && code !== 0) queue.fail(new Error(stderr.trim() || `codex app-server exited with code ${code}`)); else if (!terminal) queue.end(); });

      await rpc('initialize', { clientInfo: { name: 'lucubro', title: 'Lucubro', version: '0.1.0' } });
      notify('initialized', {});
      const threadResult = request.providerSessionId ? await rpc('thread/resume', { threadId: request.providerSessionId }) : await rpc('thread/start', { ...(request.model ? { model: request.model } : {}) });
      const threadId = request.providerSessionId || (threadResult && threadResult.thread && threadResult.thread.id);
      if (!threadId) throw new Error('Codex app-server did not return a thread id');
      queue.push({ type: 'run.started', providerSessionId: threadId });
      await rpc('turn/start', { threadId, input: [{ type: 'text', text: request.prompt }], cwd: request.cwd, approvalPolicy: 'unlessTrusted', sandboxPolicy: codexSandboxPolicy(request.delegationEnvelope, request.cwd), ...(request.model ? { model: request.model } : {}) });
      for await (const event of queue) yield event;
    },
  };
}

module.exports = { createCodexAppServerRuntime, mapCodexNotification, approvalRequestFromCodex };
