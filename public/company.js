(() => {
  'use strict';

  const state = {
    active: new Map(),
    views: new Map(),
    needsYou: new Map(),
    bootstrapReady: false,
    lastPanelTrigger: null,
  };

  const feed = document.querySelector('#conversation-feed');
  const form = document.querySelector('#work-form');
  const brief = document.querySelector('#work-brief');
  const repoDir = document.querySelector('#repo-dir');
  const runtime = document.querySelector('#runtime');
  const runtimeNote = document.querySelector('#runtime-note');
  const runtimeRetry = document.querySelector('#runtime-retry');
  const runtimeLine = runtimeNote.closest('.runtime-line');
  const settingsSummaryValue = document.querySelector('#settings-summary-value');
  const runSettings = document.querySelector('#run-settings');
  const needsButton = document.querySelector('#needs-you-button');
  const needsPanel = document.querySelector('#needs-you-panel');
  const needsList = document.querySelector('#needs-you-list');
  const needsCount = document.querySelector('#needs-you-count');
  const closeNeeds = document.querySelector('#close-needs-you');
  const send = document.querySelector('#send-work');
  const sendLabel = send.querySelector('.send-label');
  const composerError = document.querySelector('#composer-error');

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const hasGsap = () => Boolean(window.gsap && !reducedMotion.matches);

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function setCanvasState(next) {
    if (document.body.dataset.canvasState === next) return;
    document.body.dataset.canvasState = next;
  }

  function reconcileCanvasState() {
    if (state.needsYou.size) {
      setCanvasState('decision');
      return;
    }
    const phases = [...state.views.values()].map((view) => view.phase || view.card.dataset.canvasPhase || 'active');
    if (phases.includes('decision')) setCanvasState('decision');
    else if (phases.includes('review')) setCanvasState('review');
    else if (phases.some((phase) => ['starting', 'active'].includes(phase))) setCanvasState('active');
    else if (phases.includes('failed')) setCanvasState('failed');
    else setCanvasState('quiet');
  }

  function animateIn(node, { y = 8, duration = 0.32 } = {}) {
    if (!hasGsap()) return;
    window.gsap.fromTo(
      node,
      { autoAlpha: 0, y },
      { autoAlpha: 1, y: 0, duration, ease: 'power2.out', clearProps: 'transform,opacity,visibility' },
    );
  }

  function animateInitialSurface() {
    if (!hasGsap()) return;
    const mm = window.gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const tl = window.gsap.timeline({ defaults: { ease: 'power2.out' } });
      tl.from('[data-animate="intro"] .message-avatar', { autoAlpha: 0, y: 6, duration: 0.28 })
        .from('[data-animate="intro"] .message-content', { autoAlpha: 0, y: 8, duration: 0.38 }, '-=0.14');
      return () => tl.kill();
    });
  }

  function animateAttention() {
    if (!hasGsap()) return;
    window.gsap.fromTo(
      needsButton,
      { scale: 1 },
      { scale: 1.025, duration: 0.14, repeat: 1, yoyo: true, ease: 'power1.inOut', clearProps: 'transform' },
    );
  }

  function showComposerError(message = '') {
    composerError.textContent = message;
    composerError.hidden = !message;
  }

  function setSubmitting(isSubmitting) {
    send.disabled = isSubmitting || !state.bootstrapReady;
    send.dataset.loading = isSubmitting ? 'true' : 'false';
    sendLabel.textContent = isSubmitting ? 'Starting…' : 'Send to Alex';
    brief.disabled = isSubmitting;
    repoDir.disabled = isSubmitting;
    runtime.disabled = isSubmitting;
  }

  function closeExecutionSetupForSubmit() {
    if (!runSettings.open) return;
    const closeEvent = new CustomEvent('lucubro:close-execution', {
      cancelable: true,
      detail: { restoreFocus: false },
    });
    const unhandled = runSettings.dispatchEvent(closeEvent);
    if (unhandled) runSettings.open = false;
  }

  function managerMessage(text) {
    const article = el('article', 'message manager-message canvas-manager-message');
    const avatar = el('div', 'message-avatar', 'A');
    avatar.setAttribute('aria-hidden', 'true');
    const content = el('div', 'message-content');
    content.append(el('div', 'message-author', 'Alex'), el('p', '', text));
    article.append(avatar, content);
    feed.append(article);
    animateIn(article, { y: 5, duration: 0.24 });
    article.scrollIntoView({ block: 'nearest', behavior: reducedMotion.matches ? 'auto' : 'smooth' });
  }

  function canvasIntent(text) {
    const intent = el('article', 'canvas-intent');
    intent.dataset.canvasIntent = '';
    intent.dataset.state = 'receiving';

    const label = el('span', 'canvas-intent-label', 'Intent');
    const copy = el('p', 'canvas-intent-copy', text);
    const receipt = el('span', 'canvas-intent-receipt', 'Alex is structuring this into Work…');
    receipt.setAttribute('role', 'status');
    intent.append(label, copy, receipt);
    feed.append(intent);

    if (hasGsap()) {
      const tl = window.gsap.timeline({ defaults: { ease: 'power2.out' } });
      tl.fromTo(intent, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.24, clearProps: 'transform,opacity,visibility' })
        .fromTo(label, { autoAlpha: 0, x: -5 }, { autoAlpha: 1, x: 0, duration: 0.18, clearProps: 'transform,opacity,visibility' }, '<0.04')
        .fromTo(receipt, { autoAlpha: 0, y: 3 }, { autoAlpha: 1, y: 0, duration: 0.18, clearProps: 'transform,opacity,visibility' }, '<0.05');
    }

    intent.scrollIntoView({ block: 'nearest', behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    return { intent, receipt };
  }

  function resolveCanvasIntent(intentView) {
    if (!intentView) return;
    intentView.intent.dataset.state = 'formed';
    const text = 'Work formed · assigned to Ben';
    if (!hasGsap()) {
      intentView.receipt.textContent = text;
      return;
    }
    window.gsap.timeline()
      .to(intentView.receipt, { autoAlpha: 0, y: -3, duration: 0.11, ease: 'power1.in' })
      .call(() => { intentView.receipt.textContent = text; })
      .fromTo(intentView.receipt, { autoAlpha: 0, y: 3 }, { autoAlpha: 1, y: 0, duration: 0.18, ease: 'power2.out', clearProps: 'transform,opacity,visibility' });
  }

  function failCanvasIntent(intentView, message) {
    if (!intentView) return;
    intentView.intent.dataset.state = 'failed';
    intentView.receipt.textContent = `Could not form Work · ${message}`;
    setCanvasState('failed');
    if (hasGsap()) {
      window.gsap.fromTo(intentView.receipt, { autoAlpha: 0.45, x: -3 }, { autoAlpha: 1, x: 0, duration: 0.2, ease: 'power2.out', clearProps: 'transform,opacity,visibility' });
    }
  }

  function canvasEventCopy(event) {
    if (event.type === 'run.running' || event.type === 'run.started') return 'Run started';
    if (event.type === 'message.delta') return 'Employee update';
    if (event.type === 'tool.started') return `${event.tool || 'Tool'} started`;
    if (event.type === 'tool.completed') return `${event.tool || 'Tool'} finished`;
    if (event.type === 'evidence.produced') return 'Evidence captured';
    if (event.type === 'artifact.updated') return 'Evidence updated';
    if (event.type === 'artifact.produced') return 'Evidence produced';
    if (event.type === 'approval.requested') return 'Decision requested';
    if (event.type === 'approval.resolved') return 'Decision received';
    if (event.type === 'run.completed') return 'Run completed';
    if (event.type === 'run.failed') return 'Run failed';
    return event.type;
  }

  function addCanvasEvent(view, text) {
    if (!text) return;
    const items = [...view.history.querySelectorAll('.canvas-event')];
    if (items.at(-1)?.textContent === text) return;

    const node = el('span', 'canvas-event', text);
    view.history.append(node);
    animateIn(node, { y: 3, duration: 0.18 });

    const all = [...view.history.querySelectorAll('.canvas-event')];
    if (all.length > 5) {
      const first = all[0];
      if (hasGsap()) {
        window.gsap.to(first, { autoAlpha: 0, x: -4, duration: 0.12, ease: 'power1.in', onComplete: () => first.remove() });
      } else first.remove();
    }
  }

  function pulseLiveState(view) {
    if (!hasGsap()) return;
    window.gsap.killTweensOf([view.liveProgress, view.signal]);
    window.gsap.fromTo(
      view.liveProgress,
      { autoAlpha: 0.7, scaleX: 0 },
      {
        autoAlpha: 0,
        scaleX: 1,
        duration: 0.38,
        transformOrigin: 'left center',
        ease: 'power2.out',
        clearProps: 'opacity',
        onComplete: () => window.gsap.set(view.liveProgress, { scaleX: 0 }),
      },
    );
    window.gsap.fromTo(view.signal, { scale: 0.72 }, { scale: 1, duration: 0.22, ease: 'back.out(2)', clearProps: 'transform' });
  }

  function updateLiveState(view, { label, copy, tone = 'neutral', phase = null, event = null } = {}) {
    if (phase) {
      view.phase = phase;
      view.card.dataset.canvasPhase = phase;
      reconcileCanvasState();
    }
    if (tone === 'neutral') view.live.removeAttribute('data-tone');
    else view.live.dataset.tone = tone;

    const apply = () => {
      if (label) view.liveLabel.textContent = label;
      if (copy) view.liveCopy.textContent = copy;
    };

    if (hasGsap() && (label || copy)) {
      window.gsap.killTweensOf([view.liveLabel, view.liveCopy]);
      window.gsap.timeline()
        .to([view.liveLabel, view.liveCopy], { autoAlpha: 0, y: -3, duration: 0.09, ease: 'power1.in', stagger: 0.015 })
        .call(apply)
        .fromTo([view.liveLabel, view.liveCopy], { autoAlpha: 0, y: 4 }, { autoAlpha: 1, y: 0, duration: 0.18, ease: 'power2.out', stagger: 0.02, clearProps: 'transform,opacity,visibility' });
    } else apply();

    if (event) addCanvasEvent(view, canvasEventCopy(event));
    pulseLiveState(view);
  }

  function workObject(work, run) {
    const card = el('article', 'work-object');
    card.dataset.workId = work.id;
    card.dataset.runId = run.id;
    card.dataset.canvasObject = 'work';
    card.dataset.canvasPhase = 'active';

    const header = el('div', 'work-object-header');
    const title = el('div', 'work-object-title');
    title.append(
      el('div', 'work-eyebrow', 'Work'),
      el('strong', '', work.title || work.brief),
      el('div', 'work-owner', 'Ben · Software Engineer'),
    );
    const status = el('span', 'status', 'Starting');
    status.setAttribute('role', 'status');
    header.append(title, status);

    const body = el('div', 'work-object-body');
    const live = el('div', 'canvas-live-state');
    live.setAttribute('role', 'status');
    live.setAttribute('aria-live', 'polite');
    const signal = el('span', 'canvas-live-signal');
    signal.setAttribute('aria-hidden', 'true');
    const liveLabel = el('strong', 'canvas-live-label', 'Work formed');
    const liveCopy = el('span', 'canvas-live-copy', 'Ben is preparing an isolated Run.');
    const liveProgress = el('span', 'canvas-live-progress');
    liveProgress.setAttribute('aria-hidden', 'true');
    live.append(signal, liveLabel, liveCopy, liveProgress);

    const history = el('div', 'canvas-event-history');
    history.setAttribute('aria-label', 'Recent Work events');
    history.append(el('span', 'canvas-event', 'Work created'));

    const progress = el('div', 'work-progress');
    progress.append(el('div', 'activity-line', 'Ben is starting an isolated Run.'));
    body.append(live, history, progress);

    const details = el('details', 'artifact run-detail');
    const summary = el('summary', '', 'Execution details');
    const meta = el('pre', '', `Runtime: ${run.runtime}\nRun: ${run.id}`);
    details.append(summary, meta);
    body.append(details);

    card.append(header, body);
    feed.append(card);

    if (hasGsap()) {
      const tl = window.gsap.timeline({ defaults: { ease: 'power2.out' } });
      tl.fromTo(card, { autoAlpha: 0, y: 14, scale: 0.988 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.3, clearProps: 'transform,opacity,visibility' })
        .fromTo(live, { autoAlpha: 0, y: 5 }, { autoAlpha: 1, y: 0, duration: 0.2, clearProps: 'transform,opacity,visibility' }, '<0.08')
        .fromTo(history.children, { autoAlpha: 0, y: 3 }, { autoAlpha: 1, y: 0, duration: 0.18, stagger: 0.03, clearProps: 'transform,opacity,visibility' }, '<0.04');
    }

    card.scrollIntoView({ block: 'nearest', behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    return { card, body, progress, status, live, signal, liveLabel, liveCopy, liveProgress, history, phase: 'active' };
  }

  function setStatus(view, text, tone = 'neutral') {
    view.status.textContent = text;
    if (tone === 'neutral') view.status.removeAttribute('data-tone');
    else view.status.dataset.tone = tone;
  }

  function addActivity(view, text) {
    const lines = [...view.progress.querySelectorAll('.activity-line')];
    const last = lines.at(-1);
    if (last && last.textContent === text) return;
    const line = el('div', 'activity-line', text);
    view.progress.append(line);
  }

  function addArtifact(view, event) {
    let artifact = view.body.querySelector('.artifact:not(.run-detail)');
    const isNew = !artifact;
    if (!artifact) {
      artifact = el('details', 'artifact');
      artifact.append(el('summary', '', 'Review code changes'), el('pre'));
      const execution = view.body.querySelector('.run-detail');
      if (execution) view.body.insertBefore(artifact, execution);
      else view.body.append(artifact);
    }
    if (event.diff) artifact.querySelector('pre').textContent = event.diff;
    const files = event.changedFiles || [];
    artifact.querySelector('summary').textContent = files.length
      ? `Code changes · ${files.length} file${files.length === 1 ? '' : 's'}`
      : 'Review code changes';

    if (hasGsap()) {
      if (isNew) {
        window.gsap.fromTo(artifact, { autoAlpha: 0, y: 8, scale: 0.99 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.26, ease: 'power2.out', clearProps: 'transform,opacity,visibility' });
      } else {
        window.gsap.fromTo(artifact, { backgroundColor: 'rgba(238,242,255,0.98)' }, { backgroundColor: 'rgba(255,255,255,0)', duration: 0.42, ease: 'power2.out', clearProps: 'backgroundColor' });
      }
    }
  }

  function evidenceSourceCopy(item) {
    if (item.source === 'deterministic-mock') return 'Deterministic mock';
    if (item.source === 'worktree') return 'Worktree evidence';
    return item.source || 'Run evidence';
  }

  function addEvidence(view, item) {
    if (!item || !item.id) return;
    let shelf = view.body.querySelector('.run-evidence-shelf');
    if (!shelf) {
      shelf = el('section', 'run-evidence-shelf');
      shelf.dataset.testid = 'run-evidence';
      shelf.setAttribute('aria-label', 'Run evidence');
      const header = el('div', 'run-evidence-header');
      header.append(el('h3', '', 'Run evidence'), el('span', 'run-evidence-count', '0 captured'));
      shelf.append(header, el('div', 'run-evidence-grid'));
      const execution = view.body.querySelector('.run-detail');
      if (execution) view.body.insertBefore(shelf, execution);
      else view.body.append(shelf);
      animateIn(shelf, { y: 7, duration: 0.24 });
    }

    const grid = shelf.querySelector('.run-evidence-grid');
    if (grid.querySelector(`[data-evidence-id="${CSS.escape(item.id)}"]`)) return;

    const card = el('article', 'run-evidence-item');
    card.dataset.evidenceId = item.id;
    card.dataset.evidenceKind = item.kind || 'unknown';
    if (String(item.mimeType || '').startsWith('image/')) {
      const image = document.createElement('img');
      image.src = `/api/company/evidence/${encodeURIComponent(item.id)}/content`;
      image.alt = `${item.label || 'Screenshot'} evidence`;
      image.loading = 'eager';
      image.decoding = 'async';
      card.append(image);
    } else {
      const glyph = el('div', 'run-evidence-glyph', String(item.kind || 'evidence').slice(0, 1).toUpperCase());
      glyph.setAttribute('aria-hidden', 'true');
      card.append(glyph);
    }

    const copy = el('div', 'run-evidence-copy');
    copy.append(
      el('strong', '', item.label || item.kind || 'Evidence'),
      el('span', 'run-evidence-source', `${evidenceSourceCopy(item)} · ${item.kind || 'evidence'}`),
    );
    const url = item.metadata && item.metadata.url;
    if (url) copy.append(el('span', 'run-evidence-context', url));
    card.append(copy);
    grid.append(card);
    shelf.querySelector('.run-evidence-count').textContent = `${grid.children.length} captured`;

    if (hasGsap()) {
      window.gsap.fromTo(card, { autoAlpha: 0, y: 7, scale: 0.992 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.25, ease: 'power2.out', clearProps: 'transform,opacity,visibility' });
    }
  }

  function renderNeedsYou() {
    const count = state.needsYou.size;
    needsCount.textContent = String(count);
    needsCount.setAttribute('aria-label', `${count} decision${count === 1 ? '' : 's'}`);
    needsButton.dataset.active = count ? 'true' : 'false';
    needsList.replaceChildren();

    if (!count) {
      const empty = el('div', 'empty-panel-state');
      empty.append(el('strong', '', 'Nothing needs your decision.'), el('span', '', 'Running work stays quiet until your judgment matters.'));
      needsList.append(empty);
      return;
    }

    for (const approval of state.needsYou.values()) {
      const card = el('article', 'decision-card');
      card.dataset.testid = 'needs-you-card';
      card.append(
        el('div', 'decision-kicker', 'Authority request'),
        el('strong', '', approval.capability),
        el('p', '', approval.reason || 'This Run needs authority outside its current envelope.'),
      );
      const actions = el('div', 'decision-actions');
      const approve = el('button', 'primary-action', 'Approve once');
      approve.type = 'button';
      approve.addEventListener('click', () => decide(approval, 'allow'));
      const deny = el('button', 'secondary-action', 'Keep blocked');
      deny.type = 'button';
      deny.addEventListener('click', () => decide(approval, 'deny'));
      actions.append(approve, deny);
      card.append(actions);
      needsList.append(card);
    }
  }

  function openNeedsPanel({ focus = false } = {}) {
    if (!needsPanel.hidden) return;
    state.lastPanelTrigger = document.activeElement;
    needsPanel.hidden = false;
    needsButton.setAttribute('aria-expanded', 'true');
    if (hasGsap()) {
      window.gsap.fromTo(needsPanel, { autoAlpha: 0, y: -6, scale: 0.985 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.22, ease: 'power2.out', clearProps: 'transform,opacity,visibility' });
    }
    if (focus) needsPanel.focus({ preventScroll: true });
  }

  function closeNeedsPanel({ restoreFocus = true } = {}) {
    if (needsPanel.hidden) return;
    const finish = () => {
      needsPanel.hidden = true;
      needsButton.setAttribute('aria-expanded', 'false');
      if (restoreFocus && state.lastPanelTrigger instanceof HTMLElement) state.lastPanelTrigger.focus({ preventScroll: true });
    };
    if (hasGsap()) {
      window.gsap.to(needsPanel, { autoAlpha: 0, y: -4, scale: 0.99, duration: 0.15, ease: 'power1.in', onComplete: finish });
    } else finish();
  }

  async function decide(approval, decision) {
    const response = await fetch(`/api/company/runs/${encodeURIComponent(approval.runId)}/approvals/${encodeURIComponent(approval.id)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision }),
    });
    if (!response.ok) {
      const payload = await response.json();
      managerMessage(`I couldn't apply that decision: ${payload.error || response.statusText}`);
      return;
    }
    state.needsYou.delete(approval.id);
    renderNeedsYou();
    if (!state.needsYou.size) closeNeedsPanel({ restoreFocus: false });

    const view = state.views.get(approval.runId);
    if (view) {
      updateLiveState(view, {
        label: decision === 'allow' ? 'Decision received' : 'Boundary kept',
        copy: decision === 'allow' ? 'Approved once. Ben can continue inside the updated Work boundary.' : 'The requested authority remains blocked.',
        tone: decision === 'allow' ? 'neutral' : 'attention',
        phase: decision === 'allow' ? 'active' : 'decision',
      });
    } else reconcileCanvasState();
  }

  async function decideWork(workId, view, decision) {
    const response = await fetch(`/api/company/works/${encodeURIComponent(workId)}/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision }),
    });
    const payload = await response.json();
    if (!response.ok) {
      managerMessage(`I couldn't apply that review decision: ${payload.error || response.statusText}`);
      return;
    }

    view.body.querySelector('.review-actions')?.remove();
    if (decision === 'accept') {
      setStatus(view, 'Accepted', 'success');
      updateLiveState(view, {
        label: 'Accepted',
        copy: 'Your review decision is recorded on this durable Work.',
        tone: 'success',
        phase: 'accepted',
      });
      addCanvasEvent(view, 'CEO accepted Work');
    } else {
      setStatus(view, 'Needs rework', 'attention');
      updateLiveState(view, {
        label: 'Rework requested',
        copy: 'This Run stays in history. A future attempt will be a new Run.',
        tone: 'attention',
        phase: 'decision',
      });
      addCanvasEvent(view, 'CEO requested rework');
    }
  }

  function handleRunEvent(view, event) {
    if (event.type === 'run.running' || event.type === 'run.started') {
      setStatus(view, 'In progress');
      updateLiveState(view, {
        label: 'Run started',
        copy: 'Ben is working in the isolated workspace.',
        phase: 'active',
        event,
      });
    }

    if (event.type === 'message.delta' && event.text) {
      addActivity(view, event.text);
      updateLiveState(view, {
        label: 'Ben update',
        copy: event.text,
        phase: 'active',
        event,
      });
    }

    if (event.type === 'tool.started') {
      const tool = event.tool || 'tool';
      addActivity(view, `Running ${tool}…`);
      updateLiveState(view, {
        label: `Using ${tool}`,
        copy: 'The Run emitted a tool-start event.',
        phase: 'active',
        event,
      });
    }

    if (event.type === 'tool.completed') {
      const tool = event.tool || 'Tool';
      addActivity(view, `${tool} finished.`);
      updateLiveState(view, {
        label: `${tool} finished`,
        copy: 'The Run reported the tool operation complete.',
        phase: 'active',
        event,
      });
    }

    if (event.type === 'evidence.produced' && event.evidence) {
      addEvidence(view, event.evidence);
      updateLiveState(view, {
        label: 'Evidence captured',
        copy: `${event.evidence.label || 'Run evidence'} is now attached to this Work.`,
        phase: 'active',
        event,
      });
    }

    if (event.type === 'artifact.updated' || event.type === 'artifact.produced') {
      addArtifact(view, event);
      const files = event.changedFiles || [];
      updateLiveState(view, {
        label: event.type === 'artifact.produced' ? 'Evidence arrived' : 'Evidence updated',
        copy: files.length ? `${files.length} changed file${files.length === 1 ? '' : 's'} now attached to this Work.` : 'New evidence is attached to this Work.',
        phase: 'active',
        event,
      });
    }

    if (event.type === 'approval.requested' && event.approval) {
      state.needsYou.set(event.approval.id, event.approval);
      renderNeedsYou();
      setStatus(view, 'Needs you', 'attention');
      updateLiveState(view, {
        label: 'Decision needed',
        copy: event.approval.reason || 'The Run reached authority outside its current Delegation Envelope.',
        tone: 'attention',
        phase: 'decision',
        event,
      });
      openNeedsPanel();
      animateAttention();
    }

    if (event.type === 'approval.resolved') {
      setStatus(view, 'In progress');
      updateLiveState(view, {
        label: 'Decision applied',
        copy: 'The Run can continue from the resolved authority boundary.',
        phase: 'active',
        event,
      });
    }

    if (event.type === 'run.completed') {
      setStatus(view, 'Ready for review', 'success');
      addActivity(view, event.summary || 'Ben finished the Run.');
      updateLiveState(view, {
        label: 'Evidence ready',
        copy: event.summary || 'The Run is complete and its evidence is ready for your review.',
        tone: 'success',
        phase: 'review',
        event,
      });

      if (!view.body.querySelector('.review-actions')) {
        const actions = el('div', 'review-actions');
        const accept = el('button', 'primary-action', 'Accept');
        accept.type = 'button';
        accept.addEventListener('click', () => decideWork(view.card.dataset.workId, view, 'accept'));
        const rework = el('button', 'secondary-action', 'Rework');
        rework.type = 'button';
        rework.addEventListener('click', () => decideWork(view.card.dataset.workId, view, 'rework'));
        actions.append(accept, rework);
        view.body.append(actions);
        if (hasGsap()) {
          window.gsap.fromTo(actions.children, { autoAlpha: 0, y: 5 }, { autoAlpha: 1, y: 0, duration: 0.2, stagger: 0.04, ease: 'power2.out', clearProps: 'transform,opacity,visibility' });
        }
      }
    }

    if (event.type === 'run.failed') {
      setStatus(view, 'Failed', 'error');
      addActivity(view, event.error || 'The Run failed.');
      updateLiveState(view, {
        label: 'Run stopped',
        copy: event.error || 'The Run failed. Durable Work and existing evidence remain intact.',
        tone: 'error',
        phase: 'failed',
        event,
      });
    }
  }

  function watchRun(run, view) {
    const source = new EventSource(`/api/company/runs/${encodeURIComponent(run.id)}/stream`);
    state.active.set(run.id, source);
    state.views.set(run.id, view);
    reconcileCanvasState();
    source.onmessage = (message) => {
      const event = JSON.parse(message.data);
      handleRunEvent(view, event);
      if (['run.completed', 'run.failed', 'run.cancelled'].includes(event.type)) {
        source.close();
        state.active.delete(run.id);
      }
    };
    source.onerror = () => {
      if (!state.active.has(run.id)) return;
      setStatus(view, 'Reconnecting…', 'attention');
      updateLiveState(view, {
        label: 'Reconnecting',
        copy: 'The event stream dropped. Lucubro is waiting to resume real Run events.',
        tone: 'attention',
        phase: 'active',
      });
    };
  }

  function updateSettingsSummary() {
    const runtimeLabel = runtime.options[runtime.selectedIndex]?.textContent || 'No runtime';
    const repo = repoDir.value.trim();
    settingsSummaryValue.textContent = repo
      ? `${repo.split('/').filter(Boolean).at(-1) || repo} · ${runtimeLabel}`
      : runtimeLabel;
  }

  async function submitWork(event) {
    event.preventDefault();
    showComposerError('');

    const text = brief.value.trim();
    const repo = repoDir.value.trim();
    const runtimeId = runtime.value;
    const projectId = String(document.body.dataset.activeProjectId || '').trim() || null;

    if (!state.bootstrapReady) {
      showComposerError('The local execution environment is not ready yet.');
      return;
    }
    if (!text) {
      showComposerError('Tell Alex the outcome you want.');
      brief.focus();
      return;
    }
    if (!runtimeId) {
      showComposerError('Choose an available runtime in Execution setup.');
      runSettings.open = true;
      runtime.focus();
      return;
    }

    const intentView = canvasIntent(text);
    setCanvasState('intent');
    brief.value = '';
    closeExecutionSetupForSubmit();
    setSubmitting(true);

    try {
      const response = await fetch('/api/company/works', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief: text,
          repoDir: repo || null,
          projectId,
          runtime: runtimeId,
          employeeId: 'ben',
          delegationEnvelope: { allow: ['workspace.read', 'workspace.write', 'shell.execute'], deny: ['git.push'] },
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to create Work');

      resolveCanvasIntent(intentView);
      const view = workObject(payload.work, payload.run);
      state.views.set(payload.run.id, view);
      reconcileCanvasState();
      watchRun(payload.run, view);
    } catch (error) {
      showComposerError(error.message);
      failCanvasIntent(intentView, error.message);
    } finally {
      setSubmitting(false);
      brief.focus();
    }
  }

  async function bootstrap() {
    state.bootstrapReady = false;
    setSubmitting(false);
    runtimeRetry.hidden = true;
    runtimeLine.dataset.state = 'loading';
    runtimeNote.textContent = 'Checking local workspace…';
    settingsSummaryValue.textContent = 'Checking local workspace…';
    runtime.replaceChildren();

    try {
      const response = await fetch('/api/company/bootstrap');
      if (!response.ok) throw new Error(`Bootstrap failed (${response.status})`);
      const data = await response.json();
      const available = data.runtimes.filter((item) => item.available);

      for (const item of data.runtimes) {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = item.available ? item.id : `${item.id} · unavailable`;
        option.disabled = !item.available;
        runtime.append(option);
      }

      if (available.length) {
        runtime.value = available[0].id;
        runtimeLine.dataset.state = 'ready';
        runtimeNote.textContent = `Ready: ${available.map((item) => item.id).join(', ')}`;
        state.bootstrapReady = true;
      } else {
        runtimeLine.dataset.state = 'error';
        runtimeNote.textContent = 'No local runtime is ready. Execution stays disabled until one is configured.';
        runtimeRetry.hidden = false;
      }

      for (const approval of data.needsYou || []) state.needsYou.set(approval.id, approval);
      renderNeedsYou();
      updateSettingsSummary();
      setSubmitting(false);
    } catch (error) {
      runtimeLine.dataset.state = 'error';
      runtimeNote.textContent = `Workspace unavailable: ${error.message}`;
      settingsSummaryValue.textContent = 'Workspace unavailable';
      runtimeRetry.hidden = false;
      state.bootstrapReady = false;
      setSubmitting(false);
    }
  }

  needsButton.addEventListener('click', () => {
    if (needsPanel.hidden) openNeedsPanel({ focus: true });
    else closeNeedsPanel();
  });
  closeNeeds.addEventListener('click', () => closeNeedsPanel());
  runtimeRetry.addEventListener('click', bootstrap);
  repoDir.addEventListener('input', updateSettingsSummary);
  runtime.addEventListener('change', updateSettingsSummary);
  form.addEventListener('submit', submitWork);

  brief.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !needsPanel.hidden) closeNeedsPanel();
  });

  document.addEventListener('pointerdown', (event) => {
    if (needsPanel.hidden) return;
    if (needsPanel.contains(event.target) || needsButton.contains(event.target)) return;
    closeNeedsPanel({ restoreFocus: false });
  });

  setCanvasState('quiet');
  animateInitialSurface();
  bootstrap();

  window.addEventListener('pagehide', () => {
    for (const source of state.active.values()) source.close();
    state.active.clear();
    state.views.clear();
  }, { once: true });
})();
