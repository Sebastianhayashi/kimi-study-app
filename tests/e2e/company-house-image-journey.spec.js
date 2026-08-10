'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { startCompanyTestServer, stopCompanyTestServer } = require('../support/company-test-server');

const ROOT = path.resolve(__dirname, '..', '..');
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z2V0AAAAASUVORK5CYII=',
  'base64',
);
let server;
let URL;

function seedProject(dataDir) {
  const projectsDir = path.join(dataDir, 'projects');
  fs.mkdirSync(projectsDir, { recursive: true });
  fs.writeFileSync(path.join(projectsDir, 'project_home_refresh.json'), `${JSON.stringify({
    id: 'project_home_refresh',
    name: 'Home refresh',
    kind: 'work-context',
    repoDir: null,
    isGitRepository: false,
    sources: [],
    checkpoint: null,
    memory: {
      schemaVersion: 1,
      objective: 'Make the home calmer and easier to use as new evidence arrives.',
      report: {
        title: 'Home refresh report',
        summary: 'Keep the current sofa and prefer reversible changes before replacement.',
        changed: 'The sofa direction still needs a current room-context check.',
        nextAction: 'Send a current living-room photo.',
        artifactId: null,
      },
      facts: [{ id: 'fact_sofa', text: 'The living-room sofa is a large red modular chaise.', status: null, evidenceIds: [] }],
      preferences: [{ id: 'pref_reversible', text: 'Prefer reversible high-ROI changes first.' }],
      decisions: [],
      frontiers: [{
        id: 'frontier_sofa',
        title: 'Sofa visual refresh',
        status: 'active',
        summary: 'Validate whether the sofa is still the dominant visual problem in the room.',
        nextAction: 'Send a current living-room photo.',
        evidenceIds: [],
      }],
      sourceWorkIds: [],
    },
    createdAt: '2026-08-10T11:30:00.000Z',
    updatedAt: '2026-08-10T11:30:00.000Z',
  }, null, 2)}\n`, 'utf8');
}

test.beforeAll(async () => {
  const dataDir = path.join(ROOT, 'tests', '.runtime', 'company-house-image-journey');
  fs.rmSync(dataDir, { recursive: true, force: true });
  seedProject(dataDir);
  server = await startCompanyTestServer({ rootDir: ROOT, dataDir });
  URL = server.url;
});

test.afterAll(async () => {
  await stopCompanyTestServer(server);
});

test('a room photo becomes contextual Evidence and corrects the same durable Frontier in place', async ({ page }) => {
  await page.goto(`${URL}/company`);
  const project = page.getByTestId('project-result');
  await expect(project).toBeVisible();
  await expect(project.locator('[data-frontier-id="frontier_sofa"]')).toHaveCount(1);

  await project.getByRole('button', { name: 'Continue in Home refresh' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-active-project-id', 'project_home_refresh');

  const attachmentInput = page.locator('#work-attachments');
  await expect(attachmentInput).toHaveCount(1);
  await attachmentInput.setInputFiles({
    name: 'living-room.png',
    mimeType: 'image/png',
    buffer: PNG_1X1,
  });
  const attachmentPreview = page.getByTestId('composer-attachment');
  await expect(attachmentPreview).toContainText('living-room.png');

  await page.locator('#work-brief').fill('Use this living-room photo to update the existing sofa direction.');
  await page.locator('#send-work').click();

  const workObject = page.locator('.work-object').filter({ hasText: 'Use this living-room photo' }).first();
  await expect(workObject).toBeVisible();
  const evidenceShelf = workObject.getByTestId('run-evidence');
  await expect(evidenceShelf).toBeVisible();
  await expect(evidenceShelf).toContainText('User input');
  const evidenceImage = evidenceShelf.locator('img').first();
  await expect(evidenceImage).toBeVisible();
  await expect(evidenceImage).toHaveAttribute('src', /\/api\/company\/evidence\/[^/]+\/content$/);

  await expect(project.getByTestId('project-change')).toContainText('room photo confirms');
  const sofaFrontier = project.locator('[data-frontier-id="frontier_sofa"]');
  await expect(sofaFrontier).toHaveCount(1);
  await expect(sofaFrontier).toContainText('room photo confirms');
  await expect(sofaFrontier.locator('.project-frontier-evidence img')).toBeVisible();

  const state = await page.evaluate(async () => {
    const projectResponse = await fetch('/api/company/projects/project_home_refresh', { cache: 'no-store' });
    const evidenceResponse = await fetch('/api/company/projects/project_home_refresh/evidence', { cache: 'no-store' });
    const current = await projectResponse.json();
    const evidence = await evidenceResponse.json();
    return {
      frontierIds: current.memory.frontiers.map((item) => item.id),
      frontierEvidenceIds: current.memory.frontiers[0].evidenceIds,
      evidence: evidence.evidence.map((item) => ({ id: item.id, source: item.source, mimeType: item.mimeType })),
    };
  });
  expect(state.frontierIds).toEqual(['frontier_sofa']);
  expect(state.frontierEvidenceIds).toHaveLength(1);
  expect(state.evidence).toEqual([{ id: state.frontierEvidenceIds[0], source: 'user-input', mimeType: 'image/png' }]);

  await page.reload();
  await expect(page.getByTestId('project-change')).toContainText('room photo confirms');
  await expect(page.locator('[data-frontier-id="frontier_sofa"]')).toHaveCount(1);
  await expect(page.locator('[data-frontier-id="frontier_sofa"] .project-frontier-evidence img')).toBeVisible();
});
