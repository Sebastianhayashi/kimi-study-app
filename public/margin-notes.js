(() => {
  'use strict';

  const Core = window.KimiMarginNotesCore;
  if (!Core) throw new Error('KimiMarginNotesCore is required');

  const CARD_GAP = 10;
  const CARD_WIDTH = 272;
  const TEXT_CONTEXT = 48;

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
    constructor(courseId) {
      this.courseId = courseId;
      this.notes = [];
      this.timer = 0;
      this.saving = false;
      this.dirty = false;
    }

    async load() {
      const response = await fetch(`/api/courses/${this.courseId}/notes`);
      const raw = response.ok ? await response.json() : [];
      this.notes = Array.isArray(raw) ? raw.map(Core.normalizeNote) : [];
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
        await fetch(`/api/courses/${this.courseId}/notes`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.notes.map(Core.serializeNote)),
        });
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
        <section class="kn-detail" role="dialog" aria-modal="true" aria-labelledby="kn-detail-title">
          <header class="kn-detail-head">
            <h2 class="kn-detail-title" id="kn-detail-title">笔记</h2>
            <button class="kn-detail-close" type="button" aria-label="关闭">✕</button>
          </header>
          <div class="kn-detail-content"></div>
          <footer class="kn-detail-actions"></footer>
        </section>`;
      document.body.appendChild(this.el);
      this.content = this.el.querySelector('.kn-detail-content');
      this.actions = this.el.querySelector('.kn-detail-actions');
      this.el.querySelector('.kn-detail-close').addEventListener('click', () => this.close());
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
      this.el.querySelector('.kn-detail-title').textContent = note.kind === 'assistant' ? 'AI 笔记' : '我的笔记';

      if (note.question) {
        const question = document.createElement('p');
        question.className = 'kn-detail-question';
        question.textContent = `问 · ${note.question}`;
        this.content.appendChild(question);
      }

      const currentText = note.custom || note.answer || '';
      if (edit) {
        const textarea = document.createElement('textarea');
        textarea.value = currentText;
        this.content.appendChild(textarea);
        const cancel = this.button('取消', 'kn-secondary-button', () => this.render(false));
        const save = this.button('保存', 'kn-primary-button', () => {
          this.controller.updateNote(note.id, { custom: textarea.value.trim() });
          this.render(false);
        });
        this.actions.append(cancel, save);
        window.setTimeout(() => textarea.focus(), 0);
      } else {
        const body = document.createElement('div');
        body.className = 'kn-detail-body';
        body.textContent = currentText || '这条笔记还没有内容。';
        this.content.appendChild(body);
        const jump = this.button('回到原文', 'kn-secondary-button', () => this.controller.jumpTo(note.id));
        const editButton = this.button('编辑', 'kn-secondary-button', () => this.render(true));
        const remove = this.button('删除', 'kn-secondary-button', () => this.controller.deleteNote(note.id));
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
      this.editing = false;
      this.overflowing = false;
      this.el = document.createElement('article');
      this.el.className = 'kn-ui kn-card';
      this.el.dataset.noteId = note.id;
      this.resizeObserver = new ResizeObserver(() => this.measure());
      this.el.addEventListener('mouseenter', () => this.controller.setActive(note.id, true));
      this.el.addEventListener('mouseleave', () => this.controller.setActive(note.id, false));
      this.render();
      this.resizeObserver.observe(this.el);
    }

    update(note) {
      this.note = note;
      this.render();
    }

    setOrphan(orphan) {
      this.el.classList.toggle('is-orphan', orphan);
    }

    setSideAvailable(available) {
      const button = this.el.querySelector('[data-action="side"]');
      if (button) button.hidden = !available;
    }

    render() {
      const note = this.note;
      this.el.replaceChildren();

      const head = document.createElement('header');
      head.className = 'kn-card-head';
      const meta = document.createElement('div');
      meta.className = 'kn-card-meta';
      const kind = document.createElement('span');
      kind.className = 'kn-card-kind';
      kind.textContent = note.kind === 'assistant' ? 'AI 笔记' : '我的笔记';
      const section = document.createElement('span');
      section.className = 'kn-card-section';
      section.textContent = note.section || '当前课节';
      meta.append(kind, section);
      const anchor = document.createElement('button');
      anchor.type = 'button';
      anchor.className = 'kn-card-anchor';
      anchor.title = '回到原文';
      anchor.setAttribute('aria-label', '回到原文');
      anchor.textContent = '⌖';
      anchor.addEventListener('click', (event) => {
        event.stopPropagation();
        this.controller.jumpTo(note.id);
      });
      head.append(meta, anchor);
      this.el.appendChild(head);

      if (!this.controller.rangeFor(note.id)) {
        const orphan = document.createElement('div');
        orphan.className = 'kn-card-orphan';
        orphan.textContent = '原文位置发生变化，当前按孤立笔记显示。';
        this.el.appendChild(orphan);
      }

      const clip = document.createElement('div');
      clip.className = 'kn-card-clip';
      if (note.question) {
        const question = document.createElement('p');
        question.className = 'kn-card-question';
        question.textContent = note.question;
        clip.appendChild(question);
      }

      if (this.editing) this.renderEditor(clip);
      else {
        const body = document.createElement('div');
        body.className = 'kn-card-body';
        const text = note.custom || note.answer || '';
        body.textContent = text || '点击“编辑”写下笔记…';
        body.classList.toggle('is-empty', !text);
        clip.appendChild(body);
      }
      this.el.appendChild(clip);

      const foot = document.createElement('footer');
      foot.className = 'kn-card-foot';
      const more = document.createElement('button');
      more.type = 'button';
      more.className = 'kn-text-button';
      more.dataset.action = 'more';
      more.textContent = '展开全文';
      more.hidden = !this.overflowing || this.editing;
      more.addEventListener('click', () => this.controller.openDetail(note.id));

      const actions = document.createElement('div');
      actions.className = 'kn-card-actions';
      const edit = this.iconButton('编辑', '✎', () => {
        this.editing = true;
        this.render();
        this.controller.requestLayout();
      });
      const side = this.iconButton('切换侧边', '⇄', () => this.controller.toggleSide(note.id));
      side.dataset.action = 'side';
      const remove = this.iconButton('删除', '⌫', () => this.controller.deleteNote(note.id));
      actions.append(edit, side, remove);
      foot.append(more, actions);
      this.el.appendChild(foot);
      this.measure();
    }

    renderEditor(parent) {
      const textarea = document.createElement('textarea');
      textarea.className = 'kn-card-editor';
      textarea.value = this.note.custom || this.note.answer || '';
      const actions = document.createElement('div');
      actions.className = 'kn-edit-actions';
      const cancel = this.controller.button('取消', 'kn-secondary-button', () => {
        this.editing = false;
        this.render();
        this.controller.requestLayout();
      });
      const save = this.controller.button('保存', 'kn-primary-button', () => {
        this.controller.updateNote(this.note.id, { custom: textarea.value.trim() });
        this.editing = false;
        this.render();
        this.controller.requestLayout();
      });
      actions.append(cancel, save);
      parent.append(textarea, actions);
      window.setTimeout(() => textarea.focus(), 0);
    }

    iconButton(label, text, handler) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'kn-icon-button';
      button.title = label;
      button.setAttribute('aria-label', label);
      button.textContent = text;
      button.addEventListener('click', handler);
      return button;
    }

    measure() {
      const clip = this.el.querySelector('.kn-card-clip');
      if (!clip || this.editing) return;
      const overflowing = clip.scrollHeight > 220;
      if (overflowing === this.overflowing) return;
      this.overflowing = overflowing;
      this.el.classList.toggle('is-clamped', overflowing);
      const more = this.el.querySelector('[data-action="more"]');
      if (more) more.hidden = !overflowing;
      this.controller.requestLayout();
    }

    destroy() {
      this.resizeObserver.disconnect();
      this.el.remove();
    }
  }

  class MarginLayout {
    constructor(controller, content) {
      this.controller = controller;
      this.content = content;
      this.mode = 'drawer';
      this.raf = 0;
      this.layer = document.createElement('div');
      this.layer.className = 'kn-ui kn-margin-layer';
      document.body.appendChild(this.layer);
      const computed = getComputedStyle(document.body);
      document.documentElement.style.setProperty('--kn-base-padding-left', computed.paddingLeft);
      document.documentElement.style.setProperty('--kn-base-padding-right', computed.paddingRight);
      document.documentElement.style.setProperty('--kn-card-width', `${CARD_WIDTH}px`);
      document.documentElement.style.setProperty('--kn-card-gap', `${CARD_GAP}px`);
      document.documentElement.style.setProperty('--kn-rail-reserve', `${CARD_WIDTH + CARD_GAP + 16}px`);
      this.onScroll = () => this.request();
      this.onResize = () => {
        this.clearReserve();
        this.mode = '';
        this.request();
      };
      window.addEventListener('scroll', this.onScroll, { passive: true });
      window.addEventListener('resize', this.onResize, { passive: true });
      this.resizeObserver = new ResizeObserver(() => this.request());
      this.resizeObserver.observe(document.documentElement);
      this.resizeObserver.observe(content);
    }

    clearReserve() {
      document.documentElement.classList.remove('kn-reserve-left', 'kn-reserve-right', 'kn-reserve-both');
    }

    calculateMode(rect) {
      return Core.chooseRailMode({
        viewportWidth: document.documentElement.clientWidth,
        contentLeft: rect.left,
        contentRight: rect.right,
        cardWidth: CARD_WIDTH,
        gap: CARD_GAP,
      });
    }

    applyMode(mode) {
      this.clearReserve();
      if (mode === 'reserve-right') document.documentElement.classList.add('kn-reserve-right');
      else if (mode === 'reserve-left') document.documentElement.classList.add('kn-reserve-left');
      else if (mode === 'reserve-both') document.documentElement.classList.add('kn-reserve-both');
      this.layer.classList.toggle('kn-mode-drawer', mode === 'drawer');
      this.mode = mode;
    }

    request() {
      if (this.raf) return;
      this.raf = requestAnimationFrame(() => {
        this.raf = 0;
        this.position();
      });
    }

    position() {
      let rect = this.content.getBoundingClientRect();
      // A reserved rail creates the space that it needs. Do not immediately
      // reinterpret that self-created gutter as a natural rail and oscillate.
      const nextMode = this.mode.startsWith('reserve-') ? this.mode : this.calculateMode(rect);
      if (nextMode !== this.mode) {
        this.applyMode(nextMode);
        rect = this.content.getBoundingClientRect();
      }

      const viewport = document.documentElement.clientWidth;
      const leftX = Math.max(8, rect.left - CARD_WIDTH - CARD_GAP + window.scrollX);
      let rightX = rect.right + CARD_GAP + window.scrollX;
      if (this.mode === 'reserve-right' || this.mode === 'drawer') {
        rightX = viewport - CARD_WIDTH - 8 + window.scrollX;
      }
      rightX = Math.max(8, Math.min(rightX, viewport - CARD_WIDTH - 8 + window.scrollX));

      const grouped = { left: [], right: [] };
      for (const note of this.controller.store.notes) {
        const card = this.controller.cards.get(note.id);
        const range = this.controller.rangeFor(note.id);
        if (!card || !range) continue;
        let side = note.side || (note.kind === 'assistant' ? 'right' : 'left');
        if (this.mode !== 'both') side = this.mode === 'left' ? 'left' : 'right';
        grouped[side].push({
          id: note.id,
          top: range.getBoundingClientRect().top + window.scrollY,
          height: card.el.offsetHeight,
          card,
        });
        card.setSideAvailable(this.mode === 'both');
      }

      if (this.controller.draft) {
        let side = this.mode === 'both' ? 'left' : this.mode === 'left' ? 'left' : 'right';
        grouped[side].push({
          id: '__draft__',
          top: this.controller.draft.range.getBoundingClientRect().top + window.scrollY,
          height: this.controller.draft.el.offsetHeight,
          card: { el: this.controller.draft.el },
        });
      }

      for (const side of ['left', 'right']) {
        const placed = Core.stackPlacements(grouped[side], CARD_GAP);
        const x = side === 'left' ? leftX : rightX;
        for (const item of placed) {
          item.card.el.style.left = `${x}px`;
          item.card.el.style.top = `${item.y}px`;
        }
      }

      let orphanTop = window.scrollY + 12;
      for (const note of this.controller.store.notes) {
        if (this.controller.rangeFor(note.id)) continue;
        const card = this.controller.cards.get(note.id);
        if (!card) continue;
        card.setOrphan(true);
        card.setSideAvailable(false);
        card.el.style.left = `${rightX}px`;
        card.el.style.top = `${orphanTop}px`;
        orphanTop += card.el.offsetHeight + CARD_GAP;
      }
    }

    destroy() {
      if (this.raf) cancelAnimationFrame(this.raf);
      window.removeEventListener('scroll', this.onScroll);
      window.removeEventListener('resize', this.onResize);
      this.resizeObserver.disconnect();
      this.clearReserve();
      this.layer.remove();
    }
  }

  class AnnotationController {
    constructor(courseId) {
      this.courseId = courseId;
      this.content = document.querySelector('.container, main, article') || document.body;
      this.textIndex = new TextIndex(document.body);
      this.highlights = new HighlightManager();
      this.store = new AnnotationStore(courseId);
      this.cards = new Map();
      this.draft = null;
      this.savedRange = null;
      this.layout = new MarginLayout(this, this.content);
      this.drawer = new DetailDrawer(this);
      this.toolbar = this.createToolbar();
      this.onMouseUp = (event) => this.handleSelection(event);
      this.onScroll = () => this.hideToolbar();
      this.onMessage = (event) => this.handleMessage(event);
      document.addEventListener('mouseup', this.onMouseUp);
      window.addEventListener('scroll', this.onScroll, { passive: true });
      window.addEventListener('message', this.onMessage);
    }

    async mount() {
      const notes = await this.store.load();
      for (const note of notes) this.renderNote(note);
      this.requestLayout();
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
      toolbar.innerHTML = '<button type="button" data-action="ask">问助手</button><button type="button" data-action="note">贴笔记</button>';
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
      if (event.target.closest('.kn-ui, [data-study-ready="true"]')) return;
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
      const el = document.createElement('div');
      el.className = 'kn-ui kn-draft';
      const title = document.createElement('div');
      title.className = 'kn-draft-title';
      title.textContent = section ? `在「${section}」旁写笔记` : '写一条课边笔记';
      const textarea = document.createElement('textarea');
      textarea.rows = 4;
      textarea.placeholder = '写下你的理解、疑问或提醒…';
      const actions = document.createElement('div');
      actions.className = 'kn-draft-actions';
      actions.append(
        this.button('取消', 'kn-secondary-button', () => this.closeDraft()),
        this.button('保存', 'kn-primary-button', () => {
          const text = textarea.value.trim();
          if (!text) return textarea.focus();
          const note = Core.normalizeNote({
            id: `n${Date.now().toString(36)}`,
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
      this.layout.layer.appendChild(el);
      this.draft = { el, range, anchor, section };
      this.requestLayout();
      window.setTimeout(() => textarea.focus(), 0);
    }

    closeDraft() {
      this.draft?.el.remove();
      this.draft = null;
      this.requestLayout();
    }

    handleMessage(event) {
      const data = event.data;
      if (event.source !== parent || !data || data.type !== 'create-note') return;
      const note = Core.normalizeNote({
        id: `n${Date.now().toString(36)}`,
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
      this.requestLayout();
    }

    renderNote(note) {
      const range = this.textIndex.rangeFromAnchor(note.anchor);
      if (range) this.highlights.set(note.id, range);
      const card = new NoteCard(note, this);
      card.setOrphan(!range);
      this.cards.set(note.id, card);
      this.layout.layer.appendChild(card.el);
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
      if (!note || !window.confirm('删除这条笔记？')) return;
      this.store.remove(id);
      this.highlights.delete(id);
      this.cards.get(id)?.destroy();
      this.cards.delete(id);
      this.drawer.close();
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
