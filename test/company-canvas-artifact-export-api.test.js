'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createCompanyServer } = require('../company-server');

function tempRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lucubro-canvas-export-api-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

async function withServer(options, prepare, run) {
  const instance = createCompanyServer(options);
  const prepared = await prepare(instance);
  const server = instance.app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address();
  try {
    return await run(`http://127.0.0.1:${address.port}`, instance, prepared);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

function seed(instance) {
  instance.workStore.create({
    id: 'work_export_api',
    brief: 'Export this Artifact.',
    assignedEmployeeId: 'ben',
    status: 'review',
    runtime: 'mock',
  });
  const source = instance.evidenceStore.create({
    id: 'evidence_export_api_source',
    runId: 'run_export_api',
    workId: 'work_export_api',
    workerId: instance.localWorker.id,
    kind: 'source-page',
    label: 'Export source',
    mimeType: 'text/plain',
    source: 'web',
    metadata: {
      publisher: 'Fixture Publisher',
      sourcePage: 'https://example.test/export-source',
    },
    content: 'Evidence.',
  });
  return instance.canvasArtifactStore.create({
    workId: 'work_export_api',
    title: 'Export Fixture',
    blocks: [
      {
        type: 'claim',
        material: true,
        content: { text: 'A sourced claim.' },
        evidenceRefs: [source.id],
      },
      {
        type: 'interaction',
        content: { kind: 'choice', prompt: 'Choose one', options: ['A', 'B'] },
        staticFallback: {
          type: 'list',
          content: { items: ['A: first', 'B: second'] },
        },
      },
    ],
  });
}

test('Work Artifact endpoint advertises export capability and serves Markdown/PDF from canonical IR', async (t) => {
  const dataDir = tempRoot(t);
  const pdfDocuments = [];

  await withServer({
    dataDir,
    runtimes: new Map(),
    worktreeManager: {},
    canvasPdfRenderer: {
      available() { return { available: true, engine: 'fixture' }; },
      async render(document) {
        pdfDocuments.push(structuredClone(document));
        return Buffer.from('%PDF-1.7\nfixture\n', 'utf8');
      },
    },
  }, async (instance) => seed(instance), async (baseUrl, instance, artifact) => {
    const projectionResponse = await fetch(`${baseUrl}/api/company/works/work_export_api/artifacts`);
    assert.equal(projectionResponse.status, 200);
    const projection = await projectionResponse.json();
    assert.deepEqual(projection.exportCapabilities, {
      markdown: { available: true },
      pdf: { available: true, engine: 'fixture' },
    });

    const markdownResponse = await fetch(`${baseUrl}/api/company/works/work_export_api/artifacts/${encodeURIComponent(artifact.id)}/export.md`);
    assert.equal(markdownResponse.status, 200);
    assert.match(markdownResponse.headers.get('content-type'), /^text\/markdown/);
    assert.match(markdownResponse.headers.get('content-disposition'), new RegExp(`${artifact.id}\\.md`));
    const markdown = await markdownResponse.text();
    assert.match(markdown, /^# Export Fixture/m);
    assert.match(markdown, /A sourced claim/);
    assert.match(markdown, /Static export fallback/);
    assert.match(markdown, /Fixture Publisher/);

    const pdfResponse = await fetch(`${baseUrl}/api/company/works/work_export_api/artifacts/${encodeURIComponent(artifact.id)}/export.pdf`);
    assert.equal(pdfResponse.status, 200);
    assert.equal(pdfResponse.headers.get('content-type'), 'application/pdf');
    assert.match(pdfResponse.headers.get('content-disposition'), new RegExp(`${artifact.id}\\.pdf`));
    const pdf = Buffer.from(await pdfResponse.arrayBuffer());
    assert.equal(pdf.subarray(0, 5).toString('ascii'), '%PDF-');
    assert.equal(pdfDocuments.length, 1);
    assert.equal(pdfDocuments[0].artifactId, artifact.id);
    assert.equal(pdfDocuments[0].blocks.some((block) => block.type === 'static-interaction'), true);
  });
});

test('Artifact export stays Work-scoped and PDF fails closed when its engine is unavailable', async (t) => {
  const dataDir = tempRoot(t);

  await withServer({
    dataDir,
    runtimes: new Map(),
    worktreeManager: {},
    canvasPdfRenderer: {
      available() { return { available: false, reason: 'xelatex unavailable' }; },
      async render() { throw new Error('must not render'); },
    },
  }, async (instance) => {
    const artifact = seed(instance);
    instance.workStore.create({
      id: 'work_other_export',
      brief: 'Other Work.',
      assignedEmployeeId: 'ben',
      status: 'review',
      runtime: 'mock',
    });
    return artifact;
  }, async (baseUrl, instance, artifact) => {
    const wrongWork = await fetch(`${baseUrl}/api/company/works/work_other_export/artifacts/${encodeURIComponent(artifact.id)}/export.md`);
    assert.equal(wrongWork.status, 404);

    const pdfResponse = await fetch(`${baseUrl}/api/company/works/work_export_api/artifacts/${encodeURIComponent(artifact.id)}/export.pdf`);
    assert.equal(pdfResponse.status, 503);
    const error = await pdfResponse.json();
    assert.match(error.error, /xelatex unavailable/);
  });
});
