# Lucubro Project Persistence v1

Status: proposed executable product slice
Decision date: 2026-08-09
Governing product direction: issue #19 and `PRODUCT-THESIS.md`
Related execution slice: `SPEC.md`

## Goal

Make a Lucubro Project durable across agent sessions, provider threads, Lucubro process restarts, and ordinary context-window loss without requiring the user to replay prior chat history.

The core product promise is:

> The user continues the Project, not the provider session.

Project continuity must come from durable, source-backed project semantics and Lucubro-owned operational state. Provider memory may improve an individual Run, but it must never be required to understand what the Project is, what has already happened, or what should happen next.

This slice is inspired by the persistence pattern used by Matt Pocock's engineering skills: durable domain context, decisions, specs, issue-tracker state, and compact handoff state live outside the model conversation. Lucubro adopts the principle, not a hard dependency on a particular skill package or repository layout.

## Problem Statement

Lucubro already persists Work, Run, Worker, Evidence, approval, and review state, and it already treats provider session/thread ids as execution references rather than product identity. That proves execution can survive independently from a single provider conversation.

The missing layer is Project continuity.

Today a new agent session can know the current Work brief and Run state, but there is no first-class durable Project context that answers all of these questions together:

- What is this project and repository for?
- Which domain terms and constraints are already settled?
- Which consequential decisions have already been made?
- Which spec or issue currently governs the work?
- What work has been completed and verified?
- What remains unresolved?
- What is the next safe action?

Without that layer, a long-running project can still depend on a previous conversation, a provider thread, or the user's memory to reconstruct intent. That breaks the product thesis that durable company state must outlive individual execution attempts.

## Scope

Project Persistence v1 includes:

- a durable Project identity associated with a workspace/repository;
- non-destructive discovery of existing project context and project-management artifacts;
- compatibility with common Matt-style context conventions such as `AGENTS.md`, `CONTEXT.md`, ADRs, specs, and issue-tracker guidance when those artifacts exist;
- explicit provenance for discovered project context;
- durable association between Project and Work;
- compact continuation state that records the current project frontier without copying raw conversation history;
- source-backed continuation context for every Project-bound execution attempt;
- recovery when the previous provider session/thread is absent or unusable;
- reconciliation when project sources change after a checkpoint was created;
- a Project context lens inside the persistent Company Canvas Shell;
- truthful handling of missing, stale, conflicting, or unavailable project sources;
- reviewable persistence of new long-lived project semantics when a Work proposes changing project context, decisions, specs, or related repository artifacts.

## Non-goals

Project Persistence v1 does not include:

- storing or replaying raw chat transcripts as project memory;
- storing raw model reasoning or chain-of-thought;
- treating a Claude/Codex session, thread, conversation, or context window as Project identity;
- requiring users to install Matt Pocock's skills in order to use Lucubro;
- creating a mandatory top-level Projects application or dashboard;
- automatically rewriting `CONTEXT.md`, ADRs, specs, or issue-tracker state without a normal reviewable Work path;
- inventing domain context or decisions when the repository does not contain supporting evidence;
- full multi-user or cloud project synchronization;
- guaranteeing that Lucubro-owned operational history automatically follows a repository clone to another machine;
- solving general document search or Knowledge-domain design;
- intelligent project decomposition beyond the current Work model;
- enabling real Claude/Codex execution before the existing runtime policy gate is satisfied;
- making Project state depend on UI animation or canvas position.

## Known Facts

- Lucubro's governing product direction defines Project as a durable Work Context that should grow around Work when long-running structure becomes relevant.
- The current Company execution slice persists Work and Run independently from provider sessions.
- Provider session/thread ids are execution references and are not Lucubro product identity.
- Real Claude/Codex execution remains intentionally paused while product and runtime boundaries are stabilized.
- Lucubro already requires raw model reasoning to remain outside durable product truth.
- The current Company implementation does not yet have a first-class Project domain in the active Work/Run path.
- The Company Canvas Shell is intended to remain persistent while contextual lenses change around the current Work.

## Assumptions

