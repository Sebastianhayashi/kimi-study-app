(() => {
  'use strict';

  const stage = document.querySelector('#project-result-stage');
  const host = document.querySelector('#project-result-host');
  const stageName = document.querySelector('#project-result-name');
  const stageUpdated = document.querySelector('#project-result-updated');
  if (!stage || !host) return;

  const state = {
    projects: new Map(),
    currentProjectId: null,
    projectedRuns: new Set(),
  };

  function text(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : '';
  }

  function el(tag, className, content = null) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content != null) node.textContent = content;
    return node;
  }

  function memoryProjects(data) {
    const projects = Array.isArray(data && data.projects) ? data.projects : [];
    return projects
      .filter((project) => project && project.memory && typeof project.memory === 'object')
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')) || String(a.id).localeCompare(String(b.id)));
  }

  function requestedProjectId(projects) {
    const query = new URLSearchParams(window.location.search).get('project');
    if (query && projects.some((project) => project.id === query)) return query;
    const existing = text(document.body.dataset.activeProjectId);
    if (existing && projects.some((project) => project.id === existing)) return existing;
    return null;
  }

  function relativeUpdate(value) {
    if (!value) return 'Saved project state';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Saved project state';
    return `Updated ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
  }

  function syncProjectFocus(project, { updateUrl = false } = {}) {
    if (!project) return;
    state.currentProjectId = project.id;
    document.body.dataset.activeProjectId = project.id;
    document.body.dataset.hasProjectMemory = 'true';
    for (const button of stage.querySelectorAll('.project-continue-button')) {
      const active = button.dataset.projectId === project.id;
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      button.textContent = active ? `Working in ${project.name || 'this Project'}` : `Continue in ${project.name || 'this Project'}`;
    }
    const brief = document.querySelector('#work-brief');
    if (brief) brief.placeholder = `Add something to ${project.name || 'this Project'}…`;
    if (updateUrl) {
      const url = new URL(window.location.href);
      url.searchParams.set('project', project.id);
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }
    window.dispatchEvent(new CustomEvent('lucubro:project-focus', {
      detail: { projectId: project.id, project },
    }));
  }

  function frontierNode(frontier) {
    const card = el('article', 'project-frontier');
    card.dataset.frontierId = frontier.id;

    const head = el('div', 'project-frontier-head');
    head.append(
      el('strong', '', text(frontier.title) || frontier.id),
      el('span', 'project-frontier-status', text(frontier.status) || 'active'),
    );
    card.append(head);

    if (text(frontier.summary)) card.append(el('p', '', frontier.summary));
    if (text(frontier.nextAction)) {
      card.append(el('div', 'project-frontier-next', `Next · ${frontier.nextAction}`));
    }
    return card;
  }

  function renderProject(project, { activate = false } = {}) {
    const memory = project.memory || {};
    const report = memory.report && typeof memory.report === 'object' ? memory.report : {};
    const frontiers = Array.isArray(memory.frontiers) ? memory.frontiers.filter((item) => item && item.id) : [];

    const article = el('article', 'project-result');
    article.dataset.testid = 'project-result';
    article.dataset.projectId = project.id;

    const reportSurface = el('section', 'project-report');
    reportSurface.dataset.testid = 'project-report';
    const heading = el('div', 'project-report-heading');
    heading.append(
      el('span', 'context-kicker', project.name || 'Project'),
      el('h1', '', text(report.title) || `${project.name || 'Project'} report`),
    );
    const summary = text(report.summary) || text(memory.objective);
    if (summary) heading.append(el('p', 'project-report-summary', summary));
    reportSurface.append(heading);

    if (text(report.changed)) {
      const changed = el('div', 'project-change');
      changed.dataset.testid = 'project-change';
      changed.append(el('span', 'project-change-label', 'Updated'), el('p', '', report.changed));
      reportSurface.append(changed);
    }

    if (text(report.nextAction)) {
      const next = el('div', 'project-next-action');
      next.dataset.testid = 'project-next-action';
      next.append(el('span', '', 'Next meaningful step'), el('p', '', report.nextAction));
      reportSurface.append(next);
    }

    const frontierSurface = el('aside', 'project-frontiers');
    frontierSurface.setAttribute('aria-label', 'Open Project frontiers');
    const frontierHeading = el('div', 'project-frontiers-heading');
    frontierHeading.append(el('strong', '', 'Open frontiers'), el('span', 'project-frontiers-count', String(frontiers.length)));
    frontierSurface.append(frontierHeading);

    for (const frontier of frontiers) frontierSurface.append(frontierNode(frontier));
    if (!frontiers.length) frontierSurface.append(el('p', 'project-frontier-label', 'No unresolved frontier right now.'));

    const actions = el('div', 'project-result-actions');
    const continueButton = el('button', 'project-continue-button', `Continue in ${project.name || 'this Project'}`);
    continueButton.type = 'button';
    continueButton.dataset.projectId = project.id;
    continueButton.setAttribute('aria-pressed', 'false');
    continueButton.addEventListener('click', () => {
      syncProjectFocus(project, { updateUrl: true });
      const brief = document.querySelector('#work-brief');
      if (brief) {
        brief.focus();
        brief.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      }
    });
    actions.append(continueButton);
    frontierSurface.append(actions);

    article.append(reportSurface, frontierSurface);
    host.replaceChildren(article);
    if (stageName) stageName.textContent = project.name || project.id;
    if (stageUpdated) stageUpdated.textContent = relativeUpdate(project.updatedAt);
    stage.hidden = false;
    document.body.dataset.hasProjectMemory = 'true';
    if (activate) syncProjectFocus(project);
  }

  function hideProjectSurface() {
    state.projects.clear();
    state.currentProjectId = null;
    delete document.body.dataset.activeProjectId;
    delete document.body.dataset.hasProjectMemory;
    stage.hidden = true;
    host.replaceChildren();
  }

  function ensureEvidenceShelf(card) {
    let shelf = card.querySelector('.run-evidence-shelf');
    if (shelf) return shelf;
    shelf = el('section', 'run-evidence-shelf');
    shelf.dataset.testid = 'run-evidence';
    shelf.setAttribute('aria-label', 'Run evidence');
    const header = el('div', 'run-evidence-header');
    header.append(el('h3', '', 'Run evidence'), el('span', 'run-evidence-count', '0 captured'));
    shelf.append(header, el('div', 'run-evidence-grid'));
    const execution = card.querySelector('.run-detail');
    if (execution) execution.before(shelf);
    else card.querySelector('.work-object-body')?.append(shelf);
    return shelf;
  }

  function renderUserEvidence(card, item) {
    if (!item || !item.id || item.source !== 'user-input') return;
    const shelf = ensureEvidenceShelf(card);
    const grid = shelf.querySelector('.run-evidence-grid');
    if (!grid) return;
    if ([...grid.children].some((node) => node.dataset.evidenceId === item.id)) return;

    const evidence = el('article', 'run-evidence-item');
    evidence.dataset.evidenceId = item.id;
    evidence.dataset.evidenceKind = item.kind || 'unknown';
    const glyph = el('div', 'run-evidence-glyph', String(item.kind || 'evidence').slice(0, 1).toUpperCase());
    glyph.setAttribute('aria-hidden', 'true');
    const copy = el('div', 'run-evidence-copy');
    copy.append(
      el('strong', '', item.label || item.kind || 'Evidence'),
      el('span', 'run-evidence-source', `User input · ${item.kind || 'evidence'}`),
    );
    const url = item.metadata && item.metadata.url;
    if (url) copy.append(el('span', 'run-evidence-context', url));
    evidence.append(glyph, copy);
    grid.append(evidence);
    shelf.querySelector('.run-evidence-count').textContent = `${grid.children.length} captured`;
  }

  async function projectRunInputEvidence(card) {
    const runId = text(card && card.dataset && card.dataset.runId);
    if (!runId || state.projectedRuns.has(runId)) return;
    state.projectedRuns.add(runId);
    try {
      const response = await fetch(`/api/company/runs/${encodeURIComponent(runId)}`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!response.ok) return;
      const payload = await response.json();
      for (const item of Array.isArray(payload.evidence) ? payload.evidence : []) {
        renderUserEvidence(card, item);
      }
    } catch {
      // The normal Run stream remains authoritative; this projection is best-effort UI hydration.
    }
  }

  function observeWorkEvidence() {
    const feed = document.querySelector('#conversation-feed');
    if (!feed) return;
    const projectVisibleCards = () => {
      for (const card of feed.querySelectorAll('.work-object[data-run-id]')) projectRunInputEvidence(card);
    };
    const observer = new MutationObserver(projectVisibleCards);
    observer.observe(feed, { childList: true, subtree: true });
    projectVisibleCards();
    window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
  }

  async function load() {
    let response;
    try {
      response = await fetch('/api/company/bootstrap', { headers: { Accept: 'application/json' }, cache: 'no-store' });
    } catch {
      hideProjectSurface();
      return;
    }
    if (!response.ok) {
      hideProjectSurface();
      return;
    }
    const data = await response.json();
    const projects = memoryProjects(data);
    if (!projects.length) {
      hideProjectSurface();
      return;
    }
    state.projects = new Map(projects.map((project) => [project.id, project]));
    const activeProjectId = requestedProjectId(projects);
    const project = activeProjectId ? state.projects.get(activeProjectId) : projects[0];
    renderProject(project, { activate: Boolean(activeProjectId) });
  }

  window.addEventListener('lucubro:project-memory-refresh', load);
  observeWorkEvidence();
  load();
})();
