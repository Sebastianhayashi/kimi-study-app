'use strict';

const crypto = require('crypto');
const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createEvidenceStore } = require('./lib/company/evidence-store');
const { evidenceResponsePolicy } = require('./lib/company/evidence-response');
const { createRunStore } = require('./lib/company/run-store');
const { createWorkStore } = require('./lib/company/work-store');
const { createWorkerStore } = require('./lib/company/worker-store');
const { createProjectStore } = require('./lib/company/project-store');
const { discoverProjectSources } = require('./lib/company/project-discovery');
const { createApprovalBroker } = require('./lib/company/approval-broker');
const { createRunOrchestrator } = require('./lib/company/run-orchestrator');
const { createWorktreeManager } = require('./lib/company/worktree-manager');
const { createExecutionWorkspaceManager } = require('./lib/company/execution-workspace-manager');
const { createCompanyService } = require('./lib/company/company-service');
const { createWorkspaceBrowser } = require('./lib/company/workspace-browser');
const { createClaudeAgentSdkRuntime } = require('./lib/company/runtime/claude-agent-sdk');
const { createCodexAppServerRuntime } = require('./lib/company/runtime/codex-app-server');
const { createMockCompanyRuntime } = require('./lib/company/runtime/mock');
const { applyRuntimePolicy } = require('./lib/company/runtime/policy');

const ROOT = __dirname;

function testWorktreeManager() {
  return {
    async create({ repoDir, runId }) { return { cwd: repoDir, branch: `fixture/${runId}` }; },
    async inspect() { return { diff: 'diff --git a/src/session.js b/src/session.js\n+// fixed session refresh race\n', changedFiles: ['src/session.js'] }; },
    async remove() {},
  };
}

function isLoopbackRequest(req) {
  const address = String(req.socket && req.socket.remoteAddress || '');
  return address === '127.0.0.1' || address === '::1' || address.startsWith('::ffff:127.');
}

