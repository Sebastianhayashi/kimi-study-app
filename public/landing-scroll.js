(() => {
  'use strict';

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.documentElement;
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

  function configureMotion() {
    // Native scrolling is the single owner on the landing page. The previous
    // Lenis wheel interpolation competed with anchor navigation and page
    // reveals without improving task comprehension.
    delete window.__lucubroLandingLenis;
    root.classList.add('landing-native-scroll');
    root.style.scrollBehavior = 'auto';
    configureReveal();
  }

  configureMotion();
  window.addEventListener('pagehide', destroyRevealObserver, { once: true });
  if (typeof reducedMotion.addEventListener === 'function') {
    reducedMotion.addEventListener('change', configureMotion);
  } else {
    reducedMotion.addListener(configureMotion);
  }
})();
