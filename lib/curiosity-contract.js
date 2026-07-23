'use strict';

const MAX_CARDS = 3;
const SCORE_KEYS = ['relevance', 'surprise', 'clarity', 'confidence', 'load'];

function text(value, limit) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function numberScore(value, fallback) {
  const score = Number(value);
  return Number.isFinite(score) ? Math.max(1, Math.min(5, score)) : fallback;
}

function normalizeCuriosityCard(raw, index = 0) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const prediction = source.prediction && typeof source.prediction === 'object' ? source.prediction : {};
  const options = Array.isArray(prediction.options)
    ? prediction.options.map((item) => text(item, 180)).filter(Boolean).slice(0, 4)
    : [];
  const scores = source.scores && typeof source.scores === 'object' ? source.scores : {};
  return {
    id: text(source.id, 100) || `curiosity-${index + 1}`,
    hook: text(source.hook, 220),
    prediction: {
      prompt: text(prediction.prompt, 240),
      options,
    },
    reveal: text(source.reveal, 1000),
    bridge: text(source.bridge, 500),
    section: text(source.section, 300),
    anchor: text(source.anchor, 400),
    source: {
      label: text(source.source?.label || source.sourceLabel, 240),
      href: /^https?:\/\//i.test(String(source.source?.href || '')) ? String(source.source.href).slice(0, 1200) : '',
      refs: Array.isArray(source.sourceRefs) ? source.sourceRefs.map((item) => text(item, 300)).filter(Boolean).slice(0, 8) : [],
    },
    scores: {
      relevance: numberScore(scores.relevance, 1),
      surprise: numberScore(scores.surprise, 1),
      clarity: numberScore(scores.clarity, 1),
      confidence: numberScore(scores.confidence, 1),
      load: numberScore(scores.load, 5),
    },
  };
}

function validateCuriosityCard(card, index = 0) {
  const errors = [];
  const at = `cards[${index}]`;
  if (card.hook.length < 12) errors.push(`${at}.hook must be at least 12 characters`);
  if (card.reveal.length < 40) errors.push(`${at}.reveal must be at least 40 characters`);
  if (card.bridge.length < 18) errors.push(`${at}.bridge must explain why the card matters here`);
  if (!card.section && !card.anchor) errors.push(`${at} needs section or anchor placement`);
  if (!card.source.label && !card.source.refs.length) errors.push(`${at} needs a source label or sourceRefs`);
  if (card.prediction.options.length && card.prediction.options.length < 2) errors.push(`${at}.prediction needs at least two options`);
  if (card.scores.relevance < 4) errors.push(`${at}.scores.relevance must be >= 4`);
  if (card.scores.surprise < 3) errors.push(`${at}.scores.surprise must be >= 3`);
  if (card.scores.clarity < 3) errors.push(`${at}.scores.clarity must be >= 3`);
  if (card.scores.confidence < 4) errors.push(`${at}.scores.confidence must be >= 4`);
  if (card.scores.load > 3) errors.push(`${at}.scores.load must be <= 3`);
  return errors;
}

function normalizeCuriosityDocument(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const cards = Array.isArray(source.cards) ? source.cards.slice(0, MAX_CARDS).map(normalizeCuriosityCard) : [];
  return {
    schemaVersion: 1,
    lessonId: text(source.lessonId, 240),
    cards,
  };
}

function validateCuriosityDocument(raw) {
  const document = normalizeCuriosityDocument(raw);
  const errors = [];
  if (raw && Number(raw.schemaVersion) !== 1) errors.push('schemaVersion must be 1');
  document.cards.forEach((card, index) => errors.push(...validateCuriosityCard(card, index)));
  const ids = new Set();
  for (const card of document.cards) {
    if (ids.has(card.id)) errors.push(`duplicate curiosity id: ${card.id}`);
    ids.add(card.id);
  }
  return { ok: errors.length === 0, errors, document };
}

module.exports = {
  MAX_CARDS,
  SCORE_KEYS,
  normalizeCuriosityCard,
  normalizeCuriosityDocument,
  validateCuriosityCard,
  validateCuriosityDocument,
};
