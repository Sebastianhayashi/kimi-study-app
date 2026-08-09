'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createCompanyServer } = require('../company-server');
const { createWorkspaceBrowser } = require('../lib/company/workspace-browser');

function tempRoot(t, prefix = 'lucubro-project-continuation-api-') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

async function withServer(options, run) {
  const { app } = createCompanyServer(options);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address();
  try {
    return await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('Continuation API exposes stale canonical source state without mutating the checkpoint snapshot', async (t) => {
  const dataDir = tempRoot(t, 'lucubro-project-continuation-data-');
  const workspaceRoot = tempRoot(t, 'lucubro-project-continuation-workspace-');
  const repoDir = path.join(workspaceRoot, 'repo');
  fs.mkdirSync(repoDir);
  fs.mkdirSync(path.join(repoDir, '.git'));
  fs.writeFileSync(path.join(repoDir, 'CONTEXT.md'), '# Context\nfirst\n');
  const workspaceBrowser = createWorkspaceBrowser({ rootDir: workspaceRoot, homeDir: workspaceRoot, showHidden: true });

  await withServer({ dataDir, runtimes: new Map(), worktreeManager: {}, workspaceBrowser }, async (baseUrl) => {
    const adoptResponse = await fetch(`${baseUrl}/api/company/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ repoDir }),
    });
    assert.equal(adoptResponse.status, 201);
    const adopted = await adoptResponse.json();
    const projectId = adopted.project.id;

    const checkpointResponse = await fetch(`${baseUrl}/api/company/projects/${projectId}/checkpoint`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        status: 'active',
        scope: 'Project Persistence v1',
        nextSafeAction: 'compile continuation context',
      }),
    });
    assert.equal(checkpointResponse.status, 200);
    const checkpointed = await checkpointResponse.json();
    const originalFingerprint = checkpointed.project.checkpoint.sourceSnapshot[0].fingerprint;

    fs.writeFileSync(path.join(repoDir, 'CONTEXT.md'), '# Context\nsecond\n');

    const continuationResponse = await fetch(`${baseUrl}/api/company/projects/${projectId}/continuation`);
    assert.equal(continuationResponse.status, 200);
    const continuation = await continuationResponse.json();
    assert.equal(continuation.reconciliation.status, 'stale');
    assert.equal(continuation.reconciliation.changed[0].path, 'CONTEXT.md');
    assert.equal(continuation.reconciliation.changed[0].checkpointFingerprint, originalFingerprint);
    assert.notEqual(continuation.reconciliation.changed[0].currentFingerprint, originalFingerprint);

    const projectResponse = await fetch(`${baseUrl}/api/company/projects/${projectId}`);
    const project = await projectResponse.json();
    assert.equal(project.checkpoint.sourceSnapshot[0].fingerprint, originalFingerprint);
  });
});

test('Continuation rechecks the current workspace boundary after server recreation', async (t) => {
  const dataDir = tempRoot(t, 'lucubro-project-continuation-rebound-data-');
  const originalRoot = tempRoot(t, 'lucubro-project-continuation-original-');
  const restrictedRoot = tempRoot(t, 'lucubro-project-continuation-restricted-');
  const repoDir = path.join(originalRoot, 'repo');
  fs.mkdirSync(repoDir);
  fs.mkdirSync(path.join(repoDir, '.git'));
  fs.writeFileSync(path.join(repoDir, 'CONTEXT.md'), '# Context\n');

  let projectId;
  await withServer({
    dataDir,
    runtimes: new Map(),
    worktreeManager: {},
    workspaceBrowser: createWorkspaceBrowser({ rootDir: originalRoot, homeDir: originalRoot, showHidden: true }),
  }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/company/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ repoDir }),
    });
    assert.equal(response.status, 201);
    const body = await response.json();
    projectId = body.project.id;
  });

  await withServer({
    dataDir,
    runtimes: new Map(),
    worktreeManager: {},
    workspaceBrowser: createWorkspaceBrowser({ rootDir: restrictedRoot, homeDir: restrictedRoot, showHidden: true }),
  }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/company/projects/${projectId}/continuation`);
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.match(body.error, /outside the allowed workspace root/i);
  });
});

test('Project-bound Work rechecks the workspace boundary before compiling canonical source context', async (t) => {
  const dataDir = tempRoot(t, 'lucubro-project-work-rebound-data-');
  const originalRoot = tempRoot(t, 'lucubro-project-work-original-');
  const restrictedRoot = tempRoot(t, 'lucubro-project-work-restricted-');
  const repoDir = path.join(originalRoot, 'repo');
  fs.mkdirSync(repoDir);
  fs.mkdirSync(path.join(repoDir, '.git'));
  fs.writeFileSync(path.join(repoDir, 'CONTEXT.md'), '# Context\n');

  let projectId;
  await withServer({
    dataDir,
    runtimes: new Map(),
    worktreeManager: {},
    workspaceBrowser: createWorkspaceBrowser({ rootDir: originalRoot, homeDir: originalRoot, showHidden: true }),
  }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/company/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ repoDir }),
    });
    const body = await response.json();
    projectId = body.project.id;
  });

  await withServer({
    dataDir,
    runtimes: new Map(),
    worktreeManager: {},
    workspaceBrowser: createWorkspaceBrowser({ rootDir: restrictedRoot, homeDir: restrictedRoot, showHidden: true }),
  }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/company/works`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        brief: 'Continue the project',
        projectId,
        runtime: 'mock',
      }),
    });
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.match(body.error, /outside the allowed workspace root/i);
  });
});
