// Kimi Study 课节标注层：划词工具条 + 默认高亮 + 课文两侧边缘笔记卡。
// 由服务端在输出课节 HTML 时注入，磁盘课件不动；所有 UI 只存在于本 iframe 内。
(() => {
  if (window.__knInit) return;
  window.__knInit = true;
  const courseId = window.__courseId;
  if (!courseId) return;

  const HL = 'kimi-note';
  const CARD_W = 240;
  const CARD_GAP = 14;
  const FOLD_H = 220;
  const notes = []; // {id, anchor{exact,prefix,suffix}, section, question, answer, custom, side, collapsed, createdAt}
  const ranges = new Map(); // id -> Range
  const cards = new Map(); // id -> card element

  // ---------- 样式 ----------
  const style = document.createElement('style');
  style.textContent = `
    ::highlight(${HL}) { background-color: rgba(255, 213, 79, .45); border-radius: 2px; }
    ::highlight(kimi-note-active) { background-color: rgba(255, 193, 7, .75); border-radius: 2px; }
    ::highlight(kimi-flash) { background-color: rgba(255, 152, 0, .8); border-radius: 2px; }
    .kn-ui { font: 13px/1.6 -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; color: #202124; }
    .kn-toolbar { position: absolute; z-index: 99999; display: flex; gap: 4px; padding: 4px;
      background: #202124; border-radius: 8px; box-shadow: 0 4px 14px rgba(0,0,0,.25); }
    .kn-toolbar button { border: 0; background: transparent; color: #fff; font-size: 12px;
      padding: 4px 10px; border-radius: 6px; cursor: pointer; white-space: nowrap; }
    .kn-toolbar button:hover { background: rgba(255,255,255,.15); }
    .kn-card { position: absolute; z-index: 9998; width: ${CARD_W}px; background: #fffbe6;
      border: 1px solid #f0df9a; border-radius: 10px; box-shadow: 0 4px 16px rgba(0,0,0,.12);
      padding: 10px 12px; box-sizing: border-box; }
    .kn-card:hover { box-shadow: 0 6px 20px rgba(0,0,0,.18); }
    .kn-q { font-weight: 600; margin-bottom: 6px; cursor: pointer; }
    .kn-q::before { content: "问 · "; color: #8a6d00; }
    .kn-a { outline: none; white-space: pre-wrap; min-height: 1.5em; }
    .kn-a:empty::before { content: "点击写下笔记…"; color: #9a8b5a; }
    .kn-card.kn-folded .kn-a { max-height: ${FOLD_H}px; overflow: hidden;
      -webkit-mask-image: linear-gradient(#000 70%, transparent); mask-image: linear-gradient(#000 70%, transparent); }
    .kn-ops { display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px; }
    .kn-ops button { border: 0; background: none; color: #8a6d00; font-size: 12px; cursor: pointer; padding: 0; }
    .kn-card.kn-collapsed { width: auto; padding: 4px 10px; cursor: pointer; }
    .kn-card.kn-collapsed .kn-q, .kn-card.kn-collapsed .kn-a, .kn-card.kn-collapsed .kn-ops { display: none; }
    .kn-card.kn-collapsed .kn-peek { display: inline; color: #8a6d00; font-size: 12px; }
    .kn-peek { display: none; cursor: pointer; }
    .kn-orphan-tag { color: #b3261e; font-size: 11px; display: block; margin-bottom: 4px; }
  `;
  document.head.appendChild(style);

  const highlight = new Highlight();
  CSS.highlights.set(HL, highlight);
  const activeHighlight = new Highlight();
  CSS.highlights.set('kimi-note-active', activeHighlight);
  const flashHighlight = new Highlight();
  CSS.highlights.set('kimi-flash', flashHighlight);

  // ---------- 锚点：TextQuote(exact + prefix/suffix) ----------
  function fullText() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let text = '';
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) {
      nodes.push([n, text.length]);
      text += n.nodeValue;
    }
    return { text, nodes };
  }

  function makeAnchor(range) {
    const exact = range.toString();
    const pre = document.createRange();
    pre.selectNodeContents(document.body);
    pre.setEnd(range.startContainer, range.startOffset);
    const post = document.createRange();
    post.selectNodeContents(document.body);
    post.setStart(range.endContainer, range.endOffset);
    return { exact, prefix: pre.toString().slice(-32), suffix: post.toString().slice(0, 32) };
  }

  function findRange(anchor) {
    const { text, nodes } = fullText();
    const candidates = [
      anchor.prefix + anchor.exact + anchor.suffix,
      anchor.prefix + anchor.exact,
      anchor.exact + anchor.suffix,
      anchor.exact,
    ];
    for (const c of candidates) {
      const i = text.indexOf(c);
      if (i < 0) continue;
      const start = i + (c.startsWith(anchor.prefix) ? anchor.prefix.length : 0);
      const end = start + anchor.exact.length;
      const range = document.createRange();
      for (const [node, offset] of nodes) {
        const nodeEnd = offset + node.nodeValue.length;
        if (start >= offset && start <= nodeEnd) range.setStart(node, start - offset);
        if (end >= offset && end <= nodeEnd) {
          range.setEnd(node, end - offset);
          return range;
        }
      }
    }
    return null;
  }

  // ---------- 两侧布局 ----------
  const contentEl = document.querySelector('.container, main, article') || document.body;

  function rails() {
    // 返回每侧的 left 坐标；空间不足时只有右侧
    const rect = contentEl.getBoundingClientRect();
    const rightLeft = Math.min(rect.right + window.scrollX + CARD_GAP, document.documentElement.clientWidth - CARD_W - 8);
    const leftLeft = Math.max(rect.left + window.scrollX - CARD_W - CARD_GAP, 8);
    const both = rect.left - window.scrollX >= CARD_W + CARD_GAP + 16;
    return { left: leftLeft, right: Math.max(rightLeft, 8), both };
  }

  function relayout() {
    const r = rails();
    const placed = { left: [], right: [] };
    const orphans = [];
    notes.forEach((note) => {
      const card = cards.get(note.id);
      const range = ranges.get(note.id);
      if (!card) return;
      if (!range) { orphans.push(note); return; }
      const side = r.both ? (note.side || (note.question ? 'right' : 'left')) : 'right';
      placed[side].push({ note, card, top: range.getBoundingClientRect().top + window.scrollY });
    });
    ['left', 'right'].forEach((side) => {
      placed[side].sort((a, b) => a.top - b.top);
      let cursor = 0;
      placed[side].forEach(({ card, top }) => {
        const y = Math.max(top, cursor);
        card.style.top = y + 'px';
        card.style.left = r[side] + 'px';
        cursor = y + card.offsetHeight + 8;
      });
    });
    // 孤儿：堆在右栏顶部
    let oTop = 12 + window.scrollY;
    orphans.forEach((note) => {
      const card = cards.get(note.id);
      card.style.left = r.right + 'px';
      card.style.top = oTop + 'px';
      oTop += card.offsetHeight + 8;
    });
  }

  // ---------- 笔记卡 ----------
  function save() {
    fetch(`/api/courses/${courseId}/notes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(notes),
    });
  }

  function flash(range) {
    flashHighlight.add(range);
    range.startContainer.parentElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => flashHighlight.delete(range), 1200);
  }

  function renderNote(note) {
    const range = findRange(note.anchor);
    if (range) {
      ranges.set(note.id, range);
      highlight.add(range);
    }

    const card = document.createElement('div');
    card.className = 'kn-ui kn-card' + (note.collapsed ? ' kn-collapsed' : '');
    card.dataset.id = note.id;

    const peek = (note.question || note.custom || note.answer || '笔记').slice(0, 8);
    card.innerHTML =
      (range ? '' : '<span class="kn-orphan-tag">原文未找到</span>') +
      (note.question ? `<div class="kn-q"></div>` : '') +
      `<div class="kn-a" contenteditable="true"></div>` +
      `<span class="kn-peek">${peek.replace(/</g, '&lt;')}…</span>` +
      `<div class="kn-ops">` +
      `<button class="kn-full" hidden>展开全文</button>` +
      `<button class="kn-side" title="切换到另一侧">⇄</button>` +
      `<button class="kn-collapse">${note.collapsed ? '展开' : '收起'}</button>` +
      `<button class="kn-del">删除</button></div>`;
    if (note.question) card.querySelector('.kn-q').textContent = note.question;
    const body = card.querySelector('.kn-a');
    body.textContent = note.custom || note.answer || '';
    document.body.appendChild(card);
    cards.set(note.id, card);

    // 长内容折叠
    if (body.scrollHeight > FOLD_H + 20) {
      card.classList.add('kn-folded');
      const fullBtn = card.querySelector('.kn-full');
      fullBtn.hidden = false;
      fullBtn.addEventListener('click', () => {
        const folded = card.classList.toggle('kn-folded');
        fullBtn.textContent = folded ? '展开全文' : '收起全文';
        relayout();
      });
    }

    // 点击问题标题 -> 回到原文并闪烁；hover 卡片 -> 正文变亮
    card.addEventListener('click', (e) => {
      if (e.target.closest('.kn-a, .kn-ops, .kn-peek')) return;
      const r = ranges.get(note.id);
      if (r) flash(r);
    });
    card.addEventListener('mouseenter', () => {
      const r = ranges.get(note.id);
      if (r) activeHighlight.add(r);
    });
    card.addEventListener('mouseleave', () => {
      const r = ranges.get(note.id);
      if (r) activeHighlight.delete(r);
    });

    body.addEventListener('blur', (e) => {
      note.custom = e.target.innerText.trim();
      save();
      relayout();
    });
    card.querySelector('.kn-side').addEventListener('click', () => {
      note.side = (note.side || (note.question ? 'right' : 'left')) === 'left' ? 'right' : 'left';
      save();
      relayout();
    });
    card.querySelector('.kn-collapse').addEventListener('click', () => {
      note.collapsed = !note.collapsed;
      card.classList.toggle('kn-collapsed', note.collapsed);
      card.querySelector('.kn-collapse').textContent = note.collapsed ? '展开' : '收起';
      save();
      relayout();
    });
    card.querySelector('.kn-peek').addEventListener('click', () => {
      note.collapsed = false;
      card.classList.remove('kn-collapsed');
      card.querySelector('.kn-collapse').textContent = '收起';
      save();
      relayout();
    });
    card.querySelector('.kn-del').addEventListener('click', () => {
      const r = ranges.get(note.id);
      if (r) highlight.delete(r);
      ranges.delete(note.id);
      cards.delete(note.id);
      notes.splice(notes.indexOf(note), 1);
      card.remove();
      save();
      relayout();
    });
    return card;
  }

  function addNote(data) {
    const note = { collapsed: false, createdAt: Date.now(), ...data };
    notes.push(note);
    const card = renderNote(note);
    save();
    relayout();
    return card;
  }

  // ---------- 划词工具条 ----------
  const toolbar = document.createElement('div');
  toolbar.className = 'kn-ui kn-toolbar';
  toolbar.style.display = 'none';
  toolbar.innerHTML = '<button data-act="ask">问助手</button><button data-act="note">贴笔记</button>';
  document.body.appendChild(toolbar);

  let savedRange = null;

  function sectionOf(range) {
    const headings = [...document.querySelectorAll('h1,h2,h3,h4')];
    const h = headings
      .filter((x) => x.compareDocumentPosition(range.startContainer) & Node.DOCUMENT_POSITION_FOLLOWING)
      .pop();
    return h ? h.textContent.trim() : '';
  }

  function surroundingOf(range) {
    const el = range.startContainer.parentElement?.closest('p,li,td,section,article,div');
    return (el ? el.textContent : range.toString()).trim().slice(0, 2000);
  }

  document.addEventListener('mouseup', (e) => {
    if (e.target.closest('.kn-ui')) return;
    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        toolbar.style.display = 'none';
        savedRange = null;
        return;
      }
      savedRange = sel.getRangeAt(0).cloneRange();
      const rect = savedRange.getBoundingClientRect();
      const left = Math.max(8, Math.min(rect.left + window.scrollX, document.documentElement.clientWidth - 150));
      toolbar.style.left = left + 'px';
      const top = rect.top + window.scrollY - 44;
      toolbar.style.top = (top > 8 ? top : rect.bottom + window.scrollY + 8) + 'px';
      toolbar.style.display = 'flex';
    }, 10);
  });

  toolbar.addEventListener('click', (e) => {
    const act = e.target.dataset.act;
    if (!act || !savedRange) return;
    const anchor = makeAnchor(savedRange);
    const section = sectionOf(savedRange);
    toolbar.style.display = 'none';
    if (act === 'ask') {
      parent.postMessage({
        type: 'ask-selection',
        selectedText: anchor.exact,
        surrounding: surroundingOf(savedRange),
        section, anchor,
      }, '*');
    } else {
      const card = addNote({ id: 'n' + Date.now().toString(36), anchor, section, question: '', answer: '', custom: '', side: 'left' });
      card?.querySelector('.kn-a')?.focus();
    }
    savedRange = null;
    window.getSelection().removeAllRanges();
  });

  // ---------- 父页消息：问助手的回答 -> 建高亮 + 右侧笔记卡 ----------
  window.addEventListener('message', (e) => {
    const d = e.data;
    if (d && d.type === 'create-note') {
      addNote({ id: 'n' + Date.now().toString(36), anchor: d.anchor, section: d.section, question: d.question, answer: d.answer, custom: '', side: 'right' });
    }
  });


  // ---------- 可点击学习卡：英语单词朗读 ----------
  if ('speechSynthesis' in window && 'SpeechSynthesisUtterance' in window) {
    const ENGLISH_TERM_PATTERN = /^[A-Za-z][A-Za-z' -]{0,40}$/;
    const HAS_CHINESE_PATTERN = /[\u3400-\u9fff]/;
    let speakingCard = null;

    style.textContent += `
      [data-study-ready="true"] {
        cursor: pointer;
        user-select: none;
        -webkit-tap-highlight-color: transparent;
        transition: transform .12s ease, box-shadow .12s ease;
      }
      [data-study-ready="true"]:hover { transform: translateY(-1px); }
      [data-study-ready="true"]:active { transform: scale(.985); }
      [data-study-ready="true"]:focus-visible {
        outline: 3px solid rgba(11, 87, 208, .18);
        outline-offset: 3px;
      }
      [data-study-ready="true"].study-speaking {
        outline: 2px solid rgba(11, 87, 208, .42);
        outline-offset: 2px;
        box-shadow: 0 5px 16px rgba(11, 87, 208, .12);
      }
      @media (prefers-reduced-motion: reduce) {
        [data-study-ready="true"] { transition: none; }
        [data-study-ready="true"]:hover,
        [data-study-ready="true"]:active { transform: none; }
      }
    `;

    function markSpeakableCard(card, word, lang = 'en-US') {
      if (!card || card.dataset.studyReady === 'true') return;
      card.dataset.studyReady = 'true';
      card.dataset.studyAction = 'speak';
      card.dataset.studyValue = word;
      card.dataset.studyLang = lang;
      if (!card.matches('button, input, textarea, select')) {
        card.setAttribute('role', 'button');
        card.tabIndex = 0;
      }
      card.setAttribute('aria-label', `朗读英语单词 ${word}`);
      if (!card.title) card.title = `点击朗读：${word}`;
    }

    function legacyVocabularyCard(card) {
      if (!(card instanceof HTMLElement) || card.closest('.kn-ui')) return null;
      if (card.matches('a[href]') || card.querySelector('a[href], button, input, textarea, select, audio, video, iframe, table, ul, ol')) return null;
      if (card.textContent.trim().length > 80 || card.children.length > 5) return null;

      const lines = card.innerText.split(/\n+/).map((line) => line.trim()).filter(Boolean);
      const firstChildText = card.firstElementChild?.textContent?.trim() || '';
      const word = ENGLISH_TERM_PATTERN.test(firstChildText) ? firstChildText : lines[0];
      const translation = card.textContent.replace(word || '', '').trim();

      if (!word || !ENGLISH_TERM_PATTERN.test(word)) return null;
      if (!HAS_CHINESE_PATTERN.test(translation)) return null;
      return { card, word };
    }

    function upgradeVocabularyCards(root = document) {
      root.querySelectorAll('[data-study-action="speak"][data-study-value]').forEach((card) => {
        markSpeakableCard(card, card.dataset.studyValue, card.dataset.studyLang || 'en-US');
      });

      root.querySelectorAll('main, article, section, div').forEach((container) => {
        if (container.closest('.kn-ui')) return;
        const children = [...container.children];
        if (children.length < 2 || children.length > 24) return;
        const matches = children.map(legacyVocabularyCard).filter(Boolean);
        if (matches.length < 2 || matches.length / children.length < 0.6) return;
        matches.forEach(({ card, word }) => markSpeakableCard(card, word));
      });
    }

    function speakStudyCard(card) {
      const text = card.dataset.studyValue?.trim();
      if (!text) return;

      window.speechSynthesis.cancel();
      speakingCard?.classList.remove('study-speaking');
      speakingCard = card;
      card.classList.add('study-speaking');

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = card.dataset.studyLang || 'en-US';
      utterance.rate = 0.86;
      utterance.pitch = 1;
      utterance.volume = 1;

      const clear = () => {
        card.classList.remove('study-speaking');
        if (speakingCard === card) speakingCard = null;
      };
      utterance.addEventListener('end', clear, { once: true });
      utterance.addEventListener('error', clear, { once: true });
      window.speechSynthesis.speak(utterance);
    }

    document.addEventListener('click', (event) => {
      if (!(event.target instanceof Element)) return;
      const card = event.target.closest('[data-study-action="speak"]');
      if (!card || card.closest('.kn-ui')) return;
      event.preventDefault();
      speakStudyCard(card);
    });

    document.addEventListener('keydown', (event) => {
      if (!(event.target instanceof Element)) return;
      const card = event.target.closest('[data-study-action="speak"]');
      if (!card || card.matches('button') || card.closest('.kn-ui')) return;
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      speakStudyCard(card);
    });

    window.addEventListener('pagehide', () => window.speechSynthesis.cancel(), { once: true });
    upgradeVocabularyCards();
  }

  // ---------- 重排 & 恢复（只渲染，不触发保存） ----------
  // ResizeObserver 覆盖窗口缩放、面板拖动、浏览器缩放；window resize 事件在 iframe 尺寸变化时不触发
  new ResizeObserver(() => relayout()).observe(document.documentElement);
  fetch(`/api/courses/${courseId}/notes`)
    .then((r) => r.json())
    .then((list) => {
      list.forEach((n) => { notes.push(n); renderNote(n); });
      relayout();
    });
})();
