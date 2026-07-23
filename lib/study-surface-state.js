'use strict';

function clean(value, limit) {
  return String(value || '').trim().slice(0, limit);
}

function normalizePoint(point) {
  const source = Array.isArray(point) ? point : [];
  const x = Number(source[0]);
  const y = Number(source[1]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return [Math.max(0, Math.min(1, x)), Math.max(0, Math.min(1, y))];
}

function normalizeStudySurfaceState(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const cards = (Array.isArray(source.cards) ? source.cards : []).slice(0, 80).map((card, index) => ({
    id: clean(card?.id, 100) || `card-${index + 1}`,
    kind: ['quote', 'note', 'curiosity'].includes(card?.kind) ? card.kind : 'note',
    quote: clean(card?.quote, 1200),
    section: clean(card?.section, 300),
    body: clean(card?.body, 5000),
    createdAt: Number.isFinite(Number(card?.createdAt)) ? Number(card.createdAt) : Date.now(),
  }));
  const strokes = (Array.isArray(source.strokes) ? source.strokes : []).slice(0, 300).map((stroke) => ({
    id: clean(stroke?.id, 100),
    points: (Array.isArray(stroke?.points) ? stroke.points : []).slice(0, 1200).map(normalizePoint).filter(Boolean),
  })).filter((stroke) => stroke.points.length > 1);
  return {
    version: 1,
    cards,
    strokes,
    updatedAt: Number.isFinite(Number(source.updatedAt)) ? Number(source.updatedAt) : Date.now(),
  };
}

module.exports = { normalizeStudySurfaceState };
