'use strict';

const REAL_RUNTIME_IDS = new Set(['claude-code', 'codex']);
const DEFAULT_PAUSE_REASON = 'Real provider execution is paused. Enable it explicitly only after the approved runtime policy is enforced.';

function pausedRuntime(runtime, { reason = DEFAULT_PAUSE_REASON } = {}) {
  return {
    kind: runtime && runtime.kind || 'paused-provider',
    async available() {
      return { available: false, paused: true, reason };
    },
    async *run() {
      throw new Error(reason);
    },
  };
}

function applyRuntimePolicy(registry, { enableRealRuntimes = false, reason = DEFAULT_PAUSE_REASON } = {}) {
  if (!(registry instanceof Map)) throw new Error('Runtime policy requires a Map registry');
  const next = new Map(registry);
  if (enableRealRuntimes) return next;

  for (const id of REAL_RUNTIME_IDS) {
    const runtime = next.get(id);
    if (runtime) next.set(id, pausedRuntime(runtime, { reason }));
  }
  return next;
}

module.exports = {
  DEFAULT_PAUSE_REASON,
  REAL_RUNTIME_IDS,
  applyRuntimePolicy,
  pausedRuntime,
};
