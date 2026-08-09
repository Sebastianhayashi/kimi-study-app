'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { evidenceResponsePolicy } = require('../lib/company/evidence-response');

test('safe raster Evidence may render inline with nosniff', () => {
  assert.deepEqual(evidenceResponsePolicy({ id: 'evidence_png', mimeType: 'image/png', label: 'Browser screenshot' }), {
    contentType: 'image/png',
    contentDisposition: 'inline; filename="evidence_png.png"',
    nosniff: true,
  });
});

test('text and active document Evidence cannot execute as same-origin content', () => {
  assert.deepEqual(evidenceResponsePolicy({ id: 'evidence_diff', mimeType: 'text/x-diff', label: 'Code changes' }), {
    contentType: 'text/plain; charset=utf-8',
    contentDisposition: 'attachment; filename="evidence_diff.diff"',
    nosniff: true,
  });

  assert.deepEqual(evidenceResponsePolicy({ id: 'evidence_svg', mimeType: 'image/svg+xml', label: 'Vector capture' }), {
    contentType: 'application/octet-stream',
    contentDisposition: 'attachment; filename="evidence_svg.bin"',
    nosniff: true,
  });

  assert.deepEqual(evidenceResponsePolicy({ id: 'evidence_html', mimeType: 'text/html', label: 'HTML capture' }), {
    contentType: 'application/octet-stream',
    contentDisposition: 'attachment; filename="evidence_html.bin"',
    nosniff: true,
  });
});
