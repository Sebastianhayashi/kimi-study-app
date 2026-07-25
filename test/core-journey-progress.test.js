'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { deriveEvidenceProgress, formatElapsed } = require('../public/core-journey-progress');

test('derives progress only from backend-confirmed stages', () => {
  const result = deriveEvidenceProgress({
    stage: 'generating',
    progress: 37,
    history: [
      { id: 'context', label: '读取学习记录', state: 'complete' },
      { id: 'lesson', label: '写入下一课页面', state: 'active' },
      { id: 'assessment', label: '写入互动练习', state: 'pending' },
      { id: 'validate', label: '检查新增课程文件', state: 'pending' },
    ],
  });
  assert.equal(result.determinate, true);
  assert.equal(result.value, 37);
  assert.equal(result.label, '37%');
});

test('uses indeterminate progress before any backend stage is known', () => {
  const result = deriveEvidenceProgress({ stage: 'generating', history: [] });
  assert.equal(result.determinate, false);
  assert.equal(result.value, 0);
});

test('formats elapsed time without pretending to know remaining time', () => {
  assert.equal(formatElapsed('2026-07-22T00:00:00.000Z', Date.parse('2026-07-22T00:03:07.000Z')), '已用时 03:07');
});
