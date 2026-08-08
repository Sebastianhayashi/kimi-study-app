(() => {
  'use strict';

  const state = {
    active: new Map(),
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

  function animateIn(node, { y = 8, duration = 0.32 } = {}) {
    if (!hasGsap()) return;
    window.gsap.fromTo(node, { autoAlpha: 0, y }, { autoAlpha: 1, y: 0, duration, ease: 'power2.out', clearProps: 'transform,opacity,visibility' });
  }

  function animateInitialSurface() {
    if (!hasGsap()) return;
    const mm = window.gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const tl = window.gsap.timeline({ defaults: { ease: 'power2.out' } });
      tl.from('[data-animate="intro"] .message-avatar', { autoAlpha: 0, y: 6, duration: 0.28 })
        .from('[data-animate="intro"] .message-content', { autoAlpha: 0, y: 8, duration: 0.38 }, '-=0.14')
        .from('[data-animate="composer"]', { autoAlpha: 0, y: 10, duration: 0.36 }, '-=0.12');
      return () => tl.kill();
    });
  }

  function animateAttention() {
    if (!hasGsap()) return;
    window.gsap.fromTo(needsButton, { scale: 1 }, { scale: 1.025, duration: 0.14, repeat: 1, yoyo: true, ease: 'power1.inOut', clearProps: 'transform' });
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

  function managerMessage(text) {
    const article = el('article', 'message manager-message');
    const avatar = el('div', 'message-avatar', 'A');
    avatar.setAttribute('aria-hidden', 'true');
    const content = el('div', 'message-content');
    content.append(el('div', 'message-author', 'Alex'), el('p', '', text));
    article.append(avatar, content);
    feed.append(article);
    animateIn(article);
    article.scrollIntoView({ block: 'nearest', behavior: reducedMotion.matches ? 'auto' : 'smooth' });
  }

  function userMessage(text) {
    const article = el('article', 'message user-message');
    const content = el('div', 'message-content');
    content.append(el('p', '', text));
    article.append(content);
    feed.append(article);
    animateIn(article, { y: 6, duration: 0.26 });
  }

  function workObject(work, run) {
    const card = el('article', 'work-object');
    card.dataset.workId = work.id;
    card.dataset.runId = run.id;

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
    const progress = el('div', 'work-progress');
    progress.append(el('div', 'activity-line', 'Ben is starting an isolated Run.'));
    body.append(progress);

    const details = el('details', 'artifact run-detail');
    const summary = el('summary', '', 'Execution details');
    const meta = el('pre', '', `Runtime: ${run.runtime}\nRun: ${run.id}`);
    details.append(summary, meta);
    body.append(details);

    card.append(header, body);
    feed.append(card);
    animateIn(card, { y: 10, duration: 0.34 });
    return { card, body, progress, status };
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
    animateIn(line, { y: 4, duration: 0.22 });
  }

  function addArtifact(view, event) {
    let artifact = view.body.querySelector('.artifact:not(.run-detail)');
    if (!artifact) {
      artifact = el('details', 'artifact');
      artifact.append(el('summary', '', 'Review code changes'), el('pre'));
      view.body.append(artifact);
      animateIn(artifact, { y: 5, duration: 0.24 });
    }
    if (event.diff) artifact.querySelector('pre').textContent = event.diff;
    const files = event.changedFiles || [];
    artifact.querySelector('summary').textContent = files.length
      ? `Code changes · ${files.length} file${files.length === 1 ? '' : 's'}`
      : 'Review code changes';
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
    managerMessage(decision === 'allow'
      ? 'Approved for that one decision. Ben can continue.'
      : 'Kept blocked. I’ll preserve the boundary and the current Work context.');
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
      managerMessage('Accepted. I recorded this Work as complete.');
    } else {
      setStatus(view, 'Needs rework', 'attention');
      managerMessage('Marked for rework. The current Run stays in history; the next attempt will be a new Run.');
    }
  }

  function handleRunEvent(view, event) {
    if (event.type === 'run.running' || event.type === 'run.started') setStatus(view, 'In progress');
    if (event.type === 'message.delta' && event.text) addActivity(view, event.text);
    if (event.type === 'tool.started') addActivity(view, `Running ${event.tool || 'tool'}…`);
    if (event.type === 'tool.completed') addActivity(view, `${event.tool || 'Tool'} finished.`);
    if (event.type === 'artifact.updated' || event.type === 'artifact.produced') addArtifact(view, event);

    if (event.type === 'approval.requested' && event.approval) {
      state.needsYou.set(event.approval.id, event.approval);
      renderNeedsYou();
      setStatus(view, 'Needs you', 'attention');
      openNeedsPanel();
      animateAttention();
    }

    if (event.type === 'approval.resolved') setStatus(view, 'In progress');

    if (event.type === 'run.completed') {
      setStatus(view, 'Ready for review', 'success');
      addActivity(view, event.summary || 'Ben finished the Run.');
      managerMessage('Ben finished this Run. The Work is ready for your review.');
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
        animateIn(actions, { y: 4, duration: 0.22 });
      }
    }

    if (event.type === 'run.failed') {
      setStatus(view, 'Failed', 'error');
      addActivity(view, event.error || 'The Run failed.');
      managerMessage('This Run stopped. I kept the Work and its evidence intact so we can retry or redirect it.');
    }
  }

  function watchRun(run, view) {
    const source = new EventSource(`/api/company/runs/${encodeURIComponent(run.id)}/stream`);
    state.active.set(run.id, source);
    source.onmessage = (message) => {
      const event = JSON.parse(message.data);
      handleRunEvent(view, event);
      if (['run.completed', 'run.failed', 'run.cancelled'].includes(event.type)) {
        source.close();
        state.active.delete(run.id);
      }
    };
    source.onerror = () => {
      if (state.active.has(run.id)) setStatus(view, 'Reconnecting…', 'attention');
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

    if (!state.bootstrapReady) {
      showComposerError('The local workspace is not ready yet.');
      return;
    }
    if (!text) {
      showComposerError('Tell Alex the outcome you want.');
      brief.focus();
      return;
    }
    if (!repo) {
      showComposerError('Choose a repository path in Execution setup.');
      runSettings.open = true;
      repoDir.focus();
      return;
    }
    if (!runtimeId) {
      showComposerError('Choose an available runtime in Execution setup.');
      runSettings.open = true;
      runtime.focus();
      return;
    }

    userMessage(text);
    brief.value = '';
    setSubmitting(true);

    try {
      const response = await fetch('/api/company/works', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief: text,
          repoDir: repo,
          runtime: runtimeId,
          employeeId: 'ben',
          delegationEnvelope: { allow: ['workspace.read', 'workspace.write', 'shell.execute'], deny: ['git.push'] },
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to create Work');

      managerMessage('I created the Work and assigned it to Ben. I’ll keep the execution quiet unless a decision needs you.');
      const view = workObject(payload.work, payload.run);
      watchRun(payload.run, view);
    } catch (error) {
      showComposerError(error.message);
      managerMessage(`I couldn't start that Work: ${error.message}`);
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

  animateInitialSurface();
  bootstrap();
})();
