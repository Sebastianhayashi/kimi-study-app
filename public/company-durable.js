(() => {
  'use strict';

  const section = document.querySelector('#durable-work-context');
  const list = document.querySelector('#durable-work-list');
  const summary = document.querySelector('#durable-work-summary');
  const detailHost = document.querySelector('#durable-work-detail-host');
  if (!section || !list || !summary || !detailHost) return;

  const state = {
    works: [],
    selectedWorkId: null,
  };

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const hasGsap = () => Boolean(window.gsap && !reducedMotion.matches);

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function displayStatus(status) {
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
    const [label, tone] = displayStatus(status);
    const node = el('span', 'status durable-work-status', label);
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

  function animateIn(node, options = {}) {
    if (!hasGsap()) return;
    window.gsap.fromTo(
      node,
      { autoAlpha: 0, y: options.y ?? 6 },
      { autoAlpha: 1, y: 0, duration: options.duration ?? 0.26, ease: 'power2.out', clearProps: 'transform,opacity,visibility' },
    );
  }

  function activeWorkCount() {
    return state.works.filter((work) => ['starting', 'in-progress', 'needs-you', 'needs-rework'].includes(work.status)).length;
  }

  function reviewWorkCount() {
    return state.works.filter((work) => work.status === 'review').length;
  }

  function updateSummary() {
    const active = activeWorkCount();
    const review = reviewWorkCount();
    if (review > 0) {
      summary.textContent = `${review} ready for review · ${active} active`;
      return;
    }
    if (active > 0) {
      summary.textContent = `${active} active · ${state.works.length} recent`;
      return;
    }
    summary.textContent = `${state.works.length} recent Work item${state.works.length === 1 ? '' : 's'}`;
  }

  function renderRows() {
    list.replaceChildren();
    const visibleWorks = state.works.slice(0, 6);

    for (const work of visibleWorks) {
      const row = el('button', 'durable-work-row');
      row.type = 'button';
      row.dataset.testid = 'durable-work-row';
      row.dataset.workId = work.id;
      row.setAttribute('aria-expanded', String(state.selectedWorkId === work.id));
      row.setAttribute('aria-controls', 'durable-work-detail');

      const copy = el('span', 'durable-work-row-copy');
      copy.append(
        el('strong', '', work.title || work.brief || 'Untitled Work'),
        el('span', 'durable-work-row-meta', `Ben · ${formatTimestamp(work.updatedAt || work.createdAt)}`),
      );
      const stateCell = el('span', 'durable-work-row-state');
      stateCell.append(statusNode(work.status));
      row.append(copy, stateCell);
      row.addEventListener('click', () => openWork(work.id));
      list.append(row);
    }

    updateSummary();
  }

  function latestArtifact(events) {
    return [...events].reverse().find((event) => event.type === 'artifact.produced' || event.type === 'artifact.updated') || null;
  }

  function latestActivity(events) {
    return events
      .filter((event) => event.type === 'message.delta' || event.type === 'tool.started' || event.type === 'tool.completed' || event.type === 'run.completed' || event.type === 'run.failed')
      .slice(-4);
  }

  function activityCopy(event) {
    if (event.type === 'message.delta') return event.text || 'Employee update';
    if (event.type === 'tool.started') return `Running ${event.tool || 'tool'}…`;
    if (event.type === 'tool.completed') return `${event.tool || 'Tool'} finished.`;
    if (event.type === 'run.completed') return event.summary || 'Run completed.';
    if (event.type === 'run.failed') return event.error || 'Run failed.';
    return event.type;
  }

  async function decideWork(work, decision) {
    const response = await fetch(`/api/company/works/${encodeURIComponent(work.id)}/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || response.statusText);

    const index = state.works.findIndex((item) => item.id === work.id);
    if (index >= 0) state.works[index] = payload.work;
    renderRows();
    await openWork(work.id, { preserveSelection: true });
  }

  function renderDetail(work, runPayload) {
    detailHost.replaceChildren();

    const detail = el('article', 'durable-work-detail');
    detail.id = 'durable-work-detail';
    detail.dataset.workId = work.id;

    const header = el('div', 'durable-work-detail-header');
    const heading = el('div', 'durable-work-detail-title');
    heading.append(
      el('span', 'context-kicker', 'Durable Work'),
      el('h2', '', work.title || work.brief || 'Untitled Work'),
      el('p', '', work.brief || work.title || ''),
    );
    const close = el('button', 'icon-button durable-work-close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close Work detail');
    close.addEventListener('click', closeDetail);
    header.append(heading, close);

    const meta = el('div', 'durable-work-meta');
    const [statusLabel] = displayStatus(work.status);
    meta.append(
      statusNode(work.status),
      el('span', '', 'Ben · Software Engineer'),
      el('span', '', work.runtime ? `Runtime ${work.runtime}` : 'Runtime unavailable'),
      el('span', '', `Updated ${formatTimestamp(work.updatedAt)}`),
    );

    const body = el('div', 'durable-work-detail-body');

    if (!runPayload || !runPayload.run) {
      const empty = el('div', 'durable-work-evidence-empty');
      empty.append(
        el('strong', '', 'No Run evidence is attached yet.'),
        el('span', '', 'The Work remains durable even before execution evidence exists.'),
      );
      body.append(empty);
    } else {
      const { run, events = [] } = runPayload;
      const artifact = latestArtifact(events);
      const activity = latestActivity(events);

      if (activity.length) {
        const activitySection = el('section', 'durable-work-activity');
        activitySection.append(el('h3', '', 'Recent activity'));
        const activityList = el('div', 'work-progress');
        for (const event of activity) activityList.append(el('div', 'activity-line', activityCopy(event)));
        activitySection.append(activityList);
        body.append(activitySection);
      }

      if (artifact) {
        const evidence = el('details', 'artifact durable-work-artifact');
        const files = artifact.changedFiles || run.changedFiles || [];
        evidence.open = work.status === 'review';
        evidence.append(
          el('summary', '', files.length ? `Code changes · ${files.length} file${files.length === 1 ? '' : 's'}` : 'Review code changes'),
          el('pre', '', artifact.diff || 'No textual diff was captured.'),
        );
        body.append(evidence);
      } else {
        const empty = el('div', 'durable-work-evidence-empty');
        empty.append(
          el('strong', '', 'No Artifact evidence yet.'),
          el('span', '', 'Run state is preserved; review actions appear only when evidence reaches the Work boundary.'),
        );
        body.append(empty);
      }

      const execution = el('details', 'artifact run-detail durable-run-detail');
      execution.append(
        el('summary', '', 'Execution details'),
        el('pre', '', `Run: ${run.id}\nRuntime: ${run.runtime}\nStatus: ${run.status}\nBranch: ${run.branch || 'n/a'}\nChanged files: ${(run.changedFiles || []).join(', ') || 'none'}`),
      );
      body.append(execution);
    }

    if (work.status === 'review') {
      const actions = el('div', 'review-actions durable-review-actions');
      const accept = el('button', 'primary-action', 'Accept');
      accept.type = 'button';
      const rework = el('button', 'secondary-action', 'Rework');
      rework.type = 'button';
      const error = el('p', 'durable-work-error');
      error.setAttribute('role', 'alert');
      error.hidden = true;

      async function apply(decision) {
        accept.disabled = true;
        rework.disabled = true;
        error.hidden = true;
        try {
          await decideWork(work, decision);
        } catch (cause) {
          error.textContent = `Could not update Work: ${cause.message}`;
          error.hidden = false;
          accept.disabled = false;
          rework.disabled = false;
        }
      }

      accept.addEventListener('click', () => apply('accept'));
      rework.addEventListener('click', () => apply('rework'));
      actions.append(accept, rework, error);
      body.append(actions);
    }

    detail.append(header, meta, body);
    detailHost.append(detail);
    animateIn(detail, { y: 8, duration: 0.3 });
    detail.querySelector('h2')?.focus?.({ preventScroll: true });

    const selectedRow = list.querySelector(`[data-work-id="${CSS.escape(work.id)}"]`);
    selectedRow?.setAttribute('aria-expanded', 'true');
    selectedRow?.classList.add('is-selected');

    detail.scrollIntoView({ block: 'nearest', behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    detail.dataset.statusLabel = statusLabel;
  }

  async function openWork(workId, { preserveSelection = false } = {}) {
    const work = state.works.find((item) => item.id === workId);
    if (!work) return;

    if (!preserveSelection && state.selectedWorkId === workId && !detailHost.hidden) {
      closeDetail();
      return;
    }

    state.selectedWorkId = workId;
    for (const row of list.querySelectorAll('[data-testid="durable-work-row"]')) {
      const selected = row.dataset.workId === workId;
      row.setAttribute('aria-expanded', String(selected));
      row.classList.toggle('is-selected', selected);
    }

    detailHost.hidden = false;
    detailHost.replaceChildren();
    const loading = el('div', 'durable-work-loading');
    loading.setAttribute('role', 'status');
    loading.textContent = 'Loading Work evidence…';
    detailHost.append(loading);

    try {
      let runPayload = null;
      if (work.activeRunId) {
        const response = await fetch(`/api/company/runs/${encodeURIComponent(work.activeRunId)}`);
        if (!response.ok) throw new Error(`Run evidence unavailable (${response.status})`);
        runPayload = await response.json();
      }
      renderDetail(work, runPayload);
    } catch (error) {
      detailHost.replaceChildren();
      const failure = el('div', 'durable-work-load-error');
      failure.setAttribute('role', 'alert');
      failure.append(
        el('strong', '', 'Work is durable, but its evidence could not be loaded.'),
        el('span', '', error.message),
      );
      detailHost.append(failure);
    }
  }

  function closeDetail() {
    state.selectedWorkId = null;
    for (const row of list.querySelectorAll('[data-testid="durable-work-row"]')) {
      row.setAttribute('aria-expanded', 'false');
      row.classList.remove('is-selected');
    }
    detailHost.hidden = true;
    detailHost.replaceChildren();
  }

  async function bootstrapDurableWork() {
    try {
      const response = await fetch('/api/company/bootstrap');
      if (!response.ok) throw new Error(`Bootstrap failed (${response.status})`);
      const data = await response.json();
      state.works = Array.isArray(data.works) ? data.works : [];

      if (!state.works.length) {
        section.hidden = true;
        return;
      }

      section.hidden = false;
      renderRows();
      animateIn(section, { y: 7, duration: 0.3 });
    } catch (error) {
      section.hidden = false;
      list.replaceChildren();
      const failure = el('div', 'durable-work-load-error');
      failure.setAttribute('role', 'alert');
      failure.append(
        el('strong', '', 'Durable Work could not be loaded.'),
        el('span', '', error.message),
      );
      list.append(failure);
      summary.textContent = 'Work context unavailable';
    }
  }

  bootstrapDurableWork();
})();
