(() => {
  'use strict';

  const context = document.querySelector('#company-context');
  const contextCopy = document.querySelector('#context-copy');
  const activeCount = document.querySelector('#context-active-count');
  const reviewCount = document.querySelector('#context-review-count');
  const decisionCount = document.querySelector('#context-decision-count');
  const feed = document.querySelector('#conversation-feed');
  const durableContext = document.querySelector('#durable-work-context');
  const needsCount = document.querySelector('#needs-you-count');

  if (!context || !contextCopy || !activeCount || !reviewCount || !decisionCount || !feed || !needsCount) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const statusHistory = new WeakMap();
  const observers = [];
  let scheduled = false;
  let mediaContext = null;

  function canAnimate() {
    return Boolean(window.gsap && !reducedMotion.matches);
  }

  function animateMetric(node) {
    if (!canAnimate()) return;
    window.gsap.fromTo(
      node,
      { autoAlpha: 0.45, y: 4 },
      { autoAlpha: 1, y: 0, duration: 0.24, ease: 'power2.out', clearProps: 'transform,opacity,visibility' },
    );
  }

  function setMetric(node, value) {
    const next = String(value);
    if (node.textContent === next) return;
    node.textContent = next;
    animateMetric(node);
  }

  function normalizeStatus(status) {
    const text = status.textContent.trim();
    if (text === 'Ready for review' && status.dataset.tone !== 'review') status.dataset.tone = 'review';
    if (text === 'Accepted' && status.dataset.tone !== 'success') status.dataset.tone = 'success';
    return text;
  }

  function animateStatus(card, status, previous, next) {
    if (!canAnimate() || !previous || previous === next) return;

    window.gsap.fromTo(
      status,
      { autoAlpha: 0.55, y: 3, scale: 0.97 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.28, ease: 'power2.out', clearProps: 'transform,opacity,visibility' },
    );

    if (next === 'Ready for review' || next === 'Needs you') {
      window.gsap.fromTo(
        card,
        { boxShadow: '0 12px 30px rgba(16, 32, 73, 0.06)' },
        {
          boxShadow: next === 'Needs you'
            ? '0 16px 38px rgba(154, 90, 18, 0.13)'
            : '0 16px 38px rgba(0, 47, 167, 0.13)',
          duration: 0.34,
          ease: 'power2.out',
          yoyo: true,
          repeat: 1,
          clearProps: 'boxShadow',
        },
      );
    }
  }

  function refresh() {
    scheduled = false;

    const cards = [...document.querySelectorAll('.work-object, [data-testid="durable-work-row"]')];
    let active = 0;
    let review = 0;

    for (const card of cards) {
      const status = card.querySelector('.status');
      if (!status) continue;
      const previous = statusHistory.get(status) || '';
      const current = normalizeStatus(status);
      statusHistory.set(status, current);
      animateStatus(card, status, previous, current);

      if (current === 'Ready for review') review += 1;
      if (['Starting', 'In progress', 'Needs you', 'Reconnecting…', 'Needs rework'].includes(current)) active += 1;
    }

    const decisions = Number.parseInt(needsCount.textContent, 10) || 0;
    setMetric(activeCount, active);
    setMetric(reviewCount, review);
    setMetric(decisionCount, decisions);

    document.body.dataset.companyHasWork = cards.length ? 'true' : 'false';

    if (decisions > 0) {
      context.dataset.state = 'decision';
      contextCopy.textContent = decisions === 1
        ? '1 authority decision is waiting for you.'
        : `${decisions} authority decisions are waiting for you.`;
      return;
    }

    if (review > 0) {
      context.dataset.state = 'review';
      contextCopy.textContent = review === 1
        ? '1 Work item is ready for review.'
        : `${review} Work items are ready for review.`;
      return;
    }

    if (active > 0) {
      context.dataset.state = 'active';
      contextCopy.textContent = active === 1
        ? '1 Work item is moving. Alex will surface material changes.'
        : `${active} Work items are moving. Alex will surface material changes.`;
      return;
    }

    context.dataset.state = 'quiet';
    contextCopy.textContent = cards.length ? 'No Work needs action right now.' : 'Quiet until something changes.';
  }

  function scheduleRefresh() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(refresh);
  }

  const feedObserver = new MutationObserver(scheduleRefresh);
  feedObserver.observe(feed, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['data-tone'] });
  observers.push(feedObserver);

  if (durableContext) {
    const durableObserver = new MutationObserver(scheduleRefresh);
    durableObserver.observe(durableContext, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['data-tone', 'hidden'] });
    observers.push(durableObserver);
  }

  const needsObserver = new MutationObserver(scheduleRefresh);
  needsObserver.observe(needsCount, { childList: true, subtree: true, characterData: true });
  observers.push(needsObserver);

  if (window.gsap) {
    mediaContext = window.gsap.matchMedia();
    mediaContext.add(
      {
        motion: '(prefers-reduced-motion: no-preference)',
        desktop: '(min-width: 761px)',
      },
      ({ conditions }) => {
        if (!conditions.motion) return undefined;
        const travel = conditions.desktop ? 8 : 5;
        const timeline = window.gsap.timeline({ defaults: { ease: 'power2.out' } });
        timeline
          .from('.topbar .brand', { autoAlpha: 0, x: -travel, duration: 0.30 })
          .from('.manager-presence', { autoAlpha: 0, y: -4, duration: 0.28 }, '-=0.18')
          .from('.attention-button', { autoAlpha: 0, x: travel, duration: 0.28 }, '-=0.18')
          .from('#company-context', { autoAlpha: 0, y: travel, duration: 0.34 }, '-=0.10');
        return () => timeline.kill();
      },
    );
  }

  requestAnimationFrame(refresh);

  window.addEventListener('pagehide', () => {
    for (const observer of observers) observer.disconnect();
    mediaContext?.revert();
  }, { once: true });
})();
