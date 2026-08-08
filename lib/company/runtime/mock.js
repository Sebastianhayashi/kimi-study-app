function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function createMockCompanyRuntime({ delayMs = 40 } = {}) {
  return {
    kind: 'mock',
    async available() { return { available: true, mode: 'fixture' }; },
    async *run(request) {
      yield { type: 'run.started', providerSessionId: `mock_session_${request.runId}` };
      await sleep(delayMs);
      yield { type: 'message.delta', text: 'I have the Work. I am checking the relevant code path.' };
      await sleep(delayMs);

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
      yield { type: 'artifact.updated', kind: 'diff', diff: 'diff --git a/src/session.js b/src/session.js\n+// fixed session refresh race\n' };
      await sleep(delayMs);
      yield { type: 'run.completed', summary: 'Fixed the session refresh path and verified the change.' };
    },
  };
}

module.exports = { createMockCompanyRuntime };
