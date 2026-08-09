(() => {
  'use strict';

  const routeToLens = new Map([
    ['/company', 'manager'],
    ['/company/', 'manager'],
    ['/company/work', 'work'],
    ['/company/employees', 'employees'],
    ['/company/settings', 'settings'],
  ]);
  const lensToRoute = new Map([
    ['manager', '/company'],
    ['work', '/company/work'],
    ['employees', '/company/employees'],
    ['settings', '/company/settings'],
  ]);
  const lensLabels = {
    manager: 'Manager canvas',
    work: 'Work',
    employees: 'Employees',
    settings: 'Execution settings',
  };
  const titles = {
    manager: 'Lucubro · Company',
    work: 'Work · Lucubro',
    employees: 'Employees · Lucubro',
    settings: 'Execution settings · Lucubro',
  };

  const panels = [...document.querySelectorAll('[data-canvas-lens-panel]')];
  const trigger = document.querySelector('#canvas-lens-trigger');
  const triggerLabel = trigger?.querySelector('.canvas-lens-trigger-copy strong');
  const currentLabel = document.querySelector('#canvas-lens-current');
  const menu = document.querySelector('#canvas-lens-menu');
  const menuItems = [...document.querySelectorAll('[data-canvas-lens-target]')];
  const brand = document.querySelector('.brand');
  const composer = document.querySelector('.composer-dock');
  const workForm = document.querySelector('#work-form');
  const workList = document.querySelector('#work-page-list');
  const workSummary = document.querySelector('#work-page-summary');
  const employeeList = document.querySelector('#employee-page-list');
  const employeeSummary = document.querySelector('#employee-page-summary');
  const runtimeList = document.querySelector('#settings-runtime-list');
  const workspaceRoot = document.querySelector('#settings-workspace-root');
  const settingsSummary = document.querySelector('#settings-page-summary');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  let currentLens = routeToLens.get(window.location.pathname) || 'manager';
  let transitionSerial = 0;
  let menuClosing = false;

  const canAnimate = () => Boolean(window.gsap && !reducedMotion.matches);

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function statusInfo(status) {
    const map = {
      starting: ['Starting', 'neutral'],
      'in-progress': ['In progress', 'neutral'],
      'needs-you': ['Needs you', 'attention'],
      review: ['Ready for review', 'review'],
      accepted: ['Accepted', 'success'],
      'needs-rework': ['Needs rework', 'attention'],
      failed: ['Failed', 'error'],
      held: ['Held', 'attention'],
      proposed: ['Proposed', 'neutral'],
    };
    return map[status] || [status || 'Unknown', 'neutral'];
  }

  function statusNode(status) {
    const [label, tone] = statusInfo(status);
    const node = el('span', 'status', label);
    if (tone !== 'neutral') node.dataset.tone = tone;
    return node;
  }

  function formatTimestamp(value) {
    if (!value) return 'Unknown time';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown time';
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  function renderEmpty(host, title, copy) {
    host.replaceChildren();
    const empty = el('div', 'product-empty-state');
    empty.append(el('strong', '', title), el('span', '', copy));
    host.append(empty);
  }

  function renderFailure(host, error) {
    host.replaceChildren();
    const failure = el('div', 'product-load-error');
    failure.setAttribute('role', 'alert');
    failure.append(el('strong', '', 'This lens could not be loaded.'), el('span', '', error.message));
    host.append(failure);
  }

  function renderWorkLens(data) {
    if (!workList || !workSummary) return;
    const works = Array.isArray(data.works) ? data.works : [];
    workSummary.textContent = `${works.length} durable Work item${works.length === 1 ? '' : 's'}`;
    if (!works.length) {
      renderEmpty(workList, 'No durable Work yet.', 'Start with Alex. Work will appear here once it exists as durable company state.');
      return;
    }

    workList.replaceChildren();
    for (const work of works) {
      const row = el('a', 'work-index-row');
      row.href = `/company?work=${encodeURIComponent(work.id)}`;
      const copy = el('span', 'work-index-copy');
      copy.append(
        el('span', 'work-index-title', work.title || work.brief || 'Untitled Work'),
        el('span', 'work-index-meta', `Ben · ${formatTimestamp(work.updatedAt || work.createdAt)}`),
      );
      const state = el('span', 'work-index-state');
      state.append(statusNode(work.status), el('span', 'work-index-arrow', '→'));
      row.append(copy, state);
      workList.append(row);
    }
  }

  function renderEmployeesLens(data) {
    if (!employeeList || !employeeSummary) return;
    const manager = data.manager ? [data.manager] : [];
    const employees = Array.isArray(data.employees) ? data.employees : [];
    const people = [...manager, ...employees];
    employeeSummary.textContent = `${people.length} durable identit${people.length === 1 ? 'y' : 'ies'}`;
    if (!people.length) {
      renderEmpty(employeeList, 'No Employee identities are available.', 'Lucubro only shows people that exist in the current product state.');
      return;
    }

    const works = Array.isArray(data.works) ? data.works : [];
    employeeList.replaceChildren();
    for (const person of people) {
      const assigned = person.id === 'alex'
        ? 0
        : works.filter((work) => (work.assignedEmployeeId || work.employeeId) === person.id).length;
      const row = el('div', 'employee-index-row');
      const avatar = el('span', 'employee-index-avatar', (person.name || '?').slice(0, 1).toUpperCase());
      avatar.setAttribute('aria-hidden', 'true');
      const copy = el('span', 'employee-index-copy');
      copy.append(
        el('span', 'employee-index-name', person.name || person.id),
        el('span', 'employee-index-meta', person.position || 'Employee'),
      );
      const assignment = el(
        'span',
        'employee-index-assignment',
        person.id === 'alex' ? 'Primary company relationship' : `${assigned} Work assignment${assigned === 1 ? '' : 's'}`,
      );
      row.append(avatar, copy, assignment);
      employeeList.append(row);
    }
  }

  async function renderSettingsLens(data) {
    if (!runtimeList || !workspaceRoot || !settingsSummary) return;
    const runtimes = Array.isArray(data.runtimes) ? data.runtimes : [];
    settingsSummary.textContent = `${runtimes.filter((runtime) => runtime.available).length}/${runtimes.length} runtimes available`;
    runtimeList.replaceChildren();

    if (!runtimes.length) {
      renderEmpty(runtimeList, 'No runtimes are registered.', 'Runtime adapters appear here when the local server registers them.');
    } else {
      for (const runtime of runtimes) {
        const row = el('div', 'settings-index-row');
        const copy = el('span', 'settings-index-copy');
        copy.append(
          el('span', 'settings-index-name', runtime.id),
          el('span', 'settings-index-meta', runtime.available ? 'Available to the Company Workbench' : (runtime.reason || 'Not available on this host')),
        );
        const state = el('span', 'settings-state', runtime.available ? 'Available' : 'Not ready');
        state.dataset.tone = runtime.available ? 'success' : 'error';
        row.append(copy, state);
        runtimeList.append(row);
      }
    }

    try {
      const response = await fetch('/api/company/workspaces/root');
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || response.statusText);
      workspaceRoot.textContent = payload.root.displayPath;
      workspaceRoot.title = payload.root.path;
    } catch (error) {
      workspaceRoot.textContent = 'Unavailable';
      workspaceRoot.title = error.message;
    }
  }

  async function loadLens(lens) {
    if (lens === 'manager') return;
    const host = lens === 'work' ? workList : lens === 'employees' ? employeeList : runtimeList;
    try {
      const response = await fetch('/api/company/bootstrap');
      if (!response.ok) throw new Error(`Bootstrap failed (${response.status})`);
      const data = await response.json();
      if (lens === 'work') renderWorkLens(data);
      if (lens === 'employees') renderEmployeesLens(data);
      if (lens === 'settings') await renderSettingsLens(data);
    } catch (error) {
      if (host) renderFailure(host, error);
    }
  }

  function panelFor(lens) {
    return document.querySelector(`[data-canvas-lens-panel="${CSS.escape(lens)}"]`);
  }

  function setShellState(lens) {
    document.body.dataset.companyView = lens;
    document.body.dataset.canvasLens = lens;
    document.title = titles[lens] || titles.manager;
    const label = lensLabels[lens] || lensLabels.manager;
    if (currentLabel) currentLabel.textContent = label;
    if (triggerLabel) triggerLabel.textContent = label;
    if (trigger) trigger.setAttribute('aria-label', `Change canvas focus. Current: ${label}`);
    if (composer) composer.hidden = false;

    for (const item of menuItems) {
      if (item.dataset.canvasLensTarget === lens) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    }
  }

  function clearMotion(node) {
    if (window.gsap && node) window.gsap.set(node, { clearProps: 'transform,opacity,visibility' });
  }

  function animatePanelOut(panel) {
    if (!panel || !canAnimate()) return Promise.resolve();
    return new Promise((resolve) => {
      window.gsap.killTweensOf(panel);
      window.gsap.to(panel, {
        autoAlpha: 0,
        y: -6,
        scale: 0.995,
        duration: 0.15,
        ease: 'power1.in',
        onComplete: () => {
          clearMotion(panel);
          resolve();
        },
      });
    });
  }

  function animatePanelIn(panel) {
    if (!panel || !canAnimate()) return;
    const detailTargets = panel.querySelectorAll('.product-page-header, .product-page-body > *, .intro-message, .company-context, .durable-work-context, .conversation-feed > *');
    window.gsap.killTweensOf([panel, ...detailTargets]);
    const timeline = window.gsap.timeline({ defaults: { ease: 'power2.out' } });
    timeline.fromTo(panel, { autoAlpha: 0, y: 7, scale: 0.997 }, {
      autoAlpha: 1,
      y: 0,
      scale: 1,
      duration: 0.23,
      clearProps: 'transform,opacity,visibility',
    });
    if (detailTargets.length) {
      timeline.fromTo(detailTargets, { autoAlpha: 0, y: 5 }, {
        autoAlpha: 1,
        y: 0,
        duration: 0.2,
        stagger: 0.025,
        clearProps: 'transform,opacity,visibility',
      }, '-=0.13');
    }
  }

  function finishMenuClose({ restoreFocus = false } = {}) {
    if (!menu || !trigger) return;
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    menuClosing = false;
    clearMotion(menu);
    for (const item of menuItems) clearMotion(item);
    if (restoreFocus) trigger.focus({ preventScroll: true });
  }

  function closeMenu({ restoreFocus = false, immediate = false } = {}) {
    if (!menu || !trigger || menu.hidden) return;
    if (immediate) {
      finishMenuClose({ restoreFocus });
      return;
    }
    if (menuClosing) return;
    if (!canAnimate()) {
      finishMenuClose({ restoreFocus });
      return;
    }

    menuClosing = true;
    const timeline = window.gsap.timeline({ onComplete: () => finishMenuClose({ restoreFocus }) });
    timeline.to(menuItems, {
      autoAlpha: 0,
      y: -3,
      duration: 0.1,
      stagger: { each: 0.015, from: 'end' },
      ease: 'power1.in',
    });
    timeline.to(menu, {
      autoAlpha: 0,
      y: -4,
      scale: 0.985,
      duration: 0.11,
      ease: 'power1.in',
    }, '-=0.06');
  }

  function openMenu() {
    if (!menu || !trigger || !menu.hidden) return;
    menu.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    if (canAnimate()) {
      window.gsap.killTweensOf([menu, ...menuItems]);
      const timeline = window.gsap.timeline({ defaults: { ease: 'power2.out' } });
      timeline.fromTo(menu, { autoAlpha: 0, y: -5, scale: 0.985 }, {
        autoAlpha: 1,
        y: 0,
        scale: 1,
        duration: 0.18,
        clearProps: 'transform,opacity,visibility',
      });
      timeline.fromTo(menuItems, { autoAlpha: 0, y: -4 }, {
        autoAlpha: 1,
        y: 0,
        duration: 0.17,
        stagger: 0.025,
        clearProps: 'transform,opacity,visibility',
      }, '-=0.09');
    }
    const currentItem = menuItems.find((item) => item.dataset.canvasLensTarget === currentLens) || menuItems[0];
    currentItem?.focus({ preventScroll: true });
  }

  function pushLensUrl(lens) {
    const route = lensToRoute.get(lens);
    if (window.location.pathname !== route || window.location.search) {
      history.pushState({ lucubroLens: lens }, '', route);
    }
  }

  async function switchLens(nextLens, { historyMode = 'push', initial = false } = {}) {
    if (!lensToRoute.has(nextLens)) nextLens = 'manager';
    const serial = ++transitionSerial;
    const previousLens = currentLens;
    const previousPanel = panelFor(previousLens);
    const nextPanel = panelFor(nextLens);

    closeMenu({ immediate: true });

    if (!initial && previousLens === nextLens) {
      setShellState(nextLens);
      if (historyMode === 'push') pushLensUrl(nextLens);
      return;
    }

    if (!initial && previousPanel && !previousPanel.hidden) await animatePanelOut(previousPanel);
    if (serial !== transitionSerial) return;

    for (const panel of panels) panel.hidden = panel !== nextPanel;
    if (nextPanel) nextPanel.hidden = false;
    currentLens = nextLens;
    setShellState(nextLens);

    if (historyMode === 'push') pushLensUrl(nextLens);
    else if (historyMode === 'replace') history.replaceState({ lucubroLens: nextLens }, '', window.location.href);

    await loadLens(nextLens);
    if (serial !== transitionSerial) return;
    animatePanelIn(nextPanel);
  }

  function moveMenuFocus(delta) {
    if (!menuItems.length) return;
    const index = Math.max(0, menuItems.indexOf(document.activeElement));
    const next = (index + delta + menuItems.length) % menuItems.length;
    menuItems[next].focus({ preventScroll: true });
  }

  trigger?.addEventListener('click', () => {
    if (menu?.hidden) openMenu();
    else closeMenu({ restoreFocus: true });
  });

  for (const item of menuItems) {
    item.addEventListener('click', async (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      await switchLens(item.dataset.canvasLensTarget, { historyMode: 'push' });
      trigger?.focus({ preventScroll: true });
    });
  }

  menu?.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveMenuFocus(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveMenuFocus(-1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      menuItems[0]?.focus({ preventScroll: true });
    } else if (event.key === 'End') {
      event.preventDefault();
      menuItems.at(-1)?.focus({ preventScroll: true });
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu({ restoreFocus: true });
    }
  });

  document.addEventListener('pointerdown', (event) => {
    if (!menu || menu.hidden || !trigger) return;
    if (menu.contains(event.target) || trigger.contains(event.target)) return;
    closeMenu();
  });

  workForm?.addEventListener('submit', () => {
    if (currentLens !== 'manager') switchLens('manager', { historyMode: 'push' });
  }, { capture: true });

  brand?.addEventListener('click', (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    switchLens('manager', { historyMode: 'push' });
  });

  window.addEventListener('popstate', () => {
    const lens = routeToLens.get(window.location.pathname) || 'manager';
    switchLens(lens, { historyMode: 'none' });
  });

  window.addEventListener('pagehide', () => {
    if (!window.gsap) return;
    window.gsap.killTweensOf([menu, ...menuItems, ...panels]);
  }, { once: true });

  for (const panel of panels) panel.hidden = panel.dataset.canvasLensPanel !== currentLens;
  setShellState(currentLens);
  history.replaceState({ lucubroLens: currentLens }, '', window.location.href);
  loadLens(currentLens).then(() => {
    if (currentLens !== 'manager') animatePanelIn(panelFor(currentLens));
  });
})();
