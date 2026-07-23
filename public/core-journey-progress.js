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
    const history = normalizedHistory(status);
    const terminal = status.stage === 'ready' && Number(status.lessons || 0) > 0;
    if (terminal) {
      return {
        determinate: true,
        value: 100,
        completed: history.length || 1,
        total: history.length || 1,
        current: history.length || 1,
        label: '全部阶段已完成',
      };
    }
    if (!history.length) {
      return {
        determinate: false,
        value: 0,
        completed: 0,
        total: 0,
        current: 0,
        label: '正在等待后端阶段事件',
      };
    }
    const completed = history.filter((item) => item.state === 'complete').length;
    const activeIndex = history.findIndex((item) => item.state === 'active' || item.state === 'error');
    const firstPending = history.findIndex((item) => item.state === 'pending');
    const currentIndex = activeIndex >= 0 ? activeIndex : firstPending >= 0 ? firstPending : history.length - 1;
    const value = Math.max(0, Math.min(100, Math.round((completed / history.length) * 100)));
    return {
      determinate: true,
      value,
      completed,
      total: history.length,
      current: currentIndex + 1,
      label: `阶段 ${Math.min(currentIndex + 1, history.length)} / ${history.length}`,
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
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours) return `已用时 ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    return `已用时 ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return { deriveEvidenceProgress, formatElapsed, normalizedHistory };
});
