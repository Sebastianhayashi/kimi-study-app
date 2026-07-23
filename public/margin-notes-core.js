(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.KimiMarginNotesCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function commonPrefixLength(a, b) {
    const limit = Math.min(a.length, b.length);
    let i = 0;
    while (i < limit && a[i] === b[i]) i += 1;
    return i;
  }

  function commonSuffixLength(a, b) {
    const limit = Math.min(a.length, b.length);
    let i = 0;
    while (i < limit && a[a.length - 1 - i] === b[b.length - 1 - i]) i += 1;
    return i;
  }

  function normalizeAnchor(anchor) {
    const source = anchor && typeof anchor === 'object' ? anchor : {};
    const quote = source.textQuote && typeof source.textQuote === 'object'
      ? source.textQuote
      : source;
    const position = source.textPosition && typeof source.textPosition === 'object'
      ? source.textPosition
      : source.position;

    const exact = typeof quote.exact === 'string' ? quote.exact : '';
    const prefix = typeof quote.prefix === 'string' ? quote.prefix : '';
    const suffix = typeof quote.suffix === 'string' ? quote.suffix : '';
    const start = Number.isInteger(position?.start) ? position.start : null;
    const end = Number.isInteger(position?.end) ? position.end : null;

    return {
      textQuote: { exact, prefix, suffix },
      textPosition: start !== null && end !== null && end >= start ? { start, end } : null,
    };
  }

  function normalizeNote(raw, index) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const createdAt = Number.isFinite(source.createdAt) ? source.createdAt : Date.now();
    const id = typeof source.id === 'string' && source.id
      ? source.id
      : `note-${createdAt.toString(36)}-${index}`;
    const lessonFile = typeof source.lessonFile === 'string' ? source.lessonFile.trim().slice(0, 240) : '';

    return {
      id,
      lessonFile,
      anchor: normalizeAnchor(source.anchor),
      section: typeof source.section === 'string' ? source.section : '',
      question: typeof source.question === 'string' ? source.question : '',
      answer: typeof source.answer === 'string' ? source.answer : '',
      custom: typeof source.custom === 'string' ? source.custom : '',
      side: source.side === 'left' || source.side === 'right' ? source.side : null,
      kind: ['assistant', 'vocabulary', 'curiosity', 'scratch', 'user'].includes(source.kind)
        ? source.kind
        : source.question ? 'assistant' : 'user',
      createdAt,
      updatedAt: Number.isFinite(source.updatedAt) ? source.updatedAt : createdAt,
    };
  }

  function serializeNote(note) {
    return {
      id: note.id,
      lessonFile: note.lessonFile || undefined,
      anchor: {
        exact: note.anchor.textQuote.exact,
        prefix: note.anchor.textQuote.prefix,
        suffix: note.anchor.textQuote.suffix,
        position: note.anchor.textPosition || undefined,
      },
      section: note.section || '',
      question: note.question || '',
      answer: note.answer || '',
      custom: note.custom || '',
      side: note.side || undefined,
      kind: note.kind,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    };
  }

  function findBestQuoteOffset(text, anchorInput) {
    const anchor = normalizeAnchor(anchorInput);
    const { exact, prefix, suffix } = anchor.textQuote;
    if (!exact) return null;

    const position = anchor.textPosition;
    if (
      position &&
      position.start >= 0 &&
      position.end <= text.length &&
      text.slice(position.start, position.end) === exact
    ) {
      return { start: position.start, end: position.end, score: Number.POSITIVE_INFINITY };
    }

    const candidates = [];
    let from = 0;
    while (from <= text.length - exact.length) {
      const start = text.indexOf(exact, from);
      if (start < 0) break;
      const before = text.slice(Math.max(0, start - prefix.length), start);
      const after = text.slice(start + exact.length, start + exact.length + suffix.length);
      const prefixScore = commonSuffixLength(before, prefix);
      const suffixScore = commonPrefixLength(after, suffix);
      const positionPenalty = position ? Math.min(Math.abs(start - position.start), 5000) / 5000 : 0;
      candidates.push({
        start,
        end: start + exact.length,
        score: prefixScore * 2 + suffixScore * 2 - positionPenalty,
      });
      from = start + Math.max(1, exact.length);
    }

    if (!candidates.length) return null;
    candidates.sort((a, b) => b.score - a.score || a.start - b.start);
    return candidates[0];
  }

  function stackPlacements(items, gap) {
    const sorted = items
      .map((item) => ({ ...item }))
      .sort((a, b) => a.top - b.top || String(a.id).localeCompare(String(b.id)));
    let cursor = Number.NEGATIVE_INFINITY;
    return sorted.map((item) => {
      const y = Math.max(item.top, cursor);
      cursor = y + Math.max(0, item.height) + gap;
      return { ...item, y };
    });
  }

  function chooseRailMode({ viewportWidth, contentLeft, contentRight, cardWidth, gap, minContentWidth = 560 }) {
    const leftSpace = Math.max(0, contentLeft);
    const rightSpace = Math.max(0, viewportWidth - contentRight);
    const needed = cardWidth + gap;

    if (leftSpace >= needed && rightSpace >= needed) return 'both';
    if (rightSpace >= needed) return 'right';
    if (leftSpace >= needed) return 'left';
    if (viewportWidth >= minContentWidth + needed + gap * 2) return 'reserve-right';
    return 'drawer';
  }

  return {
    clamp,
    normalizeAnchor,
    normalizeNote,
    serializeNote,
    findBestQuoteOffset,
    stackPlacements,
    chooseRailMode,
  };
});
