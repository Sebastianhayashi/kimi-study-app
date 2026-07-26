(() => {
  'use strict';

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.documentElement;
  let lenis = null;
  let revealObserver = null;

  function revealEverything() {
    document.querySelectorAll('[data-reveal]').forEach((node) => node.classList.add('is-visible'));
  }

  function destroyRevealObserver() {
    revealObserver?.disconnect();
    revealObserver = null;
    root.classList.remove('motion-ready');
  }

  function configureReveal() {
    destroyRevealObserver();
    if (reducedMotion.matches || typeof window.IntersectionObserver !== 'function') {
      revealEverything();
      return;
    }

    const targets = [...document.querySelectorAll('[data-reveal]')];
    if (!targets.length) return;
    root.classList.add('motion-ready');
    revealObserver = new IntersectionObserver((entries, observer) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    targets.forEach((target) => revealObserver.observe(target));
  }

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

  function configureMotion() {
    configureScroll();
    configureReveal();
  }

  configureMotion();
  window.addEventListener('pagehide', () => {
    destroyLenis();
    destroyRevealObserver();
  }, { once: true });
  if (typeof reducedMotion.addEventListener === 'function') {
    reducedMotion.addEventListener('change', configureMotion);
  } else {
    reducedMotion.addListener(configureMotion);
  }
})();
