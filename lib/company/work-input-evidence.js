'use strict';

const MAX_INPUT_LINKS = 8;
const MAX_INPUT_URL_LENGTH = 2048;

function trimTerminalPunctuation(value) {
  let next = String(value || '');
  while (/[.,;:!?)]$/.test(next)) next = next.slice(0, -1);
  return next;
}

function normalizeHttpUrl(value) {
  const candidate = trimTerminalPunctuation(value);
  if (!candidate || candidate.length > MAX_INPUT_URL_LENGTH) return null;
  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  const normalized = parsed.toString();
  if (normalized.length > MAX_INPUT_URL_LENGTH) return null;
  return normalized;
}

function extractWorkInputEvidence({ brief, projectId = null } = {}) {
  const text = typeof brief === 'string' ? brief : '';
  const candidates = text.match(/https?:\/\/[^\s<>"'`]+/gi) || [];
  const seen = new Set();
  const items = [];

  for (const candidate of candidates) {
    if (items.length >= MAX_INPUT_LINKS) break;
    const url = normalizeHttpUrl(candidate);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const hostname = new URL(url).hostname.toLowerCase().slice(0, 80) || 'link';
    const metadata = {
      url,
      origin: 'work-brief',
    };
    if (typeof projectId === 'string' && projectId.trim()) metadata.projectId = projectId.trim();
    items.push({
      kind: 'link',
      label: `Shared link · ${hostname}`,
      mimeType: 'text/uri-list',
      source: 'user-input',
      metadata,
      content: `${url}\n`,
    });
  }

  return items;
}

module.exports = {
  MAX_INPUT_LINKS,
  MAX_INPUT_URL_LENGTH,
  extractWorkInputEvidence,
  normalizeHttpUrl,
};
