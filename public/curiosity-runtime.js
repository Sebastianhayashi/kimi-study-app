(() => {
  'use strict';
  if (window.__kimiCuriosityMounted || !window.__courseId || !window.__lessonFile) return;
  window.__kimiCuriosityMounted = true;

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
    hook.textContent = card.hook;
    const chevron = document.createElement('span');
    chevron.textContent = '⌄';
    toggle.append(hook, chevron);
    const body = document.createElement('div');
    body.className = 'ks-curiosity-body';
    body.hidden = true;
    const prompt = document.createElement('p');
    prompt.className = 'ks-curiosity-prompt';
    prompt.textContent = card.prediction?.prompt || '先猜一下，再看解释。';
    body.appendChild(prompt);
    const options = document.createElement('div');
    options.className = 'ks-curiosity-options';
    const reveal = document.createElement('div');
    reveal.className = 'ks-curiosity-reveal';
    reveal.hidden = true;
    const revealCopy = document.createElement('div');
    revealCopy.textContent = card.reveal;
    const bridge = document.createElement('div');
    bridge.className = 'ks-curiosity-bridge';
    bridge.textContent = `为什么和本课有关：${card.bridge}`;
    const source = document.createElement('div');
    source.className = 'ks-curiosity-source';
    source.textContent = card.source?.label ? `依据：${card.source.label}` : `依据：${(card.source?.refs || []).join('、')}`;
    const actions = document.createElement('div');
    actions.className = 'ks-curiosity-actions';
    const scratch = document.createElement('button');
    scratch.type = 'button';
    scratch.textContent = '放到草稿';
    scratch.addEventListener('click', () => parent.postMessage({
      type: 'study-surface-add',
      kind: 'curiosity',
      quote: card.hook,
      section: card.section,
      body: `${card.reveal}\n\n${card.bridge}`,
    }, '*'));
    const ask = document.createElement('button');
    ask.type = 'button';
    ask.textContent = '问 Lucubro';
    ask.addEventListener('click', () => parent.postMessage({
      type: 'ask-selection',
      selectedText: card.hook,
      surrounding: `${card.reveal}\n${card.bridge}`,
      section: card.section || 'Curiosity',
      suggestedPrompt: `请结合当前课节，进一步解释这个问题：${card.hook}`,
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
        button.textContent = value;
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
      button.textContent = '看看为什么';
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
