# Lucubro Company Workbench V1

Status: implementation branch foundation
Decision date: 2026-08-08

## Problem Statement

Lucubro is pivoting from an AI learning workspace into a local-first AI company workbench for a single CEO. The product needs one durable place where the CEO works with a Primary Manager, delegates durable Work to named AI Employees, supervises only material decisions, and can inspect the evidence behind completed work.

The first product milestone must prove that this model survives contact with real coding agents. A provider conversation or CLI session must not become the product's source of truth. Provider-specific permissions, events, session ids, and output formats remain execution details behind a stable Lucubro Run contract.

## Solution

Build one executable vertical slice:

CEO request → durable Work → Ben assignment → isolated Run → Claude Code or Codex runtime → normalized product events → Delegation Envelope approval → artifact/diff → review-ready Work → Accept/Rework.

The default surface remains a persistent Primary Manager conversation. Operational depth stays contextual. Raw provider reasoning and terminal noise are not promoted into the Manager conversation.

## User Stories

1. As the CEO, I want to give Alex a coding request in normal language, so that I do not need to operate an agent CLI directly.
2. As the CEO, I want that request to become durable Work, so that it survives beyond a provider session.
3. As the CEO, I want to see which Employee owns the Work, so that responsibility is legible.
4. As the CEO, I want each execution attempt to have a Lucubro Run id, so that provider sessions cannot replace product identity.
5. As the CEO, I want coding Runs isolated from each other, so that parallel Employees do not mutate the same checkout.
6. As the CEO, I want normal in-envelope execution to continue without interrupting me, so that Auto is useful.
7. As the CEO, I want network, git push, destructive filesystem operations, and permission expansion to remain outside the default coding envelope.
8. As the CEO, I want out-of-envelope requests to appear as Needs You decisions, so that I only see material interruptions.
9. As the CEO, I want approving one request to unblock only that decision, so that approval remains scoped.
10. As the CEO, I want provider events compressed into understandable progress, so that the product does not become a terminal transcript.
11. As the CEO, I want code changes represented as an Artifact/diff, so that I can review the result rather than inspect agent chatter.
12. As the CEO, I want completed execution to move Work to Ready for review rather than silently declare business acceptance.
13. As the CEO, I want Accept/Rework to update durable Work state.
14. As the CEO, I want failed Runs to leave Work and evidence intact, so that Alex can retry or redirect instead of losing context.
15. As the product owner, I want Claude and Codex to implement the same runtime boundary, so that switching providers does not rewrite Work Core.
16. As the product owner, I want provider session ids stored only as execution references on a Run, so that Employees remain durable identities independent of model/runtime.
17. As the product owner, I want raw reasoning excluded from product events, so that internal reasoning is not persisted or displayed as operational truth.
18. As the product owner, I want a compact audit trail for runtime decisions and approvals, so that routing and debugging can be explained without copying provider machine state.

## Implementation Decisions

- Product thesis is locked: Lucubro is a single-CEO AI company workbench. Session managers and coding agents are execution capabilities beneath the product.
- Lucubro owns Work, Run state, authorization, artifacts, and audit history. Providers own their agent loop, provider context, tools, and provider session/thread mechanics.
- Employee is a durable identity. Assignment/Work is dispatch. Run is one execution attempt. Runtime is the execution engine.
- Provider session/thread scope defaults to Run, not Employee. A Run may resume its provider session, but a new Run is a new execution boundary by default.
- Runtime integration is behind a provider-neutral adapter. Product code consumes normalized events rather than Claude or Codex wire objects.
- Claude integration targets Claude Agent SDK and loads it dynamically so the legacy product dependency lock is not silently changed before deliberate adoption.
- Codex integration targets `codex app-server` over stdio JSONL with initialization, thread start/resume, turn start, event projection, and server-initiated approval responses.
- Raw reasoning events are discarded by the product event projector. Product events include lifecycle, user-visible agent text, tool summaries, diffs/artifacts, approval requests, warnings, and terminal state.
- Auto is a scoped Delegation Envelope. Default coding authority allows workspace read/write and ordinary local shell execution. Network access, git push, destructive filesystem operations, unknown external side effects, and permission expansion require separate authority unless explicitly delegated.
- Commands are classified before authorization. Generic shell authority does not silently include git push, package installation/network actions, or destructive local commands.
- Each active coding Run uses an isolated git worktree in production. Tests inject a non-mutating worktree implementation.
- Work and Run state are persisted locally as canonical JSON records. Run events are append-only JSONL and separately projected into current state.
- Execution completion moves Work to `review`; CEO Accept/Rework is a separate durable Work decision.
- Q71 is locked to a compact immutable routing decision record with versioned references, but adaptive provider selection is postponed. V1 uses an explicit runtime choice.
- V1 is BYO/local runtime. Lucubro does not aggregate model billing or own provider credentials.

## Testing Decisions

- Tests assert behavior at product seams, not provider implementation details.
- Delegation tests prove in-envelope allow, explicit deny, and out-of-envelope Needs You behavior.
- Runtime adapter tests use fake Claude streams and fake Codex app-server JSONL to prove provider session capture, safe event projection, handshake semantics, and approval routing.
- Run tests prove Lucubro Run identity remains canonical while provider session id remains a separate reference.
- Persistence tests reload Run state and append-only events from disk.
- A browser journey uses the mock runtime only in test mode to exercise conversation → Work → Run → Needs You → review → Accept without external model credentials.
- Existing repository unit and browser suites remain regression gates for the legacy product during the pivot branch.

## Out of Scope

- Intelligent Manager decomposition/planning beyond the single coding Work path.
- Multiple Employees collaborating on the same Work.
- Playbook selection and Required Gate UI.
- Learned/adaptive runtime routing.
- Cloud queues, multi-user tenancy, billing, hosted credentials, or provider spend aggregation.
- Automatic merge, deploy, git push, production changes, or unrestricted network access.
- Full product visual redesign. V1 UI validates the live Work/Run/approval journey; visual refinement follows real-runtime evidence.
- Migration or deletion of the existing learning-workspace product on `main`.

## Further Notes

This branch is intentionally a side-by-side pivot slice. The legacy application already contains useful local-first, event, state-ownership, runner, and testing patterns. V1 reuses those engineering principles while introducing a new Company domain rather than rewriting the old product in place.
