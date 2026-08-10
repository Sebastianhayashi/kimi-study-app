'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createArtifactReferenceStore } = require('../lib/company/artifact-reference-store');
const { createCanvasArtifactStore } = require('../lib/company/canvas-artifact-store');
const { createEvidenceStore } = require('../lib/company/evidence-store');
const { createRelatedWorkIndex } = require('../lib/company/related-work-index');
const { createWorkStore } = require('../lib/company/work-store');

function tempRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lucubro-related-work-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function setup(t) {
  const root = tempRoot(t);
  const workStore = createWorkStore({ rootDir: root, now: () => '2026-08-09T13:10:00.000Z' });
  let evidenceCounter = 0;
  const evidenceStore = createEvidenceStore({
    rootDir: root,
    createId: () => `evidence_related_${++evidenceCounter}`,
    now: () => '2026-08-09T13:10:00.000Z',
  });
  let artifactCounter = 0;
  let blockCounter = 0;
  const artifactStore = createCanvasArtifactStore({
    rootDir: root,
    evidenceStore,
    createArtifactId: () => `artifact_related_${++artifactCounter}`,
    createBlockId: () => `block_related_${++blockCounter}`,
    now: () => '2026-08-09T13:10:00.000Z',
  });

  const priorCoffee = workStore.create({
    id: 'work_coffee_prior',
    brief: 'Teach me the difference between light, medium, and dark coffee roasts.',
    projectId: null,
    assignedEmployeeId: 'ben',
    status: 'accepted',
    runtime: 'mock',
  });
  const coffeeSource = evidenceStore.create({
    runId: 'run_coffee_prior',
    workId: priorCoffee.id,
    workerId: 'worker_local',
    kind: 'source-page',
    label: 'Coffee roast source',
    mimeType: 'text/plain',
    source: 'web',
    content: 'Coffee roast evidence.',
  });
  const coffeeArtifact = artifactStore.create({
    workId: priorCoffee.id,
    projectId: null,
    title: 'Coffee Roast Field Guide',
    blocks: [
      {
        type: 'claim',
        material: true,
        content: { text: 'Medium roast is a broad beginner starting point.' },
        evidenceRefs: [coffeeSource.id],
      },
    ],
  });

  const unrelated = workStore.create({
    id: 'work_website_prior',
    brief: 'Build a landing page for a software launch.',
    projectId: null,
    assignedEmployeeId: 'ben',
    status: 'accepted',
    runtime: 'mock',
  });
  const websiteArtifact = artifactStore.create({
    workId: unrelated.id,
    projectId: null,
    title: 'Website Delivery',
    blocks: [{ type: 'paragraph', content: { text: 'Landing page delivered.' } }],
  });

  const current = workStore.create({
    id: 'work_coffee_followup',
    brief: 'I liked the coffee roast guide. What medium roast beans should I buy next?',
    projectId: null,
    assignedEmployeeId: 'ben',
    status: 'starting',
    runtime: 'mock',
  });

  return {
    root,
    workStore,
    evidenceStore,
    artifactStore,
    priorCoffee,
    coffeeArtifact,
    coffeeSource,
    unrelated,
    websiteArtifact,
    current,
  };
}

test('later lightweight Work finds the prior relevant Artifact without creating a Project', (t) => {
  const f = setup(t);
  const index = createRelatedWorkIndex({ workStore: f.workStore, artifactStore: f.artifactStore });

  const candidates = index.search({
    intent: f.current.brief,
    excludeWorkId: f.current.id,
    limit: 5,
  });

  assert.equal(candidates.length >= 1, true);
  assert.equal(candidates[0].workId, f.priorCoffee.id);
  assert.equal(candidates[0].artifactId, f.coffeeArtifact.id);
  assert.equal(candidates[0].projectId, null);
  assert.equal(candidates[0].matchedTerms.includes('coffee'), true);
  assert.equal(candidates.some((candidate) => candidate.artifactId === f.websiteArtifact.id), false);
  assert.equal(f.workStore.get(f.current.id).projectId, null);
  assert.equal(f.workStore.get(f.priorCoffee.id).projectId, null);
});

test('snapshot reference preserves exact source block semantics and Evidence provenance across restart', (t) => {
  const f = setup(t);
  let referenceCounter = 0;
  const references = createArtifactReferenceStore({
    rootDir: f.root,
    workStore: f.workStore,
    artifactStore: f.artifactStore,
    createId: () => `reference_${++referenceCounter}`,
    now: () => '2026-08-09T13:11:00.000Z',
  });
  const sourceBlock = f.coffeeArtifact.blocks[0];

  const reference = references.create({
    fromWorkId: f.current.id,
    toArtifactId: f.coffeeArtifact.id,
    toBlockId: sourceBlock.id,
    reasonCode: 'related-work-reuse',
  });

  assert.equal(reference.mode, 'snapshot');
  assert.equal(reference.fromWorkId, f.current.id);
  assert.equal(reference.fromProjectId, null);
  assert.equal(reference.toWorkId, f.priorCoffee.id);
  assert.equal(reference.toArtifactId, f.coffeeArtifact.id);
  assert.equal(reference.toBlockId, sourceBlock.id);
  assert.equal(reference.sourceArtifactRevision, 1);
  assert.deepEqual(reference.snapshot, {
    type: 'claim',
    material: true,
    content: { text: 'Medium roast is a broad beginner starting point.' },
    evidenceRefs: [f.coffeeSource.id],
    references: [],
  });
  assert.equal(f.workStore.get(f.current.id).projectId, null);

  sourceBlock.content.text = 'mutated caller copy';
  const restarted = createArtifactReferenceStore({
    rootDir: f.root,
    workStore: f.workStore,
    artifactStore: f.artifactStore,
  });
  assert.deepEqual(restarted.get(reference.id), reference);
  assert.deepEqual(restarted.listByWork(f.current.id), [reference]);
  assert.equal(restarted.get(reference.id).snapshot.content.text, 'Medium roast is a broad beginner starting point.');
});

test('reference creation fails closed for foreign/missing Work or block targets and never promotes Project state', (t) => {
  const f = setup(t);
  const references = createArtifactReferenceStore({
    rootDir: f.root,
    workStore: f.workStore,
    artifactStore: f.artifactStore,
    createId: () => 'reference_fail',
  });

  assert.throws(() => references.create({
    fromWorkId: 'work_missing',
    toArtifactId: f.coffeeArtifact.id,
    toBlockId: f.coffeeArtifact.blocks[0].id,
    reasonCode: 'related-work-reuse',
  }), /Work not found/i);

  assert.throws(() => references.create({
    fromWorkId: f.current.id,
    toArtifactId: f.coffeeArtifact.id,
    toBlockId: 'block_missing',
    reasonCode: 'related-work-reuse',
  }), /Artifact block not found/i);

  assert.throws(() => references.create({
    fromWorkId: f.current.id,
    toArtifactId: 'artifact_missing',
    toBlockId: 'block_missing',
    reasonCode: 'related-work-reuse',
  }), /Artifact not found/i);

  assert.equal(f.workStore.get(f.current.id).projectId, null);
  assert.deepEqual(references.listByWork(f.current.id), []);
});
