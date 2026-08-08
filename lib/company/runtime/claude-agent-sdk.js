const { capabilityForClaudeTool } = require('../delegation-envelope');

async function defaultQueryLoader() {
  let mod;
  try {
    mod = await import('@anthropic-ai/claude-agent-sdk');
  } catch (error) {
    const wrapped = new Error('Claude Agent SDK is not installed. Install @anthropic-ai/claude-agent-sdk to enable the claude-code runtime.');
    wrapped.code = 'CLAUDE_AGENT_SDK_UNAVAILABLE';
    wrapped.cause = error;
    throw wrapped;
  }
  if (typeof mod.query !== 'function') throw new Error('Claude Agent SDK does not export query()');
  return mod.query;
}

function contentBlocks(message) {
  const content = message && message.message && message.message.content;
  return Array.isArray(content) ? content : [];
}

function safeClaudeEvents(message) {
  if (!message || typeof message !== 'object') return [];
  const events = [];

  if (message.type === 'system' && message.subtype === 'init') {
    events.push({ type: 'run.started', providerSessionId: message.session_id || null });
    return events;
  }

  if (message.type === 'assistant') {
    for (const block of contentBlocks(message)) {
      if (!block || typeof block !== 'object') continue;
      if (block.type === 'text' && typeof block.text === 'string' && block.text) {
        events.push({ type: 'message.delta', text: block.text });
      } else if (block.type === 'tool_use') {
        events.push({ type: 'tool.started', tool: block.name || 'tool', providerItemId: block.id || null });
      }
    }
    return events;
  }

  if (message.type === 'user') {
    for (const block of contentBlocks(message)) {
      if (block && block.type === 'tool_result') {
        events.push({ type: 'tool.completed', providerItemId: block.tool_use_id || null, isError: Boolean(block.is_error) });
      }
    }
    return events;
  }

  if (message.type === 'result') {
    if (message.subtype === 'success') {
      events.push({ type: 'run.completed', providerSessionId: message.session_id || null, summary: typeof message.result === 'string' ? message.result : null });
    } else {
      events.push({ type: 'run.failed', providerSessionId: message.session_id || null, error: message.error || message.subtype || 'Claude run failed' });
    }
  }

  return events;
}

function createClaudeAgentSdkRuntime({ queryImpl = null, queryLoader = defaultQueryLoader } = {}) {
  return {
    kind: 'claude-code',

    async available() {
      if (queryImpl) return { available: true, mode: 'agent-sdk' };
      try {
        await queryLoader();
        return { available: true, mode: 'agent-sdk' };
      } catch (error) {
        return { available: false, mode: 'agent-sdk', reason: error.message };
      }
    },

    async *run(request) {
      const query = queryImpl || await queryLoader();
      const abortController = request.abortController || new AbortController();
      const canUseTool = async (toolName, input) => {
        const capability = capabilityForClaudeTool(toolName, input);
        const decision = await request.requestApproval({
          provider: 'claude-code',
          capability,
          reason: `Claude requested ${toolName}`,
          detail: { toolName },
        });
        if (decision === 'allow') return { behavior: 'allow', updatedInput: input };
        return { behavior: 'deny', message: `Lucubro did not authorize capability: ${capability}` };
      };

      const stream = query({
        prompt: request.prompt,
        options: {
          cwd: request.cwd,
          abortController,
          settingSources: ['project'],
          permissionMode: 'default',
          canUseTool,
          ...(request.model ? { model: request.model } : {}),
          ...(request.providerSessionId ? { resume: request.providerSessionId } : {}),
        },
      });

      let started = false;
      for await (const message of stream) {
        const projected = safeClaudeEvents(message);
        for (const event of projected) {
          if (event.type === 'run.started') started = true;
          if (!started && event.providerSessionId) {
            started = true;
            yield { type: 'run.started', providerSessionId: event.providerSessionId };
          }
          yield event;
        }
      }
    },
  };
}

module.exports = {
  createClaudeAgentSdkRuntime,
  safeClaudeEvents,
};
