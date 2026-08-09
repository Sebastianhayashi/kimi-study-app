'use strict';

function sourceKey(source) {
  return `${source.kind}:${source.path}`;
}

function captureSourceSnapshot(sources) {
  if (!Array.isArray(sources)) return [];
  return sources
    .filter((source) => source && source.kind && source.path && source.fingerprint)
    .map((source) => ({
      kind: source.kind,
      path: source.path,
      fingerprint: source.fingerprint,
    }));
}

function reconcileProjectSources({ checkpointSnapshot, currentSources }) {
  if (!Array.isArray(checkpointSnapshot)) {
    return {
      status: 'uncheckpointed',
      stale: false,
      changed: [],
      missing: [],
      added: [],
    };
  }

  const expected = new Map(checkpointSnapshot.map((source) => [sourceKey(source), source]));
  const current = new Map((Array.isArray(currentSources) ? currentSources : []).map((source) => [sourceKey(source), source]));
  const changed = [];
  const missing = [];
  const added = [];

  for (const [key, source] of expected) {
    const next = current.get(key);
    if (!next) {
      missing.push({
        kind: source.kind,
        path: source.path,
        checkpointFingerprint: source.fingerprint,
      });
      continue;
    }
    if (next.fingerprint !== source.fingerprint) {
      changed.push({
        kind: source.kind,
        path: source.path,
        checkpointFingerprint: source.fingerprint,
        currentFingerprint: next.fingerprint,
      });
    }
  }

  for (const [key, source] of current) {
    if (expected.has(key)) continue;
    added.push({
      kind: source.kind,
      path: source.path,
      currentFingerprint: source.fingerprint,
    });
  }

  const stale = changed.length > 0 || missing.length > 0 || added.length > 0;
  return {
    status: stale ? 'stale' : 'fresh',
    stale,
    changed,
    missing,
    added,
  };
}

module.exports = {
  captureSourceSnapshot,
  reconcileProjectSources,
};
