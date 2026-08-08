const crypto = require('crypto');
const { evaluateDelegationRequest } = require('./delegation-envelope');

function createApprovalBroker({ runStore, createId = () => `approval_${crypto.randomUUID()}` }) {
  if (!runStore) throw new Error('Approval broker requires runStore');
  const pending = new Map();

  async function request({ runId, envelope, request: capabilityRequest }) {
    const evaluation = evaluateDelegationRequest(envelope, capabilityRequest);
    if (evaluation.decision !== 'ask') {
      runStore.appendEvent(runId, {
        type: 'approval.resolved',
        decision: evaluation.decision,
        capability: evaluation.capability,
        automatic: true,
        reason: evaluation.reason,
      });
      return evaluation.decision;
    }

    const id = createId();
    const item = {
      id,
      runId,
      state: 'needs-you',
      capability: evaluation.capability,
      reason: capabilityRequest.reason || evaluation.reason,
      detail: capabilityRequest.detail || null,
      provider: capabilityRequest.provider || null,
      providerRequestId: capabilityRequest.providerRequestId || null,
    };

    runStore.appendEvent(runId, { type: 'approval.requested', approval: item });
    return new Promise((resolve, reject) => {
      pending.set(id, { ...item, resolve, reject });
    });
  }

  function listPending(runId = null) {
    return [...pending.values()]
      .filter((item) => !runId || item.runId === runId)
      .map(({ resolve, reject, ...item }) => ({ ...item }));
  }

  function resolve({ runId, approvalId, decision }) {
    if (!['allow', 'deny'].includes(decision)) throw new Error(`Invalid approval decision: ${decision}`);
    const item = pending.get(approvalId);
    if (!item || item.runId !== runId) throw new Error(`Pending approval not found: ${approvalId}`);
    pending.delete(approvalId);
    runStore.appendEvent(runId, {
      type: 'approval.resolved',
      approvalId,
      capability: item.capability,
      decision,
      automatic: false,
    });
    item.resolve(decision);
  }

  return { request, listPending, resolve };
}

module.exports = { createApprovalBroker };
