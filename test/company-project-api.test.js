'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createCompanyServer } = require('../company-server');

function tempRoot(t, prefix = 'lucubro-project-api-') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

async function withServer(t, options, run) {
  const app = createCompanyServer(options);
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address();
  return run(`http://127.0.0.1:${address.port}`);
}

test('Company bootstrap exposes durable Projects and Work association', async (t) => {
  const dataDir = tempRoot(t);
  const repoDir = tempRoot(t, 'lucubro-project-repo-');
  fs.mkdirSync(path.join(repoDir, '.git'));
  fs.writeFileSync(path.join(repoDir, 'AGENTS.md'), '# Instructions\n');
  fs.writeFileSync(path.join(repoDir, 'CONTEXT.md'), '# Context\n');

  await withServer(t, {
    dataDir,
    runtimes: new Map(),
    worktreeManager: {},
    workspaceBrowser: { root: {}, list() {}, suggest() {}, inspect() {}, createDirectory() {} },
  }, async (baseUrl) => {
    const adoptResponse = await fetch(`${baseUrl}/api/company/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ repoDir, name: 'Fixture project' }),
    });
    assert.equal(adoptResponse.status, 201);
    const adopted = await adoptResponse.json();
    assert.equal(adopted.project.name, 'Fixture project');
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
  const repoDir = tempRoot(t, 'lucubro-project-restart-');
  fs.mkdirSync(path.join(repoDir, '.git'));
  fs.writeFileSync(path.join(repoDir, 'CONTEXT.md'), '# Context\n');

  let projectId;
  await withServer(t, { dataDir, runtimes: new Map(), worktreeManager: {}, workspaceBrowser: { root: {}, list() {}, suggest() {}, inspect() {}, createDirectory() {} } }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/company/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ repoDir }),
    });
    const body = await response.json();
    projectId = body.project.id;
  });

  await withServer(t, { dataDir, runtimes: new Map(), worktreeManager: {}, workspaceBrowser: { root: {}, list() {}, suggest() {}, inspect() {}, createDirectory() {} } }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/company/bootstrap`);
    const bootstrap = await response.json();
    assert.equal(bootstrap.projects.length, 1);
    assert.equal(bootstrap.projects[0].id, projectId);
  });
});
