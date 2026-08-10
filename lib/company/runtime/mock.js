'use strict';

const { createDeterministicBrowserPng } = require('./mock-evidence');

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function requestsBrowserEvidence(prompt) {
  return /screenshot|browser|preview|visual|截图|浏览器|预览/i.test(String(prompt || ''));
}

function firstProjectFrontier(prompt) {
  const text = String(prompt || '');
  const section = text.match(/Open frontiers:\s*\n([\s\S]*?)(?:\n(?:Source Work ids:|## )|$)/i);
  if (!section) return null;
  const line = section[1].split('\n').find((value) => /^- \[[a-zA-Z0-9_-]+\]/.test(value.trim()));
  if (!line) return null;
  const match = line.trim().match(/^- \[([a-zA-Z0-9_-]+)\]\s+(.+?)\s+\(([^)]+)\)\./);
  if (!match) return null;
  return { id: match[1], title: match[2].trim(), status: match[3].trim() || 'active' };
}

function visualProjectFixture(request) {
  const image = (Array.isArray(request.inputEvidence) ? request.inputEvidence : [])
    .find((item) => item && item.source === 'user-input' && /^image\/(?:png|jpeg|webp)$/.test(String(item.mimeType || '')));
  const frontier = firstProjectFrontier(request.prompt);
  if (!image || !frontier) return null;
  return { image, frontier };
}

function createMockCompanyRuntime({ delayMs = 40 } = {}) {
  return {
    kind: 'mock',
    async available() { return { available: true, mode: 'fixture' }; },
    async *run(request) {
      yield { type: 'run.started', providerSessionId: `mock_session_${request.runId}` };
      await sleep(delayMs);
      yield { type: 'message.delta', text: 'I have the Work. I am checking the relevant code path.' };
      await sleep(delayMs);

      const visualFixture = visualProjectFixture(request);
      if (visualFixture) {
        const { image, frontier } = visualFixture;
        yield {
          type: 'skill.output',
          skillId: 'fixture:visual-diagnosis',
          output: {
            type: 'project.memory.patch',
            summary: 'New visual Evidence updated the existing Project finding.',
            evidenceRefs: [image.id],
            mutation: {
              report: {
                changed: `The room photo confirms the current direction for ${frontier.title} and keeps this existing problem in focus.`,
                nextAction: 'Compare the next candidate or measurement against this visual context.',
              },
              frontiersUpsert: [{
                id: frontier.id,
                title: frontier.title,
                status: frontier.status,
                summary: 'The room photo confirms the current direction remains relevant; keep this Frontier active while the next candidate or measurement is checked.',
                nextAction: 'Compare the next candidate or measurement against this visual context.',
                evidenceIds: [image.id],
              }],
            },
          },
        };
        await sleep(delayMs);
        yield { type: 'run.completed', summary: 'Updated the current Project from the new visual Evidence.' };
        return;
      }

      if (/needs-approval/i.test(request.prompt)) {
        const decision = await request.requestApproval({
          provider: 'mock',
          capability: 'network.access',
          reason: 'This fixture needs network access to continue.',
        });
        if (decision !== 'allow') {
          yield { type: 'run.failed', error: 'Network access was not approved.' };
          return;
        }
        yield { type: 'message.delta', text: 'Network access approved. Continuing.' };
      }

      yield { type: 'tool.started', tool: 'test', providerItemId: 'mock-test' };
      await sleep(delayMs);
      yield { type: 'tool.completed', tool: 'test', providerItemId: 'mock-test', status: 'completed' };

      if (requestsBrowserEvidence(request.prompt)) {
        const screenshot = createDeterministicBrowserPng();
        yield {
          type: 'evidence.produced',
          kind: 'screenshot',
          label: 'Deterministic browser screenshot',
          mimeType: 'image/png',
          source: 'deterministic-mock',
          metadata: {
            deterministic: true,
            url: 'https://fixture.invalid/company',
            title: 'Lucubro deterministic browser fixture',
            viewport: { width: 480, height: 270 },
          },
          contentBase64: screenshot.toString('base64'),
        };
        await sleep(delayMs);
      }

      yield { type: 'artifact.updated', kind: 'diff', changedFiles: ['src/session.js'] };
      await sleep(delayMs);
      yield { type: 'run.completed', summary: 'Fixed the session refresh path and verified the change.' };
    },
  };
}

module.exports = {
  createMockCompanyRuntime,
  firstProjectFrontier,
  requestsBrowserEvidence,
  visualProjectFixture,
};
