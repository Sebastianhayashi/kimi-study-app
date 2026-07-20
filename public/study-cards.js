(() => {
  'use strict';

  function mount(root = document) {
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) return () => {};

    const ENGLISH_TERM_PATTERN = /^[A-Za-z][A-Za-z' -]{0,40}$/;
    const HAS_CHINESE_PATTERN = /[\u3400-\u9fff]/;
    let speakingCard = null;

    function markSpeakableCard(card, word, lang = 'en-US') {
      if (!card || card.dataset.studyReady === 'true') return;
      card.dataset.studyReady = 'true';
      card.dataset.studyAction = 'speak';
      card.dataset.studyValue = word;
      card.dataset.studyLang = lang;
      if (!card.matches('button, input, textarea, select')) {
        card.setAttribute('role', 'button');
        card.tabIndex = 0;
      }
      card.setAttribute('aria-label', `朗读英语单词 ${word}`);
      if (!card.title) card.title = `点击朗读：${word}`;
    }

    function legacyVocabularyCard(card) {
      if (!(card instanceof HTMLElement) || card.closest('.kn-ui')) return null;
      if (card.matches('a[href]') || card.querySelector('a[href], button, input, textarea, select, audio, video, iframe, table, ul, ol')) return null;
      if (card.textContent.trim().length > 80 || card.children.length > 5) return null;

      const lines = card.innerText.split(/\n+/).map((line) => line.trim()).filter(Boolean);
      const firstChildText = card.firstElementChild?.textContent?.trim() || '';
      const word = ENGLISH_TERM_PATTERN.test(firstChildText) ? firstChildText : lines[0];
      const translation = card.textContent.replace(word || '', '').trim();
      if (!word || !ENGLISH_TERM_PATTERN.test(word) || !HAS_CHINESE_PATTERN.test(translation)) return null;
      return { card, word };
    }

    function upgradeVocabularyCards() {
      root.querySelectorAll('[data-study-action="speak"][data-study-value]').forEach((card) => {
        markSpeakableCard(card, card.dataset.studyValue, card.dataset.studyLang || 'en-US');
      });

      root.querySelectorAll('main, article, section, div').forEach((container) => {
        if (container.closest('.kn-ui')) return;
        const children = [...container.children];
        if (children.length < 2 || children.length > 24) return;
        const matches = children.map(legacyVocabularyCard).filter(Boolean);
        if (matches.length < 2 || matches.length / children.length < 0.6) return;
        matches.forEach(({ card, word }) => markSpeakableCard(card, word));
      });
    }

    function speak(card) {
      const text = card.dataset.studyValue?.trim();
      if (!text) return;
      window.speechSynthesis.cancel();
      speakingCard?.classList.remove('study-speaking');
      speakingCard = card;
      card.classList.add('study-speaking');

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = card.dataset.studyLang || 'en-US';
      utterance.rate = 0.86;
      utterance.pitch = 1;
      utterance.volume = 1;
      const clear = () => {
        card.classList.remove('study-speaking');
        if (speakingCard === card) speakingCard = null;
      };
      utterance.addEventListener('end', clear, { once: true });
      utterance.addEventListener('error', clear, { once: true });
      window.speechSynthesis.speak(utterance);
    }

    const onClick = (event) => {
      if (!(event.target instanceof Element)) return;
      const card = event.target.closest('[data-study-action="speak"]');
      if (!card || card.closest('.kn-ui')) return;
      event.preventDefault();
      speak(card);
    };
    const onKeyDown = (event) => {
      if (!(event.target instanceof Element)) return;
      const card = event.target.closest('[data-study-action="speak"]');
      if (!card || card.matches('button') || card.closest('.kn-ui')) return;
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      speak(card);
    };

    root.addEventListener('click', onClick);
    root.addEventListener('keydown', onKeyDown);
    upgradeVocabularyCards();

    return () => {
      root.removeEventListener('click', onClick);
      root.removeEventListener('keydown', onKeyDown);
      window.speechSynthesis.cancel();
    };
  }

  window.KimiStudyCards = { mount };
})();
