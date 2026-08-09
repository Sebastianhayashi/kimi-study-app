'use strict';

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

function requiredText(value, label) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new Error(`${label} is required`);
  return text;
}

function createCodexAppServerPreflight({ spawnImpl } = {}) {
  if (typeof spawnImpl !== 'function') throw new Error('Codex preflight requires spawnImpl');

  return async function preflight({ cwd, requestedModelId, requestedPermissionProfileId } = {}) {
    const modelId = requiredText(requestedModelId, 'requestedModelId');
    const permissionProfileId = requiredText(requestedPermissionProfileId, 'requestedPermissionProfileId');
    const child = spawnImpl('codex', ['app-server'], { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    const pending = new Map();
    let requestId = 0;
    let stderr = '';
    let closed = false;

    const failPending = (error) => {
      for (const waiter of pending.values()) waiter.reject(error);
      pending.clear();
    };
    const send = (message) => child.stdin.write(`${JSON.stringify(message)}\n`);
    const rpc = (method, params) => new Promise((resolve, reject) => {
      const id = ++requestId;
      pending.set(id, { resolve, reject });
      send({ method, id, params });
    });
    const notify = (method, params) => send({ method, params });
    const parser = createLineParser((line) => {
      const message = JSON.parse(line);
      if (message && message.id != null && pending.has(message.id)) {
        const waiter = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) waiter.reject(new Error(message.error.message || 'Codex RPC error'));
        else waiter.resolve(message.result);
      }
    });

    child.stdout.on('data', (chunk) => {
      try { parser.push(chunk); } catch (error) { failPending(error); }
    });
    child.stderr.on('data', (chunk) => { stderr = `${stderr}${chunk}`.slice(-12000); });
    child.on('error', (error) => failPending(error));
    child.on('close', (code) => {
      closed = true;
      try { parser.flush(); } catch (error) { failPending(error); return; }
      if (pending.size) failPending(new Error(stderr.trim() || `codex app-server exited with code ${code}`));
    });

    try {
      const initialize = await rpc('initialize', {
        clientInfo: { name: 'lucubro', title: 'Lucubro', version: '0.1.0' },
        capabilities: { experimentalApi: true },
      });
      notify('initialized', {});

      const modelResult = await rpc('model/list', { includeHidden: true });
      const configResult = await rpc('config/read', { cwd, includeLayers: true });
      const permissionResult = await rpc('permissionProfile/list', { cwd });

      const models = Array.isArray(modelResult && modelResult.data) ? modelResult.data : [];
      const requestedModel = models.find((model) => model && (model.id === modelId || model.model === modelId)) || null;
      const config = configResult && configResult.config && typeof configResult.config === 'object' ? configResult.config : {};
      const profiles = Array.isArray(permissionResult && permissionResult.data) ? permissionResult.data : [];
      const requestedProfile = profiles.find((profile) => profile && profile.id === permissionProfileId) || null;
      const unknown = [];
      if (!requestedModel) unknown.push('model.catalogMatch');
      if (typeof config.model !== 'string' || !config.model.trim()) unknown.push('effectiveConfig.modelId');
      if (!requestedProfile) unknown.push('permissionProfile.present');

      return {
        kind: 'codex-app-server-preflight',
        initialize: {
          userAgent: initialize && initialize.userAgent || null,
          codexHome: initialize && initialize.codexHome || null,
          platformFamily: initialize && initialize.platformFamily || null,
          platformOs: initialize && initialize.platformOs || null,
        },
        model: {
          requestedId: modelId,
          catalogMatch: Boolean(requestedModel),
          displayName: requestedModel && requestedModel.displayName || null,
          isDefault: requestedModel ? Boolean(requestedModel.isDefault) : false,
          defaultServiceTier: requestedModel && requestedModel.defaultServiceTier != null ? requestedModel.defaultServiceTier : null,
          additionalSpeedTiers: requestedModel && Array.isArray(requestedModel.additionalSpeedTiers) ? [...requestedModel.additionalSpeedTiers] : [],
          serviceTierIds: requestedModel && Array.isArray(requestedModel.serviceTiers)
            ? requestedModel.serviceTiers.map((tier) => tier && tier.id).filter(Boolean)
            : [],
        },
        effectiveConfig: {
          modelId: typeof config.model === 'string' && config.model.trim() ? config.model : null,
          modelProvider: typeof config.model_provider === 'string' && config.model_provider.trim() ? config.model_provider : null,
          serviceTier: typeof config.service_tier === 'string' && config.service_tier.trim() ? config.service_tier : null,
        },
        permissionProfile: {
          requestedId: permissionProfileId,
          present: Boolean(requestedProfile),
          allowed: Boolean(requestedProfile && requestedProfile.allowed),
          description: requestedProfile && requestedProfile.description || null,
        },
        unknown,
      };
    } finally {
      if (child.stdin && !child.stdin.destroyed) child.stdin.end();
      if (!closed && child && !child.killed) child.kill('SIGTERM');
    }
  };
}

module.exports = {
  createCodexAppServerPreflight,
};
