'use strict';

const MAX_SELECTION = 2400;
const MAX_SURROUNDING = 5000;
const ACTIONS = Object.freeze({
  ask: { id: 'ask', label: '问 Tutor', kind: 'tutor' },
  explain: { id: 'explain', label: '解释', kind: 'tutor' },
  note: { id: 'note', label: '记笔记', kind: 'note' },
  scratch: { id: 'scratch', label: '放到草稿', kind: 'scratch' },
  read: { id: 'read', label: '朗读', kind: 'speech' },
  pronounce: { id: 'pronounce', label: '发音', kind: 'speech' },
  saveCard: { id: 'save-card', label: '做词卡', kind: 'note' },
});

function clean(value, limit) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function normalizeLearningActionRequest(input) {
  const source = input && typeof input === 'object' ? input : {};
  return {
    selectedText: clean(source.selectedText, MAX_SELECTION),
    surrounding: clean(source.surrounding, MAX_SURROUNDING),
    section: clean(source.section, 300),
    lessonFile: clean(source.lessonFile, 240),
    locale: clean(source.locale, 40) || 'und',
  };
}

function looksLikeFormula(text) {
  return /(?:[=<>±×÷√∑∫^]|\b(?:sin|cos|tan|log|ln)\b)/i.test(text) && /[0-9a-z]/i.test(text);
}

function looksLikeEnglishWord(text) {
  return /^[A-Za-z][A-Za-z'’-]{0,34}$/.test(text);
}

function looksLikeEnglishText(text) {
  const latin = (text.match(/[A-Za-z]/g) || []).length;
  const letters = (text.match(/[A-Za-z\u3400-\u9fff]/g) || []).length;
  return letters > 0 && latin / letters >= 0.72;
}

function looksLikeHistoricalReference(text) {
  return /\b(?:1[0-9]{3}|20[0-9]{2})\b|(?:世纪|年代|王朝|战争|革命|条约|运动)/.test(text);
}

function uniqueActions(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (!item || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  }).slice(0, 3);
}

function routeLearningActions(input) {
  const request = normalizeLearningActionRequest(input);
  const text = request.selectedText;
  if (!text) return { source: 'deterministic-fallback', selectionType: 'empty', actions: [] };

  if (looksLikeEnglishWord(text)) {
    return {
      source: 'deterministic-fallback',
      selectionType: 'english-word',
      actions: uniqueActions([ACTIONS.pronounce, ACTIONS.explain, ACTIONS.saveCard]),
    };
  }

  if (looksLikeFormula(text)) {
    return {
      source: 'deterministic-fallback',
      selectionType: 'formula',
      actions: uniqueActions([ACTIONS.explain, ACTIONS.scratch, ACTIONS.note]),
    };
  }

  if (looksLikeHistoricalReference(`${text} ${request.surrounding}`)) {
    return {
      source: 'deterministic-fallback',
      selectionType: 'historical-reference',
      actions: uniqueActions([ACTIONS.explain, ACTIONS.scratch, ACTIONS.note]),
    };
  }

  if (looksLikeEnglishText(text)) {
    return {
      source: 'deterministic-fallback',
      selectionType: 'english-passage',
      actions: uniqueActions([ACTIONS.read, ACTIONS.explain, ACTIONS.scratch]),
    };
  }

  return {
    source: 'deterministic-fallback',
    selectionType: text.length <= 48 ? 'short-passage' : 'passage',
    actions: uniqueActions([ACTIONS.ask, ACTIONS.note, ACTIONS.scratch]),
  };
}

function createLearningActionService({ modelSelector = null } = {}) {
  return async function selectLearningActions(input) {
    const request = normalizeLearningActionRequest(input);
    if (typeof modelSelector === 'function') {
      try {
        const result = await modelSelector(request);
        const actions = uniqueActions(Array.isArray(result?.actions) ? result.actions : []);
        if (actions.length) return { source: 'model', selectionType: result.selectionType || 'model', actions };
      } catch {
        // The learner must never lose the contextual menu because the optional router failed.
      }
    }
    return routeLearningActions(request);
  };
}

module.exports = {
  ACTIONS,
  MAX_SELECTION,
  createLearningActionService,
  normalizeLearningActionRequest,
  routeLearningActions,
};
