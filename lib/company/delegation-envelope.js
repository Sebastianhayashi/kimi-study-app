const CLAUDE_TOOL_CAPABILITIES = new Map([
  ['Read', 'workspace.read'],
  ['Glob', 'workspace.read'],
  ['Grep', 'workspace.read'],
  ['LS', 'workspace.read'],
  ['Edit', 'workspace.write'],
  ['Write', 'workspace.write'],
  ['NotebookEdit', 'workspace.write'],
  ['Bash', 'shell.execute'],
  ['WebFetch', 'network.access'],
  ['WebSearch', 'network.access'],
]);

function uniqueStrings(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).filter((value) => typeof value === 'string' && value.trim()))];
}

function createDelegationEnvelope(input = {}) {
  return Object.freeze({
    allow: Object.freeze(uniqueStrings(input.allow)),
    deny: Object.freeze(uniqueStrings(input.deny)),
  });
}

function restrictDelegationEnvelope(parentInput = {}, childInput = null) {
  const parent = createDelegationEnvelope(parentInput);
  if (childInput == null) return parent;
  const child = createDelegationEnvelope(childInput);
  const parentAllowed = new Set(parent.allow);
  const parentDenied = new Set(parent.deny);

  for (const capability of child.allow) {
    if (!parentAllowed.has(capability) || parentDenied.has(capability)) {
      throw new Error(`Delegation Envelope expands parent authority: ${capability}`);
    }
  }

  return createDelegationEnvelope({
    allow: child.allow,
    deny: [...parent.deny, ...child.deny],
  });
}

function evaluateDelegationRequest(envelopeInput = {}, request = {}) {
  const envelope = createDelegationEnvelope(envelopeInput);
  const capability = typeof request.capability === 'string' ? request.capability : 'unknown.capability';

  if (envelope.deny.includes(capability)) {
    return { decision: 'deny', capability, reason: 'Capability is explicitly denied by the Delegation Envelope.' };
  }
  if (envelope.allow.includes(capability)) {
    return { decision: 'allow', capability, reason: 'Capability is explicitly delegated for this Work.' };
  }
  return { decision: 'ask', capability, reason: 'Capability is outside the current Delegation Envelope.' };
}

function commandText(command) {
  if (Array.isArray(command)) return command.join(' ');
  return String(command || '');
}

function capabilityForCommand(command) {
  const text = commandText(command).trim();
  if (!text) return 'shell.execute';
  if (/\bgit\s+push\b/i.test(text)) return 'git.push';
  if (/\bgit\s+commit\b/i.test(text)) return 'git.commit';
  if (/\b(rm\s+-[a-z]*r[a-z]*f|rm\s+-[a-z]*f[a-z]*r|git\s+reset\s+--hard|git\s+clean\s+-[a-z]*f[a-z]*d|sudo\b|chmod\s+777\b)/i.test(text)) return 'filesystem.destructive';
  if (/\b(curl|wget|npm\s+(install|i)\b|pnpm\s+(add|install)\b|yarn\s+add\b|pip3?\s+install\b|brew\s+install\b|apt(-get)?\s+install\b)\b/i.test(text)) return 'network.access';
  return 'shell.execute';
}

function capabilityForClaudeTool(toolName, input = {}) {
  const name = String(toolName || '');
  if (name === 'Bash') return capabilityForCommand(input && input.command);
  return CLAUDE_TOOL_CAPABILITIES.get(name) || 'external.side-effect';
}

function codexSandboxPolicy(envelopeInput, cwd) {
  const envelope = createDelegationEnvelope(envelopeInput);
  const canWrite = envelope.allow.includes('workspace.write');
  const canNetwork = envelope.allow.includes('network.access');

  if (!canWrite) {
    return { type: 'readOnly', access: { type: 'fullAccess' } };
  }

  return {
    type: 'workspaceWrite',
    writableRoots: [cwd],
    networkAccess: canNetwork,
  };
}

module.exports = {
  createDelegationEnvelope,
  restrictDelegationEnvelope,
  evaluateDelegationRequest,
  capabilityForClaudeTool,
  capabilityForCommand,
  codexSandboxPolicy,
};
