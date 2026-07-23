'use strict';

const MAX_STUDY_SURFACE_BYTES = 900_000;
const MAX_CARDS = 80;
const MAX_STROKES = 300;
const MAX_POINTS_PER_STROKE = 1200;
const MAX_TOTAL_POINTS = 12_000;

function clean(value, limit) {
  return String(value || '').trim().slice(0, limit);
}

function roundCoordinate(value) {
  return Math.round(value * 10_000) / 10_000;
}

function normalizePoint(point) {
  const source = Array.isArray(point) ? point : [];
  const x = Number(source[0]);
  const y = Number(source[1]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return [
    roundCoordinate(Math.max(0, Math.min(1, x))),
    roundCoordinate(Math.max(0, Math.min(1, y))),
  ];
}

function studySurfaceByteLength(value) {
  try { return Buffer.byteLength(JSON.stringify(value == null ? {} : value), 'utf8'); }
  catch { return Number.POSITIVE_INFINITY; }
}

function inspectStudySurfaceState(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const cards = Array.isArray(source.cards) ? source.cards : [];
  const strokes = Array.isArray(source.strokes) ? source.strokes : [];
  const errors = [];
  let totalPoints = 0;

  if (cards.length > MAX_CARDS) errors.push(`cards exceed ${MAX_CARDS}`);
  if (strokes.length > MAX_STROKES) errors.push(`strokes exceed ${MAX_STROKES}`);
  for (const [index, stroke] of strokes.entries()) {
    const count = Array.isArray(stroke?.points) ? stroke.points.length : 0;
    totalPoints += count;
    if (count > MAX_POINTS_PER_STROKE) errors.push(`strokes[${index}].points exceed ${MAX_POINTS_PER_STROKE}`);
  }
  if (totalPoints > MAX_TOTAL_POINTS) errors.push(`total points exceed ${MAX_TOTAL_POINTS}`);
  const bytes = studySurfaceByteLength(source);
  if (bytes > MAX_STUDY_SURFACE_BYTES) errors.push(`payload exceeds ${MAX_STUDY_SURFACE_BYTES} bytes`);
  return { ok: errors.length === 0, errors, bytes, totalPoints };
}

function normalizeStudySurfaceState(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const cards = (Array.isArray(source.cards) ? source.cards : []).slice(0, MAX_CARDS).map((card, index) => ({
    id: clean(card?.id, 100) || `card-${index + 1}`,
    kind: ['quote', 'note', 'curiosity'].includes(card?.kind) ? card.kind : 'note',
    quote: clean(card?.quote, 1200),
    section: clean(card?.section, 300),
    body: clean(card?.body, 5000),
    createdAt: Number.isFinite(Number(card?.createdAt)) ? Number(card.createdAt) : Date.now(),
  }));

  let remainingPoints = MAX_TOTAL_POINTS;
  const strokes = [];
  for (const stroke of (Array.isArray(source.strokes) ? source.strokes : []).slice(0, MAX_STROKES)) {
    if (remainingPoints <= 1) break;
    const points = (Array.isArray(stroke?.points) ? stroke.points : [])
      .slice(0, Math.min(MAX_POINTS_PER_STROKE, remainingPoints))
      .map(normalizePoint)
      .filter(Boolean);
    remainingPoints -= points.length;
    if (points.length > 1) strokes.push({ id: clean(stroke?.id, 100), points });
  }

  return {
    version: 1,
    cards,
    strokes,
    updatedAt: Number.isFinite(Number(source.updatedAt)) ? Number(source.updatedAt) : Date.now(),
  };
}

module.exports = {
  MAX_CARDS,
  MAX_POINTS_PER_STROKE,
  MAX_STROKES,
  MAX_STUDY_SURFACE_BYTES,
  MAX_TOTAL_POINTS,
  inspectStudySurfaceState,
  normalizeStudySurfaceState,
  studySurfaceByteLength,
};
