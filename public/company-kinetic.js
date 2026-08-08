(() => {
  'use strict';

  const runSettings = document.querySelector('#run-settings');
  const settingsPanel = runSettings?.querySelector('.settings-panel');
  const settingsSummary = runSettings?.querySelector(':scope > summary');
  const closeSettings = document.querySelector('#close-run-settings');
  const runtime = document.querySelector('#runtime');
  const runtimeChoice = document.querySelector('#runtime-choice');
  const runtimeReceipt = document.querySelector('#runtime-selection-receipt');

  if (!runSettings || !settingsPanel || !settingsSummary || !closeSettings || !runtime || !runtimeChoice || !runtimeReceipt) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const runtimeMeta = {
    'claude-code': { label: 'Claude Code', mark: 'C' },
    codex: { label: 'Codex', mark: 'CX' },
    mock: { label: 'Mock', mark: 'M' },
  };

  let renderQueued = false;
  let openTimeline = null;
  let closeTimeline = null;
  let runtimeRenderTimeline = null;
  let runtimeReceiptTimeline = null;

  const canAnimate = () => Boolean(window.gsap && !reducedMotion.matches);

  function setLifecycle(element, value) {
    if (element) element.dataset.lifecycle = value;
  }

  function displayMeta(id) {
    if (runtimeMeta[id]) return runtimeMeta[id];
    const label = String(id || 'Runtime')
      .split(/[-_]/g)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ') || 'Runtime';
    return { label, mark: label.slice(0, 2).toUpperCase() };
  }

  function optionReady(option) {
    return !option.disabled && !runtime.disabled;
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
        const previous = runtimeChoice.querySelector('[data-selected="true"]');
        if (runtime.value !== option.value) {
          runtime.value = option.value;
          runtime.dispatchEvent(new Event('change', { bubbles: true }));
        }
        syncRuntimeSelection({ announce: true, animate: true, previousButton: previous });
      });
      fragment.append(button);
    }
    return fragment;
  }

  function animateRuntimeReceipt(previousButton, selectedButton, text) {
    runtimeReceiptTimeline?.kill();
    if (!canAnimate()) {
      runtimeReceipt.textContent = text;
      runtimeReceipt.hidden = false;
      return;
    }

    const previousCheck = previousButton && previousButton !== selectedButton
      ? previousButton.querySelector('.runtime-check')
      : null;
    const selectedMark = selectedButton?.querySelector('.runtime-mark');
    const selectedCheck = selectedButton?.querySelector('.runtime-check');
    const hadReceipt = !runtimeReceipt.hidden;

    runtimeReceiptTimeline = window.gsap.timeline({ defaults: { ease: 'power2.out' } });
    if (previousButton && previousButton !== selectedButton) {
      runtimeReceiptTimeline.to(previousButton, { y: -2, scale: 0.988, duration: 0.12, ease: 'power1.in', clearProps: 'transform' }, 0);
      if (previousCheck) runtimeReceiptTimeline.to(previousCheck, { autoAlpha: 0, y: -3, scale: 0.72, duration: 0.12, ease: 'power1.in' }, 0);
    }
    if (hadReceipt) runtimeReceiptTimeline.to(runtimeReceipt, { autoAlpha: 0, y: -4, duration: 0.12, ease: 'power1.in' }, 0);

    runtimeReceiptTimeline.call(() => {
      runtimeReceipt.textContent = text;
      runtimeReceipt.hidden = false;
    });

    if (selectedButton) {
      runtimeReceiptTimeline.fromTo(selectedButton, { y: 4, scale: 0.98 }, { y: 0, scale: 1, duration: 0.22, clearProps: 'transform' }, '<');
    }
    if (selectedMark) {
      runtimeReceiptTimeline.fromTo(selectedMark, { scale: 0.82, rotation: -4 }, { scale: 1, rotation: 0, duration: 0.24, clearProps: 'transform' }, '<0.02');
    }
    if (selectedCheck) {
      runtimeReceiptTimeline.fromTo(selectedCheck, { autoAlpha: 0, y: 3, scale: 0.68 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.20, clearProps: 'transform,opacity,visibility' }, '<0.04');
    }
    runtimeReceiptTimeline.fromTo(runtimeReceipt, { autoAlpha: 0, y: 4 }, { autoAlpha: 1, y: 0, duration: 0.20, clearProps: 'transform,opacity,visibility' }, '<0.02');
  }

  function syncRuntimeSelection({ announce = false, animate = false, previousButton = null } = {}) {
    const selected = runtime.value;
    const selectedMeta = displayMeta(selected);
    for (const button of runtimeChoice.querySelectorAll('[data-runtime-id]')) {
      const isSelected = button.dataset.runtimeId === selected;
      button.dataset.selected = String(isSelected);
      button.setAttribute('aria-checked', String(isSelected));
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

    if (announce) {
      const selectedButton = runtimeChoice.querySelector(`[data-runtime-id="${CSS.escape(selected)}"]`);
      const text = `${selectedMeta.label} selected`;
      if (animate) animateRuntimeReceipt(previousButton, selectedButton, text);
      else {
        runtimeReceipt.textContent = text;
        runtimeReceipt.hidden = false;
      }
    }
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
    runtimeRenderTimeline = window.gsap.timeline({ onComplete: () => setLifecycle(runtimeChoice, 'active') });
    runtimeRenderTimeline.fromTo(buttons, { autoAlpha: 0, y: 8, scale: 0.982 }, {
      autoAlpha: 1,
      y: 0,
      scale: 1,
      duration: 0.24,
      stagger: 0.045,
      ease: 'power2.out',
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
    runtimeRenderTimeline = window.gsap.timeline({ onComplete: () => mountRuntimeChoices(fragment, { animate: true }) });
    runtimeRenderTimeline.to(existing, {
      autoAlpha: 0,
      y: -7,
      scale: 0.982,
      duration: 0.15,
      stagger: { each: 0.025, from: 'end' },
      ease: 'power1.in',
    });
  }

  function scheduleRuntimeRender() {
    if (renderQueued) return;
    renderQueued = true;
    queueMicrotask(renderRuntimeChoices);
  }

  function settingsParts() {
    return {
      header: settingsPanel.querySelector('.execution-panel-header'),
      runtimeField: settingsPanel.querySelector('.runtime-field'),
      repoField: settingsPanel.querySelector('.repo-field'),
      runtimeLine: settingsPanel.querySelector('.runtime-line'),
      buttons: [...runtimeChoice.querySelectorAll('.runtime-choice-button')],
      repoReceipt: settingsPanel.querySelector('#repo-path-receipt'),
      dropReceipt: settingsPanel.querySelector('#workspace-drop-receipt'),
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
      .fromTo(settingsPanel, { autoAlpha: 0, y: 9, scale: 0.985 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.26, clearProps: 'transform,opacity,visibility' })
      .fromTo(header, { autoAlpha: 0, y: 5 }, { autoAlpha: 1, y: 0, duration: 0.20, clearProps: 'transform,opacity,visibility' }, '<0.04')
      .fromTo(runtimeField, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.22, clearProps: 'transform,opacity,visibility' }, '<0.05');
    if (buttons.length) {
      openTimeline.fromTo(buttons, { autoAlpha: 0, y: 8, scale: 0.982 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.22, stagger: 0.045, clearProps: 'transform,opacity,visibility' }, '<0.03');
    }
    openTimeline
      .fromTo(repoField, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.22, clearProps: 'transform,opacity,visibility' }, '<0.05')
      .fromTo(runtimeLine, { autoAlpha: 0, y: 5 }, { autoAlpha: 1, y: 0, duration: 0.18, clearProps: 'transform,opacity,visibility' }, '<0.06');
  }

  function closeExecutionSetup({ restoreFocus = true } = {}) {
    if (!runSettings.open) return;
    runSettings.dispatchEvent(new CustomEvent('lucubro:execution-closing'));
    openTimeline?.kill();
    closeTimeline?.kill();

    const finish = () => {
      runSettings.open = false;
      setLifecycle(settingsPanel, 'hidden');
      if (window.gsap) window.gsap.set(settingsPanel.querySelectorAll('*'), { clearProps: 'transform,opacity,visibility' });
      if (restoreFocus) settingsSummary.focus({ preventScroll: true });
    };

    if (!canAnimate()) {
      finish();
      return;
    }

    setLifecycle(settingsPanel, 'exiting');
    const { header, runtimeField, repoField, runtimeLine, buttons, repoReceipt, dropReceipt } = settingsParts();
    const visibleReceipts = [runtimeReceipt, repoReceipt, dropReceipt].filter((node) => node && !node.hidden);
    closeTimeline = window.gsap.timeline({ defaults: { ease: 'power1.in' }, onComplete: finish });
    if (visibleReceipts.length) closeTimeline.to(visibleReceipts, { autoAlpha: 0, y: -3, duration: 0.10, stagger: 0.015 });
    closeTimeline.to(runtimeLine, { autoAlpha: 0, y: -3, duration: 0.11 }, visibleReceipts.length ? '>' : 0);
    closeTimeline.to(repoField, { autoAlpha: 0, y: -5, duration: 0.13 }, '<0.01');
    if (buttons.length) {
      closeTimeline.to(buttons, { autoAlpha: 0, y: -6, scale: 0.985, duration: 0.13, stagger: { each: 0.022, from: 'end' } }, '<0.01');
    }
    closeTimeline
      .to(runtimeField, { autoAlpha: 0, y: -5, duration: 0.12 }, '<0.01')
      .to(header, { autoAlpha: 0, y: -4, duration: 0.11 }, '<0.01')
      .to(settingsPanel, { autoAlpha: 0, y: 6, scale: 0.99, duration: 0.14 }, '<0.01');
  }

  const runtimeObserver = new MutationObserver(scheduleRuntimeRender);
  runtimeObserver.observe(runtime, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });

  runtime.addEventListener('change', () => syncRuntimeSelection());
  runSettings.addEventListener('toggle', () => {
    if (runSettings.open) {
      scheduleRuntimeRender();
      requestAnimationFrame(animateSettingsOpen);
    } else {
      setLifecycle(settingsPanel, 'hidden');
    }
  });
  runSettings.addEventListener('lucubro:close-execution', (event) => {
    event.preventDefault();
    closeExecutionSetup({ restoreFocus: event.detail?.restoreFocus !== false });
  });

  settingsSummary.addEventListener('click', (event) => {
    if (!runSettings.open) return;
    event.preventDefault();
    closeExecutionSetup();
  });
  closeSettings.addEventListener('click', () => closeExecutionSetup());

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !runSettings.open) return;
    const needsPanel = document.querySelector('#needs-you-panel');
    if (needsPanel && !needsPanel.hidden) return;
    const workspacePanel = document.querySelector('#workspace-tree-panel');
    const suggestions = document.querySelector('#workspace-suggestions');
    if ((workspacePanel && !workspacePanel.hidden) || (suggestions && !suggestions.hidden)) return;
    event.preventDefault();
    closeExecutionSetup();
  });

  scheduleRuntimeRender();
  setLifecycle(settingsPanel, runSettings.open ? 'active' : 'hidden');

  window.addEventListener('pagehide', () => {
    runtimeObserver.disconnect();
    openTimeline?.kill();
    closeTimeline?.kill();
    runtimeRenderTimeline?.kill();
    runtimeReceiptTimeline?.kill();
    if (window.gsap) window.gsap.killTweensOf([settingsPanel, runtimeChoice, runtimeReceipt]);
  }, { once: true });
})();
