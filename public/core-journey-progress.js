(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.KimiCoreJourneyProgress = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function normalizedHistory(status) {
    return (Array.isArray(status?.history) ? status.history : [])
      .filter((item) => item && typeof item.label === 'string' && item.label.trim())
      .map((item, index) => ({
        id: String(item.id || `step-${index + 1}`),
        label: item.label.trim(),
        state: ['complete', 'active', 'error', 'pending'].includes(item.state) ? item.state : 'pending',
      }));
  }

  function deriveEvidenceProgress(status = {}) {
    const value = Number(status.progress);
    if (!Number.isFinite(value)) {
      return {
        determinate: false,
        value: 0,
        completed: 0,
        total: 0,
        current: 0,
        label: '正在等待 canonical operation 投影',
      };
    }
    const normalized = Math.max(0, Math.min(100, Math.round(value)));
    return {
      determinate: true,
      value: normalized,
      completed: null,
      total: null,
      current: null,
      label: status.state === 'ready' || status.stage === 'ready' ? '已完成' : `${normalized}%`,
    };
  }

  function parseStartedAt(value) {
    if (Number.isFinite(value)) return value;
    const parsed = Date.parse(value || '');
    return Number.isFinite(parsed) ? parsed : null;
  }

  function formatElapsed(startedAt, now = Date.now()) {
    const start = parseStartedAt(startedAt);
    if (start === null) return '已用时 00:00';
    const totalSeconds = Math.max(0, Math.floor((now - start) / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (days) {
      const remainingHours = hours % 24;
      return `已用时 ${days} 天 ${String(remainingHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    if (hours) return `已用时 ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    return `已用时 ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return { deriveEvidenceProgress, formatElapsed, normalizedHistory };
});
