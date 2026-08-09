'use strict';

const REAL_RUNTIME_IDS = new Set(['claude-code', 'codex']);
const DEFAULT_PAUSE_REASON = 'Real provider execution is paused. Enable it explicitly only after the approved runtime policy is enforced.';
const CODEX_ADMISSION_REQUIRED_REASON = 'Real Codex is blocked until Luna Max profile admission is verified.';
const LUNA_ONLY_REASON = 'Only Codex Luna Max is permitted for Lucubro AI execution.';

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

function admissionFor(admissions, id) {
  if (admissions instanceof Map) return admissions.get(id) || null;
  if (admissions && typeof admissions === 'object') return admissions[id] || null;
  return null;
}

function applyRuntimePolicy(registry, {
  enableRealRuntimes = false,
  reason = DEFAULT_PAUSE_REASON,
  admissions = null,
} = {}) {
  if (!(registry instanceof Map)) throw new Error('Runtime policy requires a Map registry');
  const next = new Map(registry);

  for (const id of REAL_RUNTIME_IDS) {
    const runtime = next.get(id);
    if (!runtime) continue;

    if (!enableRealRuntimes) {
      next.set(id, pausedRuntime(runtime, { reason }));
      continue;
    }

    if (id !== 'codex') {
      next.set(id, pausedRuntime(runtime, { reason: LUNA_ONLY_REASON }));
      continue;
    }

    const admission = admissionFor(admissions, id);
    if (!admission || admission.admitted !== true || admission.profileName !== 'Luna Max') {
      next.set(id, pausedRuntime(runtime, { reason: CODEX_ADMISSION_REQUIRED_REASON }));
    }
  }

  return next;
}

module.exports = {
  CODEX_ADMISSION_REQUIRED_REASON,
  DEFAULT_PAUSE_REASON,
  LUNA_ONLY_REASON,
  REAL_RUNTIME_IDS,
  applyRuntimePolicy,
  pausedRuntime,
};