function createCompanyServer({
  rootDir = ROOT,
  dataDir = process.env.LUCUBRO_COMPANY_DATA_DIR || path.join(rootDir, 'data', 'company'),
  runtimes = null,
  worktreeManager = null,
  workspaceManager = null,
  workspaceBrowser = null,
  workerStore = null,
  projectStore = null,
  projectDiscovery = discoverProjectSources,
  evidenceStore = null,
  workerIdentity = null,
  workPlanner = null,
  skillMountBuilder = null,
} = {}) {
  fs.mkdirSync(dataDir, { recursive: true });
  const app = express();
  app.use(express.json({ limit: '256kb' }));
  app.use('/vendor/geist', express.static(path.join(rootDir, 'node_modules', '@fontsource-variable', 'geist')));
  app.use(express.static(path.join(rootDir, 'public')));

  const runStore = createRunStore({ rootDir: dataDir });
  const workStore = createWorkStore({ rootDir: dataDir });
  const projects = projectStore || createProjectStore({ rootDir: dataDir });
  const workers = workerStore || createWorkerStore({ rootDir: dataDir });
  const evidence = evidenceStore || createEvidenceStore({ rootDir: dataDir });
  const existingWorker = workers.list()[0] || null;
  const requestedWorkerId = workerIdentity && workerIdentity.id || process.env.LUCUBRO_WORKER_ID || null;
  const localWorkerId = requestedWorkerId || existingWorker && existingWorker.id || `worker_${crypto.randomUUID()}`;
  const localWorker = workers.upsert({
    id: localWorkerId,
    name: workerIdentity && workerIdentity.name || process.env.LUCUBRO_WORKER_NAME || existingWorker && existingWorker.name || os.hostname() || 'Local Worker',
    kind: workerIdentity && workerIdentity.kind || existingWorker && existingWorker.kind || 'self-hosted',
  });
  const approvalBroker = createApprovalBroker({ runStore });
  const configuredRuntimeRegistry = runtimes || new Map([
    ['claude-code', createClaudeAgentSdkRuntime()],
    ['codex', createCodexAppServerRuntime()],
  ]);
  const runtimeRegistry = runtimes
    ? configuredRuntimeRegistry
    : applyRuntimePolicy(configuredRuntimeRegistry, {
      enableRealRuntimes: process.env.LUCUBRO_ENABLE_REAL_RUNTIMES === '1',
    });
  if (process.env.LUCUBRO_COMPANY_MOCK_RUNTIME === '1' && !runtimeRegistry.has('mock')) runtimeRegistry.set('mock', createMockCompanyRuntime());

  const worktrees = worktreeManager || (
    process.env.NODE_ENV === 'test' && process.env.LUCUBRO_COMPANY_MOCK_RUNTIME === '1'
      ? testWorktreeManager()
      : createWorktreeManager()
  );
  const executionWorkspaces = workspaceManager || createExecutionWorkspaceManager({
    rootDir: dataDir,
    gitWorktreeManager: worktrees,
  });
  const runOrchestrator = createRunOrchestrator({
    runStore,
    approvalBroker,
    runtimeRegistry,
    workspaceManager: executionWorkspaces,
    evidenceStore: evidence,
    skillMountBuilder,
  });
  const company = createCompanyService({
    workStore,
    runStore,
    runOrchestrator,
    projectStore: projects,
    projectDiscovery,
    workPlanner,
    defaultWorkerId: localWorker.id,
  });
  const workspaces = workspaceBrowser || createWorkspaceBrowser();

  function canAccessWorkspace(req) {
    return isLoopbackRequest(req) || process.env.LUCUBRO_ALLOW_LAN_WORKSPACE_BROWSER === '1';
  }

  function requireWorkspaceAccess(req, res, next) {
    if (canAccessWorkspace(req)) return next();
    return res.status(403).json({
      error: 'Host workspace browsing is disabled for LAN clients. Set LUCUBRO_ALLOW_LAN_WORKSPACE_BROWSER=1 only on a trusted network.',
    });
  }

  function assertProjectWorkspaceAccess(projectId) {
    const project = company.getProject(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);
    const inspected = workspaces.inspect(project.repoDir);
    if (!inspected || !inspected.exists || !inspected.isDirectory) throw new Error('Project repoDir must remain an existing directory inside the allowed workspace root.');
    return project;
  }

  async function readRuntimeStates() {
    const runtimeStates = [];
    for (const [id, runtime] of runtimeRegistry.entries()) {
      let availability;
      try { availability = await runtime.available(); }
      catch (error) { availability = { available: false, reason: error.message }; }
      runtimeStates.push({ id, ...availability });
    }
    return runtimeStates;
  }

  function publicWorkerState(identity, runtimeStates) {
    return {
      ...identity,
      status: 'online',
      transport: 'in-process',
      platform: process.platform,
      arch: process.arch,
      capabilities: {
        workspace: true,
        runtimes: runtimeStates.filter((runtime) => runtime.available).map((runtime) => runtime.id),
      },
    };
  }

  function publicRunSummary(run) {
    return {
      id: run.id,
      workId: run.workId,
      employeeId: run.employeeId,
      workerId: run.workerId || null,
      status: run.status,
      evidenceCount: evidence.listByRun(run.id).length,
    };
  }

  app.get('/api/company/health', (req, res) => res.json({ ok: true }));
  app.get(['/company', '/company/work', '/company/employees', '/company/settings'], (req, res) => res.sendFile(path.join(rootDir, 'public', 'company.html')));

  app.get('/api/company/bootstrap', async (req, res) => {
    const runtimeStates = await readRuntimeStates();
    res.json({
      manager: { id: 'alex', name: 'Alex', position: 'Primary Manager' },
      employees: [{ id: 'ben', name: 'Ben', position: 'Software Engineer' }],
      workers: [publicWorkerState(localWorker, runtimeStates)],
      runtimes: runtimeStates,
      projects: company.listProjects(),
      runs: runStore.list().map(publicRunSummary),
      works: company.listWorks(),
      needsYou: approvalBroker.listPending(),
    });
  });

  app.post('/api/company/projects', requireWorkspaceAccess, (req, res) => {
    try {
      const body = req.body || {};
      if (!body.repoDir || !String(body.repoDir).trim()) throw new Error('Project repoDir is required.');
      const inspected = workspaces.inspect(body.repoDir);
      if (!inspected || !inspected.exists || !inspected.isDirectory) throw new Error('Project repoDir must be an existing directory.');
      const project = company.adoptProject({ repoDir: inspected.path || body.repoDir, name: body.name || null });
      res.status(201).json({ project });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get('/api/company/projects/:projectId', (req, res) => {
    const project = company.getProject(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(project);
  });

  app.post('/api/company/projects/:projectId/checkpoint', requireWorkspaceAccess, (req, res) => {
    try {
      assertProjectWorkspaceAccess(req.params.projectId);
      const project = company.checkpointProject({
        projectId: req.params.projectId,
        checkpoint: req.body || {},
      });
      res.json({ project });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get('/api/company/projects/:projectId/continuation', requireWorkspaceAccess, (req, res) => {
    try {
      assertProjectWorkspaceAccess(req.params.projectId);
      res.json(company.inspectProjectContinuation(req.params.projectId));
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get('/api/company/workspaces/root', requireWorkspaceAccess, (req, res) => {
    res.json({ root: workspaces.root });
  });

  app.get('/api/company/workspaces/list', requireWorkspaceAccess, (req, res) => {
    try {
      res.json(workspaces.list(req.query.path || '~'));
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get('/api/company/workspaces/suggest', requireWorkspaceAccess, (req, res) => {
    try {
      res.json(workspaces.suggest(req.query.q || ''));
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get('/api/company/workspaces/inspect', requireWorkspaceAccess, (req, res) => {
    try {
      res.json(workspaces.inspect(req.query.path || '~'));
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/company/workspaces/directories', requireWorkspaceAccess, (req, res) => {
    try {
      const directory = workspaces.createDirectory({
        parentPath: req.body && req.body.parentPath,
        name: req.body && req.body.name,
      });
      res.status(201).json({ directory });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/company/works', async (req, res) => {
    try {
      const body = req.body || {};
      if (body.projectId) {
        if (!canAccessWorkspace(req)) {
          return res.status(403).json({
            error: 'Project-bound Work cannot read host Project Sources from this client. Enable LAN workspace access only on a trusted network.',
          });
        }
        assertProjectWorkspaceAccess(body.projectId);
      }
      const hasRepo = Boolean(body.repoDir && String(body.repoDir).trim());
      const createWork = body.projectId || hasRepo ? company.createCodingWork : company.createWork;
      const result = await createWork({
        brief: body.brief,
        repoDir: hasRepo ? body.repoDir : null,
        projectId: body.projectId || null,
        runtime: body.runtime,
        employeeId: body.employeeId || 'ben',
        workerId: localWorker.id,
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
    res.json({
      run,
      worker: run.workerId ? workers.get(run.workerId) : null,
      evidence: evidence.listByRun(run.id),
      events: runStore.readEvents(run.id),
      needsYou: approvalBroker.listPending(run.id),
    });
  });

  app.get('/api/company/evidence/:evidenceId/content', (req, res) => {
    try {
      const item = evidence.get(req.params.evidenceId);
      if (!item) return res.status(404).json({ error: 'Evidence not found' });
      const content = evidence.readContent(item.id);
      const policy = evidenceResponsePolicy(item);
      res.set('Content-Type', policy.contentType);
      res.set('Content-Disposition', policy.contentDisposition);
      res.set('Content-Length', String(content.byteLength));
      res.set('Cache-Control', 'private, no-store');
      if (policy.nosniff) res.set('X-Content-Type-Options', 'nosniff');
      res.send(content);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
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

  return {
    app,
    company,
    projectStore: projects,
    runStore,
    workStore,
    workerStore: workers,
    evidenceStore: evidence,
    localWorker,
    approvalBroker,
    runtimeRegistry,
    workspaceBrowser: workspaces,
    executionWorkspaceManager: executionWorkspaces,
  };
}

if (require.main === module) {
  const host = process.env.LUCUBRO_COMPANY_HOST || '127.0.0.1';
  const port = Number(process.env.LUCUBRO_COMPANY_PORT || process.env.PORT || 3200);
  const { app } = createCompanyServer();
  app.listen(port, host, () => console.log(`[lucubro-company] http://${host}:${port}/company`));
}

module.exports = { createCompanyServer, isLoopbackRequest };
