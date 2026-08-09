'use strict';

const INLINE_RASTER = new Map([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
]);

const SAFE_TEXT = new Map([
  ['text/plain', 'txt'],
  ['text/x-diff', 'diff'],
]);

function safeFilenameId(value) {
  const id = String(value || 'evidence').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 96);
  return id || 'evidence';
}

function evidenceResponsePolicy(item = {}) {
  const id = safeFilenameId(item.id);
  const mimeType = String(item.mimeType || '').trim().toLowerCase();

  if (INLINE_RASTER.has(mimeType)) {
    const extension = INLINE_RASTER.get(mimeType);
    return {
      contentType: mimeType,
      contentDisposition: `inline; filename="${id}.${extension}"`,
      nosniff: true,
    };
  }

  if (SAFE_TEXT.has(mimeType)) {
    const extension = SAFE_TEXT.get(mimeType);
    return {
      contentType: 'text/plain; charset=utf-8',
      contentDisposition: `attachment; filename="${id}.${extension}"`,
      nosniff: true,
    };
  }

  return {
    contentType: 'application/octet-stream',
    contentDisposition: `attachment; filename="${id}.bin"`,
    nosniff: true,
  };
}

module.exports = { evidenceResponsePolicy };
