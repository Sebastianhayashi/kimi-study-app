(() => {
  'use strict';

  const routeToView = new Map([
    ['/company', 'manager'],
    ['/company/', 'manager'],
    ['/company/work', 'work'],
    ['/company/employees', 'employees'],
    ['/company/settings', 'settings'],
  ]);

  const view = routeToView.get(window.location.pathname) || 'manager';
  const views = [...document.querySelectorAll('[data-company-view-panel]')];
  const links = [...document.querySelectorAll('[data-company-nav]')];
  const composer = document.querySelector('.composer-dock');
  const workList = document.querySelector('#work-page-list');
  const workSummary = document.querySelector('#work-page-summary');
  const employeeList = document.querySelector('#employee-page-list');
  const employeeSummary = document.querySelector('#employee-page-summary');
  const runtimeList = document.querySelector('#settings-runtime-list');
  const workspaceRoot = document.querySelector('#settings-workspace-root');
  const settingsSummary = document.querySelector('#settings-page-summary');

  document.body.dataset.companyView = view;
  for (const panel of views) panel.hidden = panel.dataset.companyViewPanel !== view;
  for (const link of links) {
    if (link.dataset.companyNav === view) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  if (composer) composer.hidden = view !== 'manager';

  const titles = {
    manager: 'Lucubro · Company',
    work: 'Work · Lucubro',
    employees: 'Employees · Lucubro',
    settings: 'Settings · Lucubro',
  };
  document.title = titles[view] || titles.manager;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const canAnimate = () => Boolean(window.gsap && !reducedMotion.matches);

  function animatePage(node) {
    if (!node || !canAnimate()) return;
    const targets = node.querySelectorAll('.product-page-header, .product-page-body > *');
    window.gsap.fromTo(targets, { autoAlpha: 0, y: 7 }, {
      autoAlpha: 1,
      y: 0,
      duration: 0.28,
      stagger: 0.035,
      ease: 'power2.out',
      clearProps: 'transform,opacity,visibility',
    });
  }

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
    failure.append(el('strong', '', 'This view could not be loaded.'), el('span', '', error.message));
    host.append(failure);
  }

  function renderWorkPage(data) {
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

  function renderEmployeesPage(data) {
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
      const assigned = person.id === 'alex' ? 0 : works.filter((work) => work.employeeId === person.id).length;
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
        person.id === 'alex' ? 'Primary company interface' : `${assigned} Work assignment${assigned === 1 ? '' : 's'}`,
      );
      row.append(avatar, copy, assignment);
      employeeList.append(row);
    }
  }

  async function renderSettingsPage(data) {
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
        const status = el('span', 'settings-state', runtime.available ? 'Available' : 'Not ready');
        status.dataset.tone = runtime.available ? 'success' : 'error';
        row.append(copy, status);
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

  async function bootstrapPage() {
    if (view === 'manager') {
      animatePage(document.querySelector('[data-company-view-panel="manager"]'));
      return;
    }

    const panel = document.querySelector(`[data-company-view-panel="${CSS.escape(view)}"]`);
    try {
      const response = await fetch('/api/company/bootstrap');
      if (!response.ok) throw new Error(`Bootstrap failed (${response.status})`);
      const data = await response.json();
      if (view === 'work') renderWorkPage(data);
      if (view === 'employees') renderEmployeesPage(data);
      if (view === 'settings') await renderSettingsPage(data);
      animatePage(panel);
    } catch (error) {
      const host = view === 'work' ? workList : view === 'employees' ? employeeList : runtimeList;
      if (host) renderFailure(host, error);
    }
  }

  bootstrapPage();
})();
