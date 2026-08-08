'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const { createRunStore } = require('./lib/company/run-store');
const { createWorkStore } = require('./lib/company/work-store');
const { createApprovalBroker } = require('./lib/company/approval-broker');
const { createRunOrchestrator } = require('./lib/company/run-orchestrator');
const { createWorktreeManager } = require('./lib/company/worktree-manager');
const { createCompanyService } = require('./lib/company/company-service');
const { createClaudeAgentSdkRuntime } = require('./lib/company/runtime/claude-agent-sdk');
const { createCodexAppServerRuntime } = require('./lib/company/runtime/codex-app-server');
const { createMockCompanyRuntime } = require('./lib/company/runtime/mock');

const ROOT = __dirname;

function testWorktreeManager() {
  return {
    async create({ repoDir, runId }) { return { cwd: repoDir, branch: `fixture/${runId}` }; },
    async inspect() { return { diff: 'diff --git a/src/session.js b/src/session.js\n+// fixed session refresh race\n', changedFiles: ['src/session.js'] }; },
    async remove() {},
  };
}

function createCompanyServer({
  rootDir = ROOT,
  dataDir = process.env.LUCUBRO_COMPANY_DATA_DIR || path.join(rootDir, 'data', 'company'),
  runtimes = null,
  worktreeManager = null,
} = {}) {
  fs.mkdirSync(dataDir, { recursive: true });
  const app = express();
  app.use(express.json({ limit: '256kb' }));
  app.use('/vendor/geist', express.static(path.join(rootDir, 'node_modules', '@fontsource-variable', 'geist')));
  app.use(express.static(path.join(rootDir, 'public')));

  const runStore = createRunStore({ rootDir: dataDir });
  const workStore = createWorkStore({ rootDir: dataDir });
  const approvalBroker = createApprovalBroker({ runStore });
  const runtimeRegistry = runtimes || new Map([
    ['claude-code', createClaudeAgentSdkRuntime()],
    ['codex', createCodexAppServerRuntime()],
  ]);
  if (process.env.LUCUBRO_COMPANY_MOCK_RUNTIME === '1' && !runtimeRegistry.has('mock')) runtimeRegistry.set('mock', createMockCompanyRuntime());

  const worktrees = worktreeManager || (
    process.env.NODE_ENV === 'test' && process.env.LUCUBRO_COMPANY_MOCK_RUNTIME === '1'
      ? testWorktreeManager()
      : createWorktreeManager()
  );
  const runOrchestrator = createRunOrchestrator({ runStore, approvalBroker, runtimeRegistry, worktreeManager: worktrees });
  const company = createCompanyService({ workStore, runStore, runOrchestrator });

  app.get('/api/company/health', (req, res) => res.json({ ok: true }));
  app.get('/company', (req, res) => res.sendFile(path.join(rootDir, 'public', 'company.html')));

  app.get('/api/company/bootstrap', async (req, res) => {
    const runtimeStates = [];
    for (const [id, runtime] of runtimeRegistry.entries()) {
      let availability;
      try { availability = await runtime.available(); }
      catch (error) { availability = { available: false, reason: error.message }; }
      runtimeStates.push({ id, ...availability });
    }
    res.json({
      manager: { id: 'alex', name: 'Alex', position: 'Primary Manager' },
      employees: [{ id: 'ben', name: 'Ben', position: 'Software Engineer' }],
      runtimes: runtimeStates,
      works: company.listWorks(),
      needsYou: approvalBroker.listPending(),
    });
  });

  app.post('/api/company/works', async (req, res) => {
    try {
      const body = req.body || {};
      const result = await company.createCodingWork({
        brief: body.brief,
        repoDir: body.repoDir,
        runtime: body.runtime,
        employeeId: body.employeeId || 'ben',
        model: body.model || null,
        delegationEnvelope: body.delegationEnvelope || {
          allow: ['workspace.read', 'workspace.write', 'shell.execute'],
          deny: ['git.push'],
        },
      });
      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/company/works/:workId/decision', (req, res) => {
    try {
      const work = company.decideWork({ workId: req.params.workId, decision: req.body && req.body.decision });
      res.json({ work });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get('/api/company/works/:workId', (req, res) => {
    const work = company.getWork(req.params.workId);
    if (!work) return res.status(404).json({ error: 'Work not found' });
    res.json(work);
  });

  app.get('/api/company/runs/:runId', (req, res) => {
    const run = runStore.get(req.params.runId);
    if (!run) return res.status(404).json({ error: 'Run not found' });
    res.json({ run, events: runStore.readEvents(run.id), needsYou: approvalBroker.listPending(run.id) });
  });

  app.get('/api/company/runs/:runId/stream', (req, res) => {
    const run = runStore.get(req.params.runId);
    if (!run) return res.status(404).end();
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' });
    const send = (event) => res.write(`data: ${JSON.stringify(event)}\n\n`);
    for (const event of runStore.readEvents(run.id)) send(event);
    const unsubscribe = runStore.subscribe(run.id, send);
    req.on('close', unsubscribe);
  });

  app.post('/api/company/runs/:runId/approvals/:approvalId', (req, res) => {
    try {
      approvalBroker.resolve({ runId: req.params.runId, approvalId: req.params.approvalId, decision: req.body && req.body.decision });
      res.json({ ok: true });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  return { app, company, runStore, workStore, approvalBroker, runtimeRegistry };
}

if (require.main === module) {
  const host = process.env.LUCUBRO_COMPANY_HOST || '127.0.0.1';
  const port = Number(process.env.LUCUBRO_COMPANY_PORT || process.env.PORT || 3200);
  const { app } = createCompanyServer();
  app.listen(port, host, () => console.log(`[lucubro-company] http://${host}:${port}/company`));
}

module.exports = { createCompanyServer };
