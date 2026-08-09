# Lucubro Company Workbench V1

Status: executable engineering slice, not complete product information architecture
Decision date: 2026-08-08

> Product-direction precedence: [`PRODUCT-THESIS.md`](PRODUCT-THESIS.md) governs why Lucubro exists and how domain objects relate to the AI-native Company Canvas. This V1 spec defines a narrow Work/Run/approval execution seam. It must not be read as a fixed navigation map or as evidence that every object below deserves a separate page.

## Problem Statement

Lucubro is pivoting from an AI learning workspace into a local-first AI company workbench for a single CEO. The product needs one durable place where the CEO works with a Primary Manager, delegates durable Work to named AI Employees, supervises only material decisions, and can inspect the evidence behind completed work.

The first engineering milestone must prove that this model is independent of provider sessions. A provider conversation or CLI session must not become the product's source of truth. Provider-specific permissions, events, session ids, and output formats remain execution details behind a stable Lucubro Run contract.

Real Claude/Codex execution is currently paused as a product-development priority while the Company Canvas interaction contract is stabilized. The deterministic mock runtime remains the active UI/product test source and exercises the same Work/Run/product-event boundary.

## Solution

Build one executable vertical slice:

CEO request → durable Work → Ben assignment → isolated Run → runtime adapter → normalized product events → Delegation Envelope approval → artifact/diff → review-ready Work → Accept/Rework.

The default product surface belongs to the persistent Company Canvas Shell and Primary Manager relationship. Operational depth stays contextual. Raw provider reasoning and terminal noise are not promoted into product truth.

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

- The governing product thesis lives above this spec: Multica-style durable operational state is projected through an AI-native kinetic Company Canvas rather than a fixed page hierarchy.
- This spec defines the Work/Run execution boundary only. Domain nouns in this document do not imply navigation items.
- Lucubro owns Work, Run state, authorization, artifacts, and audit history. Providers own their agent loop, provider context, tools, and provider session/thread mechanics.
- Employee is a durable identity. Assignment/Work is dispatch. Run is one execution attempt. Runtime is the execution engine.
- Provider session/thread scope defaults to Run, not Employee. A Run may resume its provider session, but a new Run is a new execution boundary by default.
- Runtime integration is behind a provider-neutral adapter. Product code consumes normalized events rather than Claude or Codex wire objects.
- Claude integration targets Claude Agent SDK behind the adapter when real-provider work resumes.
- Codex integration targets `codex app-server` behind the same product boundary when real-provider work resumes.
- Raw reasoning events are discarded by the product event projector. Product events include lifecycle, user-visible public agent text, tool summaries, diffs/artifacts, approval requests, warnings, and terminal state.
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
- Browser journeys use the deterministic mock runtime to exercise Intent → Work → Run → Needs You → evidence → review → Accept without external model credentials.
- Canvas/lens tests verify that durable inspection can change focus without replacing the Primary Manager shell, composer, or browser-history continuity.
- Existing repository unit and browser suites remain regression gates for frozen legacy behavior during the pivot.

## Out of Scope

- Intelligent Manager decomposition/planning beyond the current Work path.
- Full Project growth / Issues / Map / Activity implementation.
- Knowledge durable-domain design.
- Multiple Employees collaborating on the same Work.
- Playbook selection and Required Gate UI.
- Learned/adaptive runtime routing.
- Cloud queues, multi-user tenancy, billing, hosted credentials, or provider spend aggregation.
- Automatic merge, deploy, git push, production changes, or unrestricted network access.
- Treating Project, Knowledge, Usage, Account, Employee, Artifact, or other domain/configuration nouns as mandatory top-level pages.
- Migration or deletion of the frozen learning-workspace implementation solely for this slice.

## Further Notes

The legacy application still contains useful local-first, event, state-ownership, runner, and testing patterns. V1 reuses those engineering principles while the active Company product evolves around the governing Product Thesis.

The current Company UI should be evaluated as reusable implementation material for the persistent kinetic canvas, not as a final information architecture merely because a route or component exists today.
