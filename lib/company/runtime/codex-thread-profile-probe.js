'use strict';

const { spawn } = require('node:child_process');

function text(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

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

function activePermissionProfileId(result) {
  const profile = result && result.activePermissionProfile;
  return profile && text(profile.id) ? profile.id.trim() : null;
}

async function probeCodexThreadProfile({
  cwd,
  modelId,
  permissionProfileId,
  spawnImpl = spawn,
} = {}) {
  const workingDirectory = text(cwd);
  const requestedModelId = text(modelId);
  const requestedPermissionProfileId = text(permissionProfileId);
  if (!workingDirectory) throw new Error('Codex thread profile probe cwd is required.');
  if (!requestedModelId) throw new Error('Codex thread profile probe modelId is required.');
  if (!requestedPermissionProfileId) throw new Error('Codex thread profile probe permissionProfileId is required.');
  if (typeof spawnImpl !== 'function') throw new Error('Codex thread profile probe requires spawnImpl.');

  const child = spawnImpl('codex', ['app-server'], { cwd: workingDirectory, stdio: ['pipe', 'pipe', 'pipe'] });
  const pending = new Map();
  let requestId = 0;
  let stderr = '';
  let closed = false;

  function failPending(error) {
    for (const waiter of pending.values()) waiter.reject(error);
    pending.clear();
  }

  function send(message) {
    child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  function rpc(method, params) {
    return new Promise((resolve, reject) => {
      const id = ++requestId;
      pending.set(id, { resolve, reject });
      send({ method, id, params });
    });
  }

  const parser = createLineParser((line) => {
    const message = JSON.parse(line);
    if (!message || message.id == null || !pending.has(message.id)) return;
    const waiter = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(message.error.message || 'Codex thread profile probe RPC failed'));
    else waiter.resolve(message.result);
  });

  child.stdout.on('data', (chunk) => {
    try { parser.push(chunk); }
    catch (error) { failPending(error); }
  });
  child.stderr.on('data', (chunk) => { stderr = `${stderr}${chunk}`.slice(-12000); });
  child.on('error', failPending);
  child.on('close', (code) => {
    closed = true;
    try { parser.flush(); }
    catch (error) { failPending(error); return; }
    if (pending.size) failPending(new Error(stderr.trim() || `codex app-server exited with code ${code}`));
  });

  let threadId = null;
  let archived = false;
  try {
    await rpc('initialize', {
      clientInfo: { name: 'lucubro', title: 'Lucubro', version: '0.1.0' },
      capabilities: { experimentalApi: true },
    });
    send({ method: 'initialized', params: {} });
    const result = await rpc('thread/start', {
      model: requestedModelId,
      cwd: workingDirectory,
      allowProviderModelFallback: false,
      serviceTier: null,
      permissions: requestedPermissionProfileId,
    });
    const observedModelId = text(result && result.model);
    if (observedModelId !== requestedModelId) {
      throw new Error(`Codex thread model mismatch: expected ${requestedModelId}, observed ${observedModelId || 'unknown'}.`);
    }
    if (!result || result.modelProvider !== 'openai') {
      throw new Error(`Codex thread provider mismatch: expected openai, observed ${String(result && result.modelProvider || 'unknown')}.`);
    }
    const observedPermissionProfileId = activePermissionProfileId(result);
    if (observedPermissionProfileId !== requestedPermissionProfileId) {
      throw new Error(`Codex thread permission profile mismatch: expected ${requestedPermissionProfileId}, observed ${observedPermissionProfileId || 'unknown'}.`);
    }
    if (!Object.prototype.hasOwnProperty.call(result, 'serviceTier')) {
      throw new Error('Codex thread profile probe did not report serviceTier.');
    }
    if (result.serviceTier === 'fast') {
      throw new Error('Codex thread profile probe observed Fast service tier.');
    }

    threadId = result && result.thread && text(result.thread.id);
    if (!threadId) throw new Error('Codex thread profile probe did not return a thread id.');
    await rpc('thread/archive', { threadId });
    archived = true;

    return {
      modelId: observedModelId,
      modelProvider: result.modelProvider,
      serviceTier: result.serviceTier,
      activePermissionProfileId: observedPermissionProfileId,
      providerFallbackDisabled: true,
      requestedServiceTier: null,
      archived,
    };
  } finally {
    if (threadId && !archived) {
      try { await rpc('thread/archive', { threadId }); }
      catch {}
    }
    if (child.stdin && !child.stdin.destroyed) child.stdin.end();
    if (!closed && child && !child.killed) child.kill('SIGTERM');
  }
}

module.exports = {
  activePermissionProfileId,
  probeCodexThreadProfile,
};