- V1 remains single-user and self-hosted.
- Git-backed coding repositories are the primary V1 Project type.
- A repository may already contain useful project context, may contain only part of it, or may contain none of it.
- Existing project files remain canonical in their original locations. Lucubro should reference and interpret them rather than copy their contents into a parallel memory store.
- Project continuity must still work when the provider session id is missing.
- A Project may contain many Work objects over time, and each Work may have multiple Runs.
- Lucubro may maintain compact operational continuation state that is distinct from user-authored repository semantics.
- Cross-machine portability of repository-owned semantics is naturally provided by the repository itself. Cross-machine synchronization of Lucubro-owned operational state is a later concern.

## Open Questions

These questions are deliberately non-blocking for V1 and should be resolved in the technical plan rather than by changing the product goal:

1. What backend should eventually synchronize Lucubro-owned checkpoint/operational state across machines without polluting the user's normal code diff?
2. Should external issue-tracker reading begin GitHub-first or behind a provider-neutral tracker contract from the first implementation?
3. What default context budget should apply when a repository contains very large context/spec/decision artifacts?

## Product Definitions

### Project

A Project is a durable Work Context that represents a continuing body of work around a repository/workspace and its source-backed operating context.

Project identity belongs to Lucubro. It is independent of any Employee, Worker, Runtime, Run, or provider session.

### Project Source

A Project Source is an artifact that can substantiate durable project context. Examples include project instructions, domain context, ADRs, specs, issue-tracker references/state, and version-control references.

Every surfaced Project Source must retain provenance. Lucubro must be able to explain where the information came from.

### Project Frontier

The Project Frontier is the smallest current description of what remains unresolved or actionable after already-settled context and completed work are excluded.

The Frontier is not a transcript summary. It points to unresolved work, decisions, blockers, or next actions and references the durable evidence behind them.

### Continuation Checkpoint

A Continuation Checkpoint is a compact Lucubro-owned handoff state for resuming the Project. It records continuation facts and references, not a duplicate knowledge base.

At minimum, a checkpoint must be able to represent:

- Status
- Scope
- Exact target
- Completed
- Evidence
- Mutations
- Unfinished
- Next safe action
- Exact references
- Suggested skills or execution capabilities when relevant
- Do not repeat

A checkpoint must never outrank the canonical sources it references.

### Continuation Context

Continuation Context is the bounded, source-backed context Lucubro provides when starting or resuming Project-bound Work. Its purpose is to let a fresh agent participate correctly without requiring prior chat history.

Continuation Context should answer only what the execution needs to act safely and coherently, including the current objective, relevant settled context, governing decisions/specs, current frontier, verified state, and authority boundary.

## Source-of-Truth Hierarchy

When project state disagrees, Lucubro must preserve an explicit precedence model rather than silently choosing whichever source was read last.

1. Current explicit user decisions and durable Lucubro product decisions that have been accepted through the normal authority/review path.
2. Current canonical repository artifacts and version-control state relevant to the Project.
3. Canonical external tracker state when the Project explicitly declares an external tracker.
4. Durable Lucubro Project / Work / Run / Evidence / Decision state.
5. Continuation Checkpoint as a compact index into the sources above.
6. Provider session/thread context as disposable execution context only.

Raw chat history and raw model reasoning are not canonical Project sources.

Uncommitted workspace changes may be observed as current execution evidence, but they must be labeled as uncommitted and must not silently become settled Project semantics.

## User Stories

### US-001 Adopt an existing project

As the CEO, I want Lucubro to recognize useful context already present in a repository, so that I do not have to rebuild project memory by chatting with Alex.

#### Acceptance logic

- Selecting or entering an existing repository can produce a Project context without requiring a separate Project wizard.
- Recognized source artifacts are shown with truthful provenance.
- A repository with no recognized project-context artifacts can still become a Project without fabricated context.
- Discovery does not modify repository files.

### US-002 Continue work after Lucubro restarts

As the CEO, I want a Project to survive a Lucubro process restart, so that restarting the application does not reset what the company knows about the project.

#### Acceptance logic

- Project identity and its Work associations are restored after restart.
- The current Project frontier is recoverable without replaying previous chat.
- Missing provider session state does not prevent Project recovery.

### US-003 Continue with a fresh agent session

As the CEO, I want a new agent session to receive the relevant Project context automatically, so that it can continue the work without asking me to reconstruct previous conversations.

