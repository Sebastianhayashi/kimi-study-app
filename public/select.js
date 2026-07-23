// Course enhancement bootstrap. The lesson HTML stays untouched on disk.
(() => {
  if (window.__knInit) return;
  window.__knInit = true;

  const cleanups = [];

  Promise.resolve()
    .then(async () => {
      if (window.KimiMarginNotes) {
        const controller = await window.KimiMarginNotes.mount({ courseId: window.__courseId });
        if (controller) {
          if (window.KimiContextualActions) cleanups.push(window.KimiContextualActions.mount(controller));
          cleanups.push(() => controller.destroy());
        }
      }
      if (window.KimiStudyCards) {
        cleanups.push(window.KimiStudyCards.mount(document));
      }
    })
    .catch((error) => console.error('[course enhancement]', error));

  window.addEventListener('pagehide', () => {
    while (cleanups.length) {
      try { cleanups.pop()(); } catch {}
    }
  }, { once: true });
})();
