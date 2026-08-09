'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createPandocCanvasPdfRenderer } = require('../lib/company/canvas-artifact-pandoc-pdf');

function tempRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lucubro-pandoc-renderer-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function exportDocument() {
  return {
    schemaVersion: 1,
    artifactId: 'artifact_pdf_fixture',
    workId: 'work_pdf_fixture',
    projectId: null,
    title: 'Coffee Roast Field Guide / 咖啡烘焙指南',
    revision: 1,
    blocks: [
      { type: 'heading', text: 'Roast spectrum', evidenceRefs: [], references: [] },
      {
        type: 'figure',
        evidenceId: 'evidence_embed_image',
        alt: 'Exportable roast image',
        caption: 'Embedded only because Evidence policy permits it.',
        embeddingEligibility: 'embed',
        sourcePage: 'https://example.test/source',
        originalAsset: 'https://example.test/image.png',
        rightsStatus: 'export-allowed',
        evidenceRefs: ['evidence_embed_image'],
        references: [],
      },
      {
        type: 'figure',
        evidenceId: 'evidence_reference_image',
        alt: 'Reference-only roast image',
        caption: 'Must remain a textual reference.',
        embeddingEligibility: 'reference-only',
        sourcePage: 'https://example.test/reference-only',
        originalAsset: 'https://example.test/reference-only.png',
        rightsStatus: 'reference-only',
        evidenceRefs: ['evidence_reference_image'],
        references: [],
      },
      {
        type: 'static-interaction',
        prompt: 'Which roast sounds closest?',
        fallback: {
          type: 'list',
          content: { items: ['Light: brighter', 'Medium: balanced', 'Dark: roasty'] },
          evidenceRefs: [],
        },
        evidenceRefs: [],
        references: [],
      },
    ],
    sources: [
      {
        evidenceId: 'evidence_embed_image',
        label: 'Exportable roast image',
        kind: 'source-image',
        mimeType: 'image/png',
        source: 'web',
        publisher: 'Fixture Coffee Institute',
        sourcePage: 'https://example.test/source',
        originalAsset: 'https://example.test/image.png',
        rightsStatus: 'export-allowed',
        embeddingEligibility: 'embed',
        byteLength: 8,
        sha256: 'abc',
      },
      {
        evidenceId: 'evidence_reference_image',
        label: 'Reference-only roast image',
        kind: 'source-image',
        mimeType: 'image/png',
        source: 'web',
        publisher: 'Fixture Coffee Institute',
        sourcePage: 'https://example.test/reference-only',
        originalAsset: 'https://example.test/reference-only.png',
        rightsStatus: 'reference-only',
        embeddingEligibility: 'reference-only',
        byteLength: 8,
        sha256: 'def',
      },
    ],
  };
}

function evidenceStore() {
  const records = new Map([
    ['evidence_embed_image', { id: 'evidence_embed_image', workId: 'work_pdf_fixture', mimeType: 'image/png' }],
    ['evidence_reference_image', { id: 'evidence_reference_image', workId: 'work_pdf_fixture', mimeType: 'image/png' }],
  ]);
  return {
    get(id) { return records.get(id) || null; },
    readContent(id) {
      if (id === 'evidence_embed_image') return Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);
      if (id === 'evidence_reference_image') return Buffer.from([0x89, 0x50, 0x4e, 0x47, 5, 6, 7, 8]);
      throw new Error(`missing ${id}`);
    },
  };
}

test('Pandoc PDF renderer fails closed when required binaries are unavailable', async () => {
  const renderer = createPandocCanvasPdfRenderer({
    evidenceStore: evidenceStore(),
    resolveExecutable(name) {
      if (name === 'pandoc') return '/fake/pandoc';
      return null;
    },
  });

  assert.deepEqual(renderer.available(), {
    available: false,
    reason: 'Required PDF engine executable is unavailable: xelatex',
  });
  await assert.rejects(renderer.render(exportDocument()), /xelatex/);
});

test('Pandoc PDF renderer materializes only export-eligible Evidence and invokes Pandoc without a shell', async (t) => {
  const root = tempRoot(t);
  const calls = [];
  const renderer = createPandocCanvasPdfRenderer({
    evidenceStore: evidenceStore(),
    tempRoot: root,
    fontFamily: 'Noto Sans CJK SC',
    resolveExecutable(name) {
      return name === 'pandoc' ? '/fake/pandoc' : '/fake/xelatex';
    },
    async runProcess(input) {
      calls.push({
        command: input.command,
        args: [...input.args],
        cwd: input.cwd,
        timeoutMs: input.timeoutMs,
        markdown: fs.readFileSync(path.join(input.cwd, 'artifact.md'), 'utf8'),
        assets: fs.existsSync(path.join(input.cwd, 'assets')) ? fs.readdirSync(path.join(input.cwd, 'assets')) : [],
      });
      const outputIndex = input.args.indexOf('-o');
      fs.writeFileSync(path.join(input.cwd, input.args[outputIndex + 1]), Buffer.from('%PDF-1.7\nfixture\n', 'utf8'));
      return { code: 0, stdout: '', stderr: '' };
    },
  });

  assert.deepEqual(renderer.available(), {
    available: true,
    pandoc: '/fake/pandoc',
    xelatex: '/fake/xelatex',
    fontFamily: 'Noto Sans CJK SC',
  });
  const bytes = await renderer.render(exportDocument());

  assert.equal(bytes.subarray(0, 5).toString('ascii'), '%PDF-');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].command, '/fake/pandoc');
  assert.equal(calls[0].args.includes('--pdf-engine=/fake/xelatex'), true);
  assert.equal(calls[0].args.includes('mainfont=Noto Sans CJK SC'), true);
  assert.equal(calls[0].args.includes('artifact.md'), true);
  assert.equal(calls[0].args.includes('artifact.pdf'), true);
  assert.match(calls[0].markdown, /!\[Exportable roast image\]\(assets\/evidence_embed_image\.png\)/);
  assert.match(calls[0].markdown, /Figure: Reference-only roast image/);
  assert.doesNotMatch(calls[0].markdown, /!\[Reference-only roast image\]/);
  assert.match(calls[0].markdown, /Static export fallback/);
  assert.match(calls[0].markdown, /咖啡烘焙指南/);
  assert.deepEqual(calls[0].assets, ['evidence_embed_image.png']);
  assert.equal(fs.existsSync(calls[0].cwd), false);
});

test('Pandoc PDF renderer rejects failed engine execution and non-PDF output', async (t) => {
  const root = tempRoot(t);
  const common = {
    evidenceStore: evidenceStore(),
    tempRoot: root,
    resolveExecutable(name) { return `/fake/${name}`; },
  };
  const failed = createPandocCanvasPdfRenderer({
    ...common,
    async runProcess() { return { code: 42, stdout: '', stderr: 'xelatex failed' }; },
  });
  await assert.rejects(failed.render(exportDocument()), /xelatex failed/);

  const invalid = createPandocCanvasPdfRenderer({
    ...common,
    async runProcess(input) {
      const outputIndex = input.args.indexOf('-o');
      fs.writeFileSync(path.join(input.cwd, input.args[outputIndex + 1]), Buffer.from('not a pdf'));
      return { code: 0, stdout: '', stderr: '' };
    },
  });
  await assert.rejects(invalid.render(exportDocument()), /invalid PDF bytes/);
});
