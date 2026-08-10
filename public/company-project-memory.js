(() => {
  'use strict';

  const stage = document.querySelector('#project-result-stage');
  const host = document.querySelector('#project-result-host');
  const stageName = document.querySelector('#project-result-name');
  const stageUpdated = document.querySelector('#project-result-updated');
  if (!stage || !host) return;

  const MAX_ATTACHMENT_IMAGES = 4;
  const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
  const SUPPORTED_ATTACHMENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
  const nativeFetch = window.fetch.bind(window);
  const state = {
    projects: new Map(),
    currentProjectId: null,
    projectedRuns: new Set(),
    attachmentFiles: [],
    attachmentPreviewUrls: [],
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

  function evidenceContentUrl(item) {
    return `/api/company/evidence/${encodeURIComponent(item.id)}/content`;
  }

  function evidencePreviewNode(item) {
    const link = document.createElement('a');
    link.className = 'project-evidence-preview';
    link.dataset.evidenceId = item.id;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';

    if (String(item.mimeType || '').startsWith('image/')) {
      link.href = evidenceContentUrl(item);
      const image = document.createElement('img');
      image.src = evidenceContentUrl(item);
      image.alt = item.label || 'Project evidence image';
      image.loading = 'lazy';
      image.decoding = 'async';
      link.append(image);
    } else if (item.metadata && item.metadata.url) {
      link.href = item.metadata.url;
      link.append(el('span', 'project-evidence-preview-glyph', '↗'));
    } else {
      link.href = evidenceContentUrl(item);
      link.append(el('span', 'project-evidence-preview-glyph', String(item.kind || 'E').slice(0, 1).toUpperCase()));
    }

    const caption = el('span', 'project-evidence-preview-caption');
    caption.append(
      el('strong', '', item.source === 'user-input' ? 'You sent' : (item.label || 'Evidence')),
      el('small', '', item.metadata && item.metadata.filename ? item.metadata.filename : (item.kind || 'evidence')),
    );
    link.append(caption);
    return link;
  }

  async function renderContextualEvidence(project) {
    if (!project || !project.id) return;
    let response;
    try {
      response = await nativeFetch(`/api/company/projects/${encodeURIComponent(project.id)}/evidence`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
    } catch {
      return;
    }
    if (!response.ok) return;
    const payload = await response.json();
    const evidenceById = new Map((Array.isArray(payload.evidence) ? payload.evidence : []).map((item) => [item.id, item]));
    const current = host.querySelector(`.project-result[data-project-id="${CSS.escape(project.id)}"]`);
    if (!current) return;
    const frontiers = Array.isArray(project.memory && project.memory.frontiers) ? project.memory.frontiers : [];
    for (const frontier of frontiers) {
      const card = current.querySelector(`[data-frontier-id="${CSS.escape(frontier.id)}"]`);
      if (!card) continue;
      card.querySelector('.project-frontier-evidence')?.remove();
      const items = (Array.isArray(frontier.evidenceIds) ? frontier.evidenceIds : [])
        .map((id) => evidenceById.get(id))
        .filter(Boolean);
      if (!items.length) continue;
      const strip = el('div', 'project-frontier-evidence');
      strip.setAttribute('aria-label', 'Evidence for this Project frontier');
      for (const item of items.slice(0, 4)) strip.append(evidencePreviewNode(item));
      card.append(strip);
    }
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
    void renderContextualEvidence(project);
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
    if (String(item.mimeType || '').startsWith('image/')) {
      const image = document.createElement('img');
      image.src = evidenceContentUrl(item);
      image.alt = item.label || 'User input image';
      image.loading = 'eager';
      image.decoding = 'async';
      evidence.append(image);
    } else {
      const glyph = el('div', 'run-evidence-glyph', String(item.kind || 'evidence').slice(0, 1).toUpperCase());
      glyph.setAttribute('aria-hidden', 'true');
      evidence.append(glyph);
    }
    const copy = el('div', 'run-evidence-copy');
    copy.append(
      el('strong', '', item.label || item.kind || 'Evidence'),
      el('span', 'run-evidence-source', `User input · ${item.kind || 'evidence'}`),
    );
    const context = item.metadata && (item.metadata.filename || item.metadata.url);
    if (context) copy.append(el('span', 'run-evidence-context', context));
    evidence.append(copy);
    grid.append(evidence);
    shelf.querySelector('.run-evidence-count').textContent = `${grid.children.length} captured`;
  }

  async function projectRunInputEvidence(card) {
    const runId = text(card && card.dataset && card.dataset.runId);
    if (!runId || state.projectedRuns.has(runId)) return;
    try {
      const response = await nativeFetch(`/api/company/runs/${encodeURIComponent(runId)}`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!response.ok) return;
      const payload = await response.json();
      for (const item of Array.isArray(payload.evidence) ? payload.evidence : []) renderUserEvidence(card, item);
      state.projectedRuns.add(runId);
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

  function attachmentError(message = '') {
    const error = document.querySelector('#composer-error');
    if (!error) return;
    error.textContent = message;
    error.hidden = !message;
  }

  function revokeAttachmentPreviews() {
    for (const url of state.attachmentPreviewUrls) URL.revokeObjectURL(url);
    state.attachmentPreviewUrls = [];
  }

  function renderAttachmentTray() {
    const tray = document.querySelector('#work-attachment-tray');
    if (!tray) return;
    revokeAttachmentPreviews();
    tray.replaceChildren();
    tray.hidden = state.attachmentFiles.length === 0;
    state.attachmentFiles.forEach((file, index) => {
      const card = el('div', 'composer-attachment');
      card.dataset.testid = 'composer-attachment';
      const url = URL.createObjectURL(file);
      state.attachmentPreviewUrls.push(url);
      const image = document.createElement('img');
      image.src = url;
      image.alt = '';
      const copy = el('span', 'composer-attachment-copy');
      copy.append(el('strong', '', file.name || `Photo ${index + 1}`), el('small', '', `${Math.max(1, Math.round(file.size / 1024))} KB`));
      const remove = el('button', 'composer-attachment-remove', '×');
      remove.type = 'button';
      remove.setAttribute('aria-label', `Remove ${file.name || `photo ${index + 1}`}`);
      remove.addEventListener('click', () => {
        state.attachmentFiles.splice(index, 1);
        renderAttachmentTray();
      });
      card.append(image, copy, remove);
      tray.append(card);
    });
  }

  function acceptAttachmentFiles(files) {
    const incoming = Array.from(files || []);
    if (!incoming.length) return;
    if (state.attachmentFiles.length + incoming.length > MAX_ATTACHMENT_IMAGES) {
      attachmentError(`Add up to ${MAX_ATTACHMENT_IMAGES} photos at a time.`);
      return;
    }
    for (const file of incoming) {
      if (!SUPPORTED_ATTACHMENT_TYPES.has(String(file.type || '').toLowerCase())) {
        attachmentError('Photos must be JPEG, PNG, or WebP.');
        return;
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        attachmentError('Each photo must be 8 MB or smaller.');
        return;
      }
    }
    attachmentError('');
    state.attachmentFiles.push(...incoming);
    renderAttachmentTray();
  }

  function clearAttachmentFiles() {
    state.attachmentFiles = [];
    const input = document.querySelector('#work-attachments');
    if (input) input.value = '';
    renderAttachmentTray();
  }

  function installAttachmentComposer() {
    const composerMain = document.querySelector('.composer-main');
    if (!composerMain || document.querySelector('#work-attachments')) return;
    const controls = el('div', 'composer-input-tools');
    const add = el('button', 'composer-photo-button', 'Add photos');
    add.type = 'button';
    add.setAttribute('aria-label', 'Add photos to this Project update');
    const input = document.createElement('input');
    input.id = 'work-attachments';
    input.type = 'file';
    input.multiple = true;
    input.accept = 'image/jpeg,image/png,image/webp';
    input.hidden = true;
    input.addEventListener('change', () => {
      acceptAttachmentFiles(input.files);
      input.value = '';
    });
    add.addEventListener('click', () => input.click());
    controls.append(add, input);
    const tray = el('div', 'composer-attachment-tray');
    tray.id = 'work-attachment-tray';
    tray.setAttribute('aria-label', 'Photos attached to this update');
    tray.hidden = true;
    composerMain.append(controls, tray);
  }

  function isWorkCreateRequest(input, init = {}) {
    const method = String(init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (method !== 'POST') return false;
    const rawUrl = input instanceof Request ? input.url : String(input || '');
    try {
      return new URL(rawUrl, window.location.origin).pathname === '/api/company/works';
    } catch {
      return false;
    }
  }

  function multipartWorkBody(json) {
    const form = new FormData();
    for (const key of ['brief', 'repoDir', 'projectId', 'runtime', 'employeeId', 'model']) {
      const value = json[key];
      if (value != null && String(value).length) form.set(key, String(value));
    }
    for (const file of state.attachmentFiles) form.append('attachments', file, file.name || 'photo');
    return form;
  }

  async function waitForProjectCommit(runId) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      try {
        const response = await nativeFetch(`/api/company/runs/${encodeURIComponent(runId)}`, { cache: 'no-store' });
        if (response.ok) {
          const payload = await response.json();
          if (payload.run && payload.run.status === 'completed') {
            state.projectedRuns.delete(runId);
            window.dispatchEvent(new CustomEvent('lucubro:project-memory-refresh'));
            return;
          }
          if (payload.run && ['failed', 'cancelled'].includes(payload.run.status)) return;
        }
      } catch {
        // The normal stream owns execution recovery; this poll only refreshes the semantic Project projection.
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  function installWorkFetchBridge() {
    window.fetch = async (input, init = {}) => {
      if (!state.attachmentFiles.length || !isWorkCreateRequest(input, init) || typeof init.body !== 'string') {
        return nativeFetch(input, init);
      }
      let json;
      try { json = JSON.parse(init.body); }
      catch { return nativeFetch(input, init); }
      const headers = new Headers(init.headers || {});
      headers.delete('Content-Type');
      const response = await nativeFetch(input, { ...init, headers, body: multipartWorkBody(json) });
      if (response.ok) {
        const payload = await response.clone().json().catch(() => null);
        clearAttachmentFiles();
        if (payload && payload.run && payload.run.id) void waitForProjectCommit(payload.run.id);
      }
      return response;
    };
  }

  async function load() {
    let response;
    try {
      response = await nativeFetch('/api/company/bootstrap', { headers: { Accept: 'application/json' }, cache: 'no-store' });
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
  installAttachmentComposer();
  installWorkFetchBridge();
  observeWorkEvidence();
  load();

  window.addEventListener('pagehide', () => revokeAttachmentPreviews(), { once: true });
})();
