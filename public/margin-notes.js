(() => {
  'use strict';

  const Core = window.KimiMarginNotesCore;
  if (!Core) throw new Error('KimiMarginNotesCore is required');

  const CARD_GAP = 10;
  const CARD_WIDTH = 272;
  const TEXT_CONTEXT = 48;
  const COPY = {
    en: {
      note: 'Note',
      lucubroNote: 'Lucubro note',
      myNote: 'My note',
      currentLesson: 'Current lesson',
      close: 'Close',
      question: 'Question',
      emptyBody: 'This note has no content yet.',
      backToText: 'Show in lesson',
      edit: 'Edit',
      remove: 'Delete',
      cancel: 'Cancel',
      save: 'Save',
      lessonNotes: 'Lesson notes',
      noteCount: (count) => `${count} ${count === 1 ? 'note' : 'notes'}`,
      collapse: 'Close notes',
      expand: 'Open notes',
      orphan: 'The lesson changed, so this note is no longer linked to an exact passage.',
      writeBy: (section) => section ? `Note on “${section}”` : 'Add a note',
      placeholder: 'Write what you understood, questioned, or want to use…',
      ask: 'Ask Lucubro',
      add: 'Add note',
      deleteConfirm: 'Delete this note?',
      open: 'Open note',
      sourceQuote: 'From the lesson',
      empty: 'Select a passage in the lesson to add your first note.',
    },
    'zh-CN': {
      note: '笔记',
      lucubroNote: 'Lucubro 笔记',
      myNote: '我的笔记',
      currentLesson: '当前课节',
      close: '关闭',
      question: '问题',
      emptyBody: '这条笔记还没有内容。',
      backToText: '回到原文',
      edit: '编辑',
      remove: '删除',
      cancel: '取消',
      save: '保存',
      lessonNotes: '本课笔记',
      noteCount: (count) => `${count} 条笔记`,
      collapse: '关闭笔记',
      expand: '打开笔记',
      orphan: '课节内容发生了变化，这条笔记暂时无法定位到原文。',
      writeBy: (section) => section ? `为「${section}」添加笔记` : '添加笔记',
      placeholder: '写下你的理解、疑问，或准备实际使用的内容…',
      ask: '问 Lucubro',
      add: '添加笔记',
      deleteConfirm: '删除这条笔记？',
      open: '查看笔记',
      sourceQuote: '原文摘录',
      empty: '选择课节中的一段文字，开始记录第一条笔记。',
    },
    ja: {
      note: 'ノート',
      lucubroNote: 'Lucubroノート',
      myNote: 'マイノート',
      currentLesson: '現在のレッスン',
      close: '閉じる',
      question: '質問',
      emptyBody: 'このノートにはまだ内容がありません。',
      backToText: '本文で表示',
      edit: '編集',
      remove: '削除',
      cancel: 'キャンセル',
      save: '保存',
      lessonNotes: 'レッスンノート',
      noteCount: (count) => `${count}件のノート`,
      collapse: 'ノートを閉じる',
      expand: 'ノートを開く',
      orphan: 'レッスンが更新されたため、元の箇所に正確に移動できません。',
      writeBy: (section) => section ? `「${section}」のノート` : 'ノートを追加',
      placeholder: '理解したこと、疑問、実際に使いたいことを書きます…',
      ask: 'Lucubroに質問',
      add: 'ノートを追加',
      deleteConfirm: 'このノートを削除しますか？',
      open: 'ノートを開く',
      sourceQuote: 'レッスンから',
      empty: 'レッスンの文章を選択して、最初のノートを追加しましょう。',
    },
  };

  function currentLocale() {
    const saved = localStorage.getItem('lucubro-locale');
    return saved === 'zh-CN' || saved === 'ja' ? saved : 'en';
  }

  function t(key, ...args) {
    const value = COPY[currentLocale()]?.[key] ?? COPY.en[key] ?? key;
    return typeof value === 'function' ? value(...args) : value;
  }

  class TextIndex {
    constructor(root) {
      this.root = root;
      this.text = '';
      this.nodes = [];
      this.offsets = new Map();
      this.rebuild();
    }

    isIgnored(node) {
      const parent = node.parentElement;
      return !parent || !!parent.closest('script, style, noscript, template, .kn-ui, [aria-hidden="true"]');
    }

    rebuild() {
      this.text = '';
      this.nodes = [];
      this.offsets.clear();
      const walker = document.createTreeWalker(this.root, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => this.isIgnored(node) || !node.nodeValue
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT,
      });
      let node;
      while ((node = walker.nextNode())) {
        const start = this.text.length;
        this.nodes.push({ node, start, end: start + node.nodeValue.length });
        this.offsets.set(node, start);
        this.text += node.nodeValue;
      }
    }

    positionFromBoundary(node, offset) {
      if (node.nodeType === Node.TEXT_NODE && this.offsets.has(node)) {
        return this.offsets.get(node) + offset;
      }
      const range = document.createRange();
      range.selectNodeContents(this.root);
      range.setEnd(node, offset);
      return range.toString().length;
    }

    anchorFromRange(range) {
      this.rebuild();
      const exact = range.toString();
      const start = this.positionFromBoundary(range.startContainer, range.startOffset);
      const end = start + exact.length;
      return {
        textQuote: {
          exact,
          prefix: this.text.slice(Math.max(0, start - TEXT_CONTEXT), start),
          suffix: this.text.slice(end, end + TEXT_CONTEXT),
        },
        textPosition: { start, end },
      };
    }

    boundaryAt(position) {
      if (!this.nodes.length) return null;
      const target = Core.clamp(position, 0, this.text.length);
      for (const item of this.nodes) {
        if (target >= item.start && target <= item.end) {
          return { node: item.node, offset: target - item.start };
        }
      }
      const last = this.nodes[this.nodes.length - 1];
      return { node: last.node, offset: last.node.nodeValue.length };
    }

    rangeFromAnchor(anchor) {
      this.rebuild();
      const match = Core.findBestQuoteOffset(this.text, anchor);
      if (!match) return null;
      const start = this.boundaryAt(match.start);
      const end = this.boundaryAt(match.end);
      if (!start || !end) return null;
      const range = document.createRange();
      try {
        range.setStart(start.node, start.offset);
        range.setEnd(end.node, end.offset);
        return range;
      } catch {
        return null;
      }
    }
  }

  class HighlightManager {
    constructor() {
      this.supported = !!(window.CSS?.highlights && window.Highlight);
      this.ranges = new Map();
      if (this.supported) {
        this.base = new Highlight();
        this.active = new Highlight();
        this.flash = new Highlight();
        CSS.highlights.set('kimi-note', this.base);
        CSS.highlights.set('kimi-note-active', this.active);
        CSS.highlights.set('kimi-note-flash', this.flash);
      }
    }

    set(id, range) {
      this.delete(id);
      this.ranges.set(id, range);
      if (this.supported) this.base.add(range);
    }

    delete(id) {
      const range = this.ranges.get(id);
      if (range && this.supported) {
        this.base.delete(range);
        this.active.delete(range);
        this.flash.delete(range);
      }
      this.ranges.delete(id);
    }

    get(id) {
      return this.ranges.get(id) || null;
    }

    activate(id, on) {
      if (!this.supported) return;
      const range = this.get(id);
      if (!range) return;
      if (on) this.active.add(range);
      else this.active.delete(range);
    }

    flashRange(range) {
      if (!range) return;
      range.startContainer.parentElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (!this.supported) return;
      this.flash.add(range);
      window.setTimeout(() => this.flash.delete(range), 1100);
    }

    destroy() {
      if (!this.supported) return;
      CSS.highlights.delete('kimi-note');
      CSS.highlights.delete('kimi-note-active');
      CSS.highlights.delete('kimi-note-flash');
    }
  }

  class AnnotationStore {
    constructor(courseId, lessonFile) {
      this.courseId = courseId;
      this.lessonFile = lessonFile;
      this.notes = [];
      this.timer = 0;
      this.saving = false;
      this.dirty = false;
    }

    endpoint() {
      return `/api/courses/${this.courseId}/notes?lesson=${encodeURIComponent(this.lessonFile)}`;
    }

    async load(acceptLegacy = () => false) {
      const response = await fetch(this.endpoint());
      const raw = response.ok ? await response.json() : [];
      let migrated = false;
      this.notes = (Array.isArray(raw) ? raw.map(Core.normalizeNote) : []).filter((note) => {
        if (note.lessonFile === this.lessonFile) return true;
        if (!note.lessonFile && acceptLegacy(note)) {
          note.lessonFile = this.lessonFile;
          migrated = true;
          return true;
        }
        return false;
      });
      if (migrated) this.schedule();
      return this.notes;
    }

    add(note) {
      this.notes.push(note);
      this.schedule();
    }

    update(id, patch) {
      const note = this.notes.find((item) => item.id === id);
      if (!note) return null;
      Object.assign(note, patch, { updatedAt: Date.now() });
      this.schedule();
      return note;
    }

    remove(id) {
      const index = this.notes.findIndex((item) => item.id === id);
      if (index < 0) return false;
      this.notes.splice(index, 1);
      this.schedule();
      return true;
    }

    schedule() {
      this.dirty = true;
      window.clearTimeout(this.timer);
      this.timer = window.setTimeout(() => this.flush(), 180);
    }

    async flush() {
      if (!this.dirty || this.saving) return;
      this.saving = true;
      this.dirty = false;
      try {
        const response = await fetch(this.endpoint(), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.notes.map(Core.serializeNote)),
        });
        if (response.ok) parent.postMessage({ type: 'notes-changed' }, '*');
      } finally {
        this.saving = false;
        if (this.dirty) this.schedule();
      }
    }

    destroy() {
      window.clearTimeout(this.timer);
      void this.flush();
    }
  }

  class DetailDrawer {
    constructor(controller) {
      this.controller = controller;
      this.note = null;
      this.el = document.createElement('div');
      this.el.className = 'kn-ui kn-detail-backdrop';
      this.el.innerHTML = `
        <section class="kn-detail" role="dialog" aria-modal="false" aria-labelledby="kn-detail-title">
          <header class="kn-detail-head">
            <div>
              <span class="kn-detail-eyebrow"></span>
              <h2 class="kn-detail-title" id="kn-detail-title"></h2>
            </div>
            <button class="kn-detail-close" type="button">×</button>
          </header>
          <div class="kn-detail-content"></div>
          <footer class="kn-detail-actions"></footer>
        </section>`;
      controller.layout.panel.appendChild(this.el);
      this.content = this.el.querySelector('.kn-detail-content');
      this.actions = this.el.querySelector('.kn-detail-actions');
      const closeButton = this.el.querySelector('.kn-detail-close');
      closeButton.setAttribute('aria-label', t('close'));
      closeButton.addEventListener('click', () => this.close());
      this.el.addEventListener('mousedown', (event) => {
        if (event.target === this.el) this.close();
      });
      this.onKeyDown = (event) => {
        if (event.key === 'Escape' && this.el.classList.contains('is-open')) this.close();
      };
      document.addEventListener('keydown', this.onKeyDown);
    }

    open(note, edit = false) {
      this.note = note;
      this.el.classList.add('is-open');
      this.render(edit);
    }

    render(edit) {
      const note = this.note;
      if (!note) return;
      this.content.replaceChildren();
      this.actions.replaceChildren();
      this.el.querySelector('.kn-detail-eyebrow').textContent = note.section || t('currentLesson');
      this.el.querySelector('.kn-detail-title').textContent = note.kind === 'assistant' ? t('lucubroNote') : t('myNote');

      const exact = note.anchor?.textQuote?.exact;
      if (exact) {
        const quote = document.createElement('figure');
        quote.className = 'kn-detail-quote';
        const label = document.createElement('figcaption');
        label.textContent = t('sourceQuote');
        const body = document.createElement('blockquote');
        body.textContent = exact;
        quote.append(label, body);
        this.content.appendChild(quote);
      }

      if (note.question) {
        const question = document.createElement('div');
        question.className = 'kn-detail-question';
        const label = document.createElement('span');
        label.textContent = t('question');
        const body = document.createElement('p');
        body.textContent = note.question;
        question.append(label, body);
        this.content.append(question);
      }

      const currentText = note.custom || note.answer || '';
      if (edit) {
        const textarea = document.createElement('textarea');
        textarea.value = currentText;
        textarea.setAttribute('aria-label', t('note'));
        this.content.appendChild(textarea);
        const cancel = this.button(t('cancel'), 'kn-secondary-button', () => this.render(false));
        const save = this.button(t('save'), 'kn-primary-button', () => {
          this.controller.updateNote(note.id, { custom: textarea.value.trim() });
          this.render(false);
        });
        this.actions.append(cancel, save);
        window.setTimeout(() => textarea.focus(), 0);
      } else {
        const body = document.createElement('div');
        body.className = 'kn-detail-body';
        body.textContent = currentText || t('emptyBody');
        this.content.appendChild(body);
        const jump = this.button(t('backToText'), 'kn-secondary-button', () => {
          this.close();
          this.controller.jumpTo(note.id);
        });
        const editButton = this.button(t('edit'), 'kn-secondary-button', () => this.render(true));
        const remove = this.button(t('remove'), 'kn-danger-button', () => this.controller.deleteNote(note.id));
        this.actions.append(jump, editButton, remove);
      }
    }

    button(text, className, handler) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = className;
      button.textContent = text;
      button.addEventListener('click', handler);
      return button;
    }

    close() {
      this.note = null;
      this.el.classList.remove('is-open');
    }

    destroy() {
      document.removeEventListener('keydown', this.onKeyDown);
      this.el.remove();
    }
  }

  class NoteCard {
    constructor(note, controller) {
      this.note = note;
      this.controller = controller;
      this.el = document.createElement('article');
      this.el.className = 'kn-ui kn-card';
      this.el.dataset.noteId = note.id;
      this.el.addEventListener('mouseenter', () => this.controller.setActive(note.id, true));
      this.el.addEventListener('mouseleave', () => this.controller.setActive(note.id, false));
      this.el.addEventListener('click', (event) => {
        if (!event.target.closest('button')) this.controller.openDetail(note.id);
      });
      this.el.addEventListener('keydown', (event) => {
        if ((event.key === 'Enter' || event.key === ' ') && !event.target.closest('button')) {
          event.preventDefault();
          this.controller.openDetail(note.id);
        }
      });
      this.render();
    }

    update(note) {
      this.note = note;
      this.render();
    }

    setOrphan(orphan) {
      this.el.classList.toggle('is-orphan', orphan);
    }

    setSideAvailable(available) {
      this.el.dataset.marginAvailable = String(available);
    }

    render() {
      const note = this.note;
      this.el.replaceChildren();
      this.el.tabIndex = 0;
      this.el.setAttribute('role', 'button');
      this.el.setAttribute('aria-label', t('open'));

      const head = document.createElement('header');
      head.className = 'kn-card-head';
      const meta = document.createElement('div');
      meta.className = 'kn-card-meta';
      const kind = document.createElement('span');
      kind.className = 'kn-card-kind';
      kind.textContent = note.kind === 'assistant' ? t('lucubroNote') : t('myNote');
      const section = document.createElement('span');
      section.className = 'kn-card-section';
      section.textContent = note.section || t('currentLesson');
      meta.append(kind, section);
      const anchor = document.createElement('button');
      anchor.type = 'button';
      anchor.className = 'kn-card-anchor';
      anchor.title = t('backToText');
      anchor.setAttribute('aria-label', t('backToText'));
      anchor.innerHTML = '<span aria-hidden="true">↗</span>';
      anchor.addEventListener('click', (event) => {
        event.stopPropagation();
        this.controller.jumpTo(note.id);
      });
      head.append(meta, anchor);
      this.el.appendChild(head);

      if (!this.controller.rangeFor(note.id)) {
        const orphan = document.createElement('div');
        orphan.className = 'kn-card-orphan';
        orphan.textContent = t('orphan');
        this.el.appendChild(orphan);
      }

      const clip = document.createElement('div');
      clip.className = 'kn-card-clip';
      const exact = note.anchor?.textQuote?.exact;
      if (exact) {
        const quote = document.createElement('div');
        quote.className = 'kn-card-quote';
        quote.textContent = exact;
        clip.appendChild(quote);
      }
      if (note.question) {
        const question = document.createElement('p');
        question.className = 'kn-card-question';
        question.textContent = note.question;
        clip.appendChild(question);
      }

      const body = document.createElement('div');
      body.className = 'kn-card-body';
      const text = note.custom || note.answer || '';
      body.textContent = text || t('emptyBody');
      body.classList.toggle('is-empty', !text);
      clip.appendChild(body);
      this.el.appendChild(clip);

      const foot = document.createElement('footer');
      foot.className = 'kn-card-foot';
      const more = document.createElement('button');
      more.type = 'button';
      more.className = 'kn-text-button';
      more.textContent = t('open');
      more.addEventListener('click', (event) => {
        event.stopPropagation();
        this.controller.openDetail(note.id);
      });
      const date = document.createElement('time');
      date.className = 'kn-card-date';
      date.dateTime = new Date(note.updatedAt || note.createdAt || Date.now()).toISOString();
      date.textContent = new Intl.DateTimeFormat(currentLocale(), {
        month: 'short',
        day: 'numeric',
      }).format(new Date(note.updatedAt || note.createdAt || Date.now()));
      foot.append(more, date);
      this.el.appendChild(foot);
    }

    destroy() {
      this.el.remove();
    }
  }

  class MarginLayout {
    constructor(controller, content) {
      this.controller = controller;
      this.content = content;
      this.mode = 'drawer';
      this.raf = 0;
      this.reservationActive = false;
      this.basePaddingInlineEnd = '';
      this.layer = document.createElement('div');
      this.layer.className = 'kn-ui kn-margin-layer';
      document.body.appendChild(this.layer);

      this.storageKey = `lucubro-notes-panel:${controller.courseId}:${location.pathname}`;
      let stored = {};
      try { stored = JSON.parse(localStorage.getItem(this.storageKey) || '{}'); } catch {}
      this.autoMode = typeof stored.userCollapsed !== 'boolean';
      this.collapsed = this.autoMode ? true : stored.userCollapsed;
      if (this.collapsed) this.layer.classList.add('kn-panel-collapsed');

      this.panel = document.createElement('aside');
      this.panel.className = 'kn-notes-panel';
      this.panel.setAttribute('aria-label', t('lessonNotes'));
      this.panel.innerHTML = `
        <header class="kn-panel-head">
          <div>
            <span class="kn-panel-eyebrow">${t('currentLesson')}</span>
            <h2>${t('lessonNotes')}</h2>
          </div>
          <button class="kn-panel-close" type="button" aria-label="${t('collapse')}">×</button>
        </header>
        <div class="kn-panel-summary" aria-live="polite"></div>
        <div class="kn-notes-list"></div>
        <p class="kn-notes-empty">${t('empty')}</p>`;
      this.list = this.panel.querySelector('.kn-notes-list');
      this.summary = this.panel.querySelector('.kn-panel-summary');
      this.empty = this.panel.querySelector('.kn-notes-empty');
      this.panel.querySelector('.kn-panel-close').addEventListener('click', () => this.setCollapsed(true));
      this.layer.appendChild(this.panel);

      this.toggle = document.createElement('button');
      this.toggle.type = 'button';
      this.toggle.className = 'kn-ui kn-panel-toggle';
      this.toggle.addEventListener('click', () => this.setCollapsed(!this.collapsed));
      this.layer.appendChild(this.toggle);
      if (window.parent !== window) this.toggle.hidden = true;
      this.syncToggle();
      this.updateSummary();

      this.onResize = () => this.request();
      window.addEventListener('resize', this.onResize, { passive: true });
      this.resizeObserver = new ResizeObserver(() => this.request());
      this.resizeObserver.observe(document.documentElement);
      this.resizeObserver.observe(content);
    }

    syncToggle() {
      this.toggle.dataset.collapsed = String(this.collapsed);
      this.toggle.setAttribute('aria-expanded', String(!this.collapsed));
      this.toggle.setAttribute('aria-label', this.collapsed ? t('expand') : t('collapse'));
      this.toggle.textContent = this.collapsed ? t('expand') : t('collapse');
      this.panel.setAttribute('aria-hidden', String(this.collapsed));
    }

    setCollapsed(collapsed, options = {}) {
      this.collapsed = collapsed;
      if (collapsed) this.syncContentReservation(false);
      if (!options.automatic) {
        this.autoMode = false;
        try { localStorage.setItem(this.storageKey, JSON.stringify({ userCollapsed: collapsed })); } catch {}
      }
      this.layer.classList.toggle('kn-panel-collapsed', collapsed);
      this.syncToggle();
      this.request();
      parent.postMessage({ type: 'notes-panel-state', collapsed }, '*');
    }

    addCard(card) {
      this.list.prepend(card);
      this.updateSummary();
    }

    addDraft(draft) {
      this.list.prepend(draft);
      this.updateSummary();
    }

    updateSummary() {
      const count = this.controller.store.notes.length;
      this.summary.textContent = t('noteCount', count);
      this.empty.hidden = count > 0 || !!this.controller.draft;
    }

    syncContentReservation(active, reserveSize = 0) {
      if (active === this.reservationActive) {
        const nextReserve = `${reserveSize}px`;
        if (active && this.content.style.getPropertyValue('--kn-panel-reserve') !== nextReserve) {
          this.content.style.setProperty('--kn-panel-reserve', nextReserve);
        }
        return;
      }
      this.reservationActive = active;
      if (active) {
        this.basePaddingInlineEnd = getComputedStyle(this.content).paddingInlineEnd || '0px';
        this.content.style.setProperty('--kn-content-padding-end', this.basePaddingInlineEnd);
        this.content.style.setProperty('--kn-panel-reserve', `${reserveSize}px`);
        this.content.classList.add('kn-content-reserved');
      } else {
        this.content.classList.remove('kn-content-reserved');
        this.content.style.removeProperty('--kn-content-padding-end');
        this.content.style.removeProperty('--kn-panel-reserve');
        this.basePaddingInlineEnd = '';
      }
    }

    request() {
      if (this.raf) return;
      this.raf = requestAnimationFrame(() => {
        this.raf = 0;
        this.position();
      });
    }

    position() {
      const rect = this.content.getBoundingClientRect();
      const viewport = document.documentElement.clientWidth;
      const panelWidth = 336;
      const gap = 12;
      const railMode = viewport <= 640 ? 'drawer' : Core.chooseRailMode({
        viewportWidth: viewport,
        contentLeft: rect.left,
        contentRight: rect.right,
        cardWidth: panelWidth,
        gap,
        minContentWidth: 320,
      });
      const marginSide = railMode === 'left' ? 'left' : (railMode === 'right' || railMode === 'both' ? 'right' : '');
      const reserveRight = railMode === 'reserve-right';
      const nextMode = reserveRight ? 'reserve-right' : (marginSide ? `margin-${marginSide}` : 'drawer');

      if (this.autoMode) {
        const shouldCollapse = !marginSide;
        if (shouldCollapse !== this.collapsed) this.setCollapsed(shouldCollapse, { automatic: true });
      }

      this.syncContentReservation(reserveRight && !this.collapsed, panelWidth + gap * 2);
      this.mode = nextMode;
      this.layer.dataset.mode = nextMode;
      this.panel.style.removeProperty('left');
      this.panel.style.removeProperty('right');
      this.panel.style.removeProperty('width');
      if (marginSide === 'right') {
        const rightSpace = Math.max(0, viewport - rect.right);
        const width = Math.min(panelWidth, rightSpace - gap * 2);
        this.panel.style.left = `${Math.round(rect.right + gap)}px`;
        this.panel.style.width = `${Math.max(280, width)}px`;
      } else if (marginSide === 'left') {
        const leftSpace = Math.max(0, rect.left);
        const width = Math.min(panelWidth, leftSpace - gap * 2);
        this.panel.style.right = `${Math.round(viewport - rect.left + gap)}px`;
        this.panel.style.width = `${Math.max(280, width)}px`;
      } else if (reserveRight) {
        this.panel.style.right = `${gap}px`;
        this.panel.style.width = `${panelWidth}px`;
      }
      for (const card of this.controller.cards.values()) {
        card.setSideAvailable(Boolean(marginSide || reserveRight));
      }
    }

    destroy() {
      if (this.raf) cancelAnimationFrame(this.raf);
      window.removeEventListener('resize', this.onResize);
      this.resizeObserver.disconnect();
      this.syncContentReservation(false);
      this.layer.remove();
    }
  }

  class AnnotationController {
    constructor(courseId) {
      this.courseId = courseId;
      this.lessonFile = String(window.__lessonFile || '');
      this.content = document.querySelector('.container, main, article') || document.body;
      this.textIndex = new TextIndex(document.body);
      this.highlights = new HighlightManager();
      this.store = new AnnotationStore(courseId, this.lessonFile);
      this.cards = new Map();
      this.draft = null;
      this.savedRange = null;
      this.layout = new MarginLayout(this, this.content);
      this.drawer = new DetailDrawer(this);
      this.toolbar = this.createToolbar();
      this.onMouseUp = (event) => this.handleSelection(event);
      this.scrollFrame = 0;
      this.onScroll = () => {
        if (this.scrollFrame) return;
        this.scrollFrame = window.requestAnimationFrame(() => {
          this.scrollFrame = 0;
          this.hideToolbar();
        });
      };
      this.onMessage = (event) => this.handleMessage(event);
      document.addEventListener('mouseup', this.onMouseUp);
      window.addEventListener('scroll', this.onScroll, { passive: true });
      window.addEventListener('message', this.onMessage);
    }

    async mount() {
      const notes = await this.store.load((note) => Boolean(this.textIndex.rangeFromAnchor(note.anchor)));
      for (const note of notes) this.renderNote(note);
      this.requestLayout();
      parent.postMessage({ type: 'notes-panel-state', collapsed: this.layout.collapsed }, '*');
      return this;
    }

    button(text, className, handler) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = className;
      button.textContent = text;
      button.addEventListener('click', handler);
      return button;
    }

    createToolbar() {
      const toolbar = document.createElement('div');
      toolbar.className = 'kn-ui kn-toolbar';
      toolbar.innerHTML = `<button type="button" data-action="ask">${t('ask')}</button><button type="button" data-action="note">${t('add')}</button>`;
      document.body.appendChild(toolbar);
      toolbar.addEventListener('mousedown', (event) => event.preventDefault());
      toolbar.addEventListener('click', (event) => {
        const action = event.target.closest('button')?.dataset.action;
        if (!action || !this.savedRange) return;
        const range = this.savedRange.cloneRange();
        const anchor = this.textIndex.anchorFromRange(range);
        const section = this.sectionOf(range);
        this.hideToolbar();
        if (action === 'ask') {
          parent.postMessage({
            type: 'ask-selection',
            selectedText: anchor.textQuote.exact,
            surrounding: this.surroundingOf(range),
            section,
            anchor: {
              exact: anchor.textQuote.exact,
              prefix: anchor.textQuote.prefix,
              suffix: anchor.textQuote.suffix,
              position: anchor.textPosition,
            },
          }, '*');
        } else {
          this.openDraft(range, anchor, section);
        }
        window.getSelection()?.removeAllRanges();
      });
      return toolbar;
    }

    sectionOf(range) {
      const headings = [...document.querySelectorAll('h1,h2,h3,h4')];
      let selected = '';
      for (const heading of headings) {
        const relation = heading.compareDocumentPosition(range.startContainer);
        if (relation & Node.DOCUMENT_POSITION_FOLLOWING) selected = heading.textContent.trim();
      }
      return selected;
    }

    surroundingOf(range) {
      const element = range.startContainer.parentElement?.closest('p,li,td,section,article,div');
      return (element?.textContent || range.toString()).trim().slice(0, 2000);
    }

    handleSelection(event) {
      const eventTarget = event.target instanceof Element
        ? event.target
        : event.target && event.target.parentElement;
      if (eventTarget?.closest?.('.kn-ui, [data-study-ready="true"]')) return;
      window.setTimeout(() => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || !selection.toString().trim()) {
          this.hideToolbar();
          return;
        }
        this.savedRange = selection.getRangeAt(0).cloneRange();
        const rect = this.savedRange.getBoundingClientRect();
        const width = 150;
        const left = Core.clamp(rect.left + window.scrollX + rect.width / 2 - width / 2, 8, document.documentElement.clientWidth - width - 8);
        const above = rect.top + window.scrollY - 48;
        this.toolbar.style.left = `${left}px`;
        this.toolbar.style.top = `${above > window.scrollY + 8 ? above : rect.bottom + window.scrollY + 8}px`;
        this.toolbar.style.display = 'flex';
      }, 0);
    }

    hideToolbar() {
      this.toolbar.style.display = 'none';
      this.savedRange = null;
    }

    openDraft(range, anchor, section) {
      this.closeDraft();
      this.layout.setCollapsed(false);
      const el = document.createElement('div');
      el.className = 'kn-ui kn-draft';
      const title = document.createElement('div');
      title.className = 'kn-draft-title';
      title.textContent = t('writeBy', section);
      const textarea = document.createElement('textarea');
      textarea.rows = 4;
      textarea.placeholder = t('placeholder');
      const actions = document.createElement('div');
      actions.className = 'kn-draft-actions';
      actions.append(
        this.button(t('cancel'), 'kn-secondary-button', () => this.closeDraft()),
        this.button(t('save'), 'kn-primary-button', () => {
          const text = textarea.value.trim();
          if (!text) return textarea.focus();
          const note = Core.normalizeNote({
            id: `n${Date.now().toString(36)}`,
            lessonFile: this.lessonFile,
            anchor,
            section,
            custom: text,
            kind: 'user',
            side: 'left',
            createdAt: Date.now(),
          }, this.store.notes.length);
          this.store.add(note);
          this.closeDraft();
          this.renderNote(note);
          this.requestLayout();
        }),
      );
      el.append(title, textarea, actions);
      this.layout.addDraft(el);
      this.draft = { el, range, anchor, section };
      this.requestLayout();
      window.setTimeout(() => textarea.focus(), 0);
    }

    closeDraft() {
      this.draft?.el.remove();
      this.draft = null;
      this.layout.updateSummary();
      this.requestLayout();
    }

    handleMessage(event) {
      const data = event.data;
      if (event.source !== parent || !data) return;
      if (data.type === 'toggle-notes-panel') {
        this.layout.setCollapsed(typeof data.collapsed === 'boolean' ? data.collapsed : !this.layout.collapsed);
        return;
      }
      if (data.type === 'notes-panel-query') {
        parent.postMessage({ type: 'notes-panel-state', collapsed: this.layout.collapsed }, '*');
        return;
      }
      if (data.type === 'focus-note') {
        const noteId = String(data.noteId || data.id || '');
        if (!noteId) return;
        this.layout.setCollapsed(false);
        this.openDetail(noteId);
        this.jumpTo(noteId);
        return;
      }
      if (data.type !== 'create-note') return;
      const note = Core.normalizeNote({
        id: `n${Date.now().toString(36)}`,
        lessonFile: this.lessonFile,
        anchor: data.anchor,
        section: data.section,
        question: data.question,
        answer: data.answer,
        kind: 'assistant',
        side: 'right',
        createdAt: Date.now(),
      }, this.store.notes.length);
      this.store.add(note);
      this.renderNote(note);
      this.layout.setCollapsed(false);
      this.openDetail(note.id);
      this.requestLayout();
    }

    renderNote(note) {
      const range = this.textIndex.rangeFromAnchor(note.anchor);
      if (range) this.highlights.set(note.id, range);
      const card = new NoteCard(note, this);
      card.setOrphan(!range);
      this.cards.set(note.id, card);
      this.layout.addCard(card.el);
    }

    rangeFor(id) {
      return this.highlights.get(id);
    }

    setActive(id, active) {
      this.highlights.activate(id, active);
      this.cards.get(id)?.el.classList.toggle('is-active', active);
    }

    jumpTo(id) {
      const range = this.rangeFor(id);
      if (range) this.highlights.flashRange(range);
    }

    updateNote(id, patch) {
      const note = this.store.update(id, patch);
      if (!note) return;
      this.cards.get(id)?.update(note);
      this.requestLayout();
    }

    toggleSide(id) {
      const note = this.store.notes.find((item) => item.id === id);
      if (!note) return;
      const current = note.side || (note.kind === 'assistant' ? 'right' : 'left');
      this.updateNote(id, { side: current === 'left' ? 'right' : 'left' });
    }

    deleteNote(id) {
      const note = this.store.notes.find((item) => item.id === id);
      if (!note || !window.confirm(t('deleteConfirm'))) return;
      this.store.remove(id);
      this.highlights.delete(id);
      this.cards.get(id)?.destroy();
      this.cards.delete(id);
      this.drawer.close();
      this.layout.updateSummary();
      this.requestLayout();
    }

    openDetail(id) {
      const note = this.store.notes.find((item) => item.id === id);
      if (note) this.drawer.open(note);
    }

    requestLayout() {
      this.layout.request();
    }

    destroy() {
      document.removeEventListener('mouseup', this.onMouseUp);
      window.removeEventListener('scroll', this.onScroll);
      window.removeEventListener('message', this.onMessage);
      if (this.scrollFrame) window.cancelAnimationFrame(this.scrollFrame);
      this.closeDraft();
      this.toolbar.remove();
      for (const card of this.cards.values()) card.destroy();
      this.cards.clear();
      this.drawer.destroy();
      this.layout.destroy();
      this.highlights.destroy();
      this.store.destroy();
    }
  }

  async function mount(options) {
    const courseId = options?.courseId || window.__courseId;
    if (!courseId) return null;
    const controller = new AnnotationController(courseId);
    await controller.mount();
    return controller;
  }

  window.KimiMarginNotes = { mount };
})();