#### Acceptance logic

- A Project-bound execution attempt receives bounded continuation context even when no provider session/thread can be resumed.
- The continuation context contains source references for durable claims.
- A fresh session can identify the current objective, relevant settled constraints, verified prior work, and next frontier from durable state.

### US-004 Keep provider memory disposable

As the product owner, I want provider sessions to remain execution optimizations rather than project memory, so that Claude, Codex, or another runtime can be replaced without losing project continuity.

#### Acceptance logic

- Project identity does not change when the runtime or provider session changes.
- Loss of a provider session may reduce execution convenience but cannot erase Project state.
- Provider-specific ids never become the user-facing identifier for a Project.

### US-005 Preserve canonical project semantics

As the CEO, I want long-lived context such as domain language, decisions, and specs to stay in their canonical project artifacts, so that Lucubro does not create a second conflicting memory system.

#### Acceptance logic

- Lucubro references existing canonical artifacts instead of silently copying them into a parallel editable knowledge store.
- If a source artifact changes, future continuation context reflects the current source and identifies stale checkpoint references.
- A checkpoint cannot override a newer canonical Project Source.

### US-006 Record durable semantic changes through reviewable Work

As the CEO, I want important new project knowledge to become a normal reviewable project mutation, so that "AI memory" is inspectable and reversible.

#### Acceptance logic

- Changes to repository-owned context, decisions, or specs are represented as ordinary Work mutations/evidence.
- Lucubro does not silently alter repository-owned Project Sources merely because an agent inferred a new decision.
- Accept/Rework semantics remain available for project-semantic changes when they are part of Work output.

### US-007 See the Project frontier without reading a transcript

As the CEO, I want to see what is settled and what remains open, so that I can resume a long-running project from its actual state rather than a conversation log.

#### Acceptance logic

- The Project can surface current objective, current/verified state, open decisions or blockers, and next safe action.
- Completed/settled material recedes behind references instead of dominating the default surface.
- The Project frontier is distinguishable from historical activity.

### US-008 Keep Project inside the Company Canvas

As the CEO, I want Project context to appear around the Work while Alex remains my Primary Manager, so that project persistence does not turn Lucubro into a separate project-management product.

#### Acceptance logic

- Project inspection preserves the Company Canvas Shell, Alex relationship, composer, Needs You, and browser-history continuity.
- Project context can be revisited through a stable deep link or restored focus.
- A Project does not require a mandatory top-level navigation item.

### US-009 Reconcile stale continuation state

As the CEO, I want Lucubro to notice when repository/tracker state has changed since the last checkpoint, so that it does not continue from stale assumptions.

#### Acceptance logic

- Changed or missing source references are surfaced as stale/unavailable rather than treated as current truth.
- Lucubro can rebuild continuation context from current durable sources.
- Stale checkpoint content does not silently overwrite newer Project Sources.

### US-010 Preserve truthful boundaries

As the product owner, I want Project persistence to expose only substantiated state, so that durability does not become a pretext for fabricated memory.

#### Acceptance logic

- Lucubro does not claim a decision, completion, verification, issue state, or source exists without evidence.
- Raw chain-of-thought is neither required nor stored for continuation.
- Unavailable external sources remain visibly unavailable rather than being filled from model memory.

## Requirements

