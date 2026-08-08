(() => {
  'use strict';

  const runSettings = document.querySelector('#run-settings');
  const settingsPanel = runSettings?.querySelector('.settings-panel');
  const settingsSummary = runSettings?.querySelector(':scope > summary');
  const closeSettings = document.querySelector('#close-run-settings');
  const runtime = document.querySelector('#runtime');
  const runtimeChoice = document.querySelector('#runtime-choice');
  const runtimeReceipt = document.querySelector('#runtime-selection-receipt');
  const repoInput = document.querySelector('#repo-dir');
  const repoControl = document.querySelector('#repo-path-control');
  const repoNote = document.querySelector('#repo-path-note');
  const repoReceipt = document.querySelector('#repo-path-receipt');
  const repoScan = document.querySelector('#repo-path-scan');

  if (!runSettings || !settingsPanel || !settingsSummary || !closeSettings || !runtime || !runtimeChoice || !runtimeReceipt || !repoInput || !repoControl || !repoNote || !repoReceipt || !repoScan) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const runtimeMeta = {
    'claude-code': { label: 'Claude Code', mark: 'C' },
    codex: { label: 'Codex', mark: 'CX' },
    mock: { label: 'Mock', mark: 'M' },
  };

  let repoTimer = null;
  let renderQueued = false;
  let openTimeline = null;
  let closeTimeline = null;

  const canAnimate = () => Boolean(window.gsap && !reducedMotion.matches);

  function displayMeta(id) {
    const known = runtimeMeta[id];
    if (known) return known;
    const label = id
      .split(/[-_]/g)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ') || 'Runtime';
    return { label, mark: label.slice(0, 2).toUpperCase() };
  }

  function optionReady(option) {
    return !option.disabled && !runtime.disabled;
  }

  function animateRuntimeReceipt(button) {
    if (!canAnimate()) return;
    const mark = button.querySelector('.runtime-mark');
    const check = button.querySelector('.runtime-check');
    window.gsap.killTweensOf([button, mark, check, runtimeReceipt]);
    const timeline = window.gsap.timeline({ defaults: { ease: 'power2.out' } });
    timeline
      .fromTo(button, { scale: 0.985 }, { scale: 1, duration: 0.22, clearProps: 'transform' })
      .fromTo(mark, { scale: 0.84, rotation: -4 }, { scale: 1, rotation: 0, duration: 0.26, clearProps: 'transform' }, '<')
      .fromTo(check, { autoAlpha: 0, scale: 0.7 }, { autoAlpha: 1, scale: 1, duration: 0.20, clearProps: 'transform,opacity,visibility' }, '<0.05')
      .fromTo(runtimeReceipt, { autoAlpha: 0, y: 3 }, { autoAlpha: 1, y: 0, duration: 0.22, clearProps: 'transform,opacity,visibility' }, '<0.02');
  }

  function syncRuntimeSelection({ announce = false, animate = false } = {}) {
    const selected = runtime.value;
    const selectedMeta = displayMeta(selected);

    for (const button of runtimeChoice.querySelectorAll('[data-runtime-id]')) {
      const isSelected = button.dataset.runtimeId === selected;
      button.dataset.selected = isSelected ? 'true' : 'false';
      button.setAttribute('aria-checked', isSelected ? 'true' : 'false');
      const option = [...runtime.options].find((item) => item.value === button.dataset.runtimeId);
      button.disabled = !option || !optionReady(option);
      button.dataset.available = button.disabled ? 'false' : 'true';
      const availability = button.querySelector('.runtime-availability');
      if (availability) availability.textContent = button.disabled ? 'Not ready' : (isSelected ? 'Selected' : 'Ready');
    }

    if (!selected) {
      runtimeReceipt.hidden = true;
      return;
    }

    runtimeReceipt.textContent = `${selectedMeta.label} selected`;
    runtimeReceipt.hidden = !announce;
    const selectedButton = runtimeChoice.querySelector(`[data-runtime-id="${CSS.escape(selected)}"]`);
    if (animate && selectedButton) animateRuntimeReceipt(selectedButton);
  }

  function renderRuntimeChoices() {
    renderQueued = false;
    const fragment = document.createDocumentFragment();

    for (const option of runtime.options) {
      const meta = displayMeta(option.value);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'runtime-choice-button';
      button.dataset.runtimeId = option.value;
      button.dataset.selected = 'false';
      button.dataset.available = optionReady(option) ? 'true' : 'false';
      button.setAttribute('role', 'radio');
      button.setAttribute('aria-checked', 'false');
      button.disabled = !optionReady(option);
      button.setAttribute('aria-label', `${meta.label}, ${button.disabled ? 'not ready' : 'ready'}`);

      const mark = document.createElement('span');
      mark.className = 'runtime-mark';
      mark.setAttribute('aria-hidden', 'true');
      mark.textContent = meta.mark;

      const copy = document.createElement('span');
      copy.className = 'runtime-choice-copy';
      const name = document.createElement('strong');
      name.textContent = meta.label;
      const availability = document.createElement('small');
      availability.className = 'runtime-availability';
      availability.textContent = button.disabled ? 'Not ready' : 'Ready';
      copy.append(name, availability);

      const check = document.createElement('span');
      check.className = 'runtime-check';
      check.setAttribute('aria-hidden', 'true');
      check.textContent = '✓';

      button.append(mark, copy, check);
      button.addEventListener('click', () => {
        if (button.disabled || runtime.value === option.value) {
          syncRuntimeSelection({ announce: true, animate: !button.disabled });
          return;
        }
        runtime.value = option.value;
        runtime.dispatchEvent(new Event('change', { bubbles: true }));
        syncRuntimeSelection({ announce: true, animate: true });
      });
      fragment.append(button);
    }

    runtimeChoice.replaceChildren(fragment);
    syncRuntimeSelection();
  }

  function scheduleRuntimeRender() {
    if (renderQueued) return;
    renderQueued = true;
    queueMicrotask(renderRuntimeChoices);
  }

  function setRepoState(next) {
    if (repoControl.dataset.state === next) return;
    repoControl.dataset.state = next;
  }

  function animateRepoReading() {
    if (!canAnimate()) return;
    window.gsap.killTweensOf(repoScan);
    window.gsap.fromTo(
      repoScan,
      { autoAlpha: 0, xPercent: -120, scaleX: 0.55 },
      { autoAlpha: 0.9, xPercent: 360, scaleX: 1, duration: 0.46, ease: 'power2.out', clearProps: 'transform,opacity,visibility' },
    );
  }

  function settleRepoReceipt() {
    if (!repoInput.value.trim()) return;
    setRepoState('received');
    repoNote.textContent = 'Lucubro received this target. Validation happens only when Work starts.';
    repoReceipt.hidden = false;
    if (!canAnimate()) return;
    window.gsap.killTweensOf(repoReceipt);
    window.gsap.fromTo(
      repoReceipt,
      { autoAlpha: 0, y: 3 },
      { autoAlpha: 1, y: 0, duration: 0.24, ease: 'power2.out', clearProps: 'transform,opacity,visibility' },
    );
  }

  function handleRepoInput() {
    clearTimeout(repoTimer);
    const hasPath = Boolean(repoInput.value.trim());
    if (!hasPath) {
      repoReceipt.hidden = true;
      repoNote.textContent = 'Paste or type the local repository path.';
      setRepoState(document.activeElement === repoInput ? 'focused' : 'empty');
      return;
    }

    repoReceipt.hidden = true;
    repoNote.textContent = 'Reading path…';
    const wasReading = repoControl.dataset.state === 'reading';
    setRepoState('reading');
    if (!wasReading) animateRepoReading();
    repoTimer = window.setTimeout(settleRepoReceipt, 260);
  }

  function animateSettingsOpen() {
    closeTimeline?.kill();
    if (!canAnimate()) return;
    openTimeline?.kill();
    const buttons = runtimeChoice.querySelectorAll('.runtime-choice-button');
    openTimeline = window.gsap.timeline({ defaults: { ease: 'power2.out' } });
    openTimeline
      .fromTo(settingsPanel, { autoAlpha: 0, y: 8, scale: 0.985 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.28, clearProps: 'transform,opacity,visibility' })
      .fromTo(buttons, { autoAlpha: 0, y: 7 }, { autoAlpha: 1, y: 0, duration: 0.24, stagger: 0.045, clearProps: 'transform,opacity,visibility' }, '<0.07')
      .fromTo('.repo-path-line-active', { scaleX: 0 }, { scaleX: repoInput.value.trim() ? 1 : 0.12, duration: 0.30, transformOrigin: 'left center', clearProps: 'transform' }, '<0.07');
  }

  function closeExecutionSetup({ restoreFocus = true } = {}) {
    clearTimeout(repoTimer);
    if (!runSettings.open) return;
    const finish = () => {
      runSettings.open = false;
      if (restoreFocus) settingsSummary.focus({ preventScroll: true });
    };

    openTimeline?.kill();
    if (!canAnimate()) {
      finish();
      return;
    }

    closeTimeline?.kill();
    closeTimeline = window.gsap.timeline({ defaults: { ease: 'power1.in' }, onComplete: finish });
    closeTimeline.to(settingsPanel, { autoAlpha: 0, y: 5, scale: 0.99, duration: 0.16 });
  }

  const runtimeObserver = new MutationObserver(scheduleRuntimeRender);
  runtimeObserver.observe(runtime, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });

  runtime.addEventListener('change', () => syncRuntimeSelection({ announce: true, animate: true }));
  runSettings.addEventListener('toggle', () => {
    if (runSettings.open) {
      scheduleRuntimeRender();
      requestAnimationFrame(animateSettingsOpen);
    }
  });

  settingsSummary.addEventListener('click', (event) => {
    if (!runSettings.open) return;
    event.preventDefault();
    closeExecutionSetup();
  });

  closeSettings.addEventListener('click', () => closeExecutionSetup());

  repoInput.addEventListener('focus', () => {
    if (repoInput.value.trim()) setRepoState('received');
    else setRepoState('focused');
  });
  repoInput.addEventListener('input', handleRepoInput);
  repoInput.addEventListener('blur', () => {
    if (repoInput.value.trim()) settleRepoReceipt();
    else setRepoState('empty');
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !runSettings.open) return;
    const needsPanel = document.querySelector('#needs-you-panel');
    if (needsPanel && !needsPanel.hidden) return;
    event.preventDefault();
    closeExecutionSetup();
  });

  scheduleRuntimeRender();
  handleRepoInput();

  window.addEventListener('pagehide', () => {
    clearTimeout(repoTimer);
    runtimeObserver.disconnect();
    openTimeline?.kill();
    closeTimeline?.kill();
    if (window.gsap) window.gsap.killTweensOf([settingsPanel, runtimeChoice, repoReceipt, repoScan]);
  }, { once: true });
})();
