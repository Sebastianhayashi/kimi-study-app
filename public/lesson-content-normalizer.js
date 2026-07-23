(() => {
  'use strict';
  const html = document.documentElement;
  html.classList.add('ks-lesson-enter');

  function score(element) {
    if (!element || element === document.body || element.closest('.kn-ui')) return -1;
    const text = (element.innerText || '').trim();
    const rect = element.getBoundingClientRect();
    if (text.length < 180 || rect.width < 320) return -1;
    let value = Math.min(text.length, 8000) / 80;
    if (['MAIN', 'ARTICLE'].includes(element.tagName)) value += 40;
    if (/lesson|content|container|page|document/i.test(element.className || '')) value += 28;
    if (element.parentElement === document.body) value += 18;
    return value;
  }

  function normalize() {
    const selectors = [
      '[data-lesson-root]', 'main', 'article', '.lesson-content', '.lesson', '.content', '.container', '.page', '.document', '#content', '#lesson',
    ];
    const candidates = [...new Set(selectors.flatMap((selector) => [...document.querySelectorAll(selector)]))];
    let root = candidates.sort((a, b) => score(b) - score(a))[0];
    if (!root || score(root) < 0) {
      root = [...document.body.children]
        .filter((element) => !['SCRIPT', 'STYLE', 'LINK'].includes(element.tagName) && !element.classList.contains('kn-ui'))
        .sort((a, b) => score(b) - score(a))[0];
    }
    if (root && score(root) >= 0) {
      const rect = root.getBoundingClientRect();
      const computed = getComputedStyle(root);
      const visuallyUnbounded = rect.width > 920 || rect.left < 22 || computed.marginLeft === '0px' || computed.maxWidth === 'none';
      if (visuallyUnbounded) root.classList.add('ks-lesson-document-root');
    }
    requestAnimationFrame(() => {
      html.classList.remove('ks-lesson-enter');
      html.classList.add('ks-lesson-ready');
      parent.postMessage({ type: 'lesson-visual-ready' }, '*');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', normalize, { once: true });
  else normalize();
})();
