'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createEvidenceStore } = require('../lib/company/evidence-store');
const { createSkillOutputIngestor } = require('../lib/company/skill-output-ingestor');

function tempRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lucubro-skill-evidence-graph-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function setup(t) {
  const root = tempRoot(t);
  let counter = 0;
  const evidenceStore = createEvidenceStore({
    rootDir: root,
    now: () => '2026-08-09T11:45:00.000Z',
    createId: () => `evidence_graph_${++counter}`,
  });
  const ingestor = createSkillOutputIngestor({
    evidenceStore,
    approvalBroker: { async request() { return 'deny'; } },
  });
  return { evidenceStore, ingestor };
}

function createEvidence(evidenceStore, overrides = {}) {
  return evidenceStore.create({
    runId: 'run_research_child',
    workId: 'work_coffee',
    workerId: 'worker_local',
    kind: 'source-page',
    label: 'Primary coffee source',
    mimeType: 'text/plain',
    source: 'web',
    metadata: { skillId: 'mattpocock-skills:research', subrunId: 'subrun_research' },
    content: 'Inspectable primary source notes',
    ...overrides,
  });
}

test('material claim may cite Evidence from another specialist Run in the same Work', async (t) => {
  const fixture = setup(t);
  const evidence = createEvidence(fixture.evidenceStore);

  const result = await fixture.ingestor.ingest({
    runId: 'run_manager',
    workId: 'work_coffee',
    workerId: 'worker_local',
    skillId: 'mattpocock-skills:teach',
    subrunId: null,
    delegationEnvelope: { allow: ['workspace.read'], deny: [] },
    output: {
      type: 'artifact.block',
      block: {
        type: 'claim',
        text: 'Roast descriptions often discuss acidity and origin character differently across roast levels.',
        material: true,
        evidenceRefs: [evidence.id],
      },
    },
  });

  assert.equal(result.classification, 'artifact-content');
  assert.equal(result.event.type, 'artifact.content.proposed');
  assert.deepEqual(result.event.block.evidenceRefs, [evidence.id]);
  assert.equal(result.event.skillId, 'mattpocock-skills:teach');
  assert.equal(fixture.evidenceStore.get(evidence.id).metadata.skillId, 'mattpocock-skills:research');
});

test('material claim with missing Evidence is blocked instead of becoming proposed Artifact content', async (t) => {
  const fixture = setup(t);

  const result = await fixture.ingestor.ingest({
    runId: 'run_manager',
    workId: 'work_coffee',
    workerId: 'worker_local',
    skillId: 'mattpocock-skills:teach',
    output: {
      type: 'artifact.block',
      block: {
        type: 'claim',
        text: 'An unsupported factual claim.',
        material: true,
        evidenceRefs: ['evidence_missing'],
      },
    },
  });

  assert.equal(result.classification, 'artifact-content');
  assert.equal(result.accepted, false);
  assert.equal(result.event.type, 'artifact.content.blocked');
  assert.deepEqual(result.event.missingEvidenceRefs, ['evidence_missing']);
});

test('Evidence owned by another Work cannot silently substantiate this Work', async (t) => {
  const fixture = setup(t);
  const otherWorkEvidence = createEvidence(fixture.evidenceStore, {
    runId: 'run_other',
    workId: 'work_other',
    label: 'Other Work source',
  });

  const result = await fixture.ingestor.ingest({
    runId: 'run_manager',
    workId: 'work_coffee',
    workerId: 'worker_local',
    skillId: 'mattpocock-skills:teach',
    output: {
      type: 'artifact.block',
      block: {
        type: 'claim',
        text: 'Do not smuggle evidence across Work identity.',
        material: true,
        evidenceRefs: [otherWorkEvidence.id],
      },
    },
  });

  assert.equal(result.accepted, false);
  assert.equal(result.event.type, 'artifact.content.blocked');
  assert.deepEqual(result.event.foreignEvidenceRefs, [otherWorkEvidence.id]);
});

test('material claim with no Evidence references is blocked while non-material prose may remain unreferenced', async (t) => {
  const fixture = setup(t);
  const material = await fixture.ingestor.ingest({
    runId: 'run_manager',
    workId: 'work_coffee',
    workerId: 'worker_local',
    skillId: 'mattpocock-skills:teach',
    output: {
      type: 'artifact.block',
      block: { type: 'claim', text: 'Needs substantiation.', material: true, evidenceRefs: [] },
    },
  });
  const explanatory = await fixture.ingestor.ingest({
    runId: 'run_manager',
    workId: 'work_coffee',
    workerId: 'worker_local',
    skillId: 'mattpocock-skills:teach',
    output: {
      type: 'artifact.block',
      block: { type: 'paragraph', text: 'A transition that does not assert a material external fact.' },
    },
  });

  assert.equal(material.accepted, false);
  assert.equal(material.event.type, 'artifact.content.blocked');
  assert.equal(explanatory.accepted, true);
  assert.equal(explanatory.event.type, 'artifact.content.proposed');
});
