'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { startCompanyTestServer, stopCompanyTestServer } = require('../support/company-test-server');

const ROOT = path.resolve(__dirname, '..', '..');
let server;
let URL;
let projectFile;

function projectState({ changed, frontierSummary, nextAction }) {
  return {
    id: 'project_home_refresh',
    name: 'Home refresh',
    kind: 'work-context',
    repoDir: null,
    isGitRepository: false,
    sources: [],
    checkpoint: null,
    memoryRevisionId: 'revision_sofa_candidate_1',
    memory: {
      schemaVersion: 1,
      objective: 'Make the home easier to live in while improving visual calm.',
      report: {
        title: 'Home refresh report',
        summary: 'Keep the current sofa and validate a reversible segment-level cover before replacing large furniture.',
        changed,
        nextAction,
        artifactId: null,
      },
      facts: [
        { id: 'fact_sofa', text: 'The living-room sofa is a large red modular chaise.', status: null, evidenceIds: [] },
      ],
      preferences: [
        { id: 'pref_reversible', text: 'Prefer low-cost reversible interventions before replacing large furniture.' },
      ],
      decisions: [],
      frontiers: [
        {
          id: 'frontier_sofa',
          title: 'Sofa visual refresh',
          status: 'active',
          summary: frontierSummary,
          nextAction,
          evidenceIds: ['evidence_taobao_sofa_cover'],
        },
      ],
      sourceWorkIds: ['work_house_setup', 'work_sofa_candidate'],
    },
    createdAt: '2026-08-10T09:00:00.000Z',
    updatedAt: '2026-08-10T09:31:00.000Z',
  };
}

function writeProject(state) {
  fs.writeFileSync(projectFile, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

test.beforeAll(async () => {
  const dataDir = path.join(ROOT, 'tests', '.runtime', 'company-project-memory');
  fs.rmSync(dataDir, { recursive: true, force: true });
  const projectsDir = path.join(dataDir, 'projects');
  fs.mkdirSync(projectsDir, { recursive: true });
  projectFile = path.join(projectsDir, 'project_home_refresh.json');
  writeProject(projectState({
    changed: 'A Taobao segment-level full-cover candidate is now the leading reversible option.',
    frontierSummary: 'Validate the segment-level full-cover candidate before purchase.',
    nextAction: 'Measure the three sofa segments against the seller size chart.',
  }));
  server = await startCompanyTestServer({ rootDir: ROOT, dataDir });
  URL = server.url;
});

test.afterAll(async () => {
  await stopCompanyTestServer(server);
});

test('foregrounds the evolving Project result instead of execution plumbing', async ({ page }) => {
  await page.goto(`${URL}/company`);

  const project = page.getByTestId('project-result');
  await expect(project).toBeVisible();
  await expect(project).toContainText('Home refresh');
  await expect(project.getByTestId('project-report')).toContainText('Home refresh report');
  await expect(project.getByTestId('project-report')).toContainText('Keep the current sofa');
  await expect(project.getByTestId('project-change')).toContainText('Taobao segment-level full-cover candidate');
  await expect(project.getByTestId('project-next-action')).toContainText('Measure the three sofa segments');

  const frontier = project.locator('[data-frontier-id="frontier_sofa"]');
  await expect(frontier).toHaveCount(1);
  await expect(frontier).toContainText('Sofa visual refresh');
  await expect(frontier).toContainText('Validate the segment-level full-cover candidate');
});

test('reload restores the same Project and Frontier identities with the latest semantic revision', async ({ page }) => {
  await page.goto(`${URL}/company`);
  await expect(page.locator('[data-frontier-id="frontier_sofa"]')).toHaveCount(1);

  writeProject(projectState({
    changed: 'Measurements fit the candidate range; buyer-use photos are now the remaining validation step.',
    frontierSummary: 'Size fit is plausible; validate seated-use slipping and wrinkles in real buyer photos.',
    nextAction: 'Review real buyer photos before making a purchase decision.',
  }));

  await page.reload();
  const project = page.getByTestId('project-result');
  await expect(project).toBeVisible();
  await expect(project.getByTestId('project-change')).toContainText('Measurements fit the candidate range');
  await expect(project.locator('[data-frontier-id="frontier_sofa"]')).toHaveCount(1);
  await expect(project.locator('[data-frontier-id="frontier_sofa"]')).toContainText('Size fit is plausible');
  await expect(project.getByTestId('project-next-action')).toContainText('Review real buyer photos');
});

test('composer joins an explicit Project focus and preserves a pasted product link as user Evidence', async ({ page }) => {
  await page.goto(`${URL}/company`);
  const project = page.getByTestId('project-result');
  await expect(project).toBeVisible();

  const continueButton = project.getByRole('button', { name: 'Continue in Home refresh' });
  await expect(continueButton).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('body')).not.toHaveAttribute('data-active-project-id', 'project_home_refresh');
  await continueButton.click();
  await expect(project.getByRole('button', { name: 'Working in Home refresh' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('body')).toHaveAttribute('data-active-project-id', 'project_home_refresh');

  const taobaoUrl = 'https://item.taobao.com/item.htm?id=24680';
  await expect(page.locator('#repo-dir')).toHaveValue('');
  await page.locator('#work-brief').fill(`I found another Taobao sofa-cover listing ${taobaoUrl}. Compare it with the current sofa plan.`);
  await expect(page.locator('#send-work')).toBeEnabled();
  await page.locator('#send-work').click();

  const workObject = page.locator('.work-object').filter({ hasText: 'another Taobao sofa-cover listing' }).first();
  await expect(workObject).toBeVisible();
  const evidence = workObject.getByTestId('run-evidence');
  await expect(evidence).toBeVisible();
  await expect(evidence).toContainText('User input');
  await expect(evidence).toContainText(taobaoUrl);

  await expect.poll(async () => page.evaluate(async () => {
    const data = await fetch('/api/company/bootstrap', { cache: 'no-store' }).then((response) => response.json());
    const work = data.works.find((item) => item.brief.includes('another Taobao sofa-cover listing'));
    return work ? { projectId: work.projectId, repoDir: work.repoDir } : null;
  })).toEqual({ projectId: 'project_home_refresh', repoDir: null });
});
