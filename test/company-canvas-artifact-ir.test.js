'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createCanvasArtifactStore } = require('../lib/company/canvas-artifact-store');
const { createEvidenceStore } = require('../lib/company/evidence-store');

function tempRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lucubro-canvas-artifact-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function evidenceFixture(root) {
  let next = 0;
  const store = createEvidenceStore({
    rootDir: root,
    createId: () => `evidence_artifact_${++next}`,
    now: () => '2026-08-09T12:10:00.000Z',
  });
  const source = store.create({
    runId: 'run_research',
    workId: 'work_coffee',
    workerId: 'worker_local',
    kind: 'source-page',
    label: 'Coffee source',
    mimeType: 'text/plain',
    source: 'web',
    content: 'Light roast source evidence.',
  });
  const file = store.create({
    runId: 'run_manager',
    workId: 'work_coffee',
    workerId: 'worker_local',
    kind: 'deliverable-file',
    label: 'Coffee guide',
    mimeType: 'text/markdown',
    source: 'skill-output',
    metadata: { path: 'dist/coffee-guide.md', requested: true },
    content: '# Coffee guide\n',
  });
  return { store, source, file };
}

test('Canvas Artifact persists stable semantic block identity, Evidence edges, references, interactions, and file receipts', (t) => {
  const root = tempRoot(t);
  const evidence = evidenceFixture(root);
  let blockCounter = 0;
  const store = createCanvasArtifactStore({
    rootDir: root,
    evidenceStore: evidence.store,
    createArtifactId: () => 'artifact_coffee_roasts',
    createBlockId: () => `block_${++blockCounter}`,
    now: () => '2026-08-09T12:11:00.000Z',
  });

  const created = store.create({
    workId: 'work_coffee',
    projectId: null,
    title: 'Coffee Roast Field Guide',
    blocks: [
      {
        type: 'heading',
        content: { text: 'Roast spectrum' },
      },
      {
        type: 'claim',
        material: true,
        content: { text: 'Roast level changes flavor and roast character.' },
        evidenceRefs: [evidence.source.id],
        references: [{
          artifactId: 'artifact_prior_notes',
          blockId: 'block_prior_roast',
          mode: 'snapshot',
        }],
      },
      {
        type: 'interaction',
        content: {
          kind: 'choice',
          prompt: 'Which roast direction sounds closest to your preference?',
          options: ['light', 'medium', 'dark'],
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
          evidenceId: evidence.file.id,
        },
        evidenceRefs: [evidence.file.id],
      },
    ],
  });

  assert.equal(created.id, 'artifact_coffee_roasts');
  assert.equal(created.workId, 'work_coffee');
  assert.equal(created.projectId, null);
  assert.equal(created.revision, 1);
  assert.deepEqual(created.blocks.map((block) => block.id), ['block_1', 'block_2', 'block_3', 'block_4']);
  assert.deepEqual(created.blocks[1].evidenceRefs, [evidence.source.id]);
  assert.deepEqual(created.blocks[1].references, [{
    artifactId: 'artifact_prior_notes',
    blockId: 'block_prior_roast',
    mode: 'snapshot',
  }]);
  assert.equal(created.blocks[2].type, 'interaction');
  assert.equal(created.blocks[2].staticFallback.type, 'list');
  assert.equal(created.blocks[3].content.evidenceId, evidence.file.id);
  assert.notEqual(created.id, created.blocks[3].content.path);

  const restarted = createCanvasArtifactStore({ rootDir: root, evidenceStore: evidence.store });
  assert.deepEqual(restarted.get(created.id), created);
});

test('Canvas Artifact rejects renderer-owned state, unknown block types, and interactions without static fallback', (t) => {
  const root = tempRoot(t);
  const evidence = evidenceFixture(root);
  let artifactCounter = 0;
  const store = createCanvasArtifactStore({
    rootDir: root,
    evidenceStore: evidence.store,
    createArtifactId: () => `artifact_reject_${++artifactCounter}`,
    createBlockId: () => `block_reject_${artifactCounter}`,
  });

  assert.throws(() => store.create({
    workId: 'work_coffee',
    title: 'Bad HTML artifact',
    html: '<main>canonical renderer leak</main>',
    blocks: [],
  }), /renderer-owned field/i);

  assert.throws(() => store.create({
    workId: 'work_coffee',
    title: 'Bad renderer block',
    blocks: [{ type: 'html', content: { html: '<p>vendor report</p>' } }],
  }), /renderer-owned field/i);

  assert.throws(() => store.create({
    workId: 'work_coffee',
    title: 'Unknown semantic block',
    blocks: [{ type: 'vendor-report', content: { text: 'opaque vendor shape' } }],
  }), /semantic block type/i);

  assert.throws(() => store.create({
    workId: 'work_coffee',
    title: 'Bad interaction',
    blocks: [{
      type: 'interaction',
      content: { kind: 'choice', prompt: 'Pick one', options: ['a', 'b'] },
    }],
  }), /static fallback/i);
});

test('material Artifact claims cannot cite missing or foreign-Work Evidence', (t) => {
  const root = tempRoot(t);
  const evidence = evidenceFixture(root);
  const foreign = evidence.store.create({
    runId: 'run_foreign',
    workId: 'work_other',
    workerId: 'worker_local',
    kind: 'source-page',
    label: 'Foreign source',
    mimeType: 'text/plain',
    source: 'web',
    content: 'Foreign evidence.',
  });
  let artifactCounter = 0;
  const store = createCanvasArtifactStore({
    rootDir: root,
    evidenceStore: evidence.store,
    createArtifactId: () => `artifact_evidence_${++artifactCounter}`,
    createBlockId: () => 'block_claim',
  });

  assert.throws(() => store.create({
    workId: 'work_coffee',
    title: 'Missing evidence',
    blocks: [{ type: 'claim', material: true, content: { text: 'Claim' }, evidenceRefs: ['evidence_missing'] }],
  }), /Evidence not found/i);

  assert.throws(() => store.create({
    workId: 'work_coffee',
    title: 'Foreign evidence',
    blocks: [{ type: 'claim', material: true, content: { text: 'Claim' }, evidenceRefs: [foreign.id] }],
  }), /owning Work/i);
});
