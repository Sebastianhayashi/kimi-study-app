'use strict';

const path = require('node:path');

function requiredText(value, label) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new Error(`${label} is required`);
  return text;
}

function normalizeRelativeDeliverablePath(value) {
  const raw = requiredText(value, 'File deliverable path');
  if (raw.includes('\0')) throw new Error('File deliverable path must be a safe relative path');
  const slashed = raw.replace(/\\/g, '/');
  if (slashed.startsWith('/') || /^[a-zA-Z]:\//.test(slashed)) {
    throw new Error('File deliverable path must be a safe relative path');
  }
  const normalized = path.posix.normalize(slashed);
  if (!normalized || normalized === '.' || normalized === '..' || normalized.startsWith('../') || normalized.endsWith('/')) {
    throw new Error('File deliverable path must be a safe relative path');
  }
  return normalized;
}

function normalizeRequestedFileDeliverables({ intent, entries } = {}) {
  if (entries == null) return [];
  if (!Array.isArray(entries)) throw new Error('Planner fileDeliverables must be an array');
  const currentIntent = requiredText(intent, 'Work intent');
  const seen = new Set();

  return entries.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error('Planner file deliverable must be an object');
    }
    const rawPath = requiredText(entry.path, 'File deliverable path');
    const filePath = normalizeRelativeDeliverablePath(rawPath);
    if (seen.has(filePath)) throw new Error(`Duplicate file deliverable path: ${filePath}`);
    seen.add(filePath);

    const userIntentEvidence = requiredText(entry.userIntentEvidence, 'File deliverable userIntentEvidence');
    if (!currentIntent.includes(userIntentEvidence)) {
      throw new Error('File deliverable userIntentEvidence must be an exact substring of the current user intent');
    }
    if (!userIntentEvidence.includes(rawPath) && !userIntentEvidence.includes(filePath)) {
      throw new Error('File deliverable path must be explicitly present in user intent evidence');
    }

    return {
      path: filePath,
      label: typeof entry.label === 'string' && entry.label.trim() ? entry.label.trim() : path.posix.basename(filePath),
      mimeType: typeof entry.mimeType === 'string' && entry.mimeType.trim() ? entry.mimeType.trim().toLowerCase() : 'application/octet-stream',
      userIntentEvidence,
    };
  });
}

function findRequestedFileDeliverable(entries, candidatePath) {
  const normalizedPath = normalizeRelativeDeliverablePath(candidatePath);
  if (!Array.isArray(entries)) return null;
  const match = entries.find((entry) => entry && typeof entry === 'object' && entry.path === normalizedPath);
  return match ? JSON.parse(JSON.stringify(match)) : null;
}

module.exports = {
  normalizeRelativeDeliverablePath,
  normalizeRequestedFileDeliverables,
  findRequestedFileDeliverable,
};
