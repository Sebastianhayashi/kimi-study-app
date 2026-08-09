(() => {
  'use strict';

  const map = document.querySelector('#company-operating-map');
  const rowsHost = document.querySelector('#operating-map-rows');
  const mapSummary = document.querySelector('#operating-map-summary');
  const feed = document.querySelector('#conversation-feed');
  const durableContext = document.querySelector('#durable-work-context');
  const needsCount = document.querySelector('#needs-you-count');

  if (!map || !rowsHost || !mapSummary || !feed || !needsCount) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const rowNodes = new Map();
  const workNodes = new Map();
  const observers = [];
  let refreshTimer = null;
  let refreshing = false;
  let refreshQueued = false;
  let disposed = false;

  rowsHost.removeAttribute('aria-live');
  rowsHost.removeAttribute('aria-relevant');

  const canAnimate = () => Boolean(window.gsap && !reducedMotion.matches);

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function statusInfo(status) {
    const map = {
      starting: ['Starting', 'active'],
      'in-progress': ['In progress', 'active'],
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

  function ownerId(work) {
    return work.assignedEmployeeId || work.employeeId || 'unassigned';
  }

  function workTitle(work) {
    return work.title || work.brief || 'Untitled Work';
  }

  function workExecutionCopy(work) {
    if (work.status === 'needs-you') return 'Decision boundary';
    if (work.status === 'review') return 'Evidence ready';
    if (work.status === 'accepted') return 'Evidence accepted';
    if (work.status === 'failed') return 'Run stopped';
    if (work.status === 'needs-rework') return 'Rework requested';
    if (work.activeRunId) return 'Run executing';
    return 'Durable Work';
  }

  function runCopy(work) {
    if (!work.activeRunId) return 'No active Run';
    const id = String(work.activeRunId);
    const compact = id.length > 11 ? id.slice(-8) : id;
    return `Run ${compact}`;
  }

  function createdAtValue(work) {
    return Date.parse(work.createdAt || 0) || 0;
  }

  function animateMount(node) {
    if (!canAnimate()) return;
    window.gsap.fromTo(
      node,
      { autoAlpha: 0, x: 10, scale: 0.992 },
      { autoAlpha: 1, x: 0, scale: 1, duration: 0.28, ease: 'power2.out', clearProps: 'transform,opacity,visibility' },
    );
  }

  function animateState(node) {
    if (!canAnimate()) return;
    window.gsap.killTweensOf(node);
    window.gsap.fromTo(
      node,
      { scale: 0.993 },
      { scale: 1, duration: 0.22, ease: 'power2.out', clearProps: 'transform' },
    );
  }

  function ensureRow(person) {
    const id = person.id || 'unassigned';
    if (rowNodes.has(id)) return rowNodes.get(id);

    const row = el('section', 'operating-employee-row');
    row.dataset.testid = 'operating-employee-row';
    row.dataset.employeeId = id;
    row.setAttribute('aria-label', `${person.name || 'Unassigned'} responsibility row`);

    const anchor = el('div', 'operating-person-anchor');
    const avatar = el('span', 'operating-person-avatar', (person.name || '?').slice(0, 1).toUpperCase());
    avatar.setAttribute('aria-hidden', 'true');
    const copy = el('span', 'operating-person-copy');
    copy.append(
      el('span', 'operating-person-kicker', 'Employee'),
      el('strong', '', person.name || 'Unassigned'),
      el('small', '', person.position || 'No durable owner'),
    );
    anchor.append(avatar, copy);

    const track = el('div', 'operating-work-track');
    track.dataset.employeeTrack = id;
    row.append(anchor, track);
    rowsHost.append(row);

    const record = { row, anchor, track, person };
    rowNodes.set(id, record);
    if (canAnimate()) {
      window.gsap.fromTo(row, { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: 0.25, ease: 'power2.out', clearProps: 'transform,opacity,visibility' });
    }
    return record;
  }

  function updateRowIdentity(record, person) {
    record.person = person;
    const avatar = record.anchor.querySelector('.operating-person-avatar');
    const name = record.anchor.querySelector('strong');
    const position = record.anchor.querySelector('small');
    avatar.textContent = (person.name || '?').slice(0, 1).toUpperCase();
    name.textContent = person.name || 'Unassigned';
    position.textContent = person.position || 'No durable owner';
    record.row.setAttribute('aria-label', `${person.name || 'Unassigned'} responsibility row`);
  }

  function createWorkNode(work) {
    const button = el('button', 'operating-work-node');
    button.type = 'button';
    button.dataset.testid = 'operating-work-node';
    button.dataset.workId = work.id;

    const head = el('span', 'operating-work-head');
    const kind = el('span', 'operating-work-kind', 'Work');
    const status = el('span', 'operating-work-status');
    head.append(kind, status);

    const title = el('strong', 'operating-work-title');
    const meta = el('span', 'operating-work-meta');
    const footer = el('span', 'operating-work-footer');
    const execution = el('span', 'operating-work-execution');
    const run = el('span', 'operating-work-runtime');
    footer.append(execution, run);
    button.append(head, title, meta, footer);

    button.addEventListener('click', () => {
      const live = document.querySelector(`.work-object[data-work-id="${CSS.escape(work.id)}"]`);
      window.dispatchEvent(new CustomEvent('lucubro:open-work', { detail: { workId: work.id } }));
      if (live) {
        if (!live.hasAttribute('tabindex')) live.setAttribute('tabindex', '-1');
        live.focus({ preventScroll: true });
        live.scrollIntoView({ block: 'center', behavior: reducedMotion.matches ? 'auto' : 'smooth' });
      }
    });

    workNodes.set(work.id, { button, work: null });
    return workNodes.get(work.id);
  }

  function updateWorkNode(record, work) {
    const previousStatus = record.work?.status || null;
    const [label, tone] = statusInfo(work.status);
    const button = record.button;
    button.dataset.status = work.status || 'unknown';
    button.dataset.tone = tone;
    button.setAttribute('aria-label', `${workTitle(work)}. ${label}. ${runCopy(work)}.`);
    button.querySelector('.operating-work-status').textContent = label;
    button.querySelector('.operating-work-title').textContent = workTitle(work);
    button.querySelector('.operating-work-meta').textContent = work.brief && work.brief !== workTitle(work)
      ? work.brief
      : 'Durable company Work';
    button.querySelector('.operating-work-execution').textContent = workExecutionCopy(work);
    button.querySelector('.operating-work-runtime').textContent = runCopy(work);
    record.work = work;
    if (previousStatus && previousStatus !== work.status) animateState(button);
  }

  function visibleWorks(works) {
    const unsettled = works
      .filter((work) => work.status !== 'accepted')
      .sort((a, b) => createdAtValue(b) - createdAtValue(a));
    const settled = works
      .filter((work) => work.status === 'accepted')
      .sort((a, b) => createdAtValue(b) - createdAtValue(a));
    return [...unsettled, ...settled].slice(0, 6);
  }

  function render(data) {
    const employees = Array.isArray(data.employees) ? data.employees : [];
    const works = Array.isArray(data.works) ? data.works : [];
    const shownWorks = visibleWorks(works);
    const people = new Map(employees.map((employee) => [employee.id, employee]));

    for (const work of shownWorks) {
      const id = ownerId(work);
      if (!people.has(id)) {
        people.set(id, id === 'unassigned'
          ? { id, name: 'Unassigned', position: 'No durable owner' }
          : { id, name: id, position: 'Employee' });
      }
    }

    for (const person of people.values()) {
      const row = ensureRow(person);
      updateRowIdentity(row, person);
    }

    for (const [id, record] of rowNodes) {
      if (people.has(id)) continue;
      record.row.remove();
      rowNodes.delete(id);
    }

    const visibleIds = new Set(shownWorks.map((work) => work.id));
    for (const work of shownWorks) {
      const row = ensureRow(people.get(ownerId(work)));
      let record = workNodes.get(work.id);
      const isNew = !record;
      if (!record) record = createWorkNode(work);
      updateWorkNode(record, work);
      if (record.button.parentElement !== row.track) row.track.prepend(record.button);
      if (isNew) animateMount(record.button);
    }

    for (const [id, record] of workNodes) {
      if (visibleIds.has(id)) continue;
      record.button.remove();
      workNodes.delete(id);
    }

    for (const record of rowNodes.values()) {
      let empty = record.track.querySelector('.operating-row-empty');
      const hasWork = Boolean(record.track.querySelector('.operating-work-node'));
      if (hasWork) {
        empty?.remove();
      } else if (!empty) {
        empty = el('div', 'operating-row-empty');
        empty.append(
          el('strong', '', works.length ? 'No Work assigned here.' : 'No durable Work yet.'),
          el('span', '', works.length ? 'This Employee is clear right now.' : 'Give Alex an outcome below. Durable Work will appear on this map.'),
        );
        record.track.append(empty);
      }
    }

    if (!works.length) mapSummary.textContent = 'No durable Work yet';
    else if (works.length > shownWorks.length) mapSummary.textContent = `Showing ${shownWorks.length} of ${works.length} durable Work items`;
    else mapSummary.textContent = `${works.length} durable Work item${works.length === 1 ? '' : 's'} on the company map`;

    map.dataset.controller = 'ready';
    map.dataset.workCount = String(works.length);
  }

  async function refresh() {
    if (disposed) return;
    if (refreshing) {
      refreshQueued = true;
      return;
    }
    refreshing = true;
    try {
      const response = await fetch('/api/company/bootstrap');
      if (!response.ok) throw new Error(`Bootstrap failed (${response.status})`);
      const data = await response.json();
      if (!disposed) render(data);
    } catch (error) {
      map.dataset.controller = 'error';
      mapSummary.textContent = 'Company state unavailable';
      const emptyRows = rowsHost.querySelectorAll('.operating-row-empty');
      if (!emptyRows.length) {
        const failure = el('div', 'operating-map-error');
        failure.setAttribute('role', 'alert');
        failure.textContent = error.message;
        rowsHost.append(failure);
      }
    } finally {
      refreshing = false;
      if (refreshQueued && !disposed) {
        refreshQueued = false;
        queueMicrotask(refresh);
      }
    }
  }

  function scheduleRefresh() {
    if (disposed) return;
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refresh, 90);
  }

  const feedObserver = new MutationObserver(scheduleRefresh);
  feedObserver.observe(feed, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['data-tone', 'data-canvas-phase'] });
  observers.push(feedObserver);

  if (durableContext) {
    const durableObserver = new MutationObserver(scheduleRefresh);
    durableObserver.observe(durableContext, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['data-tone', 'hidden'] });
    observers.push(durableObserver);
  }

  const needsObserver = new MutationObserver(scheduleRefresh);
  needsObserver.observe(needsCount, { childList: true, subtree: true, characterData: true });
  observers.push(needsObserver);

  map.dataset.controller = 'loading';
  refresh();

  window.addEventListener('pagehide', () => {
    disposed = true;
    clearTimeout(refreshTimer);
    for (const observer of observers) observer.disconnect();
    if (window.gsap) {
      window.gsap.killTweensOf([...workNodes.values()].map((record) => record.button));
      window.gsap.killTweensOf([...rowNodes.values()].map((record) => record.row));
    }
  }, { once: true });
})();
