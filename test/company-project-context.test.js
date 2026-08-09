'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { discoverProjectSources } = require('../lib/company/project-discovery');
const { captureSourceSnapshot, reconcileProjectSources } = require('../lib/company/project-continuation');
const { compileProjectContinuationContext } = require('../lib/company/project-context');

function tempRepo(t) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'lucubro-project-context-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  fs.mkdirSync(path.join(repo, '.git'));
  return repo;
}

test('Compiler emits source-backed Project context with provenance inside a byte budget', (t) => {
  const repo = tempRepo(t);
  fs.writeFileSync(path.join(repo, 'AGENTS.md'), '# Rules\nUse the project contract.\n');
  fs.writeFileSync(path.join(repo, 'CONTEXT.md'), '# Context\nProject means durable work context.\n');
  const discovered = discoverProjectSources({ repoDir: repo });
  const checkpoint = {
    status: 'active',
    scope: 'Project Persistence v1',
    nextSafeAction: 'implement bounded bootstrap',
    doNotRepeat: ['do not replay transcripts'],
    sourceSnapshot: captureSourceSnapshot(discovered.sources),
  };
  const reconciliation = reconcileProjectSources({
    checkpointSnapshot: checkpoint.sourceSnapshot,
    currentSources: discovered.sources,
  });

  const result = compileProjectContinuationContext({
    project: { id: 'project_context', name: 'Context fixture', repoDir: repo },
    objective: 'Continue the persistence implementation',
    currentSources: discovered.sources,
    checkpoint,
    reconciliation,
    delegationEnvelope: { allow: ['workspace.read', 'workspace.write'], deny: ['git.push'] },
    maxBytes: 4096,
  });

  assert.ok(result.byteLength <= 4096);
  assert.match(result.text, /Project: Context fixture \(project_context\)/);
  assert.match(result.text, /Current objective:\nContinue the persistence implementation/);
  assert.match(result.text, /Checkpoint freshness: fresh/);
  assert.match(result.text, /Next safe action: implement bounded bootstrap/);
  assert.match(result.text, /Source: instructions AGENTS\.md/);
  assert.match(result.text, /Use the project contract\./);
  assert.match(result.text, /Source: context CONTEXT\.md/);
  assert.match(result.text, /Project means durable work context\./);
  assert.match(result.text, /workspace\.read/);
  assert.equal(result.includedSources.length, 2);
});

test('Compiler omits a stale checkpoint next action and tells the agent to re-evaluate current sources', (t) => {
  const repo = tempRepo(t);
  fs.writeFileSync(path.join(repo, 'CONTEXT.md'), '# Context\nnew canonical direction\n');
  const current = discoverProjectSources({ repoDir: repo });
  const checkpoint = {
    status: 'active',
    nextSafeAction: 'DELETE THIS STALE NEXT ACTION',
    sourceSnapshot: [{ kind: 'context', path: 'CONTEXT.md', fingerprint: 'sha256:old' }],
  };
  const reconciliation = reconcileProjectSources({
    checkpointSnapshot: checkpoint.sourceSnapshot,
    currentSources: current.sources,
  });

  const result = compileProjectContinuationContext({
    project: { id: 'project_stale', name: 'Stale fixture', repoDir: repo },
    objective: 'Continue safely',
    currentSources: current.sources,
    checkpoint,
    reconciliation,
    delegationEnvelope: { allow: ['workspace.read'] },
    maxBytes: 4096,
  });

  assert.match(result.text, /Checkpoint freshness: stale/);
  assert.match(result.text, /re-evaluate current canonical sources/i);
  assert.doesNotMatch(result.text, /DELETE THIS STALE NEXT ACTION/);
  assert.match(result.text, /new canonical direction/);
});

test('Compiler truncates oversized source content while keeping the whole continuation context bounded', (t) => {
  const repo = tempRepo(t);
  fs.writeFileSync(path.join(repo, 'CONTEXT.md'), `# Context\n${'durable-context '.repeat(1000)}\n`);
  const discovered = discoverProjectSources({ repoDir: repo });
  const reconciliation = reconcileProjectSources({ checkpointSnapshot: null, currentSources: discovered.sources });

  const result = compileProjectContinuationContext({
    project: { id: 'project_budget', name: 'Budget fixture', repoDir: repo },
    objective: 'Keep context bounded',
    currentSources: discovered.sources,
    checkpoint: null,
    reconciliation,
    delegationEnvelope: { allow: ['workspace.read'] },
    maxBytes: 900,
    perSourceBytes: 700,
  });

  assert.ok(result.byteLength <= 900);
  assert.equal(result.includedSources.length, 1);
  assert.equal(result.includedSources[0].truncated, true);
  assert.match(result.text, /truncated/i);
});
