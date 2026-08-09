'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createCompanyServer } = require('../company-server');
const { createWorkspaceBrowser } = require('../lib/company/workspace-browser');

function tempRoot(t, prefix = 'lucubro-project-api-') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function createRepo(t, prefix) {
  const workspaceRoot = tempRoot(t, prefix);
  const repoDir = path.join(workspaceRoot, 'repo');
  fs.mkdirSync(repoDir);
  fs.mkdirSync(path.join(repoDir, '.git'));
  return { workspaceRoot, repoDir };
}

function workspaceBrowserFor(workspaceRoot) {
  return createWorkspaceBrowser({ rootDir: workspaceRoot, homeDir: workspaceRoot, showHidden: true });
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

test('Company bootstrap exposes durable Projects and source provenance', async (t) => {
  const dataDir = tempRoot(t);
  const { workspaceRoot, repoDir } = createRepo(t, 'lucubro-project-repo-');
  fs.writeFileSync(path.join(repoDir, 'AGENTS.md'), '# Instructions\n');
  fs.writeFileSync(path.join(repoDir, 'CONTEXT.md'), '# Context\n');

  await withServer({
    dataDir,
    runtimes: new Map(),
    worktreeManager: {},
    workspaceBrowser: workspaceBrowserFor(workspaceRoot),
  }, async (baseUrl) => {
    const adoptResponse = await fetch(`${baseUrl}/api/company/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ repoDir, name: 'Fixture project' }),
    });
    assert.equal(adoptResponse.status, 201);
    const adopted = await adoptResponse.json();
    assert.equal(adopted.project.name, 'Fixture project');
    assert.equal(adopted.project.isGitRepository, true);
    assert.equal(adopted.project.sources.length, 2);

    const bootstrapResponse = await fetch(`${baseUrl}/api/company/bootstrap`);
    assert.equal(bootstrapResponse.status, 200);
    const bootstrap = await bootstrapResponse.json();
    assert.equal(bootstrap.projects.length, 1);
    assert.equal(bootstrap.projects[0].id, adopted.project.id);
    assert.deepEqual(bootstrap.projects[0].sources.map((source) => source.path), ['AGENTS.md', 'CONTEXT.md']);
  });
});

test('Project adoption is durable across Company server recreation', async (t) => {
  const dataDir = tempRoot(t);
  const { workspaceRoot, repoDir } = createRepo(t, 'lucubro-project-restart-');
  fs.writeFileSync(path.join(repoDir, 'CONTEXT.md'), '# Context\n');
  const workspaceBrowser = workspaceBrowserFor(workspaceRoot);

  let projectId;
  await withServer({ dataDir, runtimes: new Map(), worktreeManager: {}, workspaceBrowser }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/company/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ repoDir }),
    });
    assert.equal(response.status, 201);
    const body = await response.json();
    projectId = body.project.id;
  });

  await withServer({ dataDir, runtimes: new Map(), worktreeManager: {}, workspaceBrowser }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/company/bootstrap`);
    assert.equal(response.status, 200);
    const bootstrap = await response.json();
    assert.equal(bootstrap.projects.length, 1);
    assert.equal(bootstrap.projects[0].id, projectId);
  });
});

test('Project adoption cannot inspect a repository outside the configured workspace root', async (t) => {
  const dataDir = tempRoot(t);
  const allowedRoot = tempRoot(t, 'lucubro-project-allowed-');
  const outsideRoot = tempRoot(t, 'lucubro-project-outside-');
  fs.mkdirSync(path.join(outsideRoot, '.git'));
  fs.writeFileSync(path.join(outsideRoot, 'CONTEXT.md'), '# Outside\n');

  await withServer({
    dataDir,
    runtimes: new Map(),
    worktreeManager: {},
    workspaceBrowser: workspaceBrowserFor(allowedRoot),
  }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/company/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ repoDir: outsideRoot }),
    });
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.match(body.error, /outside the allowed workspace root/i);
  });
});