- **REQ-001 Durable Project identity:** Lucubro must persist a Project identity independently from Employee, Worker, Runtime, Run, and provider session identity.
- **REQ-002 Project to Work continuity:** Work may be associated with a Project, and the association must survive process restart.
- **REQ-003 Non-destructive discovery:** Lucubro must be able to discover existing Project Sources without modifying the repository during discovery.
- **REQ-004 Matt-style compatibility without lock-in:** Lucubro must recognize common project-context conventions such as `AGENTS.md`, `CONTEXT.md`, ADR/spec directories, and declared issue-tracker guidance when present, while also allowing projects that use other supported layouts.
- **REQ-005 Provenance:** Every durable context claim surfaced from a Project Source must retain enough source identity to be inspected or reconciled.
- **REQ-006 No transcript dependency:** A Project must be resumable without access to prior ChatGPT/Claude/Codex transcripts.
- **REQ-007 No raw reasoning persistence:** Raw model reasoning must not become Project state, continuation state, or Project Source content through Lucubro's persistence layer.
- **REQ-008 Bounded continuation:** Every Project-bound execution attempt must receive a bounded continuation context containing only relevant durable context and current frontier information.
- **REQ-009 Provider independence:** A missing, expired, or replaced provider session must not prevent a new Run from continuing the Project.
- **REQ-010 Checkpoint:** Lucubro must maintain a compact continuation checkpoint that captures current continuation state and references without duplicating the complete contents of canonical Project Sources.
- **REQ-011 Reconciliation:** Lucubro must detect when checkpoint references no longer match current Project Sources and prefer current canonical sources.
- **REQ-012 Semantic write review:** Repository-owned durable project semantics must not be silently changed by background persistence. Proposed semantic mutations must use an inspectable Work path.
- **REQ-013 Honest absence:** Missing domain context, decisions, issues, verification, or external-source availability must be represented as missing/unknown rather than inferred into existence.
- **REQ-014 Canvas continuity:** Project context must be inspectable without replacing the persistent Company Canvas Shell or Primary Manager relationship.
- **REQ-015 Deep-link/reload continuity:** Reloading or deep-linking to Project context must restore the same durable Project identity and meaningful focus state.
- **REQ-016 Authority continuity:** Continuation state does not expand the Delegation Envelope. Project memory and execution authorization remain separate concerns.
- **REQ-017 Runtime gate preservation:** Project Persistence v1 must be fully testable with deterministic mock execution and must not require enabling real Claude/Codex runtimes.
- **REQ-018 Source safety:** Project discovery and context retrieval must respect the declared workspace/project boundary and must not turn persistence into arbitrary host-file access.
- **REQ-019 Stale-state visibility:** When Git, source files, or tracker state materially diverge from a checkpoint, the user/agent must be able to distinguish current evidence from stale continuation data.
- **REQ-020 Semantic portability:** A fresh Lucubro instance pointed at the same Git-tracked Project Sources must be able to reconstruct the project's durable semantic context even when Lucubro-owned local Run history is unavailable.

## Product Behavior

### First encounter with an existing repository

Lucubro should treat repository inspection as context discovery, not as a setup ceremony. If recognizable Project Sources exist, the product may acknowledge that durable project context was found and make it available around current Work.

If no recognizable sources exist, Lucubro must not invent a Project history. The repository can still become a Project, but its semantic context begins sparse and grows only through substantiated user decisions and reviewable Work.

### Work grows into Project context

The user does not need to decide "Project or Quick Task" before expressing intent. Work may begin lightly. When durable repository context, multiple related Work items, continuing frontier state, or explicit user intent makes Project structure relevant, that durable context becomes visible around the Work.

### Returning to a Project

On return, the default recovery experience should prioritize:

- what the current objective is;
- what materially changed since the last continuation point;
- what has been verified;
- what is unresolved;
- what needs the CEO;
- what the next safe action is.

Historical activity and source detail remain inspectable but should not displace the current frontier.

### Starting another Run

Lucubro may resume a provider session when that is safe and available, but session resume is optional. The Project must be able to start a fresh provider execution boundary using durable continuation context.

The user-facing behavior should not imply that Project continuity depends on whether provider-native session resume happened internally.

### Recording a new durable decision

When ongoing Work produces a decision or context change that belongs in repository-owned Project Sources, Lucubro should make that proposed mutation inspectable as part of the Work result/evidence. Persistence is not permission to rewrite canonical project semantics silently.

## Edge Cases

- Workspace path is valid but is not a Git repository.
- Git repository exists but has no recognized Project Sources.
- Repository contains several plausible context/spec files with no declared precedence.
- A previously referenced context/spec/ADR file is renamed or deleted.
- The current Git HEAD changed after the last checkpoint.
- The checkout contains uncommitted changes.
- The same repository exists in more than one local clone/path.
- A provider session id exists but can no longer be resumed.
- External issue-tracker guidance exists but the tracker is temporarily unavailable.
- A Project Source is too large to include fully in bounded continuation context.
- A Project Source points through a symlink or path outside the allowed project/workspace boundary.
- A previous Work references a commit or Evidence item that is no longer locally available.
- A checkpoint says work is complete but current canonical sources or verification evidence do not support that claim.
- A user intentionally changes project direction after an earlier ADR or spec.
- Project semantic context is available from Git-tracked sources on a new machine while Lucubro-local Run history is absent.

