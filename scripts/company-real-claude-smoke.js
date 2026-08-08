#!/usr/bin/env node
'use strict';

// One-shot trusted-device smoke trigger. Remove with its workflow after verification.
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { createRunStore } = require('../lib/company/run-store');
const { createApprovalBroker } = require('../lib/company/approval-broker');
const { createRunOrchestrator } = require('../lib/company/run-orchestrator');
const { createWorktreeManager } = require('../lib/company/worktree-manager');
const { createClaudeAgentSdkRuntime } = require('../lib/company/runtime/claude-agent-sdk');

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
}

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lucubro-real-claude-'));
  const repoDir = path.join(root, 'fixture-repo');
  const dataDir = path.join(root, 'lucubro-data');
  fs.mkdirSync(repoDir, { recursive: true });

  try {
    run('git', ['init', '-q'], { cwd: repoDir });
    run('git', ['config', 'user.name', 'Lucubro Smoke'], { cwd: repoDir });
    run('git', ['config', 'user.email', 'smoke@lucubro.local'], { cwd: repoDir });

    fs.writeFileSync(
      path.join(repoDir, 'calc.js'),
      "'use strict';\n\nfunction add(a, b) {\n  return a - b;\n}\n\nmodule.exports = { add };\n",
      'utf8',
    );
    fs.writeFileSync(
      path.join(repoDir, 'test.js'),
      "'use strict';\nconst assert = require('node:assert/strict');\nconst { add } = require('./calc');\nassert.equal(add(2, 3), 5);\nconsole.log('fixture test passed');\n",
      'utf8',
    );
    fs.writeFileSync(
      path.join(repoDir, 'CLAUDE.md'),
      '# Fixture constraints\n\nThis is an isolated smoke-test repository. Do not access the network, install packages, commit, push, or modify files outside this repository.\n',
      'utf8',
    );
    run('git', ['add', '.'], { cwd: repoDir });
    run('git', ['commit', '-qm', 'fixture baseline'], { cwd: repoDir });

    const runStore = createRunStore({ rootDir: dataDir });
    const approvalBroker = createApprovalBroker({ runStore });
    const runtime = createClaudeAgentSdkRuntime();
    const availability = await runtime.available();
    if (!availability.available) {
      throw new Error(`Claude runtime unavailable: ${availability.reason || 'unknown reason'}`);
    }

    const orchestrator = createRunOrchestrator({
      runStore,
      approvalBroker,
      runtimeRegistry: new Map([['claude-code', runtime]]),
      worktreeManager: createWorktreeManager(),
    });

    const runRecord = await orchestrator.start({
      workId: 'work_real_claude_smoke',
      employeeId: 'ben',
      runtime: 'claude-code',
      repoDir,
      prompt: [
        'Fix the bug in this tiny fixture repository so `node test.js` passes.',
        'Make the smallest code change needed.',
        'You may read files, edit workspace files, and run local shell commands needed to verify the test.',
        'Do not access the network, install packages, commit, push, or change git configuration.',
        'Stop after the test passes.',
      ].join(' '),
      delegationEnvelope: {
        allow: ['workspace.read', 'workspace.write', 'shell.execute'],
        deny: ['network.access', 'git.push', 'git.commit', 'filesystem.destructive', 'external.side-effect'],
      },
    });

    const finalRun = await orchestrator.wait(runRecord.id);
    const events = runStore.readEvents(runRecord.id);
    const artifact = events.find((event) => event.type === 'artifact.produced');

    if (finalRun.status !== 'completed') {
      const tail = events.slice(-8).map((event) => ({ type: event.type, error: event.error || null }));
      throw new Error(`Real Claude Run failed: ${finalRun.error || 'unknown error'}; event tail=${JSON.stringify(tail)}`);
    }

    assert.ok(finalRun.providerSessionId, 'provider session id should be captured on the Lucubro Run');
    assert.ok(finalRun.cwd && path.isAbsolute(finalRun.cwd), 'Run should use an isolated worktree cwd');
    assert.notEqual(path.resolve(finalRun.cwd), path.resolve(repoDir), 'Run cwd must not be the source checkout');
    assert.ok(finalRun.changedFiles.includes('calc.js'), 'calc.js should be present in changedFiles');
    assert.ok(artifact, 'a diff Artifact should be emitted');
    assert.match(artifact.diff || '', /calc\.js/);

    const testOutput = run(process.execPath, ['test.js'], { cwd: finalRun.cwd }).trim();
    assert.match(testOutput, /fixture test passed/);

    const summary = {
      ok: true,
      runId: finalRun.id,
      workId: finalRun.workId,
      runtime: finalRun.runtime,
      providerSessionCaptured: Boolean(finalRun.providerSessionId),
      isolatedWorktree: path.resolve(finalRun.cwd) !== path.resolve(repoDir),
      changedFiles: finalRun.changedFiles,
      artifactProduced: Boolean(artifact),
      eventTypes: [...new Set(events.map((event) => event.type))],
      fixtureTest: testOutput,
    };
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
