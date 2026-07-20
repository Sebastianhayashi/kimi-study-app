(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const policy = window.KimiLessonScrollPolicy;
  if (reducedMotion.matches || typeof window.Lenis !== 'function' || !policy) return;

  const style = document.createElement('style');
  style.textContent = 'html,body{scroll-behavior:auto!important}';
  document.head.appendChild(style);

  const lenis = new window.Lenis({
    autoRaf: true,
    autoResize: true,
    smoothWheel: true,
    syncTouch: false,
    lerp: 0.14,
    wheelMultiplier: 0.9,
    anchors: true,
    overscroll: true,
    allowNestedScroll: false,
    stopInertiaOnNavigate: true,
    prevent(node) {
      return policy.shouldUseNativeScroll(node, document.documentElement);
    },
  });

  window.__kimiLessonLenis = lenis;

  const destroy = () => {
    lenis.destroy();
    if (window.__kimiLessonLenis === lenis) delete window.__kimiLessonLenis;
  };

  window.addEventListener('pagehide', destroy, { once: true });
  reducedMotion.addEventListener('change', (event) => {
    if (event.matches) destroy();
  }, { once: true });
})();
