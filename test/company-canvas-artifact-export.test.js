'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createCanvasArtifactExporter } = require('../lib/company/canvas-artifact-export');
const { createCanvasArtifactStore } = require('../lib/company/canvas-artifact-store');
const { createEvidenceStore } = require('../lib/company/evidence-store');

function tempRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lucubro-canvas-export-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function fixture(t) {
  const root = tempRoot(t);
  let evidenceCounter = 0;
  const evidenceStore = createEvidenceStore({
    rootDir: root,
    createId: () => `evidence_export_${++evidenceCounter}`,
    now: () => '2026-08-09T12:45:00.000Z',
  });
  const source = evidenceStore.create({
    runId: 'run_research',
    workId: 'work_coffee_export',
    workerId: 'worker_local',
    kind: 'source-page',
    label: 'Roast research source',
    mimeType: 'text/plain',
    source: 'web',
    metadata: {
      publisher: 'Fixture Coffee Institute',
      sourcePage: 'https://example.test/coffee-roast-source',
    },
    content: 'Source evidence.',
  });
  const image = evidenceStore.create({
    runId: 'run_research',
    workId: 'work_coffee_export',
    workerId: 'worker_local',
    kind: 'source-image',
    label: 'Roast spectrum image',
    mimeType: 'image/png',
    source: 'web',
    metadata: {
      publisher: 'Fixture Coffee Institute',
      sourcePage: 'https://example.test/coffee-roast-source',
      originalAsset: 'https://example.test/coffee-roast-image.png',
      rightsStatus: 'fixture-reference-only',
      embeddingEligibility: 'reference-only',
    },
    content: Buffer.from('not-an-exportable-image'),
  });
  const file = evidenceStore.create({
    runId: 'run_manager',
    workId: 'work_coffee_export',
    workerId: 'worker_local',
    kind: 'deliverable-file',
    label: 'Coffee guide',
    mimeType: 'text/markdown',
    source: 'skill-output',
    metadata: { path: 'dist/coffee-guide.md', requested: true },
    content: '# Coffee guide\n',
  });

  let blockCounter = 0;
  const artifactStore = createCanvasArtifactStore({
    rootDir: root,
    evidenceStore,
    createArtifactId: () => 'artifact_export_coffee',
    createBlockId: () => `block_export_${++blockCounter}`,
    now: () => '2026-08-09T12:46:00.000Z',
  });
  const artifact = artifactStore.create({
    workId: 'work_coffee_export',
    projectId: null,
    title: 'Coffee Roast Field Guide',
    blocks: [
      { type: 'heading', content: { text: 'Roast spectrum' } },
      {
        type: 'image',
        content: {
          evidenceId: image.id,
          alt: 'Coffee roast spectrum',
          caption: 'A visual orientation for roast levels.',
        },
        evidenceRefs: [image.id],
      },
      {
        type: 'claim',
        material: true,
        content: { text: 'Roast level changes flavor expression and roast character.' },
        evidenceRefs: [source.id],
      },
      {
        type: 'table',
        content: {
          columns: ['Roast', 'Cue'],
          rows: [['Light', 'Brighter'], ['Medium', 'Balanced'], ['Dark', 'Roasty']],
        },
        evidenceRefs: [source.id],
      },
      {
        type: 'interaction',
        content: {
          kind: 'choice',
          prompt: 'Which direction sounds closest?',
          options: ['Light', 'Medium', 'Dark'],
        },
        staticFallback: {
          type: 'list',
          content: { items: ['Light: brighter', 'Medium: balanced', 'Dark: roasty'] },
        },
      },
      {
        type: 'file-reference',
        content: {
          path: 'dist/coffee-guide.md',
          label: 'Coffee guide',
          mimeType: 'text/markdown',
          evidenceId: file.id,
        },
        evidenceRefs: [file.id],
      },
    ],
  });
  return { root, evidenceStore, artifact, source, image, file };
}

test('Markdown export derives from canonical IR, uses interaction static fallback, and retains provenance', (t) => {
  const f = fixture(t);
  const exporter = createCanvasArtifactExporter({ evidenceStore: f.evidenceStore });

  const markdown = exporter.toMarkdown(f.artifact);

  assert.match(markdown, /^# Coffee Roast Field Guide/m);
  assert.match(markdown, /## Roast spectrum/);
  assert.match(markdown, /Roast level changes flavor expression and roast character\./);
  assert.match(markdown, /\| Roast \| Cue \|/);
  assert.match(markdown, /Which direction sounds closest\?/);
  assert.match(markdown, /Light: brighter/);
  assert.match(markdown, /Medium: balanced/);
  assert.match(markdown, /Dark: roasty/);
  assert.doesNotMatch(markdown, /Selected: Medium/);
  assert.match(markdown, /Figure: Coffee roast spectrum/);
  assert.doesNotMatch(markdown, /!\[Coffee roast spectrum\]/);
  assert.match(markdown, /Embedding eligibility: reference-only/);
  assert.match(markdown, /Coffee guide/);
  assert.match(markdown, /dist\/coffee-guide\.md/);
  assert.match(markdown, /## Sources/);
  assert.match(markdown, /Fixture Coffee Institute/);
  assert.match(markdown, /https:\/\/example\.test\/coffee-roast-source/);
  assert.match(markdown, /fixture-reference-only/);
});

test('PDF export receives the same static export document and never depends on DOM state', async (t) => {
  const f = fixture(t);
  const calls = [];
  const exporter = createCanvasArtifactExporter({
    evidenceStore: f.evidenceStore,
    pdfRenderer: {
      async render(document) {
        calls.push(structuredClone(document));
        return Buffer.from('%PDF-1.7\n% fixture renderer\n', 'utf8');
      },
    },
  });

  const pdf = await exporter.toPdf(f.artifact);

  assert.equal(pdf.subarray(0, 5).toString('ascii'), '%PDF-');
  assert.equal(calls.length, 1);
  const document = calls[0];
  assert.equal(document.artifactId, f.artifact.id);
  assert.equal(document.title, f.artifact.title);
  assert.deepEqual(document.blocks.map((block) => block.type), [
    'heading',
    'figure',
    'claim',
    'table',
    'static-interaction',
    'file-reference',
  ]);
  const interaction = document.blocks.find((block) => block.type === 'static-interaction');
  assert.equal(interaction.prompt, 'Which direction sounds closest?');
  assert.equal(interaction.fallback.type, 'list');
  assert.deepEqual(interaction.fallback.content.items, ['Light: brighter', 'Medium: balanced', 'Dark: roasty']);
  assert.equal(Object.hasOwn(interaction, 'selected'), false);

  const figure = document.blocks.find((block) => block.type === 'figure');
  assert.equal(figure.embeddingEligibility, 'reference-only');
  assert.equal(figure.evidenceId, f.image.id);
  assert.equal(Object.hasOwn(figure, 'bytes'), false);

  assert.deepEqual(document.sources.map((item) => item.evidenceId), [f.image.id, f.source.id, f.file.id]);
  assert.equal(document.sources[0].rightsStatus, 'fixture-reference-only');
});
