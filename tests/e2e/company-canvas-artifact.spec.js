'use strict';

const { test, expect } = require('@playwright/test');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const { createCanvasArtifactStore } = require('../../lib/company/canvas-artifact-store');
const { createEvidenceStore } = require('../../lib/company/evidence-store');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 3115;
const URL = `http://127.0.0.1:${PORT}`;
const DATA_DIR = path.join(ROOT, 'tests', '.runtime', 'company-canvas-artifact');
const FIXTURE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR4nGP8z8DAwMDAxMDAwMAAAAwAAf4CBKcAAAAASUVORK5CYII=',
  'base64',
);
let server;

async function waitForServer() {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${URL}/api/company/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  throw new Error('company-server did not become ready');
}

async function waitForCompletedRun(runId) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const response = await fetch(`${URL}/api/company/runs/${encodeURIComponent(runId)}`);
    if (response.ok) {
      const payload = await response.json();
      if (payload.run.status === 'completed') return payload;
    }
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
  throw new Error(`Run did not complete: ${runId}`);
}

async function stopServer() {
  if (!server || server.exitCode !== null) return;
  await new Promise((resolve) => {
    const forceTimer = setTimeout(() => {
      if (server.exitCode === null) server.kill('SIGKILL');
    }, 2_000);
    server.once('exit', () => {
      clearTimeout(forceTimer);
      resolve();
    });
    server.kill('SIGTERM');
  });
}

function seedCoffeeArtifact(workId) {
  const evidenceStore = createEvidenceStore({ rootDir: DATA_DIR });
  const source = evidenceStore.create({
    id: 'evidence_coffee_roast_source',
    runId: 'run_coffee_research',
    workId,
    workerId: 'worker_canvas_artifact',
    kind: 'source-page',
    label: 'Coffee roast reference',
    mimeType: 'text/plain',
    source: 'web',
    metadata: {
      url: 'https://example.test/coffee-roast-reference',
      publisher: 'Fixture Coffee Institute',
    },
    content: 'Roast level changes flavor expression and roast character.',
  });
  const photo = evidenceStore.create({
    id: 'evidence_coffee_roast_photo',
    runId: 'run_coffee_research',
    workId,
    workerId: 'worker_canvas_artifact',
    kind: 'source-image',
    label: 'Coffee roast spectrum photo',
    mimeType: 'image/png',
    source: 'web',
    metadata: {
      url: 'https://example.test/coffee-roast-photo',
      sourcePage: 'https://example.test/coffee-roast-reference',
      rightsStatus: 'fixture-only',
    },
    content: FIXTURE_PNG,
  });

  const artifactStore = createCanvasArtifactStore({
    rootDir: DATA_DIR,
    evidenceStore,
    createArtifactId: () => 'artifact_coffee_field_guide',
    createBlockId: (() => {
      let index = 0;
      return () => `block_coffee_${++index}`;
    })(),
  });
  return artifactStore.create({
    workId,
    projectId: null,
    title: 'Coffee Roast Field Guide',
    blocks: [
      {
        type: 'heading',
        content: { text: 'Roast spectrum' },
      },
      {
        type: 'image',
        content: {
          evidenceId: photo.id,
          alt: 'A visual reference for comparing coffee roast levels',
          caption: 'Use color as orientation, not as a standalone quality score.',
        },
        evidenceRefs: [photo.id],
      },
      {
        type: 'claim',
        material: true,
        content: { text: 'Roast level changes flavor expression and roast character.' },
        evidenceRefs: [source.id],
      },
      {
        type: 'table',
        content: {
          columns: ['Roast', 'Beginner cue', 'Try it when'],
          rows: [
            ['Light', 'Brighter, origin-forward', 'You enjoy fruit, tea, or crisp acidity'],
            ['Medium', 'Balanced sweetness and roast', 'You want the broadest starting point'],
            ['Dark', 'Roasty, lower-acid impression', 'You prefer chocolate, smoke, or heavier roast character'],
          ],
        },
        evidenceRefs: [source.id],
      },
      {
        type: 'interaction',
        content: {
          kind: 'choice',
          prompt: 'Which direction sounds closest to your taste?',
          options: ['Light', 'Medium', 'Dark'],
        },
        staticFallback: {
          type: 'list',
          content: {
            items: [
              'Light: brighter and origin-forward',
              'Medium: balanced and forgiving',
              'Dark: roasty and heavier',
            ],
          },
        },
      },
    ],
  });
}

test.beforeAll(async () => {
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
  server = spawn(process.execPath, [path.join(ROOT, 'company-server.js')], {
    cwd: ROOT,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(PORT),
      LUCUBRO_COMPANY_PORT: String(PORT),
      LUCUBRO_COMPANY_DATA_DIR: DATA_DIR,
      LUCUBRO_COMPANY_MOCK_RUNTIME: '1',
      LUCUBRO_WORKER_ID: 'worker_canvas_artifact',
      LUCUBRO_WORKER_NAME: 'Canvas Artifact Worker',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await waitForServer();
});

test.afterAll(async () => {
  await stopServer();
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
});

test('Coffee Artifact renders as evidence-backed editorial content inside durable Work and survives reload', async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 900 });
  const brief = 'Teach me the difference between light, medium, and dark coffee roasts.';
  const createdResponse = await fetch(`${URL}/api/company/works`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brief, runtime: 'mock' }),
  });
  expect(createdResponse.ok).toBe(true);
  const created = await createdResponse.json();
  await waitForCompletedRun(created.run.id);
  seedCoffeeArtifact(created.work.id);

  await page.goto(`${URL}/company?work=${encodeURIComponent(created.work.id)}`);
  const detail = page.locator('#durable-work-detail');
  await expect(detail).toBeVisible();

  const artifact = detail.getByTestId('canvas-artifact');
  await expect(artifact).toBeVisible();
  await expect(artifact).toContainText('Coffee Roast Field Guide');
  await expect(artifact).toContainText('Roast spectrum');
  await expect(artifact).toContainText('Roast level changes flavor expression and roast character.');
  await expect(artifact).toContainText('Medium');
  await expect(artifact).not.toContainText('matt:');
  await expect(artifact).not.toContainText('gstack:');

  const image = artifact.locator('img').first();
  await expect(image).toBeVisible();
  await expect(image).toHaveAttribute('alt', 'A visual reference for comparing coffee roast levels');
  await expect.poll(() => image.evaluate((node) => node.naturalWidth)).toBeGreaterThan(0);

  const choice = artifact.getByRole('button', { name: 'Medium' });
  await choice.click();
  await expect(artifact.getByTestId('artifact-interaction-response')).toHaveText('Selected: Medium');
  await expect(choice).toHaveAttribute('aria-pressed', 'true');

  const evidenceDrawer = artifact.getByTestId('artifact-evidence-drawer');
  await expect(evidenceDrawer).toContainText('Sources');
  await evidenceDrawer.locator('summary').click();
  await expect(evidenceDrawer).toContainText('Coffee roast reference');
  await expect(evidenceDrawer).toContainText('Coffee roast spectrum photo');
  await expect(evidenceDrawer).toContainText('Fixture Coffee Institute');

  await page.reload();
  await expect(page.getByTestId('canvas-artifact')).toContainText('Coffee Roast Field Guide');
});
