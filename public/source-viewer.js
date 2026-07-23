(() => {
  if (!location.pathname.startsWith('/course/')) return;

  const courseId = location.pathname.split('/').filter(Boolean).pop();
  const stage = document.querySelector('.course-stage');
  const lessonFrame = document.getElementById('lessonFrame');
  const resourceSlot = document.getElementById('lessonResourceSlot');
  if (!stage || !lessonFrame) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const supported = new Map([
    ['pdf', 'pdf'], ['epub', 'epub'],
    ['txt', 'text'], ['md', 'text'], ['markdown', 'text'],
    ['html', 'html'], ['htm', 'html'], ['xhtml', 'html'],
    ['jpg', 'image'], ['jpeg', 'image'], ['png', 'image'], ['webp', 'image'],
  ]);

  const icons = {
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
    toc: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/></svg>',
    prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
    next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>',
    minus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    fit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/></svg>',
    rotate: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/></svg>',
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
    external: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3h7v7M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></svg>',
    source: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6M9 13h8M9 17h6"/></svg>',
  };

  stage.classList.add('ks-source-host');
  const root = document.createElement('section');
  root.className = 'ks-source-viewer';
  root.hidden = true;
  root.setAttribute('aria-label', '学习资源阅读器');
  root.innerHTML = `
    <header class="ks-source-toolbar">
      <button class="ks-source-icon ks-source-close" type="button" aria-label="返回课程">${icons.back}</button>
      <div class="ks-source-identity">
        <select class="ks-source-select" aria-label="选择学习资源"></select>
        <span class="ks-source-format"></span>
      </div>
      <div class="ks-source-toolbar-spacer"></div>
      <button class="ks-source-control ks-source-toc" type="button" aria-label="显示目录">${icons.toc}<span>目录</span></button>
      <div class="ks-source-search-wrap">
        <input class="ks-source-search" type="search" placeholder="搜索内容" aria-label="搜索资源内容">
        <button class="ks-source-icon ks-source-search-button" type="button" aria-label="搜索">${icons.search}</button>
      </div>
      <div class="ks-source-control-group ks-source-page-controls">
        <button class="ks-source-icon ks-source-prev" type="button" aria-label="上一页">${icons.prev}</button>
        <label class="ks-source-location"><input inputmode="numeric" aria-label="页码"><span>/ 0</span></label>
        <button class="ks-source-icon ks-source-next" type="button" aria-label="下一页">${icons.next}</button>
      </div>
      <div class="ks-source-control-group ks-source-scale-controls">
        <button class="ks-source-icon ks-source-smaller" type="button" aria-label="缩小">${icons.minus}</button>
        <span class="ks-source-scale-label">100%</span>
        <button class="ks-source-icon ks-source-larger" type="button" aria-label="放大">${icons.plus}</button>
      </div>
      <button class="ks-source-icon ks-source-fit" type="button" aria-label="适合宽度">${icons.fit}</button>
      <button class="ks-source-icon ks-source-rotate" type="button" aria-label="旋转页面">${icons.rotate}</button>
      <select class="ks-source-theme" aria-label="阅读主题">
        <option value="light">明亮</option>
        <option value="sepia">护眼</option>
        <option value="dark">深色</option>
      </select>
      <a class="ks-source-icon ks-source-original" target="_blank" rel="noopener noreferrer" aria-label="在新窗口打开原文件">${icons.external}</a>
    </header>
    <div class="ks-source-body">
      <aside class="ks-source-sidebar" hidden>
        <div class="ks-source-sidebar-head">
          <strong class="ks-source-sidebar-title">目录</strong>
          <span class="ks-source-sidebar-meta"></span>
        </div>
        <div class="ks-source-sidebar-content"></div>
      </aside>
      <main class="ks-source-viewport" tabindex="0">
        <div class="ks-source-loading" role="status"><span></span><p>正在打开学习资源…</p></div>
        <div class="ks-source-error" hidden>
          <strong>暂时无法在这里打开这个文件</strong>
          <p></p>
          <div class="ks-source-error-actions"><button class="ks-source-retry" type="button">重试</button><a target="_blank" rel="noopener noreferrer">在新窗口打开原文件</a></div>
        </div>
        <div class="ks-source-pdf" hidden><canvas></canvas></div>
        <div class="ks-source-epub" hidden></div>
        <article class="ks-source-document" hidden></article>
        <div class="ks-source-image" hidden><img alt=""></div>
      </main>
    </div>
    <footer class="ks-source-footer">
      <span class="ks-source-status">准备就绪</span>
      <span class="ks-source-progress"></span>
    </footer>
  `;
  stage.appendChild(root);

  const ui = {
    close: root.querySelector('.ks-source-close'),
    select: root.querySelector('.ks-source-select'),
    format: root.querySelector('.ks-source-format'),
    toc: root.querySelector('.ks-source-toc'),
    search: root.querySelector('.ks-source-search'),
    searchButton: root.querySelector('.ks-source-search-button'),
    prev: root.querySelector('.ks-source-prev'),
    next: root.querySelector('.ks-source-next'),
    location: root.querySelector('.ks-source-location input'),
    locationTotal: root.querySelector('.ks-source-location span'),
    smaller: root.querySelector('.ks-source-smaller'),
    larger: root.querySelector('.ks-source-larger'),
    scaleLabel: root.querySelector('.ks-source-scale-label'),
    fit: root.querySelector('.ks-source-fit'),
    rotate: root.querySelector('.ks-source-rotate'),
    theme: root.querySelector('.ks-source-theme'),
    original: root.querySelector('.ks-source-original'),
    body: root.querySelector('.ks-source-body'),
    sidebar: root.querySelector('.ks-source-sidebar'),
    sidebarTitle: root.querySelector('.ks-source-sidebar-title'),
    sidebarMeta: root.querySelector('.ks-source-sidebar-meta'),
    sidebarContent: root.querySelector('.ks-source-sidebar-content'),
    viewport: root.querySelector('.ks-source-viewport'),
    loading: root.querySelector('.ks-source-loading'),
    loadingText: root.querySelector('.ks-source-loading p'),
    error: root.querySelector('.ks-source-error'),
    errorText: root.querySelector('.ks-source-error p'),
    errorLink: root.querySelector('.ks-source-error a'),
    retry: root.querySelector('.ks-source-retry'),
    pdf: root.querySelector('.ks-source-pdf'),
    canvas: root.querySelector('.ks-source-pdf canvas'),
    epub: root.querySelector('.ks-source-epub'),
    document: root.querySelector('.ks-source-document'),
    image: root.querySelector('.ks-source-image'),
    imageElement: root.querySelector('.ks-source-image img'),
    status: root.querySelector('.ks-source-status'),
    progress: root.querySelector('.ks-source-progress'),
  };

  let sources = [];
  let current = null;
  let visible = false;
  let launchButton = null;
  let cleanupCurrent = () => {};
  let pdfModulePromise = null;
  let scriptPromises = new Map();
  let pdfState = null;
  let epubState = null;
  let documentState = null;
  let scale = Number(localStorage.getItem('kimi-source-scale') || 100);
  let theme = localStorage.getItem('kimi-source-theme') || 'light';

  function setStatus(message, progress = '') {
    ui.status.textContent = message;
    ui.progress.textContent = progress;
  }

  function setLoading(on, message = '正在打开学习资源…') {
    ui.loading.hidden = !on;
    ui.loadingText.textContent = message;
  }

  function clearPanels() {
    ui.error.hidden = true;
    ui.pdf.hidden = true;
    ui.epub.hidden = true;
    ui.document.hidden = true;
    ui.image.hidden = true;
    ui.sidebarContent.replaceChildren();
    ui.sidebarMeta.textContent = '';
    ui.sidebar.hidden = true;
    ui.toc.setAttribute('aria-pressed', 'false');
    ui.viewport.scrollTop = 0;
  }

  function showError(error) {
    setLoading(false);
    clearPanels();
    ui.error.hidden = false;
    ui.errorText.textContent = '文件仍然安全保存在课程中。请重试，或在新窗口打开原文件。';
    ui.errorLink.href = current?.url || '#';
    ui.error.dataset.reason = String(error?.message || error || 'unknown').slice(0, 180);
    setStatus('资源打开失败');
  }

  function loadScript(src, globalName) {
    if (globalName && window[globalName]) return Promise.resolve(window[globalName]);
    if (scriptPromises.has(src)) return scriptPromises.get(src);
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => resolve(globalName ? window[globalName] : true);
      script.onerror = () => reject(new Error(`无法加载 ${src}`));
      document.head.appendChild(script);
    });
    scriptPromises.set(src, promise);
    return promise;
  }

  async function withTimeout(promise, timeoutMs, message) {
    let timer = null;
    try {
      return await Promise.race([
        promise,
        new Promise((_, reject) => {
          timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
        }),
      ]);
    } finally {
      window.clearTimeout(timer);
    }
  }

  function extensionOf(url) {
    try {
      const name = new URL(url, location.href).pathname.split('/').pop() || '';
      return name.includes('.') ? name.split('.').pop().toLowerCase() : '';
    } catch {
      return '';
    }
  }

  function kindOf(url) {
    return supported.get(extensionOf(url)) || null;
  }

  function sourceFromUrl(url) {
    const normalized = new URL(url, location.href);
    const direct = sources.find((item) => new URL(item.url, location.href).pathname === normalized.pathname);
    if (direct) return direct;
    if (normalized.origin !== location.origin) return null;
    const coursePrefix = `/api/courses/${encodeURIComponent(courseId)}/`;
    if (!normalized.pathname.startsWith(coursePrefix)) return null;
    if (/\/(?:MISSION|RESOURCES)\.md$/i.test(normalized.pathname)) return null;
    const kind = kindOf(normalized.href);
    if (!kind) return null;
    const name = decodeURIComponent(normalized.pathname.split('/').pop() || '学习资源');
    return {
      id: normalized.pathname,
      name,
      title: name.replace(/\.[^.]+$/, ''),
      path: normalized.pathname.slice(coursePrefix.length),
      kind,
      extension: extensionOf(normalized.href),
      url: normalized.href,
      primary: false,
    };
  }

  function button(label, onClick, className = '') {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = `ks-source-sidebar-item ${className}`.trim();
    item.textContent = label;
    item.addEventListener('click', onClick);
    return item;
  }

  function setSidebar(title, nodes, meta = '') {
    ui.sidebarTitle.textContent = title;
    ui.sidebarMeta.textContent = meta;
    ui.sidebarContent.replaceChildren(...nodes);
    ui.sidebar.hidden = false;
    ui.toc.setAttribute('aria-pressed', 'true');
  }

  function toggleSidebar() {
    const next = !ui.sidebar.hidden;
    ui.sidebar.hidden = next;
    ui.toc.setAttribute('aria-pressed', String(!next));
  }

  function updateControls(kind) {
    root.dataset.kind = kind;
    ui.format.textContent = String(current?.extension || kind).toUpperCase();
    ui.original.href = current?.url || '#';
    ui.theme.value = theme;
    ui.scaleLabel.textContent = `${Math.round(scale)}%`;
    ui.location.value = '1';
    ui.location.readOnly = kind !== 'pdf';
    ui.locationTotal.textContent = '/ 1';
  }

  async function openSource(source) {
    if (!source) return;
    cleanupCurrent();
    cleanupCurrent = () => {};
    pdfState = null;
    epubState = null;
    documentState = null;
    current = source;
    visible = true;
    root.hidden = false;
    root.classList.remove('is-ready');
    stage.classList.add('is-source-viewer-active');
    lessonFrame.setAttribute('aria-hidden', 'true');
    ui.select.value = source.id;
    updateControls(source.kind);
    clearPanels();
    setLoading(true);
    setStatus(`正在打开 ${source.name}`);

    try {
      if (source.kind === 'pdf') await openPdf(source);
      else if (source.kind === 'epub') await openEpub(source);
      else if (source.kind === 'html' || source.kind === 'text') await openDocument(source);
      else if (source.kind === 'image') await openImage(source);
      else throw new Error('当前文件格式暂不支持');
      setLoading(false);
      root.classList.add('is-ready');
      ui.close.focus({ preventScroll: true });
    } catch (error) {
      console.error('[source-viewer]', error);
      showError(error);
    }
  }

  function closeViewer() {
    if (!visible) return;
    visible = false;
    cleanupCurrent();
    cleanupCurrent = () => {};
    root.classList.remove('is-ready');
    stage.classList.remove('is-source-viewer-active');
    lessonFrame.removeAttribute('aria-hidden');
    const finish = () => {
      root.hidden = true;
      clearPanels();
      launchButton?.focus({ preventScroll: true });
    };
    if (reduceMotion.matches) finish();
    else window.setTimeout(finish, 180);
  }

  async function getPdfModule() {
    if (!pdfModulePromise) {
      pdfModulePromise = import('/vendor/pdfjs/build/pdf.mjs').then((module) => {
        module.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/build/pdf.worker.mjs';
        return module;
      });
    }
    return pdfModulePromise;
  }

  async function openPdf(source) {
    const pdfjs = await getPdfModule();
    const loadingTask = pdfjs.getDocument({
      url: source.url,
      cMapUrl: '/vendor/pdfjs/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: '/vendor/pdfjs/standard_fonts/',
      wasmUrl: '/vendor/pdfjs/wasm/',
    });
    const pdf = await loadingTask.promise;
    pdfState = {
      pdf,
      page: 1,
      zoom: Math.max(50, Math.min(250, Number(localStorage.getItem('kimi-source-pdf-zoom') || 100))),
      rotation: 0,
      fit: true,
      renderTask: null,
      searchToken: 0,
    };
    cleanupCurrent = () => {
      pdfState?.renderTask?.cancel?.();
      loadingTask.destroy?.();
      pdf.destroy?.();
      pdfState = null;
    };
    ui.pdf.hidden = false;
    ui.locationTotal.textContent = `/ ${pdf.numPages}`;
    ui.location.max = String(pdf.numPages);
    ui.scaleLabel.textContent = pdfState.fit ? '适宽' : `${pdfState.zoom}%`;
    await renderPdfOutline();
    await renderPdfPage();
    setStatus(source.name, `第 1 / ${pdf.numPages} 页`);
  }

  async function renderPdfPage() {
    const state = pdfState;
    if (!state) return;
    state.renderTask?.cancel?.();
    const page = await state.pdf.getPage(state.page);
    const base = page.getViewport({ scale: 1, rotation: state.rotation });
    const available = Math.max(320, ui.viewport.clientWidth - 56);
    const renderScale = state.fit ? Math.min(2.4, available / base.width) : state.zoom / 100;
    const viewport = page.getViewport({ scale: renderScale, rotation: state.rotation });
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const canvas = ui.canvas;
    const context = canvas.getContext('2d', { alpha: false });
    canvas.width = Math.floor(viewport.width * ratio);
    canvas.height = Math.floor(viewport.height * ratio);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;
    state.renderTask = page.render({
      canvasContext: context,
      viewport,
      transform: ratio === 1 ? null : [ratio, 0, 0, ratio, 0, 0],
    });
    try { await state.renderTask.promise; } catch (error) {
      if (error?.name !== 'RenderingCancelledException') throw error;
    }
    ui.location.value = String(state.page);
    ui.locationTotal.textContent = `/ ${state.pdf.numPages}`;
    ui.scaleLabel.textContent = state.fit ? '适宽' : `${state.zoom}%`;
    setStatus(current.name, `第 ${state.page} / ${state.pdf.numPages} 页`);
  }

  async function renderPdfOutline() {
    const outline = await pdfState.pdf.getOutline();
    if (!outline?.length) {
      ui.sidebar.hidden = true;
      return;
    }
    const nodes = [];
    const append = (items, depth = 0) => {
      for (const item of items) {
        const entry = button(item.title || '未命名章节', async () => {
          try {
            const destination = typeof item.dest === 'string'
              ? await pdfState.pdf.getDestination(item.dest)
              : item.dest;
            if (!destination?.[0]) return;
            pdfState.page = await pdfState.pdf.getPageIndex(destination[0]) + 1;
            await renderPdfPage();
            if (window.innerWidth < 900) toggleSidebar();
          } catch {}
        });
        entry.style.setProperty('--depth', depth);
        nodes.push(entry);
        if (item.items?.length) append(item.items, depth + 1);
      }
    };
    append(outline);
    setSidebar('目录', nodes, `${outline.length} 项`);
    ui.sidebar.hidden = true;
    ui.toc.setAttribute('aria-pressed', 'false');
  }

  async function searchPdf(query) {
    const state = pdfState;
    if (!state || !query.trim()) return;
    const token = ++state.searchToken;
    const needle = query.trim().toLocaleLowerCase();
    setStatus('正在搜索 PDF…');
    const results = [];
    for (let pageNumber = 1; pageNumber <= state.pdf.numPages; pageNumber += 1) {
      if (token !== state.searchToken) return;
      const page = await state.pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items.map((item) => item.str).join(' ').replace(/\s+/g, ' ').trim();
      const index = text.toLocaleLowerCase().indexOf(needle);
      if (index >= 0) {
        const start = Math.max(0, index - 40);
        const excerpt = `${start ? '…' : ''}${text.slice(start, index + needle.length + 70)}${index + needle.length + 70 < text.length ? '…' : ''}`;
        results.push({ pageNumber, excerpt });
      }
      if (results.length >= 80) break;
    }
    const nodes = results.map((result) => {
      const item = button(`第 ${result.pageNumber} 页\n${result.excerpt}`, async () => {
        state.page = result.pageNumber;
        await renderPdfPage();
      }, 'is-search-result');
      return item;
    });
    if (!nodes.length) {
      const empty = document.createElement('p');
      empty.className = 'ks-source-empty';
      empty.textContent = `没有找到“${query.trim()}”`;
      nodes.push(empty);
    }
    setSidebar('搜索结果', nodes, `${results.length} 项`);
    setStatus(current.name, results.length ? `找到 ${results.length} 个相关页面` : '没有找到相关内容');
  }

  function flattenEpubToc(items, output = []) {
    for (const item of Array.isArray(items) ? items : []) {
      if (item && typeof item.href === 'string' && item.href) output.push(item.href);
      flattenEpubToc(item && (item.subitems || item.children), output);
    }
    return output;
  }

  function isEpubFrontMatterHref(href) {
    return /(?:^|[\/_-])(cover|title(?:page)?|toc|nav)(?:[.\/_-]|$)/i.test(String(href || ''));
  }

  function firstReadableEpubTarget(navigation, book) {
    const tocHrefs = flattenEpubToc(navigation && navigation.toc);
    const spineHrefs = (book && book.spine && Array.isArray(book.spine.spineItems) ? book.spine.spineItems : [])
      .filter((item) => item && item.linear !== 'no')
      .map((item) => item.href)
      .filter(Boolean);
    return tocHrefs.find((href) => !isEpubFrontMatterHref(href))
      || spineHrefs.find((href) => !isEpubFrontMatterHref(href))
      || tocHrefs[0]
      || spineHrefs[0]
      || null;
  }

  async function openEpub(source) {
    await loadScript('/vendor/jszip/jszip.min.js', 'JSZip');
    await loadScript('/vendor/epubjs/epub.min.js', 'ePub');
    if (!window.ePub) throw new Error('EPUB 阅读器加载失败');

    const response = await withTimeout(fetch(source.url, { cache: 'no-store' }), 15000, 'EPUB 下载超时');
    if (!response.ok) throw new Error(`EPUB 下载失败：HTTP ${response.status}`);
    const buffer = await withTimeout(response.arrayBuffer(), 15000, 'EPUB 读取超时');
    const book = window.ePub(buffer);
    await withTimeout(book.opened, 30000, 'EPUB 结构解析超时');
    const rendition = book.renderTo(ui.epub, {
      width: '100%',
      height: '100%',
      flow: 'paginated',
      spread: 'auto',
      allowScriptedContent: false,
    });
    epubState = { book, rendition, searchToken: 0 };
    cleanupCurrent = () => {
      try { rendition.destroy(); } catch {}
      try { book.destroy(); } catch {}
      epubState = null;
      ui.epub.replaceChildren();
    };
    ui.epub.hidden = false;

    rendition.themes.register('kimi-light', {
      body: { color: '#202124', background: '#ffffff', 'line-height': '1.75', padding: '0 4%' },
      a: { color: '#0b57d0' },
    });
    rendition.themes.register('kimi-sepia', {
      body: { color: '#3f3528', background: '#f7f0df', 'line-height': '1.78', padding: '0 4%' },
      a: { color: '#7a4b14' },
    });
    rendition.themes.register('kimi-dark', {
      body: { color: '#e8eaed', background: '#202124', 'line-height': '1.78', padding: '0 4%' },
      a: { color: '#8ab4f8' },
    });
    applyReadingTheme();
    rendition.themes.fontSize(`${scale}%`);

    const navigation = await withTimeout(book.loaded.navigation, 8000, 'EPUB 目录读取超时').catch(() => null);
    const firstTarget = firstReadableEpubTarget(navigation, book);
    if (firstTarget) await withTimeout(rendition.display(firstTarget), 15000, 'EPUB 正文打开超时');
    else await withTimeout(rendition.display(), 15000, 'EPUB 内容打开超时');
    renderEpubToc(navigation?.toc || []);
    rendition.on('relocated', (location) => {
      const start = location?.start;
      const percentage = start?.percentage == null ? null : Math.round(start.percentage * 100);
      ui.location.value = String(start?.displayed?.page || 1);
      ui.locationTotal.textContent = `/ ${start?.displayed?.total || 1}`;
      setStatus(start?.href ? decodeURIComponent(start.href.split('/').pop()) : current.name, percentage == null ? '' : `阅读进度 ${percentage}%`);
    });
    setStatus(source.name, 'EPUB 已打开');
  }

  function renderEpubToc(items) {
    const nodes = [];
    const append = (list, depth = 0) => {
      for (const chapter of list) {
        const entry = button(chapter.label?.trim() || '未命名章节', () => {
          epubState?.rendition.display(chapter.href);
          if (window.innerWidth < 900) toggleSidebar();
        });
        entry.style.setProperty('--depth', depth);
        nodes.push(entry);
        if (chapter.subitems?.length) append(chapter.subitems, depth + 1);
      }
    };
    append(items);
    if (nodes.length) {
      setSidebar('目录', nodes, `${nodes.length} 项`);
      ui.sidebar.hidden = true;
      ui.toc.setAttribute('aria-pressed', 'false');
    }
  }

  async function searchEpub(query) {
    const state = epubState;
    if (!state || !query.trim()) return;
    const token = ++state.searchToken;
    setStatus('正在搜索 EPUB…');
    const results = [];
    const needle = query.trim();
    for (const section of state.book.spine.spineItems) {
      if (token !== state.searchToken) return;
      try {
        await section.load(state.book.load.bind(state.book));
        const found = section.find(needle) || [];
        for (const match of found.slice(0, 8)) {
          results.push({ cfi: match.cfi, excerpt: match.excerpt || needle });
          if (results.length >= 80) break;
        }
      } finally {
        section.unload?.();
      }
      if (results.length >= 80) break;
    }
    const nodes = results.map((result) => button(result.excerpt, () => state.rendition.display(result.cfi), 'is-search-result'));
    if (!nodes.length) {
      const empty = document.createElement('p');
      empty.className = 'ks-source-empty';
      empty.textContent = `没有找到“${needle}”`;
      nodes.push(empty);
    }
    setSidebar('搜索结果', nodes, `${results.length} 项`);
    setStatus(current.name, results.length ? `找到 ${results.length} 处内容` : '没有找到相关内容');
  }

  function sanitizeHtml(html, baseUrl) {
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    parsed.querySelectorAll('script,style,link,iframe,frame,object,embed,form,input,button,textarea,select').forEach((item) => item.remove());
    parsed.querySelectorAll('*').forEach((element) => {
      for (const attribute of [...element.attributes]) {
        if (/^on/i.test(attribute.name) || attribute.name === 'srcdoc') element.removeAttribute(attribute.name);
      }
      for (const name of ['src', 'href']) {
        const value = element.getAttribute(name);
        if (!value || /^#/.test(value)) continue;
        try {
          const absolute = new URL(value, baseUrl);
          if (!['http:', 'https:'].includes(absolute.protocol)) element.removeAttribute(name);
          else element.setAttribute(name, absolute.href);
        } catch {
          element.removeAttribute(name);
        }
      }
      if (element.tagName === 'A') {
        element.target = '_blank';
        element.rel = 'noopener noreferrer';
      }
    });
    return parsed.body.innerHTML;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function simpleMarkdown(text) {
    const lines = String(text).split(/\r?\n/);
    let html = '';
    let list = null;
    const closeList = () => { if (list) { html += `</${list}>`; list = null; } };
    for (const raw of lines) {
      const line = raw.trimEnd();
      const heading = line.match(/^(#{1,4})\s+(.+)/);
      const unordered = line.match(/^[-*]\s+(.+)/);
      const ordered = line.match(/^\d+[.)]\s+(.+)/);
      if (heading) {
        closeList();
        const level = heading[1].length;
        html += `<h${level}>${escapeHtml(heading[2])}</h${level}>`;
      } else if (unordered || ordered) {
        const tag = unordered ? 'ul' : 'ol';
        if (list !== tag) { closeList(); list = tag; html += `<${tag}>`; }
        html += `<li>${escapeHtml((unordered || ordered)[1])}</li>`;
      } else if (!line.trim()) {
        closeList();
      } else {
        closeList();
        html += `<p>${escapeHtml(line)}</p>`;
      }
    }
    closeList();
    return html;
  }

  function renderDocumentToc() {
    const headings = [...ui.document.querySelectorAll('h1,h2,h3,h4')];
    const nodes = headings.map((heading, index) => {
      if (!heading.id) heading.id = `source-heading-${index + 1}`;
      const item = button(heading.textContent.trim() || `第 ${index + 1} 节`, () => heading.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' }));
      item.style.setProperty('--depth', Math.max(0, Number(heading.tagName.slice(1)) - 1));
      return item;
    });
    if (nodes.length) {
      setSidebar('目录', nodes, `${nodes.length} 项`);
      ui.sidebar.hidden = true;
      ui.toc.setAttribute('aria-pressed', 'false');
    }
  }

  async function openDocument(source) {
    const response = await fetch(source.url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    documentState = { original: text };
    cleanupCurrent = () => {
      clearDocumentHighlights();
      documentState = null;
      ui.document.replaceChildren();
    };
    ui.document.hidden = false;
    ui.document.innerHTML = source.kind === 'html'
      ? sanitizeHtml(text, source.url)
      : /\.md|\.markdown$/i.test(source.name) ? simpleMarkdown(text) : `<pre>${escapeHtml(text)}</pre>`;
    applyReadingTheme();
    ui.document.style.setProperty('--source-font-scale', String(scale / 100));
    renderDocumentToc();
    setStatus(source.name, `${Math.max(1, text.length).toLocaleString()} 个字符`);
  }

  function clearDocumentHighlights() {
    ui.document.querySelectorAll('mark.ks-source-match').forEach((mark) => mark.replaceWith(document.createTextNode(mark.textContent || '')));
    ui.document.normalize();
  }

  function searchDocument(query) {
    const needle = query.trim();
    if (!needle || ui.document.hidden) return;
    clearDocumentHighlights();
    const walker = document.createTreeWalker(ui.document, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue?.toLocaleLowerCase().includes(needle.toLocaleLowerCase())) return NodeFilter.FILTER_REJECT;
        if (node.parentElement?.closest('script,style,mark')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    let count = 0;
    let first = null;
    for (const textNode of nodes) {
      if (count >= 100) break;
      const value = textNode.nodeValue;
      const lower = value.toLocaleLowerCase();
      let cursor = 0;
      let index = lower.indexOf(needle.toLocaleLowerCase());
      const fragment = document.createDocumentFragment();
      while (index >= 0 && count < 100) {
        fragment.append(value.slice(cursor, index));
        const mark = document.createElement('mark');
        mark.className = 'ks-source-match';
        mark.textContent = value.slice(index, index + needle.length);
        fragment.append(mark);
        first ||= mark;
        count += 1;
        cursor = index + needle.length;
        index = lower.indexOf(needle.toLocaleLowerCase(), cursor);
      }
      fragment.append(value.slice(cursor));
      textNode.replaceWith(fragment);
    }
    first?.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'center' });
    setStatus(current.name, count ? `找到 ${count} 处内容` : '没有找到相关内容');
  }

  async function openImage(source) {
    cleanupCurrent = () => {
      ui.imageElement.removeAttribute('src');
    };
    ui.image.hidden = false;
    ui.imageElement.alt = source.title || source.name;
    await new Promise((resolve, reject) => {
      ui.imageElement.onload = resolve;
      ui.imageElement.onerror = () => reject(new Error('图片加载失败'));
      ui.imageElement.src = source.url;
    });
    setStatus(source.name, `${ui.imageElement.naturalWidth} × ${ui.imageElement.naturalHeight}`);
  }

  function applyReadingTheme() {
    localStorage.setItem('kimi-source-theme', theme);
    root.dataset.theme = theme;
    if (epubState) {
      epubState.rendition.themes.select(`kimi-${theme}`);
      epubState.rendition.themes.fontSize(`${scale}%`);
      epubState.rendition.reportLocation?.();
    }
    if (documentState) ui.document.style.setProperty('--source-font-scale', String(scale / 100));
  }

  function adjustScale(delta) {
    if (pdfState) {
      pdfState.fit = false;
      pdfState.zoom = Math.max(50, Math.min(250, pdfState.zoom + delta));
      localStorage.setItem('kimi-source-pdf-zoom', String(pdfState.zoom));
      renderPdfPage();
      return;
    }
    scale = Math.max(75, Math.min(180, scale + delta));
    localStorage.setItem('kimi-source-scale', String(scale));
    ui.scaleLabel.textContent = `${scale}%`;
    applyReadingTheme();
  }

  function goPrevious() {
    if (pdfState) {
      if (pdfState.page <= 1) return;
      pdfState.page -= 1;
      renderPdfPage();
    } else if (epubState) epubState.rendition.prev();
  }

  function goNext() {
    if (pdfState) {
      if (pdfState.page >= pdfState.pdf.numPages) return;
      pdfState.page += 1;
      renderPdfPage();
    } else if (epubState) epubState.rendition.next();
  }

  function runSearch() {
    const query = ui.search.value.trim();
    if (!query) return;
    if (pdfState) searchPdf(query).catch(showError);
    else if (epubState) searchEpub(query).catch(showError);
    else if (documentState) searchDocument(query);
  }

  function populateSources(list) {
    sources = Array.isArray(list) ? list : [];
    ui.select.replaceChildren(...sources.map((source) => {
      const option = document.createElement('option');
      option.value = source.id;
      option.textContent = `${source.title} · ${source.extension.toUpperCase()}`;
      return option;
    }));
    ensureLaunchButton();
  }

  function ensureLaunchButton() {
    if (!sources.length || !resourceSlot || resourceSlot.querySelector('.ks-source-launch')) return;
    launchButton = document.createElement('button');
    launchButton.type = 'button';
    launchButton.className = 'pill lesson-resource-tool ks-source-launch';
    launchButton.title = '查看上传的原始材料';
    launchButton.innerHTML = `${icons.source}<span class="lesson-resource-tool-label">原文</span>`;
    launchButton.addEventListener('click', () => openSource(sources[0]));
    resourceSlot.appendChild(launchButton);
    resourceSlot.hidden = false;
  }

  function attachFrameLinkInterceptor() {
    let doc;
    try { doc = lessonFrame.contentDocument; } catch { return; }
    if (!doc || doc.documentElement.dataset.kimiSourceViewerBound === 'true') return;
    doc.documentElement.dataset.kimiSourceViewerBound = 'true';
    doc.addEventListener('click', (event) => {
      const anchor = event.target.closest?.('a[href]');
      if (!anchor) return;
      const source = sourceFromUrl(anchor.href || anchor.getAttribute('href'));
      if (!source) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      openSource(source);
    }, true);
  }

  ui.close.addEventListener('click', closeViewer);
  ui.retry.addEventListener('click', () => current && openSource(current));
  ui.select.addEventListener('change', () => openSource(sources.find((item) => item.id === ui.select.value)));
  ui.toc.addEventListener('click', toggleSidebar);
  ui.searchButton.addEventListener('click', runSearch);
  ui.search.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') runSearch();
    if (event.key === 'Escape') { ui.search.value = ''; ui.viewport.focus(); }
  });
  ui.prev.addEventListener('click', goPrevious);
  ui.next.addEventListener('click', goNext);
  ui.smaller.addEventListener('click', () => adjustScale(-10));
  ui.larger.addEventListener('click', () => adjustScale(10));
  ui.fit.addEventListener('click', () => {
    if (!pdfState) return;
    pdfState.fit = true;
    renderPdfPage();
  });
  ui.rotate.addEventListener('click', () => {
    if (!pdfState) return;
    pdfState.rotation = (pdfState.rotation + 90) % 360;
    renderPdfPage();
  });
  ui.theme.addEventListener('change', () => {
    theme = ui.theme.value;
    applyReadingTheme();
  });
  ui.location.addEventListener('change', () => {
    if (!pdfState) return;
    const next = Math.max(1, Math.min(pdfState.pdf.numPages, Number(ui.location.value) || 1));
    pdfState.page = next;
    renderPdfPage();
  });
  ui.viewport.addEventListener('wheel', (event) => {
    if (!pdfState || (!event.ctrlKey && !event.metaKey)) return;
    event.preventDefault();
    adjustScale(event.deltaY > 0 ? -10 : 10);
  }, { passive: false });

  window.addEventListener('keydown', (event) => {
    if (!visible) return;
    if (event.key === 'Escape') { closeViewer(); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
      event.preventDefault();
      ui.search.focus();
      ui.search.select();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && ['+', '=', '-'].includes(event.key)) {
      event.preventDefault();
      adjustScale(event.key === '-' ? -10 : 10);
      return;
    }
    if (['ArrowLeft', 'PageUp'].includes(event.key) && !event.target.closest('input,select')) goPrevious();
    if (['ArrowRight', 'PageDown'].includes(event.key) && !event.target.closest('input,select')) goNext();
  });

  lessonFrame.addEventListener('load', () => {
    window.setTimeout(attachFrameLinkInterceptor, 0);
    window.setTimeout(ensureLaunchButton, 0);
  });

  if (resourceSlot) {
    new MutationObserver(() => window.setTimeout(ensureLaunchButton, 0))
      .observe(resourceSlot, { childList: true });
  }

  fetch(`/api/courses/${encodeURIComponent(courseId)}/sources`)
    .then((response) => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
    .then((data) => populateSources(data.sources))
    .catch((error) => console.warn('[source-viewer] source manifest unavailable', error));

  window.KimiSourceViewer = { open: openSource, close: closeViewer };
})();
