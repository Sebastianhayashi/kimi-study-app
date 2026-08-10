'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const { createCanvasArtifactStore } = require('../../lib/company/canvas-artifact-store');
const { createEvidenceStore } = require('../../lib/company/evidence-store');
const { startCompanyTestServer, stopCompanyTestServer } = require('../support/company-test-server');

const ROOT = path.resolve(__dirname, '..', '..');
let URL;
const DATA_DIR = path.join(ROOT, 'tests', '.runtime', 'company-canvas-artifact');
const FIXTURE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR4nGP8z8DAwMDAxMDAwMAAAAwAAf4CBKcAAAAASUVORK5CYII=',
  'base64',
);
let server;

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

async function createCompletedWork(brief) {
  const response = await fetch(`${URL}/api/company/works`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brief, runtime: 'mock' }),
  });
  expect(response.ok).toBe(true);
  const created = await response.json();
  await waitForCompletedRun(created.run.id);
  return created;
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

function seedWebsiteArtifact(workId) {
  const evidenceStore = createEvidenceStore({ rootDir: DATA_DIR });
  const browserCheck = evidenceStore.create({
    id: 'evidence_website_browser_check',
    runId: 'run_website_qa',
    workId,
    workerId: 'worker_canvas_artifact',
    kind: 'screenshot',
    label: 'Homepage browser check',
    mimeType: 'image/png',
    source: 'browser-qa',
    metadata: {
      url: 'https://preview.example.test/',
      publisher: 'Browser QA',
    },
    content: FIXTURE_PNG,
  });
  const deliveryFile = evidenceStore.create({
    id: 'evidence_website_delivery_file',
    runId: 'run_website_delivery',
    workId,
    workerId: 'worker_canvas_artifact',
    kind: 'deliverable-file',
    label: 'Built landing page',
    mimeType: 'text/html',
    source: 'skill-output',
    metadata: {
      path: 'dist/index.html',
      requested: true,
      userIntentEvidence: 'dist/index.html',
    },
    content: '<!doctype html><title>Launch</title>',
  });

  const artifactStore = createCanvasArtifactStore({
    rootDir: DATA_DIR,
    evidenceStore,
    createArtifactId: () => 'artifact_website_delivery',
    createBlockId: (() => {
      let index = 0;
      return () => `block_website_${++index}`;
    })(),
  });
  return artifactStore.create({
    workId,
    projectId: null,
    title: 'Website Delivery',
    blocks: [
      {
        type: 'heading',
        content: { text: 'Launch-ready landing page' },
      },
      {
        type: 'image',
        content: {
          evidenceId: browserCheck.id,
          alt: 'Browser QA capture of the delivered landing page',
          caption: 'Final browser check from the delivery run.',
        },
        evidenceRefs: [browserCheck.id],
      },
      {
        type: 'claim',
        material: true,
        content: { text: 'The delivered homepage passed the captured browser check.' },
        evidenceRefs: [browserCheck.id],
      },
      {
        type: 'list',
        content: {
          items: [
            'Responsive hero and primary call to action',
            'Production build output captured as a requested file',
            'Browser evidence attached to the Work',
          ],
        },
      },
      {
        type: 'code',
        content: {
          language: 'sh',
          text: 'npm run build',
        },
      },
      {
        type: 'file-reference',
        content: {
          path: 'dist/index.html',
          label: 'Built landing page',
          mimeType: 'text/html',
          evidenceId: deliveryFile.id,
        },
        evidenceRefs: [deliveryFile.id],
      },
    ],
  });
}

test.beforeAll(async () => {
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
  server = await startCompanyTestServer({
    rootDir: ROOT,
    dataDir: DATA_DIR,
    env: {
      LUCUBRO_WORKER_ID: 'worker_canvas_artifact',
      LUCUBRO_WORKER_NAME: 'Canvas Artifact Worker',
    },
  });
  URL = server.url;
});

test.afterAll(async () => {
  await stopCompanyTestServer(server);
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
});

test('Coffee Artifact renders as evidence-backed editorial content inside durable Work and survives reload', async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 900 });
  const created = await createCompletedWork('Teach me the difference between light, medium, and dark coffee roasts.');
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

test('Website Artifact uses the same Canvas renderer without exposing Skill plumbing', async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 900 });
  const created = await createCompletedWork('Build and deliver a launch-ready landing page as dist/index.html.');
  seedWebsiteArtifact(created.work.id);

  await page.goto(`${URL}/company?work=${encodeURIComponent(created.work.id)}`);
  const artifact = page.getByTestId('canvas-artifact');
  await expect(artifact).toBeVisible();
  await expect(artifact).toContainText('Website Delivery');
  await expect(artifact).toContainText('Launch-ready landing page');
  await expect(artifact).toContainText('npm run build');
  await expect(artifact).toContainText('Built landing page');
  await expect(artifact).toContainText('dist/index.html');
  await expect(artifact).toContainText('The delivered homepage passed the captured browser check.');
  await expect(artifact).not.toContainText('matt:');
  await expect(artifact).not.toContainText('gstack:');
  await expect(artifact.locator('img')).toHaveAttribute('alt', 'Browser QA capture of the delivered landing page');
  await expect(artifact.getByRole('link', { name: 'Open file' })).toHaveAttribute('href', /evidence_website_delivery_file/);

  const evidenceDrawer = artifact.getByTestId('artifact-evidence-drawer');
  await evidenceDrawer.locator('summary').click();
  await expect(evidenceDrawer).toContainText('Homepage browser check');
  await expect(evidenceDrawer).toContainText('Built landing page');

  await page.reload();
  await expect(page.getByTestId('canvas-artifact')).toContainText('Website Delivery');
});
