(() => {
  'use strict';

  const picker = document.querySelector('#workspace-picker');
  const toggle = document.querySelector('#workspace-tree-toggle');
  const panel = document.querySelector('#workspace-tree-panel');
  const tree = document.querySelector('#workspace-tree');
  const rootLabel = document.querySelector('#workspace-root-label');
  const newFolderButton = document.querySelector('#workspace-new-folder');
  const createForm = document.querySelector('#workspace-create-form');
  const createInput = document.querySelector('#workspace-create-name');
  const createCancel = document.querySelector('#workspace-create-cancel');
  const input = document.querySelector('#repo-dir');
  const suggestions = document.querySelector('#workspace-suggestions');
  const repoControl = document.querySelector('#repo-path-control');
  const repoNote = document.querySelector('#repo-path-note');
  const repoReceipt = document.querySelector('#repo-path-receipt');
  const repoScan = document.querySelector('#repo-path-scan');
  const dropReceipt = document.querySelector('#workspace-drop-receipt');
  const dropReceiptTitle = document.querySelector('#workspace-drop-receipt-title');
  const dropReceiptCopy = document.querySelector('#workspace-drop-receipt-copy');

  if (!picker || !toggle || !panel || !tree || !rootLabel || !newFolderButton || !createForm || !createInput || !createCancel || !input || !suggestions || !repoControl || !repoNote || !repoReceipt || !repoScan || !dropReceipt || !dropReceiptTitle || !dropReceiptCopy) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const state = {
    root: null,
    selectedPath: '',
    suggestionItems: [],
    suggestionIndex: -1,
    suggestTimer: null,
    inspectTimer: null,
    inputRevision: 0,
    selectingFromUi: false,
    rootRendered: false,
  };

  const canAnimate = () => Boolean(window.gsap && !reducedMotion.matches);

  function setRepoState(next) {
    if (repoControl.dataset.state !== next) repoControl.dataset.state = next;
  }

  function escapeQuery(value) {
    return encodeURIComponent(value || '');
  }

  async function fetchJson(url, options) {
    const response = await fetch(url, options);
    let payload = null;
    try { payload = await response.json(); } catch {}
    if (!response.ok) throw new Error(payload?.error || response.statusText || `Request failed (${response.status})`);
    return payload;
  }

  function animateEnter(target, { y = 5, duration = 0.22, stagger = 0 } = {}) {
    if (!canAnimate()) return;
    window.gsap.killTweensOf(target);
    window.gsap.fromTo(
      target,
      { autoAlpha: 0, y },
      { autoAlpha: 1, y: 0, duration, stagger, ease: 'power2.out', clearProps: 'transform,opacity,visibility' },
    );
  }

  function animateExit(target, onComplete) {
    if (!canAnimate()) {
      onComplete?.();
      return;
    }
    window.gsap.killTweensOf(target);
    window.gsap.to(target, {
      autoAlpha: 0,
      y: -3,
      duration: 0.14,
      ease: 'power1.in',
      onComplete,
    });
  }

  function animateReadingTrace() {
    if (!canAnimate()) return;
    window.gsap.killTweensOf(repoScan);
    window.gsap.fromTo(
      repoScan,
      { autoAlpha: 0, xPercent: -110, scaleX: 0.5 },
      { autoAlpha: 0.86, xPercent: 410, scaleX: 1, duration: 0.46, ease: 'power2.out', clearProps: 'transform,opacity,visibility' },
    );
  }

  function hideReceipt() {
    if (repoReceipt.hidden) return;
    const finish = () => {
      repoReceipt.hidden = true;
      if (window.gsap) window.gsap.set(repoReceipt, { clearProps: 'all' });
    };
    animateExit(repoReceipt, finish);
  }

  function showReceipt(text, tone = 'success') {
    repoReceipt.textContent = text;
    repoReceipt.dataset.tone = tone;
    repoReceipt.hidden = false;
    animateEnter(repoReceipt, { y: 3, duration: 0.2 });
  }

  function hideSuggestions() {
    state.suggestionItems = [];
    state.suggestionIndex = -1;
    if (suggestions.hidden) return;
    const finish = () => {
      suggestions.hidden = true;
      suggestions.replaceChildren();
      if (window.gsap) window.gsap.set(suggestions, { clearProps: 'all' });
    };
    animateExit(suggestions, finish);
  }

  function updateSuggestionActive() {
    const buttons = [...suggestions.querySelectorAll('.workspace-suggestion')];
    buttons.forEach((button, index) => button.dataset.active = String(index === state.suggestionIndex));
  }

  function renderSuggestions(items) {
    suggestions.replaceChildren();
    state.suggestionItems = items;
    state.suggestionIndex = items.length ? 0 : -1;
    if (!items.length) {
      suggestions.hidden = true;
      return;
    }

    items.forEach((entry, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'workspace-suggestion';
      button.setAttribute('role', 'option');
      button.dataset.active = String(index === state.suggestionIndex);
      button.setAttribute('aria-selected', String(index === state.suggestionIndex));

      const pathCopy = document.createElement('span');
      pathCopy.className = 'workspace-suggestion-path';
      pathCopy.textContent = entry.displayPath;
      const kind = document.createElement('span');
      kind.className = 'workspace-suggestion-kind';
      kind.textContent = entry.isGitRepository ? 'Git repository' : 'Folder';
      button.append(pathCopy, kind);
      button.addEventListener('pointerenter', () => {
        state.suggestionIndex = index;
        updateSuggestionActive();
      });
      button.addEventListener('click', () => selectHostPath(entry.displayPath, { source: 'suggestion' }));
      suggestions.append(button);
    });

    suggestions.hidden = false;
    animateEnter([...suggestions.children], { y: 4, duration: 0.18, stagger: 0.025 });
  }

  async function loadSuggestions(value, revision) {
    try {
      const payload = await fetchJson(`/api/company/workspaces/suggest?q=${escapeQuery(value)}`);
      if (revision !== state.inputRevision) return;
      renderSuggestions(Array.isArray(payload.suggestions) ? payload.suggestions : []);
    } catch (error) {
      if (revision !== state.inputRevision) return;
      hideSuggestions();
      if (/disabled for LAN clients/i.test(error.message)) {
        repoNote.textContent = 'Host browsing is disabled for this LAN client.';
      }
    }
  }

  async function inspectPath(value, revision, { announce = true } = {}) {
    try {
      const info = await fetchJson(`/api/company/workspaces/inspect?path=${escapeQuery(value)}`);
      if (revision !== state.inputRevision) return;
      if (!info.exists || !info.isDirectory) {
        setRepoState('empty');
        repoNote.textContent = 'No host folder exists at this path yet.';
        hideReceipt();
        return;
      }

      state.selectedPath = info.displayPath;
      setRepoState('received');
      if (info.isGitRepository) {
        repoNote.textContent = 'Found on this host. Lucubro can use this Git repository when Work starts.';
        if (announce) showReceipt('Repository found');
      } else {
        repoNote.textContent = 'Folder found on this host. Choose it for workspace use or create a repository inside it.';
        if (announce) showReceipt('Folder found');
      }
      syncSelectedRows();
    } catch (error) {
      if (revision !== state.inputRevision) return;
      setRepoState('error');
      repoNote.textContent = error.message;
      hideReceipt();
    }
  }

  function scheduleInputResolution() {
    clearTimeout(state.suggestTimer);
    clearTimeout(state.inspectTimer);
    state.inputRevision += 1;
    const revision = state.inputRevision;
    const value = input.value.trim();

    hideReceipt();
    if (!value) {
      state.selectedPath = '';
      hideSuggestions();
      setRepoState(document.activeElement === input ? 'focused' : 'empty');
      repoNote.textContent = 'Type ~/… or browse folders on the execution host.';
      syncSelectedRows();
      return;
    }

    setRepoState('reading');
    repoNote.textContent = 'Reading host path…';
    animateReadingTrace();
    state.suggestTimer = window.setTimeout(() => loadSuggestions(value, revision), 90);
    state.inspectTimer = window.setTimeout(() => inspectPath(value, revision), 260);
  }

  function syncSelectedRows() {
    for (const row of tree.querySelectorAll('.workspace-tree-row')) {
      row.dataset.selected = String(row.dataset.path === state.selectedPath);
    }
  }

  function createTreeNode(entry, { isRoot = false } = {}) {
    const node = document.createElement('div');
    node.className = 'workspace-tree-node';
    node.dataset.path = entry.displayPath;

    const row = document.createElement('div');
    row.className = 'workspace-tree-row';
    row.dataset.path = entry.displayPath;
    row.dataset.selected = String(state.selectedPath === entry.displayPath);

    const disclosure = document.createElement('button');
    disclosure.type = 'button';
    disclosure.className = 'workspace-node-toggle';
    disclosure.dataset.leaf = String(!entry.hasChildren && !isRoot);
    disclosure.setAttribute('aria-label', `${entry.hasChildren || isRoot ? 'Expand' : 'No child folders'} ${entry.displayPath}`);
    if (entry.hasChildren || isRoot) disclosure.setAttribute('aria-expanded', 'false');
    const caret = document.createElement('span');
    caret.className = 'workspace-node-caret';
    caret.setAttribute('aria-hidden', 'true');
    caret.textContent = entry.hasChildren || isRoot ? '▸' : '·';
    disclosure.append(caret);

    const name = document.createElement('button');
    name.type = 'button';
    name.className = 'workspace-node-name';
    name.textContent = isRoot ? entry.displayPath : entry.name;
    name.setAttribute('aria-label', `Use folder ${entry.displayPath}`);

    const meta = document.createElement('span');
    meta.className = 'workspace-node-meta';
    meta.dataset.git = String(Boolean(entry.isGitRepository));
    meta.textContent = entry.isGitRepository ? 'Git' : '';

    const children = document.createElement('div');
    children.className = 'workspace-tree-children';
    children.hidden = true;
    children.setAttribute('role', 'group');

    async function expand() {
      if (!(entry.hasChildren || isRoot)) return;
      const isOpen = disclosure.getAttribute('aria-expanded') === 'true';
      if (isOpen) {
        disclosure.setAttribute('aria-expanded', 'false');
        const finish = () => {
          children.hidden = true;
          if (window.gsap) window.gsap.set(children, { clearProps: 'all' });
        };
        animateExit(children, finish);
        return;
      }

      disclosure.setAttribute('aria-expanded', 'true');
      children.hidden = false;
      children.replaceChildren();
      const loading = document.createElement('div');
      loading.className = 'workspace-tree-loading';
      loading.textContent = `Reading ${entry.displayPath}…`;
      children.append(loading);

      try {
        const payload = await fetchJson(`/api/company/workspaces/list?path=${escapeQuery(entry.displayPath)}`);
        children.replaceChildren();
        if (!payload.entries?.length) {
          const empty = document.createElement('div');
          empty.className = 'workspace-tree-empty';
          empty.textContent = 'No visible folders here.';
          children.append(empty);
        } else {
          payload.entries.forEach((child) => children.append(createTreeNode(child)));
        }
        animateEnter([...children.children], { y: 3, duration: 0.18, stagger: 0.025 });
      } catch (error) {
        children.replaceChildren();
        const failure = document.createElement('div');
        failure.className = 'workspace-tree-error';
        failure.textContent = error.message;
        children.append(failure);
      }
    }

    disclosure.addEventListener('click', expand);
    name.addEventListener('click', () => selectHostPath(entry.displayPath, { source: 'tree' }));
    row.append(disclosure, name, meta);
    node.append(row, children);
    return node;
  }

  async function renderRoot() {
    if (state.rootRendered || !state.root) return;
    state.rootRendered = true;
    tree.replaceChildren();
    const rootEntry = {
      ...state.root,
      name: state.root.displayPath,
      hasChildren: true,
    };
    const rootNode = createTreeNode(rootEntry, { isRoot: true });
    tree.append(rootNode);
    animateEnter(rootNode, { y: 4, duration: 0.2 });
    const rootToggle = rootNode.querySelector('.workspace-node-toggle');
    rootToggle?.click();
  }

  async function openTree() {
    toggle.setAttribute('aria-expanded', 'true');
    panel.hidden = false;
    await renderRoot();
    if (canAnimate()) {
      window.gsap.killTweensOf(panel);
      window.gsap.fromTo(panel, { autoAlpha: 0, y: 7, scaleY: 0.985 }, {
        autoAlpha: 1,
        y: 0,
        scaleY: 1,
        duration: 0.24,
        transformOrigin: 'top center',
        ease: 'power2.out',
        clearProps: 'transform,opacity,visibility',
      });
    }
  }

  function closeTree({ restoreFocus = false } = {}) {
    if (panel.hidden) return;
    toggle.setAttribute('aria-expanded', 'false');
    createForm.hidden = true;
    const finish = () => {
      panel.hidden = true;
      if (window.gsap) window.gsap.set(panel, { clearProps: 'all' });
      if (restoreFocus) toggle.focus({ preventScroll: true });
    };
    animateExit(panel, finish);
  }

  async function selectHostPath(displayPath, { source = 'tree' } = {}) {
    state.selectingFromUi = true;
    input.value = displayPath;
    state.selectedPath = displayPath;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    state.selectingFromUi = false;
    hideSuggestions();
    syncSelectedRows();
    const revision = state.inputRevision;
    await inspectPath(displayPath, revision, { announce: true });
    if (source === 'suggestion') input.focus({ preventScroll: true });
  }

  async function initRoot() {
    try {
      const payload = await fetchJson('/api/company/workspaces/root');
      state.root = payload.root;
      rootLabel.textContent = `${payload.root.displayPath} · execution host`;
      repoNote.textContent = 'Type ~/… or browse folders on the execution host.';
    } catch (error) {
      rootLabel.textContent = 'Host browser unavailable';
      repoNote.textContent = error.message;
      toggle.disabled = true;
      newFolderButton.disabled = true;
    }
  }

  function openCreateForm() {
    createForm.hidden = false;
    createInput.value = '';
    if (canAnimate()) animateEnter(createForm, { y: 4, duration: 0.2 });
    createInput.focus({ preventScroll: true });
  }

  function closeCreateForm({ restoreFocus = false } = {}) {
    if (createForm.hidden) return;
    const finish = () => {
      createForm.hidden = true;
      createInput.value = '';
      if (window.gsap) window.gsap.set(createForm, { clearProps: 'all' });
      if (restoreFocus) newFolderButton.focus({ preventScroll: true });
    };
    animateExit(createForm, finish);
  }

  async function createFolder(event) {
    event.preventDefault();
    const name = createInput.value.trim();
    if (!name) return;
    const parentPath = state.selectedPath || state.root?.displayPath || '~';
    const submit = createForm.querySelector('.workspace-create-submit');
    submit.disabled = true;
    createInput.disabled = true;
    try {
      const payload = await fetchJson('/api/company/workspaces/directories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentPath, name }),
      });
      closeCreateForm();
      state.rootRendered = false;
      tree.replaceChildren();
      await renderRoot();
      await selectHostPath(payload.directory.displayPath, { source: 'tree' });
      repoNote.textContent = 'New folder created on the execution host.';
      showReceipt('Folder created');
    } catch (error) {
      repoNote.textContent = error.message;
      setRepoState('error');
    } finally {
      submit.disabled = false;
      createInput.disabled = false;
    }
  }

  function directoryNameFromDrop(event) {
    const items = [...(event.dataTransfer?.items || [])];
    const item = items.find((candidate) => candidate.kind === 'file');
    if (!item) return Promise.resolve(null);

    if (typeof item.getAsFileSystemHandle === 'function') {
      return item.getAsFileSystemHandle().then((handle) => handle?.kind === 'directory' ? handle.name : null).catch(() => null);
    }
    if (typeof item.webkitGetAsEntry === 'function') {
      const entry = item.webkitGetAsEntry();
      return Promise.resolve(entry?.isDirectory ? entry.name : null);
    }
    return Promise.resolve(null);
  }

  async function handleDrop(event) {
    event.preventDefault();
    picker.dataset.dragActive = 'false';
    const name = await directoryNameFromDrop(event);
    if (!name) return;

    dropReceiptTitle.textContent = `Local folder detected: ${name}`;
    dropReceiptCopy.textContent = 'This browser is controlling the NixOS execution host. A browser folder handle is not a NixOS path, so Lucubro will not pretend it can run there. Use the host tree now; direct folder import will require an explicit copy/native bridge.';
    dropReceipt.hidden = false;
    animateEnter(dropReceipt, { y: 4, duration: 0.23 });
  }

  toggle.addEventListener('click', () => {
    if (panel.hidden) openTree();
    else closeTree({ restoreFocus: true });
  });

  input.addEventListener('focus', () => {
    if (!input.value.trim()) setRepoState('focused');
  });
  input.addEventListener('input', scheduleInputResolution);
  input.addEventListener('blur', () => {
    window.setTimeout(() => {
      if (!suggestions.contains(document.activeElement)) hideSuggestions();
      if (!input.value.trim()) setRepoState('empty');
    }, 80);
  });

  input.addEventListener('keydown', (event) => {
    if (suggestions.hidden || !state.suggestionItems.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      state.suggestionIndex = Math.min(state.suggestionItems.length - 1, state.suggestionIndex + 1);
      updateSuggestionActive();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      state.suggestionIndex = Math.max(0, state.suggestionIndex - 1);
      updateSuggestionActive();
    } else if (event.key === 'Enter' && state.suggestionIndex >= 0) {
      event.preventDefault();
      selectHostPath(state.suggestionItems[state.suggestionIndex].displayPath, { source: 'suggestion' });
    } else if (event.key === 'Escape') {
      event.preventDefault();
      hideSuggestions();
    }
  });

  newFolderButton.addEventListener('click', openCreateForm);
  createCancel.addEventListener('click', () => closeCreateForm({ restoreFocus: true }));
  createForm.addEventListener('submit', createFolder);

  picker.addEventListener('dragenter', (event) => {
    event.preventDefault();
    picker.dataset.dragActive = 'true';
  });
  picker.addEventListener('dragover', (event) => {
    event.preventDefault();
    picker.dataset.dragActive = 'true';
  });
  picker.addEventListener('dragleave', (event) => {
    if (!picker.contains(event.relatedTarget)) picker.dataset.dragActive = 'false';
  });
  picker.addEventListener('drop', handleDrop);

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (!suggestions.hidden) {
      hideSuggestions();
      return;
    }
    if (!panel.hidden) closeTree({ restoreFocus: true });
  });

  window.addEventListener('pagehide', () => {
    clearTimeout(state.suggestTimer);
    clearTimeout(state.inspectTimer);
    if (window.gsap) window.gsap.killTweensOf([panel, suggestions, repoReceipt, repoScan, dropReceipt]);
  }, { once: true });

  initRoot();
  if (input.value.trim()) scheduleInputResolution();
})();
