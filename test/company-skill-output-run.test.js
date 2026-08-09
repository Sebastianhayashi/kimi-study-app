'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createApprovalBroker } = require('../lib/company/approval-broker');
const { createEvidenceStore } = require('../lib/company/evidence-store');
const { createExecutionWorkspaceManager } = require('../lib/company/execution-workspace-manager');
const { createRunOrchestrator } = require('../lib/company/run-orchestrator');
const { createRunStore } = require('../lib/company/run-store');
const { createSkillOutputIngestor } = require('../lib/company/skill-output-ingestor');

function tempRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lucubro-skill-output-run-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

test('RunOrchestrator ingests Skill outputs without persisting vendor raw payloads or transient notes', async (t) => {
  const root = tempRoot(t);
  const runStore = createRunStore({ rootDir: root, now: () => '2026-08-09T11:35:00.000Z' });
  let evidenceCounter = 0;
  const evidenceStore = createEvidenceStore({
    rootDir: root,
    now: () => '2026-08-09T11:35:00.000Z',
    createId: () => `evidence_run_skill_${++evidenceCounter}`,
  });
  const approvalBroker = createApprovalBroker({ runStore, createId: () => 'approval_skill_output' });
  const ingestor = createSkillOutputIngestor({ evidenceStore, approvalBroker });
  const runtime = {
    async *run() {
      yield {
        type: 'skill.output',
        skillId: 'mattpocock-skills:research',
        output: {
          type: 'evidence',
          evidence: {
            kind: 'source-page',
            label: 'Primary source',
            mimeType: 'text/plain',
            source: 'web',
            content: 'inspectable source content',
          },
        },
      };
      yield {
        type: 'skill.output',
        skillId: 'mattpocock-skills:research',
        output: {
          type: 'artifact.block',
          block: {
            type: 'paragraph',
            text: 'A semantic paragraph.',
            evidenceRefs: ['evidence_run_skill_1'],
          },
        },
      };
      yield {
        type: 'skill.output',
        skillId: 'mattpocock-skills:implement',
        output: {
          type: 'workspace.diff',
          changedFiles: ['src/home.js'],
          diff: 'diff --git a/src/home.js b/src/home.js\n+secret raw diff body\n',
        },
      };
      yield {
        type: 'skill.output',
        skillId: 'mattpocock-skills:teach',
        output: {
          type: 'note',
          persistence: 'transient',
          text: 'private transient teaching scratch note',
        },
      };
      yield {
        type: 'skill.output',
        skillId: 'gstack:office-hours',
        output: {
          type: 'host.raw',
          host: 'gstack',
          format: 'html-report',
          content: '<main>vendor raw html payload</main>',
        },
      };
      yield {
        type: 'skill.output',
        skillId: 'mattpocock-skills:research',
        output: {
          type: 'authority.request',
          capability: 'network.access',
          reason: 'Fetch a source.',
        },
      };
      yield { type: 'run.completed', summary: 'done' };
    },
  };
  const orchestrator = createRunOrchestrator({
    runStore,
    approvalBroker,
    runtimeRegistry: new Map([['mock', runtime]]),
    workspaceManager: createExecutionWorkspaceManager({ rootDir: root }),
    evidenceStore,
    skillOutputIngestor: ingestor,
    createId: () => 'run_skill_output_ingestion',
  });

  const run = await orchestrator.start({
    workId: 'work_skill_output_ingestion',
    employeeId: 'ben',
    workerId: 'worker_local',
    runtime: 'mock',
    repoDir: null,
    prompt: 'Do the work.',
    subrunId: 'subrun_ingestion',
    delegationEnvelope: {
      allow: ['workspace.read', 'network.access'],
      deny: ['git.push'],
    },
  });
  const finalRun = await orchestrator.wait(run.id);

  assert.equal(finalRun.status, 'completed');
  const events = runStore.readEvents(run.id);
  assert.equal(events.some((event) => event.type === 'skill.output'), false);
  assert.equal(events.some((event) => event.type === 'evidence.produced' && event.evidence.id === 'evidence_run_skill_1'), true);
  assert.equal(events.some((event) => event.type === 'artifact.content.proposed'), true);
  assert.equal(events.some((event) => event.type === 'workspace.mutation.reported' && event.evidenceId === 'evidence_run_skill_2'), true);
  assert.equal(events.some((event) => event.type === 'skill.output.unsupported'), true);
  assert.equal(events.some((event) => event.type === 'approval.resolved' && event.capability === 'network.access' && event.decision === 'allow'), true);

  const serialized = JSON.stringify(events);
  assert.equal(serialized.includes('secret raw diff body'), false);
  assert.equal(serialized.includes('private transient teaching scratch note'), false);
  assert.equal(serialized.includes('vendor raw html payload'), false);
  assert.match(evidenceStore.readContent('evidence_run_skill_2').toString('utf8'), /secret raw diff body/);
});

test('RunOrchestrator sanitizes skill.output when ingestion is not configured', async (t) => {
  const root = tempRoot(t);
  const runStore = createRunStore({ rootDir: root });
  const orchestrator = createRunOrchestrator({
    runStore,
    approvalBroker: { async request() { return 'deny'; } },
    runtimeRegistry: new Map([['mock', {
      async *run() {
        yield {
          type: 'skill.output',
          skillId: 'vendor:raw',
          output: { type: 'host.raw', content: '<secret>must not persist</secret>' },
        };
        yield { type: 'run.completed', summary: 'done' };
      },
    }]]),
    workspaceManager: createExecutionWorkspaceManager({ rootDir: root }),
    createId: () => 'run_no_ingestor',
  });

  const run = await orchestrator.start({
    workId: 'work_no_ingestor',
    employeeId: 'ben',
    workerId: 'worker_local',
    runtime: 'mock',
    prompt: 'Do the work.',
    delegationEnvelope: { allow: ['workspace.read'], deny: [] },
  });
  await orchestrator.wait(run.id);

  const events = runStore.readEvents(run.id);
  assert.equal(events.some((event) => event.type === 'skill.output'), false);
  const diagnostic = events.find((event) => event.type === 'skill.output.unsupported');
  assert.ok(diagnostic);
  assert.match(diagnostic.reason, /ingestion is not configured/i);
  assert.equal(JSON.stringify(events).includes('must not persist'), false);
});
