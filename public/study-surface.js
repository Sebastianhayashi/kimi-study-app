(() => {
  'use strict';
  if (window.__kimiStudySurfaceMounted) return;
  window.__kimiStudySurfaceMounted = true;
  const lessonFrame = document.getElementById('lessonFrame');
  const stage = document.querySelector('.course-stage');
  const courseMatch = location.pathname.match(/^\/course\/([^/]+)$/);
  if (!lessonFrame || !stage || !courseMatch) return;
  const courseId = courseMatch[1];

  const surface = document.createElement('section');
  surface.className = 'ks-study-surface';
  surface.hidden = true;
  surface.setAttribute('aria-label', '学习草稿');
  surface.innerHTML = `
    <header class="ks-study-head">
      <span class="ks-study-title">学习草稿</span>
      <div class="ks-study-head-actions">
        <button class="ks-study-control" type="button" data-action="pen" aria-label="画草稿" aria-pressed="false">✎</button>
        <button class="ks-study-control" type="button" data-action="undo" aria-label="撤销上一笔">↶</button>
        <button class="ks-study-control" type="button" data-action="expand" aria-label="展开学习草稿">⛶</button>
        <button class="ks-study-control" type="button" data-action="close" aria-label="收起学习草稿">×</button>
      </div>
    </header>
    <div class="ks-study-board">
      <canvas class="ks-study-canvas" aria-label="草稿绘图区"></canvas>
      <div class="ks-study-cards"></div>
      <div class="ks-study-quick-note"><textarea placeholder="写下推演、计算或一句自己的理解…"></textarea><button class="ks-study-add" type="button">记下</button></div>
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
  const context = canvas.getContext('2d');
  let state = { version: 1, cards: [], strokes: [], updatedAt: Date.now() };
  let lessonFile = '';
  let requestId = 0;
  let saveTimer = 0;
  let drawing = null;
  let penActive = false;

  function fileFromFrame() {
    try {
      const url = new URL(lessonFrame.src, location.href);
      const parts = url.pathname.split('/');
      return decodeURIComponent(parts[parts.length - 1] || '');
    } catch { return ''; }
  }

  function endpoint() {
    return `/api/courses/${courseId}/study-surface?lesson=${encodeURIComponent(lessonFile)}`;
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
      textarea.value = card.body || '';
      textarea.placeholder = '写下你的推演或理解…';
      textarea.addEventListener('input', () => {
        card.body = textarea.value;
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
      Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width))),
      Math.max(0, Math.min(1, (event.clientY - rect.top) / Math.max(1, rect.height))),
    ];
  }

  function setPen(active) {
    penActive = active;
    canvas.classList.toggle('is-drawing', active);
    penButton.setAttribute('aria-pressed', String(active));
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (!penActive) return;
    drawing = { id: `stroke-${Date.now().toString(36)}`, points: [point(event)] };
    state.strokes.push(drawing);
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!drawing) return;
    drawing.points.push(point(event));
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

  function scheduleSave() {
    state.updatedAt = Date.now();
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(save, 240);
  }

  async function save() {
    if (!lessonFile) return;
    try {
      await fetch(endpoint(), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state),
      });
    } catch {}
  }

  async function load() {
    const id = ++requestId;
    lessonFile = fileFromFrame();
    state = { version: 1, cards: [], strokes: [], updatedAt: Date.now() };
    closeSurface();
    renderCards();
    if (!lessonFile) return;
    try {
      const response = await fetch(endpoint());
      const data = response.ok ? await response.json() : null;
      if (id !== requestId || !data) return;
      state = data;
      if (!Array.isArray(state.cards)) state.cards = [];
      if (!Array.isArray(state.strokes)) state.strokes = [];
      renderCards();
      redraw();
    } catch {}
  }

  surface.querySelector('[data-action="close"]').addEventListener('click', closeSurface);
  surface.querySelector('[data-action="expand"]').addEventListener('click', () => {
    surface.classList.toggle('is-expanded');
    surface.querySelector('[data-action="expand"]').setAttribute('aria-label', surface.classList.contains('is-expanded') ? '缩小学习草稿' : '展开学习草稿');
    requestAnimationFrame(fitCanvas);
  });
  penButton.addEventListener('click', () => setPen(!penActive));
  surface.querySelector('[data-action="undo"]').addEventListener('click', () => {
    state.strokes.pop();
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
  new ResizeObserver(() => { if (!surface.hidden) fitCanvas(); }).observe(board);
})();
