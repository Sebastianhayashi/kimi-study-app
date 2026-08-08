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
  let runtimeRenderTimeline = null;
  let runtimeReceiptTimeline = null;
  let repoReceiptTimeline = null;

  const canAnimate = () => Boolean(window.gsap && !reducedMotion.matches);

  function setLifecycle(element, state) {
    if (!element) return;
    element.dataset.lifecycle = state;
  }

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

  function clearMotionProps(targets) {
    if (!window.gsap) return;
    window.gsap.set(targets, { clearProps: 'transform,opacity,visibility' });
  }

  function animateRuntimeReceipt(previousButton, selectedButton, text) {
    runtimeReceiptTimeline?.kill();

    const previousCheck = previousButton && previousButton !== selectedButton
      ? previousButton.querySelector('.runtime-check')
      : null;
    const selectedMark = selectedButton?.querySelector('.runtime-mark');
    const selectedCheck = selectedButton?.querySelector('.runtime-check');

    if (!canAnimate()) {
      runtimeReceipt.textContent = text;
      runtimeReceipt.hidden = false;
      return;
    }

    const hadReceipt = !runtimeReceipt.hidden;
    runtimeReceiptTimeline = window.gsap.timeline({ defaults: { ease: 'power2.out' } });

    if (previousButton && previousButton !== selectedButton) {
      runtimeReceiptTimeline.to(previousButton, {
        y: -1,
        scale: 0.992,
        duration: 0.12,
        ease: 'power1.in',
        clearProps: 'transform',
      }, 0);
      if (previousCheck) {
        runtimeReceiptTimeline.to(previousCheck, {
          autoAlpha: 0,
          y: -3,
          scale: 0.72,
          duration: 0.12,
          ease: 'power1.in',
        }, 0);
      }
    }

    if (hadReceipt) {
      runtimeReceiptTimeline.to(runtimeReceipt, {
        autoAlpha: 0,
        y: -4,
        duration: 0.12,
        ease: 'power1.in',
      }, 0);
    }

    runtimeReceiptTimeline.call(() => {
      runtimeReceipt.textContent = text;
      runtimeReceipt.hidden = false;
    });

    if (selectedButton) {
      runtimeReceiptTimeline.fromTo(selectedButton, {
        y: 3,
        scale: 0.982,
      }, {
        y: 0,
        scale: 1,
        duration: 0.22,
        clearProps: 'transform',
      }, '<');
    }

    if (selectedMark) {
      runtimeReceiptTimeline.fromTo(selectedMark, {
        scale: 0.82,
        rotation: -4,
      }, {
        scale: 1,
        rotation: 0,
        duration: 0.24,
        clearProps: 'transform',
      }, '<0.02');
    }

    if (selectedCheck) {
      runtimeReceiptTimeline.fromTo(selectedCheck, {
        autoAlpha: 0,
        y: 3,
        scale: 0.68,
      }, {
        autoAlpha: 1,
        y: 0,
        scale: 1,
        duration: 0.20,
        clearProps: 'transform,opacity,visibility',
      }, '<0.04');
    }

    runtimeReceiptTimeline.fromTo(runtimeReceipt, {
      autoAlpha: 0,
      y: 4,
    }, {
      autoAlpha: 1,
      y: 0,
      duration: 0.20,
      clearProps: 'transform,opacity,visibility',
    }, '<0.02');
  }

  function syncRuntimeSelection({ announce = false, animate = false } = {}) {
    const selected = runtime.value;
    const selectedMeta = displayMeta(selected);
    const previousButton = runtimeChoice.querySelector('[data-selected="true"]');

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

    const selectedButton = runtimeChoice.querySelector(`[data-runtime-id="${CSS.escape(selected)}"]`);
    if (announce) {
      const text = `${selectedMeta.label} selected`;
      if (animate) animateRuntimeReceipt(previousButton, selectedButton, text);
      else {
        runtimeReceipt.textContent = text;
        runtimeReceipt.hidden = false;
      }
    }
  }

  function buildRuntimeChoices() {
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
        if (button.disabled) return;
        if (runtime.value === option.value) {
          syncRuntimeSelection({ announce: true, animate: true });
          return;
        }
        runtime.value = option.value;
        runtime.dispatchEvent(new Event('change', { bubbles: true }));
      });
      fragment.append(button);
    }

    return fragment;
  }

  function mountRuntimeChoices(fragment, { animate = false } = {}) {
    runtimeChoice.replaceChildren(fragment);
    syncRuntimeSelection();
    const buttons = [...runtimeChoice.querySelectorAll('.runtime-choice-button')];

    if (!animate || !canAnimate() || !runSettings.open || !buttons.length) {
      setLifecycle(runtimeChoice, 'active');
      return;
    }

    setLifecycle(runtimeChoice, 'entering');
    runtimeRenderTimeline = window.gsap.timeline({
      defaults: { ease: 'power2.out' },
      onComplete: () => setLifecycle(runtimeChoice, 'active'),
    });
    runtimeRenderTimeline.fromTo(buttons, {
      autoAlpha: 0,
      y: 8,
      scale: 0.982,
    }, {
      autoAlpha: 1,
      y: 0,
      scale: 1,
      duration: 0.24,
      stagger: 0.045,
      clearProps: 'transform,opacity,visibility',
    });
  }

  function renderRuntimeChoices() {
    renderQueued = false;
    runtimeRenderTimeline?.kill();
    const fragment = buildRuntimeChoices();
    const existing = [...runtimeChoice.querySelectorAll('.runtime-choice-button')];

    if (!canAnimate() || !runSettings.open || !existing.length) {
      mountRuntimeChoices(fragment, { animate: runSettings.open });
      return;
    }

    setLifecycle(runtimeChoice, 'exiting');
    runtimeRenderTimeline = window.gsap.timeline({
      defaults: { ease: 'power1.in' },
      onComplete: () => mountRuntimeChoices(fragment, { animate: true }),
    });
    runtimeRenderTimeline.to(existing, {
      autoAlpha: 0,
      y: -7,
      scale: 0.982,
      duration: 0.15,
      stagger: { each: 0.025, from: 'end' },
    });
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
    const timeline = window.gsap.timeline();
    timeline
      .fromTo(repoScan, {
        autoAlpha: 0,
        xPercent: -120,
        scaleX: 0.55,
      }, {
        autoAlpha: 0.82,
        xPercent: 250,
        scaleX: 0.9,
        duration: 0.32,
        ease: 'power2.out',
      })
      .to(repoScan, {
        autoAlpha: 0,
        xPercent: 360,
        scaleX: 1,
        duration: 0.15,
        ease: 'power1.in',
        clearProps: 'transform,opacity,visibility',
      });
  }

  function hideRepoReceipt() {
    repoReceiptTimeline?.kill();
    if (repoReceipt.hidden) return;

    if (!canAnimate()) {
      repoReceipt.hidden = true;
      return;
    }

    repoReceiptTimeline = window.gsap.timeline({
      onComplete: () => {
        repoReceipt.hidden = true;
        clearMotionProps(repoReceipt);
      },
    });
    repoReceiptTimeline.to(repoReceipt, {
      autoAlpha: 0,
      y: -4,
      duration: 0.12,
      ease: 'power1.in',
    });
  }

  function settleRepoReceipt() {
    if (!repoInput.value.trim()) return;
    setRepoState('received');
    repoNote.textContent = 'Lucubro received this target. Validation happens only when Work starts.';
    repoReceiptTimeline?.kill();
    repoReceipt.hidden = false;

    if (!canAnimate()) return;

    repoReceiptTimeline = window.gsap.timeline();
    repoReceiptTimeline.fromTo(repoReceipt, {
      autoAlpha: 0,
      y: 5,
      scale: 0.98,
    }, {
      autoAlpha: 1,
      y: 0,
      scale: 1,
      duration: 0.22,
      ease: 'power2.out',
      clearProps: 'transform,opacity,visibility',
    });
  }

  function handleRepoInput() {
    clearTimeout(repoTimer);
    const hasPath = Boolean(repoInput.value.trim());

    if (!hasPath) {
      hideRepoReceipt();
      repoNote.textContent = 'Paste or type the local repository path.';
      setRepoState(document.activeElement === repoInput ? 'focused' : 'empty');
      return;
    }

    hideRepoReceipt();
    repoNote.textContent = 'Reading path…';
    const wasReading = repoControl.dataset.state === 'reading';
    setRepoState('reading');
    if (!wasReading) animateRepoReading();
    repoTimer = window.setTimeout(settleRepoReceipt, 260);
  }

  function settingsParts() {
    return {
      header: settingsPanel.querySelector('.execution-panel-header'),
      runtimeField: settingsPanel.querySelector('.runtime-field'),
      repoField: settingsPanel.querySelector('.repo-field'),
      runtimeLine: settingsPanel.querySelector('.runtime-line'),
      buttons: [...runtimeChoice.querySelectorAll('.runtime-choice-button')],
    };
  }

  function animateSettingsOpen() {
    closeTimeline?.kill();
    openTimeline?.kill();
    setLifecycle(settingsPanel, 'entering');

    if (!canAnimate()) {
      setLifecycle(settingsPanel, 'active');
      setLifecycle(runtimeChoice, 'active');
      return;
    }

    const { header, runtimeField, repoField, runtimeLine, buttons } = settingsParts();
    openTimeline = window.gsap.timeline({
      defaults: { ease: 'power2.out' },
      onComplete: () => {
        setLifecycle(settingsPanel, 'active');
        setLifecycle(runtimeChoice, 'active');
      },
    });

    openTimeline
      .fromTo(settingsPanel, {
        autoAlpha: 0,
        y: 9,
        scale: 0.985,
      }, {
        autoAlpha: 1,
        y: 0,
        scale: 1,
        duration: 0.26,
        clearProps: 'transform,opacity,visibility',
      })
      .fromTo(header, {
        autoAlpha: 0,
        y: 5,
      }, {
        autoAlpha: 1,
        y: 0,
        duration: 0.20,
        clearProps: 'transform,opacity,visibility',
      }, '<0.04')
      .fromTo(runtimeField, {
        autoAlpha: 0,
        y: 8,
      }, {
        autoAlpha: 1,
        y: 0,
        duration: 0.22,
        clearProps: 'transform,opacity,visibility',
      }, '<0.05');

    if (buttons.length) {
      openTimeline.fromTo(buttons, {
        autoAlpha: 0,
        y: 8,
        scale: 0.982,
      }, {
        autoAlpha: 1,
        y: 0,
        scale: 1,
        duration: 0.22,
        stagger: 0.045,
        clearProps: 'transform,opacity,visibility',
      }, '<0.03');
    }

    openTimeline
      .fromTo(repoField, {
        autoAlpha: 0,
        y: 8,
      }, {
        autoAlpha: 1,
        y: 0,
        duration: 0.22,
        clearProps: 'transform,opacity,visibility',
      }, '<0.07')
      .fromTo('.repo-path-line-active', {
        scaleX: 0,
      }, {
        scaleX: repoInput.value.trim() ? 1 : 0.12,
        duration: 0.28,
        transformOrigin: 'left center',
        clearProps: 'transform',
      }, '<0.02')
      .fromTo(runtimeLine, {
        autoAlpha: 0,
        y: 5,
      }, {
        autoAlpha: 1,
        y: 0,
        duration: 0.18,
        clearProps: 'transform,opacity,visibility',
      }, '<0.04');
  }

  function closeExecutionSetup({ restoreFocus = true } = {}) {
    clearTimeout(repoTimer);
    if (!runSettings.open || settingsPanel.dataset.lifecycle === 'exiting') return;

    const finish = () => {
      runSettings.open = false;
      setLifecycle(settingsPanel, 'idle');
      setLifecycle(runtimeChoice, 'active');
      if (window.gsap) {
        const { header, runtimeField, repoField, runtimeLine, buttons } = settingsParts();
        clearMotionProps([settingsPanel, header, runtimeField, repoField, runtimeLine, ...buttons, runtimeReceipt, repoReceipt]);
      }
      if (restoreFocus) settingsSummary.focus({ preventScroll: true });
    };

    openTimeline?.kill();
    runtimeRenderTimeline?.kill();
    runtimeReceiptTimeline?.kill();
    repoReceiptTimeline?.kill();
    setLifecycle(settingsPanel, 'exiting');
    setLifecycle(runtimeChoice, 'exiting');

    if (!canAnimate()) {
      finish();
      return;
    }

    const { header, runtimeField, repoField, runtimeLine, buttons } = settingsParts();
    const visibleReceipts = [runtimeReceipt, repoReceipt].filter((item) => !item.hidden);

    closeTimeline?.kill();
    closeTimeline = window.gsap.timeline({
      defaults: { ease: 'power1.in' },
      onComplete: finish,
    });

    if (visibleReceipts.length) {
      closeTimeline.to(visibleReceipts, {
        autoAlpha: 0,
        y: -4,
        duration: 0.10,
        stagger: 0.02,
      }, 0);
    }

    closeTimeline
      .to(runtimeLine, {
        autoAlpha: 0,
        y: -4,
        duration: 0.12,
      }, 0)
      .to(repoField, {
        autoAlpha: 0,
        y: -6,
        duration: 0.14,
      }, '<0.02');

    if (buttons.length) {
      closeTimeline.to(buttons, {
        autoAlpha: 0,
        y: -7,
        scale: 0.982,
        duration: 0.14,
        stagger: { each: 0.025, from: 'end' },
      }, '<');
    }

    closeTimeline
      .to(runtimeField, {
        autoAlpha: 0,
        y: -5,
        duration: 0.13,
      }, '<0.01')
      .to(header, {
        autoAlpha: 0,
        y: -4,
        duration: 0.13,
      }, '<')
      .to(settingsPanel, {
        autoAlpha: 0,
        y: -8,
        scale: 0.986,
        duration: 0.17,
      }, '<0.03');
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

  setLifecycle(settingsPanel, 'idle');
  setLifecycle(runtimeChoice, 'active');
  scheduleRuntimeRender();
  handleRepoInput();

  window.LucubroKinetic = Object.freeze({ closeExecutionSetup });

  window.addEventListener('pagehide', () => {
    clearTimeout(repoTimer);
    runtimeObserver.disconnect();
    openTimeline?.kill();
    closeTimeline?.kill();
    runtimeRenderTimeline?.kill();
    runtimeReceiptTimeline?.kill();
    repoReceiptTimeline?.kill();
    if (window.gsap) window.gsap.killTweensOf([settingsPanel, runtimeChoice, runtimeReceipt, repoReceipt, repoScan]);
  }, { once: true });
})();
