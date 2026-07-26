(() => {
  'use strict';
  if (window.__kimiCuriosityMounted || !window.__courseId || !window.__lessonFile) return;
  window.__kimiCuriosityMounted = true;

  function displayText(value) {
    if (value && typeof value === 'object') {
      return String(value.label ?? value.text ?? value.title ?? value.name ?? value.ref ?? value.href ?? value.id ?? '').trim();
    }
    return String(value ?? '').trim();
  }

  function translated(key) {
    try { return parent.LucubroI18n?.t(key) || window.LucubroI18n?.t(key) || key; } catch { return key; }
  }

  function findPlacement(card) {
    const headings = [...document.querySelectorAll('h1,h2,h3,h4')];
    if (card.section) {
      const wanted = card.section.toLowerCase();
      const heading = headings.find((item) => item.textContent.trim().toLowerCase().includes(wanted));
      if (heading) return heading.closest('section,article') || heading;
    }
    if (card.anchor) {
      const nodes = [...document.querySelectorAll('p,li,blockquote')];
      const match = nodes.find((item) => item.textContent.includes(card.anchor));
      if (match) return match;
    }
    return document.querySelector('.container,main,article')?.lastElementChild || document.body.lastElementChild;
  }

  function buildCard(card) {
    const aside = document.createElement('aside');
    aside.className = 'ks-curiosity-card';
    aside.dataset.curiosityId = card.id;
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'ks-curiosity-toggle';
    toggle.setAttribute('aria-expanded', 'false');
    const hook = document.createElement('span');
    hook.textContent = displayText(card.hook);
    const chevron = document.createElement('span');
    chevron.textContent = '⌄';
    toggle.append(hook, chevron);
    const body = document.createElement('div');
    body.className = 'ks-curiosity-body';
    body.hidden = true;
    const prompt = document.createElement('p');
    prompt.className = 'ks-curiosity-prompt';
    prompt.textContent = displayText(card.prediction?.prompt) || translated('Make a prediction before viewing the explanation.');
    body.appendChild(prompt);
    const options = document.createElement('div');
    options.className = 'ks-curiosity-options';
    const reveal = document.createElement('div');
    reveal.className = 'ks-curiosity-reveal';
    reveal.hidden = true;
    const revealCopy = document.createElement('div');
    revealCopy.textContent = displayText(card.reveal);
    const bridge = document.createElement('div');
    bridge.className = 'ks-curiosity-bridge';
    bridge.textContent = `Why it relates to this lesson: ${displayText(card.bridge)}`;
    const source = document.createElement('div');
    source.className = 'ks-curiosity-source';
    const sourceLabel = displayText(card.source?.label)
      || (Array.isArray(card.source?.refs) ? card.source.refs.map(displayText).filter(Boolean).join(', ') : '');
    source.textContent = sourceLabel ? `Source: ${sourceLabel}` : '';
    source.hidden = !sourceLabel;
    const actions = document.createElement('div');
    actions.className = 'ks-curiosity-actions';
    const scratch = document.createElement('button');
    scratch.type = 'button';
    scratch.textContent = translated('Add to draft');
    scratch.addEventListener('click', () => parent.postMessage({
      type: 'study-surface-add',
      kind: 'curiosity',
      quote: displayText(card.hook),
      section: displayText(card.section) || translated('Curiosity'),
      body: `${displayText(card.reveal)}\n\n${displayText(card.bridge)}`,
    }, '*'));
    const ask = document.createElement('button');
    ask.type = 'button';
    ask.textContent = translated('Ask Lucubro');
    ask.addEventListener('click', () => parent.postMessage({
      type: 'ask-selection',
      selectedText: displayText(card.hook),
      surrounding: `${displayText(card.reveal)}\n${displayText(card.bridge)}`,
      section: displayText(card.section) || translated('Curiosity'),
      suggestedPrompt: `${translated('Explain this question using the current lesson:')} ${displayText(card.hook)}`,
    }, '*'));
    actions.append(scratch, ask);
    reveal.append(revealCopy, bridge, source, actions);

    const optionValues = Array.isArray(card.prediction?.options) ? card.prediction.options : [];
    const showReveal = () => { reveal.hidden = false; };
    if (optionValues.length) {
      optionValues.forEach((value) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'ks-curiosity-option';
        button.textContent = displayText(value);
        button.setAttribute('aria-pressed', 'false');
        button.addEventListener('click', () => {
          options.querySelectorAll('button').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
          showReveal();
        });
        options.appendChild(button);
      });
      body.appendChild(options);
    } else {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'ks-curiosity-option';
      button.textContent = translated('See why');
      button.addEventListener('click', showReveal);
      body.appendChild(button);
    }
    body.appendChild(reveal);
    toggle.addEventListener('click', () => {
      body.hidden = !body.hidden;
      toggle.setAttribute('aria-expanded', String(!body.hidden));
      chevron.textContent = body.hidden ? '⌄' : '⌃';
    });
    aside.append(toggle, body);
    return aside;
  }

  fetch(`/api/courses/${window.__courseId}/lessons/${encodeURIComponent(window.__lessonFile)}/curiosity`)
    .then((response) => response.ok ? response.json() : { cards: [] })
    .then((data) => {
      (Array.isArray(data.cards) ? data.cards : []).forEach((card) => {
        const placement = findPlacement(card);
        if (placement) placement.insertAdjacentElement('afterend', buildCard(card));
      });
    })
    .catch(() => {});
})();
