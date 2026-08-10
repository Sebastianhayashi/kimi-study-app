'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createEvidenceStore } = require('../lib/company/evidence-store');
const { createSkillOutputIngestor } = require('../lib/company/skill-output-ingestor');

function tempRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lucubro-skill-output-ingestion-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function setup(t) {
  const root = tempRoot(t);
  let evidenceCounter = 0;
  const evidenceStore = createEvidenceStore({
    rootDir: root,
    now: () => '2026-08-09T11:25:00.000Z',
    createId: () => `evidence_skill_${++evidenceCounter}`,
  });
  const approvalRequests = [];
  const ingestor = createSkillOutputIngestor({
    evidenceStore,
    approvalBroker: {
      async request(input) {
        approvalRequests.push(structuredClone(input));
        return 'allow';
      },
    },
  });
  const context = {
    runId: 'run_skill_output',
    workId: 'work_skill_output',
    workerId: 'worker_local',
    subrunId: 'subrun_research',
    skillId: 'mattpocock-skills:research',
    delegationEnvelope: { allow: ['workspace.read', 'network.access'], deny: ['git.push'] },
  };
  return { root, evidenceStore, approvalRequests, ingestor, context };
}

test('source Evidence is persisted with Run/Work/Skill provenance', async (t) => {
  const fixture = setup(t);
  const result = await fixture.ingestor.ingest({
    ...fixture.context,
    output: {
      type: 'evidence',
      evidence: {
        kind: 'source-page',
        label: 'Primary roast source',
        mimeType: 'text/plain',
        source: 'web',
        content: 'Primary source notes',
        metadata: { url: 'https://example.test/roast' },
      },
    },
  });

  assert.equal(result.classification, 'evidence');
  assert.equal(result.event.type, 'evidence.produced');
  assert.equal(result.event.evidence.id, 'evidence_skill_1');
  assert.equal(result.event.evidence.runId, fixture.context.runId);
  assert.equal(result.event.evidence.workId, fixture.context.workId);
  assert.equal(result.event.evidence.metadata.skillId, fixture.context.skillId);
  assert.equal(result.event.evidence.metadata.subrunId, fixture.context.subrunId);
  assert.equal(fixture.evidenceStore.readContent('evidence_skill_1').toString('utf8'), 'Primary source notes');
});

test('semantic Artifact content remains a renderer-independent proposal event', async (t) => {
  const fixture = setup(t);
  await fixture.ingestor.ingest({
    ...fixture.context,
    output: {
      type: 'evidence',
      evidence: {
        kind: 'source-page',
        label: 'Roast acidity source',
        mimeType: 'text/plain',
        source: 'web',
        content: 'Primary source supporting the material roast claim.',
      },
    },
  });
  const result = await fixture.ingestor.ingest({
    ...fixture.context,
    output: {
      type: 'artifact.block',
      block: {
        type: 'claim',
        text: 'Light roasts are commonly described with brighter acidity.',
        material: true,
        evidenceRefs: ['evidence_skill_1'],
      },
    },
  });

  assert.equal(result.classification, 'artifact-content');
  assert.equal(result.event.type, 'artifact.content.proposed');
  assert.equal(result.event.block.type, 'claim');
  assert.equal(result.event.block.html, undefined);
  assert.equal(result.event.skillId, fixture.context.skillId);
  assert.equal(result.event.subrunId, fixture.context.subrunId);
});

