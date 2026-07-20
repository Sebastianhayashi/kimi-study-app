(() => {
  const ICONS = {
    mission: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 11l2 2 4-4"/><path d="M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/></svg>',
    resources: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6.5h6l2 2h9v9A2.5 2.5 0 0 1 18 20H6a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M3.5 9h17"/></svg>',
    success: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4Z"/><path d="M18.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8Z"/></svg>',
  };

  const PRESENTATION = {
    mission: { label: '学习任务', shortLabel: '任务' },
    resources: { label: '课程资源', shortLabel: '资源' },
    success: { label: 'SUCCESS 速查', shortLabel: 'SUCCESS' },
  };

  const RESOURCE_MATCHERS = [
    { kind: 'mission', pattern: /(?:^|\/)MISSION\.md(?:$|[?#])/i },
    { kind: 'resources', pattern: /(?:^|\/)RESOURCES\.md(?:$|[?#])/i },
    { kind: 'success', pattern: /(?:success|succes)[^/]*\.html?(?:$|[?#])/i },
  ];

  function kindForLink(link) {
    const href = link.href || link.getAttribute('href') || '';
    const text = link.textContent || '';
    const byHref = RESOURCE_MATCHERS.find((entry) => entry.pattern.test(href));
    if (byHref) return byHref.kind;
    if (/任务|mission/i.test(text)) return 'mission';
    if (/资源|resources?/i.test(text)) return 'resources';
    if (/success|succes|速查/i.test(text)) return 'success';
    return null;
  }

  function isAllowedCourseResource(url, courseId) {
    try {
      const parsed = new URL(url, location.href);
      if (parsed.origin !== location.origin) return false;
      return parsed.pathname.startsWith(`/api/courses/${encodeURIComponent(courseId)}/`);
    } catch {
      return false;
    }
  }

  function htmlDocument(html, baseUrl) {
    const parsed = new DOMParser().parseFromString(String(html), 'text/html');
    parsed.querySelectorAll('script, noscript, iframe, object, embed, form').forEach((node) => node.remove());
    parsed.querySelectorAll('*').forEach((node) => {
      [...node.attributes].forEach((attribute) => {
        const name = attribute.name.toLowerCase();
        const value = attribute.value.trim().toLowerCase();
        if (name.startsWith('on') || name === 'srcdoc' || ((name === 'href' || name === 'src') && value.startsWith('javascript:'))) {
          node.removeAttribute(attribute.name);
        }
      });
    });
    let base = parsed.querySelector('base');
    if (!base) {
      base = parsed.createElement('base');
      parsed.head.prepend(base);
    }
    base.href = baseUrl;
    base.target = '_blank';
    parsed.querySelectorAll('a[href]').forEach((link) => {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    });
    return `<!doctype html>\n${parsed.documentElement.outerHTML}`;
  }

  function markdownDocument(markdown, baseUrl) {
    const markedApi = globalThis.marked;
    const purifier = globalThis.DOMPurify;
    const rendered = markedApi?.parse
      ? markedApi.parse(markdown, { gfm: true, breaks: false })
      : `<pre>${String(markdown).replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[char]))}</pre>`;
    const safe = purifier?.sanitize
      ? purifier.sanitize(rendered, {
          USE_PROFILES: { html: true },
          FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
          FORBID_ATTR: ['srcdoc'],
        })
      : rendered;
    const safeBase = String(baseUrl).replace(/"/g, '&quot;');
    return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<base href="${safeBase}" target="_blank">
<style>
:root{color-scheme:light}*{box-sizing:border-box}body{margin:0;padding:34px clamp(24px,6vw,72px) 52px;color:#3c4043;background:#fff;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;font-size:15px;line-height:1.78;-webkit-font-smoothing:antialiased}main{max-width:920px;margin:0 auto}h1,h2,h3{color:#1f1f1f;letter-spacing:-.015em}h1{margin:0 0 20px;font-size:28px;line-height:1.3}h2{margin:30px 0 12px;font-size:20px;line-height:1.4}h3{margin:24px 0 9px;font-size:17px}p{margin:10px 0}ul,ol{padding-left:24px}li{margin:7px 0}a{color:#0b57d0;text-decoration-thickness:1px;text-underline-offset:3px}blockquote{margin:18px 0;padding:12px 16px;border-left:3px solid #a9c7f4;border-radius:0 14px 14px 0;background:#edf4ff}table{display:block;width:100%;max-width:100%;margin:18px 0;border:1px solid #dfe3ea;border-radius:14px;border-collapse:separate;border-spacing:0;overflow:auto}th,td{min-width:120px;padding:10px 12px;border-right:1px solid #dfe3ea;border-bottom:1px solid #dfe3ea;text-align:left;vertical-align:top}th{color:#1f1f1f;background:#f1f4f9;font-weight:700}th:last-child,td:last-child{border-right:0}tr:last-child td{border-bottom:0}code{padding:2px 5px;border-radius:5px;background:#f1f4f9}pre{max-width:100%;padding:14px;border-radius:12px;overflow:auto;background:#f1f4f9}img{max-width:100%;height:auto;border-radius:14px}@media(max-width:640px){body{padding:24px 18px 40px;font-size:14px}h1{font-size:24px}}
</style>
</head>
<body><main>${safe}</main></body>
</html>`;
  }

  function mount({ courseId, lessonFrame }) {
    const slot = document.getElementById('lessonResourceSlot');
    const viewer = document.getElementById('lessonResourceViewer');
    const title = document.getElementById('lessonResourceViewerTitle');
    const badge = document.getElementById('lessonResourceViewerBadge');
    const closeButton = document.getElementById('lessonResourceViewerClose');
    const resourceFrame = document.getElementById('lessonResourceViewerFrame');
    const state = document.getElementById('lessonResourceViewerState');
    if (!slot || !viewer || !title || !badge || !closeButton || !resourceFrame || !state || !lessonFrame) {
      return { reset() {}, destroy() {} };
    }

    const header = slot.closest('.course-header');
    let activeButton = null;
    let requestController = null;
    let layoutFrame = 0;

    const overlapsHeaderControls = () => {
      const left = header?.querySelector('.course-header-left');
      const actions = header?.querySelector('.course-actions');
      if (!left || !actions || slot.hidden) return false;
      const slotRect = slot.getBoundingClientRect();
      const leftRect = left.getBoundingClientRect();
      const actionsRect = actions.getBoundingClientRect();
      return slotRect.left < leftRect.right + 6 || slotRect.right > actionsRect.left - 6;
    };

    const fitLayout = () => {
      cancelAnimationFrame(layoutFrame);
      layoutFrame = requestAnimationFrame(() => {
        slot.classList.remove('layout-compact', 'layout-hidden');
        if (slot.hidden || !slot.childElementCount) return;
        if (overlapsHeaderControls()) slot.classList.add('layout-compact');
        if (overlapsHeaderControls()) slot.classList.add('layout-hidden');
      });
    };

    const setState = (message = '', hidden = false) => {
      state.textContent = message;
      state.hidden = hidden;
    };

    const clearFrame = () => {
      resourceFrame.removeAttribute('srcdoc');
      resourceFrame.src = 'about:blank';
    };

    const close = ({ restoreFocus = false } = {}) => {
      requestController?.abort();
      requestController = null;
      viewer.hidden = true;
      viewer.setAttribute('aria-hidden', 'true');
      slot.querySelectorAll('.lesson-resource-tool').forEach((button) => button.setAttribute('aria-pressed', 'false'));
      const focusTarget = activeButton;
      activeButton = null;
      clearFrame();
      setState('', true);
      if (restoreFocus) focusTarget?.focus();
    };

    const open = async (resource, button) => {
      requestController?.abort();
      requestController = new AbortController();
      activeButton = button;
      slot.querySelectorAll('.lesson-resource-tool').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));

      const presentation = PRESENTATION[resource.kind];
      title.textContent = presentation.label;
      badge.innerHTML = ICONS[resource.kind];
      viewer.hidden = false;
      viewer.setAttribute('aria-hidden', 'false');
      clearFrame();
      setState('正在打开课节资料…');

      try {
        const response = await fetch(resource.href, { signal: requestController.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const source = await response.text();
        resourceFrame.srcdoc = /\.md(?:$|[?#])/i.test(resource.href)
          ? markdownDocument(source, resource.href)
          : htmlDocument(source, resource.href);
      } catch (error) {
        if (error?.name === 'AbortError') return;
        clearFrame();
        setState('暂时无法打开这份资料。课程正文没有被修改，可以稍后重试。');
      }
    };

    const sync = () => {
      close();
      slot.replaceChildren();
      slot.hidden = true;

      let doc;
      try {
        doc = lessonFrame.contentDocument;
      } catch {
        return;
      }
      if (!doc) return;

      const resources = new Map();
      doc.querySelectorAll('a[href]').forEach((link) => {
        const kind = kindForLink(link);
        if (!kind || resources.has(kind)) return;
        const href = link.href;
        if (!isAllowedCourseResource(href, courseId)) return;
        resources.set(kind, { kind, href });
      });

      ['mission', 'resources', 'success'].forEach((kind) => {
        const resource = resources.get(kind);
        if (!resource) return;
        const presentation = PRESENTATION[kind];
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'lesson-resource-tool';
        button.setAttribute('aria-pressed', 'false');
        button.setAttribute('aria-controls', 'lessonResourceViewer');
        button.title = presentation.label;
        button.innerHTML = `${ICONS[kind]}<span class="lesson-resource-tool-label">${presentation.shortLabel}</span>`;
        button.addEventListener('click', () => {
          if (!viewer.hidden && activeButton === button) {
            close({ restoreFocus: true });
          } else {
            open(resource, button);
          }
        });
        slot.append(button);
      });

      slot.hidden = slot.childElementCount === 0;
      fitLayout();
    };

    const resizeObserver = typeof ResizeObserver === 'function' && header
      ? new ResizeObserver(fitLayout)
      : null;
    resizeObserver?.observe(header);

    const onFrameLoad = () => sync();
    const onResourceLoad = () => setState('', true);
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !viewer.hidden) close({ restoreFocus: true });
    };

    lessonFrame.addEventListener('load', onFrameLoad);
    resourceFrame.addEventListener('load', onResourceLoad);
    closeButton.addEventListener('click', () => close({ restoreFocus: true }));
    document.addEventListener('keydown', onKeyDown);

    return {
      reset() {
        close();
        slot.replaceChildren();
        slot.hidden = true;
      },
      destroy() {
        this.reset();
        cancelAnimationFrame(layoutFrame);
        resizeObserver?.disconnect();
        lessonFrame.removeEventListener('load', onFrameLoad);
        resourceFrame.removeEventListener('load', onResourceLoad);
        document.removeEventListener('keydown', onKeyDown);
      },
    };
  }

  globalThis.KimiLessonTools = { mount };
})();
