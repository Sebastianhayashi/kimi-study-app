'use strict';

const path = require('node:path');
const multer = require('multer');

const MAX_INPUT_IMAGES = 4;
const MAX_INPUT_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_INPUT_IMAGE_TOTAL_BYTES = 24 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function safeFilename(value) {
  const base = path.basename(String(value || 'image'))
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, 160);
  return base || 'image';
}

function hasExpectedSignature(buffer, mimeType) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return false;
  if (mimeType === 'image/png') {
    return buffer.length >= 8
      && buffer[0] === 0x89
      && buffer[1] === 0x50
      && buffer[2] === 0x4e
      && buffer[3] === 0x47
      && buffer[4] === 0x0d
      && buffer[5] === 0x0a
      && buffer[6] === 0x1a
      && buffer[7] === 0x0a;
  }
  if (mimeType === 'image/jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === 'image/webp') {
    return buffer.length >= 12
      && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
      && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  }
  return false;
}

function createWorkAttachmentMiddleware() {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      files: MAX_INPUT_IMAGES,
      fileSize: MAX_INPUT_IMAGE_BYTES,
      fields: 16,
      fieldSize: 256 * 1024,
      parts: 24,
    },
    fileFilter(req, file, callback) {
      const mimeType = String(file && file.mimetype || '').trim().toLowerCase();
      if (!SUPPORTED_IMAGE_TYPES.has(mimeType)) {
        callback(new Error('Work attachments accept JPEG, PNG, or WebP images only.'));
        return;
      }
      callback(null, true);
    },
  }).array('attachments', MAX_INPUT_IMAGES);

  return function parseWorkAttachments(req, res, next) {
    upload(req, res, (error) => {
      if (!error) return next();
      const message = error && error.code === 'LIMIT_FILE_SIZE'
        ? `Each Work image must be ${MAX_INPUT_IMAGE_BYTES} bytes or smaller.`
        : error.message || 'Unable to read Work attachments.';
      return res.status(400).json({ error: message });
    });
  };
}

function attachmentEvidence(files, { projectId = null } = {}) {
  const list = Array.isArray(files) ? files : [];
  if (list.length > MAX_INPUT_IMAGES) throw new Error(`Work accepts at most ${MAX_INPUT_IMAGES} image attachments.`);
  const totalBytes = list.reduce((sum, file) => sum + Number(file && file.size || 0), 0);
  if (totalBytes > MAX_INPUT_IMAGE_TOTAL_BYTES) {
    throw new Error(`Work image attachments exceed the ${MAX_INPUT_IMAGE_TOTAL_BYTES} byte total limit.`);
  }

  return list.map((file) => {
    const mimeType = String(file && file.mimetype || '').trim().toLowerCase();
    if (!SUPPORTED_IMAGE_TYPES.has(mimeType)) throw new Error('Work attachments accept JPEG, PNG, or WebP images only.');
    if (!hasExpectedSignature(file.buffer, mimeType)) throw new Error(`Attachment ${safeFilename(file.originalname)} does not match its declared image type.`);
    const filename = safeFilename(file.originalname);
    const metadata = {
      filename,
      origin: 'composer-attachment',
    };
    if (typeof projectId === 'string' && projectId.trim()) metadata.projectId = projectId.trim();
    return {
      kind: 'image',
      label: `You sent · ${filename}`,
      mimeType,
      source: 'user-input',
      metadata,
      content: Buffer.from(file.buffer),
    };
  });
}

module.exports = {
  MAX_INPUT_IMAGES,
  MAX_INPUT_IMAGE_BYTES,
  MAX_INPUT_IMAGE_TOTAL_BYTES,
  SUPPORTED_IMAGE_TYPES,
  attachmentEvidence,
  createWorkAttachmentMiddleware,
  hasExpectedSignature,
  safeFilename,
};
