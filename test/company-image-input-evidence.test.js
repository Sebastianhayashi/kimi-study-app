'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createCompanyServer } = require('../company-server');
const { createProjectStore } = require('../lib/company/project-store');

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z2V0AAAAASUVORK5CYII=',
  'base64',
);

function tempRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lucubro-image-input-'));
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

async function readCompletedRun(baseUrl, runId) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const response = await fetch(`${baseUrl}/api/company/runs/${runId}`);
    assert.equal(response.status, 200);
    const body = await response.json();
    if (body.run.status === 'completed') return body;
    if (body.run.status === 'failed') throw new Error(body.run.error || `Run failed: ${runId}`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Run did not complete: ${runId}`);
}

function imageAwareRuntime(observed) {
  return {
    async available() { return { available: true, mode: 'fixture' }; },
    async *run(request) {
      const image = (request.inputEvidence || []).find((item) => item.mimeType === 'image/png');
      observed.push({
        workId: request.workId,
        inputEvidence: structuredClone(request.inputEvidence || []),
      });
      yield { type: 'run.started', providerSessionId: 'session_image_input' };
      if (image) {
        yield {
          type: 'skill.output',
          skillId: 'fixture:visual-diagnosis',
          output: {
            type: 'project.memory.patch',
            summary: 'The new living-room photo corrected the current sofa finding.',
            evidenceRefs: [image.id],
            mutation: {
              report: {
                changed: 'A new living-room photo confirms the sofa is the dominant visual block and keeps the reversible-cover direction.',
                nextAction: 'Send the current cover candidate screenshot so it can be compared in context.',
              },
              frontiersUpsert: [{
                id: 'frontier_sofa',
                title: 'Sofa visual refresh',
                status: 'active',
                summary: 'The room photo confirms that reducing the sofa color block is still the highest-leverage reversible move.',
                nextAction: 'Compare a cover candidate against this room context.',
                evidenceIds: [image.id],
              }],
            },
          },
        };
      }
      yield { type: 'run.completed', summary: 'Updated the Home refresh result from the new room photo.' };
    },
  };
}

test('multipart room photo becomes durable user Evidence before runtime and updates the same Project Frontier', async (t) => {
  const dataDir = tempRoot(t);
  const projectStore = createProjectStore({ rootDir: dataDir });
  projectStore.create({
    id: 'project_home_refresh',
    name: 'Home refresh',
    kind: 'work-context',
    repoDir: null,
    isGitRepository: false,
    sources: [],
    memory: {
      objective: 'Make the home calmer and easier to use as new evidence arrives.',
      report: {
        title: 'Home refresh report',
        summary: 'Keep the existing sofa and prefer reversible changes first.',
        changed: 'The sofa-cover direction is provisional until the room context is checked.',
        nextAction: 'Send a current living-room photo.',
      },
      facts: [{ id: 'fact_sofa', text: 'The living-room sofa is a large red modular chaise.' }],
      preferences: [{ id: 'pref_reversible', text: 'Prefer reversible high-ROI changes first.' }],
      decisions: [],
      frontiers: [{
        id: 'frontier_sofa',
        title: 'Sofa visual refresh',
        status: 'active',
        summary: 'Validate whether the sofa remains the dominant visual problem in the room.',
        nextAction: 'Send a current living-room photo.',
        evidenceIds: [],
      }],
    },
  });

  const observed = [];
  await withServer({
    dataDir,
    projectStore,
    runtimes: new Map([['mock', imageAwareRuntime(observed)]]),
  }, async (baseUrl) => {
    const form = new FormData();
    form.set('brief', 'Use this room photo to update the existing sofa direction.');
    form.set('projectId', 'project_home_refresh');
    form.set('runtime', 'mock');
    form.append('attachments', new Blob([PNG_1X1], { type: 'image/png' }), 'living-room.png');

    const response = await fetch(`${baseUrl}/api/company/works`, { method: 'POST', body: form });
    assert.equal(response.status, 201);
    const created = await response.json();
    assert.equal(created.work.projectId, 'project_home_refresh');
    assert.equal(created.work.repoDir, null);

    const runState = await readCompletedRun(baseUrl, created.run.id);
    assert.equal(runState.evidence.length, 1);
    const image = runState.evidence[0];
    assert.equal(image.source, 'user-input');
    assert.equal(image.kind, 'image');
    assert.equal(image.mimeType, 'image/png');
    assert.equal(image.metadata.filename, 'living-room.png');
    assert.equal(image.metadata.projectId, 'project_home_refresh');
    assert.equal(image.byteLength, PNG_1X1.byteLength);
    assert.ok(runState.events.some((event) => event.type === 'evidence.received' && event.evidence && event.evidence.id === image.id));

    assert.equal(observed.length, 1);
    assert.equal(observed[0].inputEvidence.length, 1);
    assert.equal(observed[0].inputEvidence[0].id, image.id);
    assert.equal(observed[0].inputEvidence[0].mimeType, 'image/png');

    const contentResponse = await fetch(`${baseUrl}/api/company/evidence/${image.id}/content`);
    assert.equal(contentResponse.status, 200);
    assert.match(contentResponse.headers.get('content-type') || '', /^image\/png/);
    assert.deepEqual(Buffer.from(await contentResponse.arrayBuffer()), PNG_1X1);

    const projectResponse = await fetch(`${baseUrl}/api/company/projects/project_home_refresh`);
    assert.equal(projectResponse.status, 200);
    const project = await projectResponse.json();
    assert.match(project.memory.report.changed, /new living-room photo confirms/i);
    assert.equal(project.memory.frontiers.length, 1);
    assert.equal(project.memory.frontiers[0].id, 'frontier_sofa');
    assert.match(project.memory.frontiers[0].summary, /room photo confirms/i);
    assert.deepEqual(project.memory.frontiers[0].evidenceIds, [image.id]);
    assert.ok(project.memoryRevisionId);

    const projectEvidenceResponse = await fetch(`${baseUrl}/api/company/projects/project_home_refresh/evidence`);
    assert.equal(projectEvidenceResponse.status, 200);
    const projectEvidence = await projectEvidenceResponse.json();
    assert.deepEqual(projectEvidence.evidence.map((item) => item.id), [image.id]);
  });
});

test('image input rejects unsupported media instead of persisting arbitrary multipart files', async (t) => {
  const dataDir = tempRoot(t);
  await withServer({
    dataDir,
    runtimes: new Map([['mock', imageAwareRuntime([])]]),
  }, async (baseUrl) => {
    const form = new FormData();
    form.set('brief', 'Please inspect this attachment.');
    form.set('runtime', 'mock');
    form.append('attachments', new Blob([Buffer.from('<svg></svg>')], { type: 'image/svg+xml' }), 'unsafe.svg');

    const response = await fetch(`${baseUrl}/api/company/works`, { method: 'POST', body: form });
    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.match(payload.error, /JPEG|PNG|WebP|image/i);
  });
});