## Success Signals

Project Persistence v1 is successful when all of the following are true:

1. A user can adopt an existing context-rich repository without manually reconstructing its history in chat.
2. A Project and its Work associations survive a Lucubro restart.
3. A fresh execution session with no resumable provider thread can continue Project-bound Work from durable sources and current Lucubro state.
4. The fresh session can identify the current objective, relevant settled constraints, verified prior work, unresolved frontier, and next safe action without prior transcript access.
5. Durable claims in the Project experience retain inspectable provenance.
6. Stale checkpoint information cannot override newer canonical source state.
7. No raw transcript or raw model reasoning is required for continuation correctness.
8. Repository-owned semantic changes remain reviewable Work mutations rather than hidden memory writes.
9. Project context can be inspected through the Company Canvas without creating a separate page-centric product shell.
10. The full Project Persistence acceptance path passes with deterministic mock runtime while real Claude/Codex remains paused.
11. A fresh Lucubro instance pointed at the same Git-tracked Project Sources can recover durable semantic context even without the previous machine's provider sessions.

## Acceptance Journey

The highest-value V1 acceptance journey is:

1. Start with a fixture Git repository containing project instructions/context plus at least one durable decision or spec.
2. Let Lucubro discover/adopt the repository as Project context without modifying it.
3. Create Project-bound Work and complete a deterministic mock Run that produces reviewable Evidence.
4. Accept the Work and establish a continuation checkpoint that references the verified result and remaining frontier.
5. Stop Lucubro.
6. Start a fresh Lucubro process.
7. Continue the Project without access to the previous provider session or transcript.
8. Confirm that the fresh execution boundary receives current, source-backed continuation context and can identify the correct next action.
9. Change one canonical Project Source or Git reference.
10. Confirm that Lucubro detects/reconciles stale continuation state instead of continuing from the older checkpoint as if nothing changed.
11. Inspect Project context through the persistent Company Canvas Shell and confirm Alex/composer/Needs You continuity.

Passing this journey proves the intended abstraction:

> Agent sessions are disposable execution state. Project continuity belongs to Lucubro and the Project's durable sources.

## Relationship to Existing Company Workbench V1

`SPEC.md` remains the executable Work/Run/approval vertical slice. Project Persistence v1 extends that model upward rather than replacing it.

The relationship is:

```text
Project
  -> Work
    -> Run
      -> Evidence / approvals / provider execution references
```

Project does not absorb Work or Run. It supplies durable context and continuity around them.

Issue #19 remains the governing product direction. This spec does not change the Company Canvas thesis, Primary Manager model, Work-first default surface, provider-neutral runtime boundary, Delegation Envelope, or the freeze on real-provider execution.

## Traceability

- Issue #19 Project growth direction -> US-001, US-007, US-008 -> REQ-001, REQ-002, REQ-014, REQ-015.
- Existing provider-independence principle in `SPEC.md` -> US-003, US-004 -> REQ-006, REQ-008, REQ-009.
- Existing interaction-honesty / raw-reasoning boundary -> US-005, US-010 -> REQ-005, REQ-007, REQ-013, REQ-019.
- Existing Work/Evidence/Review semantics -> US-006 -> REQ-012.
- Existing Delegation Envelope boundary -> REQ-016.
- Existing real-runtime freeze -> REQ-017.
- Matt-style persistence principle -> US-001, US-003, US-005, US-007, US-009 -> REQ-003, REQ-004, REQ-005, REQ-010, REQ-011, REQ-020.

## Deferred to Plan

The technical plan should decide, without changing the product requirements above:

- the exact Project persistence schema;
- discovery adapters and supported source manifests;
- context selection/budgeting rules;
- checkpoint storage/backend boundaries;
- Git identity and clone/path reconciliation;
- external issue-tracker adapter scope;
- API shape;
- Project Canvas lens projection;
- test fixtures and restart/new-session harness;
- eventual cross-machine Lucubro operational-state transport.
