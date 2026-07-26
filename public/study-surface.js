(() => {
  'use strict';
  if (window.__kimiStudySurfaceMounted) return;
  window.__kimiStudySurfaceMounted = true;
  const lessonFrame = document.getElementById('lessonFrame');
  const stage = document.querySelector('.course-stage');
  const courseMatch = location.pathname.match(/^\/course\/([^/]+)$/);
  if (!lessonFrame || !stage || !courseMatch) return;
  const courseId = courseMatch[1];

  const MAX_STUDY_SURFACE_BYTES = 900_000;
  const MAX_CARDS = 80;
  const MAX_STROKES = 300;
  const MAX_POINTS_PER_STROKE = 1200;
  const MAX_TOTAL_POINTS = 12_000;
  const MIN_POINT_DISTANCE_SQUARED = 0.00000225;

  const surface = document.createElement('section');
  surface.className = 'ks-study-surface';
  surface.hidden = true;
  surface.setAttribute('aria-label', '学习草稿');
  surface.innerHTML = `
    <header class="ks-study-head">
      <span class="ks-study-title">学习草稿</span>
      <span class="ks-study-save-status" role="status" aria-live="polite" hidden></span>
      <div class="ks-study-head-actions">
        <button class="ks-study-control" type="button" data-action="retry-save" aria-label="重试保存学习草稿" title="重试保存" hidden>重试</button>
        <button class="ks-study-control" type="button" data-action="pen" aria-label="画草稿" aria-pressed="false">✎</button>
        <button class="ks-study-control" type="button" data-action="undo" aria-label="撤销上一笔">↶</button>
        <button class="ks-study-control" type="button" data-action="expand" aria-label="展开学习草稿">⛶</button>
        <button class="ks-study-control" type="button" data-action="close" aria-label="收起学习草稿">×</button>
      </div>
    </header>
    <div class="ks-study-board">
      <canvas class="ks-study-canvas" aria-label="草稿绘图区"></canvas>
      <div class="ks-study-cards"></div>
      <div class="ks-study-quick-note"><textarea maxlength="5000" placeholder="写下推演、计算或一句自己的理解…"></textarea><button class="ks-study-add" type="button">记下</button></div>
    </div>`;
  const reopen = document.createElement('button');
  reopen.type = 'button';
  reopen.className = 'ks-study-reopen';
  reopen.hidden = true;
  stage.append(surface, reopen);

  const board = surface.querySelector('.ks-study-board');
  const canvas = surface.querySelector('.ks-study-canvas');
  const cardsNode = surface.querySelector('.ks-study-cards');
  const quickInput = surface.querySelector('textarea');
  const penButton = surface.querySelector('[data-action="pen"]');
  const retryButton = surface.querySelector('[data-action="retry-save"]');
  const saveStatus = surface.querySelector('.ks-study-save-status');
  const context = canvas.getContext('2d');
  let state = emptyState();
  let lessonFile = '';
  let requestId = 0;
  let saveTimer = 0;
  let statusTimer = 0;
  let pendingSave = null;
  let failedSave = null;
  let drawing = null;
  let penActive = false;
  let totalPoints = 0;
  const latestRevisionByLesson = new Map();
  const saveQueues = new Map();

  function emptyState() {
    return { version: 1, cards: [], strokes: [], updatedAt: Date.now() };
  }

  function fileFromFrame() {
    try {
      const url = new URL(lessonFrame.src, location.href);
      const parts = url.pathname.split('/');
      return decodeURIComponent(parts[parts.length - 1] || '');
    } catch { return ''; }
  }

  function endpointFor(file) {
    return `/api/courses/${courseId}/study-surface?lesson=${encodeURIComponent(file)}`;
  }

  function byteLength(text) {
    if (window.TextEncoder) return new TextEncoder().encode(text).length;
    return new Blob([text]).size;
  }

  function roundCoordinate(value) {
    return Math.round(value * 10_000) / 10_000;
  }

  function compactPoint(value) {
    if (!Array.isArray(value)) return null;
    const x = Number(value[0]);
    const y = Number(value[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return [
      roundCoordinate(Math.max(0, Math.min(1, x))),
      roundCoordinate(Math.max(0, Math.min(1, y))),
    ];
  }

  function snapshotState(value) {
    const source = value && typeof value === 'object' ? value : emptyState();
    const cards = (Array.isArray(source.cards) ? source.cards : []).slice(0, MAX_CARDS).map((card, index) => ({
      id: String(card?.id || `card-${index + 1}`).slice(0, 100),
      kind: ['quote', 'note', 'curiosity'].includes(card?.kind) ? card.kind : 'note',
      quote: String(card?.quote || '').trim().slice(0, 1200),
      section: String(card?.section || '').trim().slice(0, 300),
      body: String(card?.body || '').trim().slice(0, 5000),
      createdAt: Number.isFinite(Number(card?.createdAt)) ? Number(card.createdAt) : Date.now(),
    }));
    let remainingPoints = MAX_TOTAL_POINTS;
    const strokes = [];
    for (const stroke of (Array.isArray(source.strokes) ? source.strokes : []).slice(0, MAX_STROKES)) {
      if (remainingPoints <= 1) break;
      const points = (Array.isArray(stroke?.points) ? stroke.points : [])
        .slice(0, Math.min(MAX_POINTS_PER_STROKE, remainingPoints))
        .map(compactPoint)
        .filter(Boolean);
      remainingPoints -= points.length;
      if (points.length > 1) strokes.push({ id: String(stroke?.id || '').slice(0, 100), points });
    }
    return {
      version: 1,
      cards,
      strokes,
      updatedAt: Number.isFinite(Number(source.updatedAt)) ? Number(source.updatedAt) : Date.now(),
    };
  }

  function setSaveStatus(message = '', { error = false, sticky = false, retry = error } = {}) {
    window.clearTimeout(statusTimer);
    statusTimer = 0;
    saveStatus.hidden = !message;
    saveStatus.textContent = message;
    saveStatus.dataset.state = error ? 'error' : message ? 'info' : '';
    retryButton.hidden = !retry;
    if (message && !sticky && !error) {
      statusTimer = window.setTimeout(() => {
        saveStatus.hidden = true;
        saveStatus.textContent = '';
      }, 1400);
    }
  }

  function updateReopen() {
    const count = state.cards.length;
    reopen.textContent = count ? `草稿 ${count}` : '草稿';
    reopen.hidden = !lessonFile || (!count && !state.strokes.length) || !surface.hidden;
  }

  function renderCards() {
    cardsNode.replaceChildren();
    state.cards.forEach((card) => {
      const article = document.createElement('article');
      article.className = 'ks-study-card';
      const head = document.createElement('div');
      head.className = 'ks-study-card-head';
      const kind = document.createElement('span');
      kind.className = 'ks-study-card-kind';
      kind.textContent = card.kind === 'curiosity' ? 'Curiosity' : card.kind === 'quote' ? '原文' : '草稿';
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'ks-study-card-remove';
      remove.setAttribute('aria-label', '删除这张草稿卡');
      remove.textContent = '×';
      remove.addEventListener('click', () => {
        state.cards = state.cards.filter((item) => item.id !== card.id);
        renderCards();
        scheduleSave();
      });
      head.append(kind, remove);
      article.appendChild(head);
      if (card.quote) {
        const quote = document.createElement('div');
        quote.className = 'ks-study-card-quote';
        quote.textContent = `${card.section ? `${card.section} · ` : ''}${card.quote}`;
        article.appendChild(quote);
      }
      const textarea = document.createElement('textarea');
      textarea.className = 'ks-study-card-body';
      textarea.maxLength = 5000;
      textarea.value = card.body || '';
      textarea.placeholder = '写下你的推演或理解…';
      textarea.addEventListener('input', () => {
        card.body = textarea.value.slice(0, 5000);
        scheduleSave();
      });
      article.appendChild(textarea);
      cardsNode.appendChild(article);
    });
    updateReopen();
  }

  function fitCanvas() {
    const rect = board.getBoundingClientRect();
    const ratio = Math.max(1, Math.min(2, devicePixelRatio || 1));
    canvas.width = Math.max(1, Math.round(rect.width * ratio));
    canvas.height = Math.max(1, Math.round(rect.height * ratio));
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    redraw();
  }

  function redraw() {
    const rect = board.getBoundingClientRect();
    context.clearRect(0, 0, rect.width, rect.height);
    context.lineWidth = 2.2;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = '#315786';
    for (const stroke of state.strokes) {
      if (!stroke.points?.length) continue;
      context.beginPath();
      stroke.points.forEach(([x, y], index) => {
        const px = x * rect.width;
        const py = y * rect.height;
        if (index === 0) context.moveTo(px, py); else context.lineTo(px, py);
      });
      context.stroke();
    }
  }

  function point(event) {
    const rect = canvas.getBoundingClientRect();
    return [
      roundCoordinate(Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width)))),
      roundCoordinate(Math.max(0, Math.min(1, (event.clientY - rect.top) / Math.max(1, rect.height)))),
    ];
  }

  function pointCount(value = state) {
    return (Array.isArray(value?.strokes) ? value.strokes : []).reduce(
      (sum, stroke) => sum + (Array.isArray(stroke?.points) ? stroke.points.length : 0),
      0,
    );
  }

  function setPen(active) {
    penActive = active;
    canvas.classList.toggle('is-drawing', active);
    penButton.setAttribute('aria-pressed', String(active));
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (!penActive) return;
    if (state.strokes.length >= MAX_STROKES || totalPoints >= MAX_TOTAL_POINTS) {
      setSaveStatus('绘图容量已满，请撤销部分笔画后继续。', { error: true, sticky: true, retry: false });
      return;
    }
    drawing = { id: `stroke-${Date.now().toString(36)}`, points: [point(event)] };
    state.strokes.push(drawing);
    totalPoints += 1;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!drawing) return;
    const next = point(event);
    const previous = drawing.points[drawing.points.length - 1];
    const dx = next[0] - previous[0];
    const dy = next[1] - previous[1];
    if ((dx * dx) + (dy * dy) < MIN_POINT_DISTANCE_SQUARED) return;
    if (drawing.points.length >= MAX_POINTS_PER_STROKE || totalPoints >= MAX_TOTAL_POINTS) {
      drawing = null;
      scheduleSave();
      setSaveStatus('绘图容量已满，当前内容会保留。', { error: true, sticky: true, retry: false });
      return;
    }
    drawing.points.push(next);
    totalPoints += 1;
    redraw();
  });
  const stopDrawing = () => {
    if (!drawing) return;
    drawing = null;
    scheduleSave();
  };
  canvas.addEventListener('pointerup', stopDrawing);
  canvas.addEventListener('pointercancel', stopDrawing);

  function openSurface({ expand = false } = {}) {
    surface.hidden = false;
    reopen.hidden = true;
    surface.classList.toggle('is-expanded', expand || surface.classList.contains('is-expanded'));
    requestAnimationFrame(fitCanvas);
  }

  function closeSurface() {
    surface.hidden = true;
    setPen(false);
    updateReopen();
  }

  function addCard(payload) {
    if (state.cards.length >= MAX_CARDS) {
      openSurface();
      setSaveStatus('草稿卡片已达到上限，请删除不再需要的卡片。', { error: true, sticky: true, retry: false });
      return;
    }
    const source = payload && typeof payload === 'object' ? payload : {};
    state.cards.push({
      id: `card-${Date.now().toString(36)}-${state.cards.length}`,
      kind: source.kind === 'curiosity' ? 'curiosity' : source.kind === 'note' ? 'note' : 'quote',
      quote: String(source.quote || source.selectedText || '').slice(0, 1200),
      section: String(source.section || '').slice(0, 300),
      body: String(source.body || '').slice(0, 5000),
      createdAt: Date.now(),
    });
    renderCards();
    openSurface();
    scheduleSave();
  }

  function createSaveJob() {
    if (!lessonFile) return null;
    state.updatedAt = Date.now();
    const file = lessonFile;
    const revision = (latestRevisionByLesson.get(file) || 0) + 1;
    latestRevisionByLesson.set(file, revision);
    return { lessonFile: file, state: snapshotState(state), revision };
  }

  function scheduleSave() {
    const job = createSaveJob();
    if (!job) return;
    pendingSave = job;
    if (failedSave?.lessonFile === job.lessonFile && failedSave.revision < job.revision) failedSave = null;
    retryButton.hidden = true;
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => { void flushPendingSave(); }, 240);
  }

  async function persistSave(job) {
    const payload = JSON.stringify(job.state);
    const bytes = byteLength(payload);
    if (bytes > MAX_STUDY_SURFACE_BYTES) {
      if (job.revision === latestRevisionByLesson.get(job.lessonFile)) {
        failedSave = job;
        if (job.lessonFile === lessonFile) {
          setSaveStatus('草稿过大，未保存。请删除部分卡片或笔画后重试。', { error: true, sticky: true });
        }
      }
      return false;
    }

    if (job.lessonFile === lessonFile && job.revision === latestRevisionByLesson.get(job.lessonFile)) {
      setSaveStatus('保存中…', { sticky: true });
    }
    try {
      const response = await fetch(endpointFor(job.lessonFile), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${response.status}`);
      }
      if (failedSave?.lessonFile === job.lessonFile && failedSave.revision <= job.revision) failedSave = null;
      if (job.lessonFile === lessonFile && job.revision === latestRevisionByLesson.get(job.lessonFile)) {
        setSaveStatus('已保存');
      }
      return true;
    } catch (error) {
      if (job.revision === latestRevisionByLesson.get(job.lessonFile)) {
        failedSave = job;
        if (job.lessonFile === lessonFile) {
          setSaveStatus('保存失败，内容仍在本页。', { error: true, sticky: true });
          retryButton.title = String(error?.message || '重试保存').slice(0, 180);
        }
      }
      return false;
    }
  }

  function enqueueSave(job) {
    if (!job) return Promise.resolve(false);
    const previous = saveQueues.get(job.lessonFile) || Promise.resolve();
    const queued = previous.then(() => persistSave(job), () => persistSave(job));
    saveQueues.set(job.lessonFile, queued);
    void queued.finally(() => {
      if (saveQueues.get(job.lessonFile) === queued) saveQueues.delete(job.lessonFile);
    });
    return queued;
  }

  function flushPendingSave() {
    window.clearTimeout(saveTimer);
    saveTimer = 0;
    const job = pendingSave;
    pendingSave = null;
    return enqueueSave(job);
  }

  async function load() {
    // Flush the old lesson before changing mutable lessonFile/state. The queued
    // save owns an immutable lesson id and state snapshot, so it cannot write
    // an old lesson's debounce into the newly selected lesson.
    void flushPendingSave();
    const id = ++requestId;
    lessonFile = fileFromFrame();
    state = emptyState();
    totalPoints = 0;
    closeSurface();
    renderCards();
    setSaveStatus();
    if (!lessonFile) return;

    // A fast return to a lesson must not read stale server state while that
    // lesson's ordered save queue is still draining.
    const inFlight = saveQueues.get(lessonFile);
    if (inFlight) await inFlight;
    if (id !== requestId) return;

    // Preserve the last-known-good in-memory snapshot after a failed save. A
    // server GET must not replace unsaved learner work with an older copy.
    if (failedSave?.lessonFile === lessonFile) {
      state = snapshotState(failedSave.state);
      totalPoints = pointCount(state);
      renderCards();
      redraw();
      setSaveStatus('这节课的草稿尚未保存。', { error: true, sticky: true });
      return;
    }

    try {
      const response = await fetch(endpointFor(lessonFile));
      const data = response.ok ? await response.json() : null;
      if (id !== requestId || !data) return;
      state = snapshotState(data);
      totalPoints = pointCount(state);
      renderCards();
      redraw();
    } catch {
      if (id === requestId) setSaveStatus('草稿暂时没有加载成功。', { error: true, sticky: true, retry: false });
    }
  }

  surface.querySelector('[data-action="close"]').addEventListener('click', closeSurface);
  surface.querySelector('[data-action="expand"]').addEventListener('click', () => {
    surface.classList.toggle('is-expanded');
    surface.querySelector('[data-action="expand"]').setAttribute('aria-label', surface.classList.contains('is-expanded') ? '收起学习草稿' : '展开学习草稿');
    requestAnimationFrame(fitCanvas);
  });
  retryButton.addEventListener('click', () => {
    if (!failedSave) return;
    retryButton.hidden = true;
    void enqueueSave(failedSave);
  });
  penButton.addEventListener('click', () => setPen(!penActive));
  surface.querySelector('[data-action="undo"]').addEventListener('click', () => {
    const removed = state.strokes.pop();
    totalPoints = Math.max(0, totalPoints - (Array.isArray(removed?.points) ? removed.points.length : 0));
    redraw();
    scheduleSave();
  });
  surface.querySelector('.ks-study-add').addEventListener('click', () => {
    const body = quickInput.value.trim();
    if (!body) return quickInput.focus();
    addCard({ kind: 'note', body });
    quickInput.value = '';
  });
  reopen.addEventListener('click', () => openSurface());
  lessonFrame.addEventListener('load', () => window.setTimeout(load, 80));
  window.addEventListener('message', (event) => {
    if (event.source !== lessonFrame.contentWindow || !event.data) return;
    if (event.data.type === 'study-surface-add') addCard(event.data);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushPendingSave();
  });
  window.addEventListener('pagehide', () => { void flushPendingSave(); });
  new ResizeObserver(() => { if (!surface.hidden) fitCanvas(); }).observe(board);
})();
