(() => {
  'use strict';

  const Core = window.KimiMarginNotesCore;
  if (!Core) return;

  function mount(controller) {
    if (!controller || controller.__contextualActionsMounted) return () => {};
    controller.__contextualActionsMounted = true;

    // Wave 8 replaces the old fixed two-button menu. Wave 8.1 keeps three
    // persistent button nodes so an async router response cannot detach the
    // button currently under a mouse, pen, keyboard, or touch activation.
    document.removeEventListener('mouseup', controller.onMouseUp);
    controller.toolbar?.remove();

    const toolbar = document.createElement('div');
    toolbar.className = 'kn-ui ks-context-actions';
    toolbar.setAttribute('role', 'toolbar');
    toolbar.setAttribute('aria-label', '选中文本操作');
    toolbar.hidden = true;
    // Keep the contextual toolbar in the iframe viewport. A browser or
    // automation client must not need to scroll the lesson document merely
    // to activate an already visible contextual action.
    toolbar.style.position = 'fixed';

    const buttons = Array.from({ length: 3 }, () => {
      const button = document.createElement('button');
      button.type = 'button';
      button.hidden = true;
      toolbar.appendChild(button);
      return button;
    });
    document.body.appendChild(toolbar);

    let requestId = 0;
    let savedRange = null;
    let savedContext = null;
    let currentActions = [];
    let currentRect = null;
    let pendingRender = null;
    let activating = false;
    let activePress = null;
    let finalizeTimer = 0;
    let renderedScroll = { x: window.scrollX, y: window.scrollY };
    let speech = null;

    const hide = ({ invalidate = true, force = false } = {}) => {
      if (activating && !force) return;
      if (invalidate) requestId += 1;
      window.clearTimeout(finalizeTimer);
      finalizeTimer = 0;
      activePress = null;
      activating = false;
      toolbar.hidden = true;
      buttons.forEach((button) => {
        button.hidden = true;
        button.removeAttribute('data-action');
        button.textContent = '';
      });
      currentActions = [];
      currentRect = null;
      pendingRender = null;
      savedRange = null;
      savedContext = null;
    };

    const speak = (text) => {
      if (!('speechSynthesis' in window) || !window.SpeechSynthesisUtterance) return;
      window.speechSynthesis.cancel();
      speech = new SpeechSynthesisUtterance(text);
      speech.lang = /[A-Za-z]/.test(text) ? 'en-US' : (document.documentElement.lang || 'zh-CN');
      speech.rate = text.length <= 40 ? 0.9 : 1;
      window.speechSynthesis.speak(speech);
    };

    const noteFromSelection = (kind, custom, context) => {
      if (!context) return;
      const note = Core.normalizeNote({
        id: `n${Date.now().toString(36)}`,
        anchor: context.anchor,
        section: context.section,
        lessonFile: controller.lessonFile,
        question: kind === 'vocabulary' ? context.selectedText : '',
        custom,
        kind,
        side: 'left',
        createdAt: Date.now(),
      }, controller.store.notes.length);
      controller.store.add(note);
      controller.renderNote(note);
      controller.requestLayout();
      parent.postMessage({ type: 'notes-changed' }, '*');
    };

    const positionToolbar = (rect) => {
      if (!rect) return;
      const width = Math.min(260, Math.max(132, toolbar.getBoundingClientRect().width));
      const left = Core.clamp(
        rect.left + rect.width / 2 - width / 2,
        8,
        document.documentElement.clientWidth - width - 8,
      );
      const above = rect.top - toolbar.offsetHeight - 10;
      toolbar.style.left = `${left}px`;
      toolbar.style.top = `${above > 8 ? above : rect.bottom + 8}px`;
      renderedScroll = { x: window.scrollX, y: window.scrollY };
    };

    const render = (actions, rect) => {
      const next = Array.isArray(actions) ? actions.slice(0, 3) : [];
      if (activating) {
        pendingRender = { actions: next, rect };
        return;
      }
      currentActions = next;
      currentRect = rect;
      buttons.forEach((button, index) => {
        const action = next[index];
        if (!action) {
          button.hidden = true;
          button.removeAttribute('data-action');
          button.textContent = '';
          return;
        }
        button.hidden = false;
        button.dataset.action = action.id;
        button.textContent = action.label;
      });
      if (!next.length) {
        hide({ invalidate: false, force: true });
        return;
      }
      toolbar.hidden = false;
      positionToolbar(rect);
    };

    const finishActivation = () => {
      activating = false;
      activePress = null;
      if (!pendingRender) return;
      const pending = pendingRender;
      pendingRender = null;
      render(pending.actions, pending.rect);
    };

    const snapshotAction = (actionId) => {
      const action = currentActions.find((item) => item.id === actionId);
      if (!action || !savedRange || !savedContext) return null;
      return {
        action: { ...action },
        context: { ...savedContext },
        range: savedRange.cloneRange(),
      };
    };

    const finalizePerformedAction = () => {
      finalizeTimer = 0;
      hide({ invalidate: false, force: true });
      window.getSelection()?.removeAllRanges();
    };

    const performSnapshot = (snapshot) => {
      if (!snapshot) {
        finishActivation();
        return;
      }
      const { action, context, range } = snapshot;

      // Invalidate the in-flight router response before any user-visible
      // action. The response may still complete, but it can no longer redraw
      // the toolbar or change the action that was pressed.
      requestId += 1;
      pendingRender = null;

      if (action.id === 'pronounce' || action.id === 'read') {
        speak(context.selectedText);
      } else if (action.id === 'note') {
        controller.openDraft(range, context.anchor, context.section);
      } else if (action.id === 'save-card') {
        const example = context.surrounding && context.surrounding !== context.selectedText
          ? `例句：${context.surrounding.slice(0, 420)}`
          : '从当前课文保存的词卡。';
        noteFromSelection('vocabulary', example, context);
      } else if (action.id === 'scratch') {
        parent.postMessage({
          type: 'study-surface-add',
          kind: 'quote',
          quote: context.selectedText,
          section: context.section,
          body: '',
        }, '*');
      } else if (action.id === 'explain' || action.id === 'ask') {
        parent.postMessage({
          type: 'ask-selection',
          ...context,
          suggestedPrompt: action.id === 'explain'
            ? `请结合当前课节，用容易理解的方式解释这段内容：${context.selectedText}`
            : `请结合当前课节回答我关于这段内容的问题：${context.selectedText}`,
        }, '*');
      }

      // Keep the pressed node visible through pointerup and the browser's
      // subsequent click dispatch. Finalize in the next task so Playwright,
      // touch browsers and assistive activation all complete against the same
      // connected button node.
      window.clearTimeout(finalizeTimer);
      finalizeTimer = window.setTimeout(finalizePerformedAction, 0);
    };

    const requestActions = async (context, rect, id) => {
      try {
        const response = await fetch(`/api/courses/${controller.courseId}/learning-actions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...context,
            lessonFile: controller.lessonFile,
            locale: document.documentElement.lang,
          }),
        });
        const data = response.ok ? await response.json() : null;
        if (id !== requestId || !data) return;
        render(Array.isArray(data.actions) ? data.actions : [], rect);
      } catch {
        if (id !== requestId) return;
        render([
          { id: 'ask', label: '问 Lucubro' },
          { id: 'note', label: '记笔记' },
          { id: 'scratch', label: '放到草稿' },
        ], rect);
      }
    };

    const handleSelection = (event) => {
      const target = event.target instanceof Element ? event.target : event.target?.parentElement;
      if (target?.closest?.('.kn-ui, .ks-curiosity-card, [data-study-ready="true"]')) return;
      window.setTimeout(() => {
        if (activating) return;
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || !selection.toString().trim()) {
          hide();
          return;
        }
        savedRange = selection.getRangeAt(0).cloneRange();
        const anchorData = controller.textIndex.anchorFromRange(savedRange);
        savedContext = {
          selectedText: anchorData.textQuote.exact,
          surrounding: controller.surroundingOf(savedRange),
          section: controller.sectionOf(savedRange),
          anchor: {
            exact: anchorData.textQuote.exact,
            prefix: anchorData.textQuote.prefix,
            suffix: anchorData.textQuote.suffix,
            position: anchorData.textPosition,
          },
        };
        const rect = savedRange.getBoundingClientRect();
        const id = ++requestId;

        // Render a useful fallback immediately. The backend may refine these
        // actions, but it updates the same three nodes instead of replacing
        // the DOM under the user.
        render([
          { id: 'ask', label: '问 Lucubro' },
          { id: 'note', label: '记笔记' },
          { id: 'scratch', label: '放到草稿' },
        ], rect);
        void requestActions(savedContext, rect, id);
      }, 0);
    };

    // A browser may collapse the DOM Selection while moving focus toward
    // the toolbar. Do not treat that transient collapse as an outside click.
    // Dismiss only after an explicit outside interaction, scrolling, Escape,
    // or a completed action.
    const handleOutsidePointerDown = (event) => {
      const target = event.target instanceof Element ? event.target : event.target?.parentElement;
      if (target?.closest?.('.ks-context-actions')) return;
      if (!toolbar.hidden) hide();
    };

    const SCROLL_KEYS = new Set([
      'ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' ',
    ]);

    const handleKeyDown = (event) => {
      if (toolbar.hidden) return;
      if (event.key === 'Escape') {
        hide({ force: true });
        return;
      }
      if (SCROLL_KEYS.has(event.key)) hide();
    };

    const handleUserScrollIntent = () => {
      if (!toolbar.hidden) hide();
    };

    const handleScroll = () => {
      if (toolbar.hidden || activating) return;
      // A scroll event alone does not prove that the learner intended to
      // dismiss the menu. Browser actionability checks, focus restoration and
      // layout stabilization may scroll the lesson before pointerdown. Keep
      // the fixed toolbar connected and visible; explicit wheel/touch/key or
      // outside-pointer intent owns dismissal.
      renderedScroll = { x: window.scrollX, y: window.scrollY };
    };

    const handleMessage = (event) => {
      if (event.source !== parent || !event.data) return;
      if (event.data.type === 'focus-note' && event.data.noteId) {
        controller.jumpTo(event.data.noteId);
        controller.openDetail(event.data.noteId);
      }
    };

    toolbar.addEventListener('pointerdown', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      const snapshot = snapshotAction(button.dataset.action);
      if (!snapshot) return;
      activating = true;
      activePress = {
        pointerId: event.pointerId,
        actionId: button.dataset.action,
        snapshot,
        performed: false,
      };
      event.preventDefault();
      event.stopPropagation();
      try { button.setPointerCapture?.(event.pointerId); } catch {}
    });
    toolbar.addEventListener('pointerup', (event) => {
      if (!activePress || activePress.pointerId !== event.pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      if (!activePress.performed) {
        activePress.performed = true;
        performSnapshot(activePress.snapshot);
      }
    });
    toolbar.addEventListener('pointercancel', () => {
      window.clearTimeout(finalizeTimer);
      finalizeTimer = 0;
      queueMicrotask(finishActivation);
    });
    toolbar.addEventListener('mousedown', (event) => event.preventDefault());
    toolbar.addEventListener('click', (event) => {
      const actionId = event.target.closest('button[data-action]')?.dataset.action;
      if (!actionId) return;
      event.preventDefault();
      event.stopPropagation();

      // Synthetic tests may dispatch pointerdown then click without pointerup.
      // Keyboard activation arrives as click without an active pointer press.
      if (activePress && activePress.actionId === actionId) {
        if (!activePress.performed) {
          activePress.performed = true;
          performSnapshot(activePress.snapshot);
        }
        return;
      }

      activating = true;
      performSnapshot(snapshotAction(actionId));
    });

    document.addEventListener('mouseup', handleSelection);
    document.addEventListener('pointerdown', handleOutsidePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('wheel', handleUserScrollIntent, { passive: true, capture: true });
    window.addEventListener('touchmove', handleUserScrollIntent, { passive: true, capture: true });
    window.addEventListener('message', handleMessage);

    return () => {
      requestId += 1;
      window.clearTimeout(finalizeTimer);
      document.removeEventListener('mouseup', handleSelection);
      document.removeEventListener('pointerdown', handleOutsidePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('wheel', handleUserScrollIntent, true);
      window.removeEventListener('touchmove', handleUserScrollIntent, true);
      window.removeEventListener('message', handleMessage);
      window.speechSynthesis?.cancel();
      toolbar.remove();
    };
  }

  window.KimiContextualActions = { mount };
})();
