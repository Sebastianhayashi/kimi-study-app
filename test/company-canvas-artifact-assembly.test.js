'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createCanvasArtifactAssembler } = require('../lib/company/canvas-artifact-assembler');
const { createCanvasArtifactStore } = require('../lib/company/canvas-artifact-store');
const { createEvidenceStore } = require('../lib/company/evidence-store');
const { createSkillOutputIngestor } = require('../lib/company/skill-output-ingestor');

function tempRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lucubro-canvas-assembly-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

test('accepted Skill proposals and requested file receipts assemble into one canonical Canvas Artifact', async (t) => {
  const root = tempRoot(t);
  let evidenceCounter = 0;
  const evidenceStore = createEvidenceStore({
    rootDir: root,
    createId: () => `evidence_assembly_${++evidenceCounter}`,
    now: () => '2026-08-09T12:30:00.000Z',
  });
  const source = evidenceStore.create({
    runId: 'run_research',
    workId: 'work_coffee',
    workerId: 'worker_local',
    kind: 'source-page',
    label: 'Roast source',
    mimeType: 'text/plain',
    source: 'web',
    content: 'Source evidence.',
  });
  const ingestor = createSkillOutputIngestor({
    evidenceStore,
    approvalBroker: { async request() { throw new Error('approval not expected'); } },
  });

  const claim = await ingestor.ingest({
    runId: 'run_manager',
    workId: 'work_coffee',
    workerId: 'worker_local',
    skillId: 'matt:teach',
    output: {
      type: 'artifact.block',
      block: {
        type: 'claim',
        text: 'Roast level changes flavor and roast character.',
        material: true,
        evidenceRefs: [source.id],
      },
    },
  });
  const interaction = await ingestor.ingest({
    runId: 'run_manager',
    workId: 'work_coffee',
    workerId: 'worker_local',
    skillId: 'matt:teach',
    output: {
      type: 'artifact.block',
      block: {
        type: 'interaction',
        content: {
          kind: 'choice',
          prompt: 'Which roast direction sounds closest?',
          options: ['light', 'medium', 'dark'],
        },
        staticFallback: {
          type: 'list',
          content: { items: ['Light', 'Medium', 'Dark'] },
        },
      },
    },
  });
  const file = await ingestor.ingest({
    runId: 'run_manager',
    workId: 'work_coffee',
    workerId: 'worker_local',
    skillId: 'matt:implement',
    fileDeliverables: [{
      path: 'dist/coffee-guide.md',
      label: 'Coffee guide',
      mimeType: 'text/markdown',
      userIntentEvidence: 'dist/coffee-guide.md',
    }],
    output: {
      type: 'file.deliverable',
      file: {
        path: 'dist/coffee-guide.md',
        content: '# Coffee guide\n',
      },
    },
  });
  const blocked = await ingestor.ingest({
    runId: 'run_manager',
    workId: 'work_coffee',
    workerId: 'worker_local',
    skillId: 'vendor:report',
    output: {
      type: 'host.raw',
      content: '<main>must never become Canvas state</main>',
    },
  });

  assert.deepEqual(claim.event.block.content, {
    text: 'Roast level changes flavor and roast character.',
  });
  assert.equal(interaction.event.type, 'artifact.content.proposed');
  assert.equal(interaction.event.block.type, 'interaction');
  assert.equal(interaction.event.block.staticFallback.type, 'list');
  assert.equal(file.event.type, 'file.deliverable.produced');
  assert.equal(blocked.event.type, 'skill.output.unsupported');

  let blockCounter = 0;
  const artifactStore = createCanvasArtifactStore({
    rootDir: root,
    evidenceStore,
    createArtifactId: () => 'artifact_assembled_coffee',
    createBlockId: () => `block_assembled_${++blockCounter}`,
    now: () => '2026-08-09T12:31:00.000Z',
  });
  const assembler = createCanvasArtifactAssembler({ artifactStore });
  const artifact = assembler.assemble({
    workId: 'work_coffee',
    projectId: null,
    title: 'Coffee Roast Field Guide',
    events: [
      claim.event,
      interaction.event,
      file.event,
      blocked.event,
      { type: 'artifact.content.blocked', reason: 'ignored blocked proposal' },
    ],
  });

  assert.equal(artifact.id, 'artifact_assembled_coffee');
  assert.deepEqual(artifact.blocks.map((block) => block.type), ['claim', 'interaction', 'file-reference']);
  assert.deepEqual(artifact.blocks.map((block) => block.id), ['block_assembled_1', 'block_assembled_2', 'block_assembled_3']);
  assert.equal(artifact.blocks[0].content.text, 'Roast level changes flavor and roast character.');
  assert.equal(artifact.blocks[1].staticFallback.type, 'list');
  assert.equal(artifact.blocks[2].content.path, 'dist/coffee-guide.md');
  assert.equal(JSON.stringify(artifact).includes('must never become Canvas state'), false);
  assert.equal(JSON.stringify(artifact).includes('ignored blocked proposal'), false);
});