test('Project Memory patch becomes a sanitized proposal only when referenced Evidence belongs to the Work', async (t) => {
  const fixture = setup(t);
  await fixture.ingestor.ingest({
    ...fixture.context,
    output: {
      type: 'evidence',
      evidence: {
        kind: 'product-candidate',
        label: 'Taobao sofa-cover candidate',
        mimeType: 'text/plain',
        source: 'user-supplied',
        content: 'Candidate dimensions and listing observations.',
      },
    },
  });

  const result = await fixture.ingestor.ingest({
    ...fixture.context,
    output: {
      type: 'project.memory.patch',
      summary: 'Evaluated the new sofa-cover candidate against the existing sofa frontier.',
      evidenceRefs: ['evidence_skill_1'],
      mutation: {
        report: {
          changed: 'A segment-level full-cover candidate is now the leading reversible option.',
          nextAction: 'Measure the three sofa segments against the seller size chart.',
        },
        frontiersUpsert: [{
          id: 'frontier_sofa',
          title: 'Sofa visual refresh',
          status: 'active',
          summary: 'Validate the candidate before purchase.',
          nextAction: 'Measure the three sofa segments against the seller size chart.',
          evidenceIds: ['evidence_skill_1'],
        }],
      },
    },
  });

  assert.equal(result.classification, 'project-memory');
  assert.equal(result.accepted, true);
  assert.equal(result.event.type, 'project.memory.proposed');
  assert.deepEqual(result.event.evidenceRefs, ['evidence_skill_1']);
  assert.equal(result.event.mutation.frontiersUpsert[0].id, 'frontier_sofa');
  assert.equal(JSON.stringify(result.event).includes('transcript'), false);

  const missing = await fixture.ingestor.ingest({
    ...fixture.context,
    output: {
      type: 'project.memory.patch',
      summary: 'This missing Evidence reference must fail closed.',
      evidenceRefs: ['evidence_missing'],
      mutation: { report: { changed: 'Must not become canonical.' } },
    },
  });
  assert.equal(missing.classification, 'project-memory');
  assert.equal(missing.accepted, false);
  assert.equal(missing.event.type, 'project.memory.blocked');
  assert.deepEqual(missing.event.missingEvidenceRefs, ['evidence_missing']);
});

test('workspace diff is stored as Evidence and raw diff is not copied into the public event', async (t) => {
  const fixture = setup(t);
  const result = await fixture.ingestor.ingest({
    ...fixture.context,
    output: {
      type: 'workspace.diff',
      changedFiles: ['src/home.js'],
      diff: 'diff --git a/src/home.js b/src/home.js\n+const improved = true;\n',
    },
  });

  assert.equal(result.classification, 'workspace-mutation');
  assert.equal(result.event.type, 'workspace.mutation.reported');
  assert.deepEqual(result.event.changedFiles, ['src/home.js']);
  assert.equal(Object.hasOwn(result.event, 'diff'), false);
  assert.equal(result.event.evidence.id, 'evidence_skill_1');
  assert.match(fixture.evidenceStore.readContent('evidence_skill_1').toString('utf8'), /improved = true/);
});

test('authority requests use ApprovalBroker and transient notes do not persist', async (t) => {
  const fixture = setup(t);
  const authority = await fixture.ingestor.ingest({
    ...fixture.context,
    output: {
      type: 'authority.request',
      capability: 'network.access',
      reason: 'Read a primary source.',
      detail: { url: 'https://example.test' },
    },
  });
  const note = await fixture.ingestor.ingest({
    ...fixture.context,
    output: {
      type: 'note',
      persistence: 'transient',
      text: 'Try a shorter explanation.',
    },
  });

  assert.equal(authority.classification, 'authority-request');
  assert.equal(authority.decision, 'allow');
  assert.equal(authority.event, null);
  assert.equal(fixture.approvalRequests.length, 1);
  assert.equal(fixture.approvalRequests[0].request.capability, 'network.access');
  assert.deepEqual(fixture.approvalRequests[0].envelope, fixture.context.delegationEnvelope);
  assert.equal(note.classification, 'transient-note');
  assert.equal(note.event, null);
  assert.equal(fixture.evidenceStore.listByRun(fixture.context.runId).length, 0);
});

test('unsupported raw host output produces only a sanitized diagnostic event', async (t) => {
  const fixture = setup(t);
  const result = await fixture.ingestor.ingest({
    ...fixture.context,
    output: {
      type: 'host.raw',
      host: 'gstack',
      format: 'html-report',
      content: '<main>vendor-owned rendering</main>',
    },
  });

  assert.equal(result.classification, 'unsupported');
  assert.equal(result.event.type, 'skill.output.unsupported');
  assert.match(result.event.reason, /adapted before Lucubro ingestion/i);
  assert.equal(Object.hasOwn(result.event, 'output'), false);
  assert.equal(JSON.stringify(result.event).includes('vendor-owned rendering'), false);
});
