(function attachLessonScrollPolicy(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.KimiLessonScrollPolicy = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  const INTERACTIVE_SELECTOR = [
    '[data-lenis-prevent]',
    '[data-native-scroll]',
    '.kn-ui',
    '.kn-note-card',
    '.kn-notes-panel',
    'dialog',
    '[popover]',
    'textarea',
    'input',
    'select',
    '[contenteditable="true"]',
    '[draggable="true"]',
    'audio',
    'video',
  ].join(',');

  function isScrollable(element, getStyle = (node) => node.ownerDocument.defaultView.getComputedStyle(node)) {
    if (!element || element.nodeType !== 1) return false;
    const style = getStyle(element);
    const overflowY = style && style.overflowY;
    return /^(auto|scroll|overlay)$/.test(overflowY || '')
      && element.scrollHeight > element.clientHeight + 1;
  }

  function findNativeScrollTarget(node, boundary, getStyle) {
    let current = node && node.nodeType === 1 ? node : node && node.parentElement;
    while (current && current !== boundary) {
      if (current.matches && current.matches(INTERACTIVE_SELECTOR)) return current;
      if (isScrollable(current, getStyle)) return current;
      current = current.parentElement;
    }
    return null;
  }

  function shouldUseNativeScroll(node, boundary, getStyle) {
    return Boolean(findNativeScrollTarget(node, boundary, getStyle));
  }

  return {
    INTERACTIVE_SELECTOR,
    isScrollable,
    findNativeScrollTarget,
    shouldUseNativeScroll,
  };
});
