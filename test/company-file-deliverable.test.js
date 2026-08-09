'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createEvidenceStore } = require('../lib/company/evidence-store');
const { createSkillOutputIngestor } = require('../lib/company/skill-output-ingestor');
const { createWorkPlanner } = require('../lib/company/work-planner');

function tempRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lucubro-file-deliverable-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function plannerHarness(proposal) {
  return createWorkPlanner({
    catalog: {
      list() { return []; },
      get() { return null; },
    },
    compatibility: { resolve() { return { status: 'native' }; } },
    dependencyResolver: {
      resolve() { return { skillIds: [], files: [], skillRoots: [], diagnostics: [] }; },
    },
    planner: { async plan() { return structuredClone(proposal); } },
  });
}

function baseProposal(overrides = {}) {
  return {
    complexity: 'simple',
    durability: 'saved-work',
    projectAction: 'none',
    issueAction: 'none',
    skillSelections: [],
    staffing: { manager: true, specialistSubruns: [] },
    evidenceRequired: false,
    deliverable: 'canvas-artifact',
    ...overrides,
  };
}

test('planner may declare a requested file only from an explicit path in current user intent', async () => {
  const intent = 'Create the website and give me dist/launch-report.md as a file deliverable.';
  const planner = plannerHarness(baseProposal({
    fileDeliverables: [{
      path: 'dist/launch-report.md',
      label: 'Launch report',
      mimeType: 'text/markdown',
      userIntentEvidence: 'dist/launch-report.md',
    }],
  }));

  const plan = await planner.plan({ intent });

  assert.deepEqual(plan.fileDeliverables, [{
    path: 'dist/launch-report.md',
    label: 'Launch report',
    mimeType: 'text/markdown',
    userIntentEvidence: 'dist/launch-report.md',
  }]);
});

test('planner rejects invented, absolute, and traversal file deliverables', async () => {
  const intent = 'Create the website and give me dist/launch-report.md.';

  await assert.rejects(
    plannerHarness(baseProposal({ fileDeliverables: [{ path: 'notes/private.md', userIntentEvidence: 'website' }] })).plan({ intent }),
    /file deliverable path must be explicitly present in user intent/i,
  );
  await assert.rejects(
    plannerHarness(baseProposal({ fileDeliverables: [{ path: '/tmp/report.md', userIntentEvidence: '/tmp/report.md' }] })).plan({ intent: 'Write /tmp/report.md' }),
    /relative path/i,
  );
  await assert.rejects(
    plannerHarness(baseProposal({ fileDeliverables: [{ path: '../report.md', userIntentEvidence: '../report.md' }] })).plan({ intent: 'Write ../report.md' }),
    /relative path/i,
  );
});

test('an explicitly requested file becomes an evidence-backed file receipt without creating Artifact identity', async (t) => {
  const root = tempRoot(t);
  const evidenceStore = createEvidenceStore({
    rootDir: root,
    createId: () => 'evidence_requested_file',
    now: () => '2026-08-09T11:50:00.000Z',
  });
  const ingestor = createSkillOutputIngestor({
    evidenceStore,
    approvalBroker: { async request() { throw new Error('approval not expected'); } },
  });

  const result = await ingestor.ingest({
    runId: 'run_file',
    workId: 'work_file',
    workerId: 'worker_local',
    skillId: 'matt:implement',
    subrunId: 'subrun_implement',
    fileDeliverables: [{
      path: 'dist/launch-report.md',
      label: 'Launch report',
      mimeType: 'text/markdown',
      userIntentEvidence: 'dist/launch-report.md',
    }],
    output: {
      type: 'file.deliverable',
      file: {
        path: 'dist/launch-report.md',
        mimeType: 'text/markdown',
        content: '# Launch report\n\nVerified build notes.\n',
      },
    },
  });

  assert.equal(result.classification, 'file-deliverable');
  assert.equal(result.accepted, true);
  assert.equal(result.event.type, 'file.deliverable.produced');
  assert.deepEqual(result.event.file, {
    path: 'dist/launch-report.md',
    label: 'Launch report',
    mimeType: 'text/markdown',
    evidenceId: 'evidence_requested_file',
    byteLength: 39,
    sha256: evidenceStore.get('evidence_requested_file').sha256,
  });
  assert.equal(Object.hasOwn(result.event, 'artifactId'), false);
  assert.equal(Object.hasOwn(result.event, 'blockId'), false);
  assert.equal(Object.hasOwn(result.event, 'canvasId'), false);
  assert.equal(result.event.file.content, undefined);
  assert.equal(evidenceStore.readContent('evidence_requested_file').toString('utf8'), '# Launch report\n\nVerified build notes.\n');
});

test('an undeclared file cannot become a file deliverable merely because a Skill produced it', async (t) => {
  const root = tempRoot(t);
  const evidenceStore = createEvidenceStore({ rootDir: root, createId: () => 'evidence_must_not_exist' });
  const ingestor = createSkillOutputIngestor({
    evidenceStore,
    approvalBroker: { async request() { throw new Error('approval not expected'); } },
  });

  const result = await ingestor.ingest({
    runId: 'run_file',
    workId: 'work_file',
    workerId: 'worker_local',
    skillId: 'matt:implement',
    fileDeliverables: [],
    output: {
      type: 'file.deliverable',
      file: {
        path: 'dist/surprise.html',
        mimeType: 'text/html',
        content: '<html>vendor output</html>',
      },
    },
  });

  assert.equal(result.classification, 'file-deliverable');
  assert.equal(result.accepted, false);
  assert.equal(result.event.type, 'file.deliverable.blocked');
  assert.equal(result.event.path, 'dist/surprise.html');
  assert.equal(result.event.reason, 'File was not explicitly requested by the owning Work.');
  assert.equal(evidenceStore.get('evidence_must_not_exist'), null);
  assert.equal(JSON.stringify(result.event).includes('vendor output'), false);
});
