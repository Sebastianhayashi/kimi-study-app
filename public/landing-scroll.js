(() => {
  'use strict';

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.documentElement;
  let lenis = null;

  function destroyLenis() {
    if (!lenis) return;
    lenis.destroy();
    lenis = null;
    if (window.__lucubroLandingLenis) delete window.__lucubroLandingLenis;
  }

  function configureScroll() {
    destroyLenis();
    root.style.scrollBehavior = 'auto';

    if (reducedMotion.matches || typeof window.Lenis !== 'function') {
      root.classList.add('landing-native-scroll');
      return;
    }

    root.classList.remove('landing-native-scroll');
    lenis = new window.Lenis({
      autoRaf: true,
      autoResize: true,
      smoothWheel: true,
      syncTouch: false,
      lerp: 0.14,
      wheelMultiplier: 0.9,
      anchors: true,
      overscroll: true,
      stopInertiaOnNavigate: true,
    });
    window.__lucubroLandingLenis = lenis;
  }

  configureScroll();
  window.addEventListener('pagehide', destroyLenis, { once: true });
  if (typeof reducedMotion.addEventListener === 'function') {
    reducedMotion.addEventListener('change', configureScroll);
  } else {
    reducedMotion.addListener(configureScroll);
  }
})();
