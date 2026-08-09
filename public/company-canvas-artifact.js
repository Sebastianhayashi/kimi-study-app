(() => {
  'use strict';

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function evidenceMap(items) {
    return new Map((Array.isArray(items) ? items : []).map((item) => [item.id, item]));
  }

  function usedEvidenceIds(artifact) {
    const ids = [];
    const seen = new Set();
    for (const block of artifact.blocks || []) {
      for (const id of block.evidenceRefs || []) {
        if (seen.has(id)) continue;
        seen.add(id);
        ids.push(id);
      }
      for (const id of block.staticFallback?.evidenceRefs || []) {
        if (seen.has(id)) continue;
        seen.add(id);
        ids.push(id);
      }
    }
    return ids;
  }

  function evidenceHref(id) {
    return `/api/company/evidence/${encodeURIComponent(id)}/content`;
  }

  function citationRow(block, byId) {
    const refs = Array.isArray(block.evidenceRefs) ? block.evidenceRefs : [];
    if (!refs.length) return null;
    const row = el('div', 'canvas-artifact-citations');
    row.append(el('span', 'canvas-artifact-citations-label', refs.length === 1 ? 'Source' : 'Sources'));
    for (const id of refs) {
      const evidence = byId.get(id);
      const link = el('a', 'canvas-artifact-citation', evidence?.label || 'Evidence');
      link.href = `#artifact-source-${id}`;
      link.setAttribute('aria-label', `Jump to source: ${evidence?.label || id}`);
      row.append(link);
    }
    return row;
  }

  function renderTextBlock(block, tag, className, byId) {
    const wrapper = el('section', `canvas-artifact-block ${className}`);
    wrapper.dataset.blockId = block.id;
    wrapper.append(el(tag, '', block.content?.text || ''));
    const citations = citationRow(block, byId);
    if (citations) wrapper.append(citations);
    return wrapper;
  }

  function renderList(block, byId) {
    const wrapper = el('section', 'canvas-artifact-block canvas-artifact-list');
    wrapper.dataset.blockId = block.id;
    const list = el('ul');
    for (const item of block.content?.items || []) list.append(el('li', '', item));
    wrapper.append(list);
    const citations = citationRow(block, byId);
    if (citations) wrapper.append(citations);
    return wrapper;
  }

  function renderTable(block, byId) {
    const wrapper = el('section', 'canvas-artifact-block canvas-artifact-table-wrap');
    wrapper.dataset.blockId = block.id;
    const table = el('table', 'canvas-artifact-table');
    const columns = Array.isArray(block.content?.columns) ? block.content.columns : [];
    const rows = Array.isArray(block.content?.rows) ? block.content.rows : [];
    if (columns.length) {
      const head = el('thead');
      const row = el('tr');
      for (const column of columns) row.append(el('th', '', column));
      head.append(row);
      table.append(head);
    }
    const body = el('tbody');
    for (const values of rows) {
      const row = el('tr');
      for (const value of values) row.append(el('td', '', String(value ?? '')));
      body.append(row);
    }
    table.append(body);
    wrapper.append(table);
    const citations = citationRow(block, byId);
    if (citations) wrapper.append(citations);
    return wrapper;
  }

  function renderImage(block, byId) {
    const wrapper = el('figure', 'canvas-artifact-block canvas-artifact-image');
    wrapper.dataset.blockId = block.id;
    const evidenceId = block.content?.evidenceId || block.evidenceRefs?.[0] || null;
    const evidence = evidenceId ? byId.get(evidenceId) : null;
    const image = document.createElement('img');
    image.alt = block.content?.alt || evidence?.label || 'Artifact image';
    image.loading = 'eager';
    image.decoding = 'async';
    if (evidenceId) image.src = evidenceHref(evidenceId);
    wrapper.append(image);
    if (block.content?.caption) wrapper.append(el('figcaption', '', block.content.caption));
    const citations = citationRow(block, byId);
    if (citations) wrapper.append(citations);
    return wrapper;
  }

  function renderCode(block, byId) {
    const wrapper = el('section', 'canvas-artifact-block canvas-artifact-code');
    wrapper.dataset.blockId = block.id;
    const pre = el('pre');
    const code = el('code', '', block.content?.text || '');
    if (block.content?.language) code.dataset.language = block.content.language;
    pre.append(code);
    wrapper.append(pre);
    const citations = citationRow(block, byId);
    if (citations) wrapper.append(citations);
    return wrapper;
  }

  function renderInteraction(block) {
    const wrapper = el('section', 'canvas-artifact-block canvas-artifact-interaction');
    wrapper.dataset.blockId = block.id;
    const prompt = el('h4', '', block.content?.prompt || 'Choose one');
    const controls = el('div', 'canvas-artifact-choice-group');
    controls.setAttribute('role', 'group');
    controls.setAttribute('aria-label', block.content?.prompt || 'Artifact choice');
    const response = el('p', 'canvas-artifact-interaction-response', 'Choose an option to compare.');
    response.dataset.testid = 'artifact-interaction-response';
    for (const option of block.content?.options || []) {
      const button = el('button', 'canvas-artifact-choice', option);
      button.type = 'button';
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => {
        for (const sibling of controls.querySelectorAll('button')) sibling.setAttribute('aria-pressed', 'false');
        button.setAttribute('aria-pressed', 'true');
        response.textContent = `Selected: ${option}`;
      });
      controls.append(button);
    }
    wrapper.append(prompt, controls, response);
    return wrapper;
  }

  function renderFileReference(block) {
    const wrapper = el('section', 'canvas-artifact-block canvas-artifact-file');
    wrapper.dataset.blockId = block.id;
    const copy = el('div', 'canvas-artifact-file-copy');
    copy.append(
      el('strong', '', block.content?.label || 'Requested file'),
      el('span', '', block.content?.path || ''),
    );
    const open = el('a', 'canvas-artifact-file-open', 'Open file');
    open.href = evidenceHref(block.content?.evidenceId || block.evidenceRefs?.[0] || '');
    open.target = '_blank';
    open.rel = 'noopener';
    wrapper.append(copy, open);
    return wrapper;
  }

  function renderBlock(block, byId) {
    if (block.type === 'heading') return renderTextBlock(block, 'h3', 'canvas-artifact-heading', byId);
    if (block.type === 'paragraph') return renderTextBlock(block, 'p', 'canvas-artifact-paragraph', byId);
    if (block.type === 'claim') return renderTextBlock(block, 'p', 'canvas-artifact-claim', byId);
    if (block.type === 'quote') return renderTextBlock(block, 'blockquote', 'canvas-artifact-quote', byId);
    if (block.type === 'callout') return renderTextBlock(block, 'p', 'canvas-artifact-callout', byId);
    if (block.type === 'list') return renderList(block, byId);
    if (block.type === 'table') return renderTable(block, byId);
    if (block.type === 'image') return renderImage(block, byId);
    if (block.type === 'code') return renderCode(block, byId);
    if (block.type === 'interaction') return renderInteraction(block);
    if (block.type === 'file-reference') return renderFileReference(block);
    return null;
  }

  function renderEvidenceDrawer(artifact, byId) {
    const ids = usedEvidenceIds(artifact);
    if (!ids.length) return null;
    const drawer = el('details', 'canvas-artifact-evidence');
    drawer.dataset.testid = 'artifact-evidence-drawer';
    drawer.append(el('summary', '', `Sources · ${ids.length}`));
    const list = el('div', 'canvas-artifact-evidence-list');
    for (const id of ids) {
      const evidence = byId.get(id);
      if (!evidence) continue;
      const item = el('article', 'canvas-artifact-evidence-item');
      item.id = `artifact-source-${id}`;
      const copy = el('div', 'canvas-artifact-evidence-copy');
      copy.append(el('strong', '', evidence.label || evidence.kind || 'Evidence'));
      const publisher = evidence.metadata?.publisher || evidence.source || 'Evidence';
      copy.append(el('span', '', publisher));
      const sourcePage = evidence.metadata?.sourcePage || evidence.metadata?.url || null;
      if (sourcePage) copy.append(el('span', 'canvas-artifact-evidence-url', sourcePage));
      const actions = el('div', 'canvas-artifact-evidence-actions');
      if (sourcePage) {
        const sourceLink = el('a', '', 'Source page');
        sourceLink.href = sourcePage;
        sourceLink.target = '_blank';
        sourceLink.rel = 'noopener noreferrer';
        actions.append(sourceLink);
      }
      const captured = el('a', '', 'Captured evidence');
      captured.href = evidenceHref(id);
      captured.target = '_blank';
      captured.rel = 'noopener';
      actions.append(captured);
      item.append(copy, actions);
      list.append(item);
    }
    drawer.append(list);
    return drawer;
  }

  function renderArtifact(artifact, evidence = []) {
    if (!artifact || typeof artifact !== 'object') return null;
    const byId = evidenceMap(evidence);
    const root = el('article', 'canvas-artifact');
    root.dataset.testid = 'canvas-artifact';
    root.dataset.artifactId = artifact.id || '';

    const header = el('header', 'canvas-artifact-header');
    const title = el('div', 'canvas-artifact-title');
    title.append(
      el('span', 'canvas-artifact-context', 'Canvas artifact'),
      el('h2', '', artifact.title || 'Untitled artifact'),
    );
    const meta = el('span', 'canvas-artifact-meta', `Revision ${artifact.revision || 1}`);
    header.append(title, meta);

    const body = el('div', 'canvas-artifact-body');
    for (const block of artifact.blocks || []) {
      const rendered = renderBlock(block, byId);
      if (rendered) body.append(rendered);
    }

    const drawer = renderEvidenceDrawer(artifact, byId);
    root.append(header, body);
    if (drawer) root.append(drawer);
    return root;
  }

  window.LucubroCanvasArtifact = Object.freeze({ renderArtifact });
})();
