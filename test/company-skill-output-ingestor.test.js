'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { classifySkillOutput } = require('../lib/company/skill-output-ingestor');

test('normalized Skill outputs map to Lucubro product semantics instead of vendor formats', () => {
  const cases = [
    [{
      type: 'evidence',
      evidence: {
        kind: 'source-page',
        label: 'SCA roast guide',
        source: 'web',
        mimeType: 'text/plain',
        content: 'Roast level source notes',
        metadata: { url: 'https://example.test/roast-guide' },
      },
    }, 'evidence'],
    [{
      type: 'artifact.block',
      block: {
        type: 'paragraph',
        text: 'Light roasts generally preserve more origin-character vocabulary in tasting descriptions.',
        evidenceRefs: ['evidence_roast_guide'],
      },
    }, 'artifact-content'],
    [{
      type: 'workspace.diff',
      changedFiles: ['src/home.js'],
      diff: 'diff --git a/src/home.js b/src/home.js',
    }, 'workspace-mutation'],
    [{
      type: 'authority.request',
      capability: 'network.access',
      reason: 'Fetch a primary source.',
    }, 'authority-request'],
    [{
      type: 'note',
      persistence: 'transient',
      text: 'Try a simpler explanation next.',
    }, 'transient-note'],
    [{
      type: 'host.raw',
      host: 'gstack',
      format: 'html-report',
      content: '<main>Vendor report</main>',
    }, 'unsupported'],
  ];

  for (const [output, expected] of cases) {
    assert.equal(classifySkillOutput(output).classification, expected);
  }
});

test('Artifact semantic content rejects renderer-owned HTML as canonical content', () => {
  const result = classifySkillOutput({
    type: 'artifact.block',
    block: {
      type: 'html',
      html: '<main>Do not make this canonical</main>',
    },
  });

  assert.equal(result.classification, 'unsupported');
  assert.match(result.reason, /semantic Artifact block/i);
});

test('material Artifact claims are marked as requiring Evidence when references are absent', () => {
  const result = classifySkillOutput({
    type: 'artifact.block',
    block: {
      type: 'claim',
      text: 'A material factual claim.',
      material: true,
      evidenceRefs: [],
    },
  });

  assert.equal(result.classification, 'artifact-content');
  assert.equal(result.requiresEvidence, true);
});

test('invalid normalized output shapes fail closed as unsupported instead of being guessed', () => {
  const cases = [
    null,
    {},
    { type: 'evidence', evidence: null },
    { type: 'workspace.diff', changedFiles: 'src/home.js' },
    { type: 'authority.request', capability: '' },
    { type: 'note', persistence: 'durable', text: 'This needs a different contract.' },
  ];

  for (const output of cases) {
    const result = classifySkillOutput(output);
    assert.equal(result.classification, 'unsupported');
    assert.ok(result.reason);
  }
});
