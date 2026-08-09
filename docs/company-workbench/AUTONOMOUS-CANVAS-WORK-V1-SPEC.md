# Lucubro Autonomous Canvas Work v1

Status: proposed executable product slice
Decision date: 2026-08-09
Governing product direction: issue #19 and `PRODUCT-THESIS.md`
Depends on: `PROJECT-PERSISTENCE-V1-SPEC.md`, `SPEC.md`, `RUNTIME-POLICY.md`
Canonical acceptance journey: Coffee Roast Beginner Guide

## Goal

Make Lucubro capable of taking an ordinary user request, deciding how much structure the work deserves, selecting and mounting the right skills, orchestrating one or more bounded specialist execution attempts when justified, producing source-backed evidence, synthesizing a useful learning experience, and delivering the result as a persistent, exportable, referenceable Canvas Artifact.

The product promise is:

> Ordinary requests can become trustworthy work without forcing ordinary users to think like project managers or agent operators.

A request may remain a lightweight saved Work, become related to prior Work, or grow into a Project over time. Persistence must not imply Project creation, and skill/subrun specialization must not imply durable Employee creation.

All AI execution in this slice is restricted to the operator-approved Codex Luna Max profile. No other model/profile and no Fast mode are permitted.

## Problem Statement

Lucubro already has durable Work, Run, Evidence, Worker, Project persistence foundations, a provider-neutral runtime boundary, a Delegation Envelope, and a semantic Company Canvas direction. The missing layer is autonomous work composition.

For a request such as:

> Explain light, medium, and dark coffee roasting. I am a beginner. What should I understand and how should I buy coffee?

Lucubro must decide, without requiring a setup wizard:

- whether the request is a lightweight Work, related Work, or something that should grow into a Project;
- whether research is required;
- which Skills are relevant and in what order;
- whether one execution attempt is enough or independent specialist subruns are justified;
- which claims require evidence and how that evidence remains inspectable;
- how a teaching methodology should be adapted into the Lucubro Canvas instead of copied as standalone HTML;
- how the result becomes a durable Artifact that can later be exported and referenced;
- how a future related request can find and reuse this Artifact without prematurely creating a Project;
- when repeated related Work becomes substantial enough to promote into Project context;
- how all of the above remains truthful under runtime, authority, provenance, and persistence boundaries.

Without this layer, Lucubro risks becoming either a chat shell that happens to call tools, or an over-structured project-management system that turns every small request into ceremony.

## Scope

Autonomous Canvas Work v1 includes:

- a Luna-only runtime admission contract for every AI Run and specialist subrun;
- a Skill Registry that exposes lightweight skill metadata for selection;
- skill selection and mount receipts that are Lucubro-verifiable rather than model self-report;
- Lucubro-adapted `research-lucubro` and `teach-canvas` skills;
- a Work planning/classification pass that decides research need, skill sequence, staffing shape, evidence expectations, deliverable shape, and durability level;
- bounded manager-style orchestration in which the Primary Manager retains control and may invoke specialist subruns;
- explicit distinction between durable Employees and disposable specialist roles/subruns;
- an Evidence Graph that can connect claims, media, source pages, and Artifacts;
- a semantic Canvas Artifact model that can be rendered interactively and exported to Markdown and PDF;
- stable Artifact/block references that can be reused across Workspaces/Canvases;
- saved Work that can persist independently from Project creation;
- progressive Project promotion when repeated related Work develops a durable objective/frontier;
- disciplined Issue creation only when a Project has genuinely trackable unresolved work;
- a Coffee Roast Beginner Guide acceptance journey that tests the full chain.

## Non-goals

Autonomous Canvas Work v1 does not include:

- automatically creating a Project for every saved request;
- automatically creating an Issue for every task or follow-up;
- creating a durable Employee merely because a specialist skill or subrun is used;
- treating a Skill as a UI component or allowing third-party Skill output to own Lucubro presentation;
- allowing `teach` to directly emit its standalone lesson HTML as the canonical Lucubro Artifact;
- allowing `research` to require a repository Markdown report as the canonical research result;
- making React, HTML, Markdown, or PDF the canonical Artifact representation;
- storing raw provider chain-of-thought or using it as Evidence;
- allowing model self-report to prove which Skill, model, mode, or profile was used;
- using Claude or any non-Codex model in Lucubro AI execution;
- using Codex Fast mode;
- silently falling back when Luna Max/default/non-Fast/full-access attestation is unavailable or mismatched;
- allowing the provider full-access profile to bypass the Lucubro Delegation Envelope;
- implementing a Figma/Freeform-style unconstrained infinite canvas;
- solving cloud collaboration or full multi-user synchronization;
- solving every future Skill hosting format in V1.

## Known Facts

- Issue #19 defines Lucubro as a persistent semantic Company Canvas in which Project structure grows around Work only when needed.
- Quick Task scale is intended to remain lightweight.
- Project Persistence v1 makes Project continuity independent of provider sessions and raw transcripts.
- Current runtime policy approves Codex Luna Max, default mode, Fast disabled, full access, while preserving Lucubro authority semantics above provider permissions.
- The current Codex adapter does not yet attest the exact approved Luna profile, so real runtime use remains gated.
- The existing `research` skill is methodology-rich but host-specific: it expects primary-source research and a Markdown report written into a repository.
- The existing `teach` skill is stateful and methodology-rich but host-specific: it expects a teaching workspace containing mission/resources/records plus standalone HTML lessons/reference documents.
- Lucubro's product direction requires Evidence and Artifact state to remain durable product truth rather than provider transcript output.

## Assumptions

- V1 remains single-user and self-hosted.
- The Primary Manager remains the user-facing orchestrator.
- `research-lucubro` and `teach-canvas` are Lucubro host adapters derived from proven methodologies rather than forks that preserve irrelevant output formats.
- The same approved Codex Luna Max runtime may perform different specialist roles using different bounded contexts and mounted Skills.
- Specialist subruns are execution attempts, not durable Employees unless the product already has a separate durable responsibility reason to create/assign an Employee.
- The Coffee Roast journey is a canary/evaluation fixture, not a hard-coded product vertical.
- Canvas Artifacts may contain a mixture of text, structured comparison, media, simple interaction, evidence links, and learning checks.
- Export fidelity may differ from the live interactive Canvas, but exported content must preserve meaning, provenance, and stable references.

## Open Questions

These are non-blocking for the product goal and should be resolved in the technical plan:

1. What exact attestation fields can Codex app-server expose for Luna Max, default mode, Fast disabled, and full access, and what local preflight is required when the provider does not expose a field directly?
2. What exact threshold/policy should convert repeated related saved Work into an automatic Project promotion suggestion or reversible auto-promotion?
3. What media-rights policy should determine whether a remote image can be embedded into an exported PDF versus linked with provenance only?
4. Which parts of Canvas interaction must have deterministic non-AI renderers in V1 versus model-authored semantic content?
5. Which stable reference URI format should be used for Artifact and block references?

## Product Definitions

### Runtime Admission

Runtime Admission is the Lucubro-owned gate that determines whether an AI execution attempt may start.

For this slice, admission requires the approved Codex profile:

- provider/runtime: Codex;
- profile/model: Luna Max;
- mode: default;
- Fast mode: disabled;
- provider host-access profile: full access;
- Lucubro Delegation Envelope: independently valid for the requested Work.

Unknown or mismatched profile state is a block, not a fallback condition.

### Skill Registry

The Skill Registry is the Lucubro-owned catalog of skills eligible for autonomous selection. The selection surface initially exposes only compact metadata sufficient to decide relevance, not the complete skill body.

### Skill Mount Receipt

A Skill Mount Receipt is durable execution evidence that identifies which Skill was actually made available to a Run/subrun. It must contain enough immutable identity to distinguish the mounted artifact/version from model self-report.

### Work Planning Pass

The Work Planning Pass converts user intent into inspectable execution structure without exposing private chain-of-thought. It may classify:

- task complexity;
- durability level;
- Project/Issue action;
- required Skills and sequence;
- specialist subrun shape;
- Evidence requirements;
- deliverable/Artifact shape;
- authority needs.

The planning result is product state, not hidden reasoning.

### Specialist Subrun

A Specialist Subrun is a bounded execution attempt with a specific role, objective, Skill set, context, and authority envelope. It may be run by the same underlying Luna Max model as the Manager.

A Specialist Subrun is not automatically an Employee.

### Evidence Graph

The Evidence Graph connects claims and Artifact content to inspectable evidence such as source pages, research notes, media provenance, durable Lucubro Evidence, and verified product state.

### Canvas Artifact

A Canvas Artifact is a durable semantic deliverable composed of stable content blocks and evidence/reference edges. It is independent from any particular renderer.

A Canvas Artifact may be rendered as the live Lucubro Canvas, exported to Markdown, or exported to PDF without changing its product identity.

### Artifact Block

An Artifact Block is a stable, referenceable semantic unit within a Canvas Artifact, such as a comparison, image-with-caption, recommendation, decision tree, explanation, quiz, or source/evidence panel.

### Related Work

Related Work is durable Work that references prior Work/Artifacts without requiring a shared Project identity.

### Project Promotion

Project Promotion is the transition from independent/related saved Work into a durable Project context when continued work develops a persistent objective, multiple Work items, accumulating state, or unresolved frontier.

Project Promotion must remain reversible/inspectable and must not be triggered solely because a Work was saved.

## Core Product Principles

1. Skill owns methodology, not UI.
2. Run owns execution, not Project identity.
3. Evidence owns substantiation, not provider prose.
4. Artifact owns the deliverable, not the renderer.
5. Canvas owns presentation, not truth.
6. Work owns one user intent/outcome.
7. Project owns durable shared context for continuing work.
8. Employee owns durable responsibility, not temporary specialization.
9. Provider profile is execution infrastructure, not a user-facing product identity.
10. Persistence does not imply Project creation.

## User Stories

### ACW-US-001 Ordinary request without project ceremony

As a user, I want to ask a normal question without choosing Quick Task versus Project first, so that Lucubro can remain useful for small requests.

Acceptance logic:

- A single coffee-learning request creates durable Work without automatically creating a Project or Issue.
- The Work may still produce persistent Artifacts and Evidence.
- The user can later revisit the Work after reload.

### ACW-US-002 Luna-only execution

As the product owner, I want every AI execution attempt to use the exact approved Codex Luna Max profile, so that tests and production behavior cannot silently drift across models or modes.

Acceptance logic:

- Manager and specialist subruns use Codex Luna Max only.
- Fast mode is never enabled.
- Unknown/mismatched profile state blocks execution.
- No other model/profile is silently substituted.
- Provider full access does not bypass Lucubro authority controls.

### ACW-US-003 Autonomous skill selection

As a user, I want Lucubro to select the right methods for the task, so that I do not need to know skill names.

Acceptance logic:

- The coffee request causes research methodology to be selected because external factual claims require source work.
- Teaching methodology is selected only after enough source-backed knowledge exists to synthesize a beginner learning experience.
- Initial selection operates from compact skill metadata.
- Actual mounted skills produce durable mount receipts.

### ACW-US-004 Skill adaptation rather than output leakage

As the product owner, I want Lucubro to reuse useful methodology without inheriting host-specific output assumptions, so that Skills compose into the Lucubro product.

Acceptance logic:

- `research-lucubro` produces research/evidence suitable for Lucubro rather than requiring a repository Markdown report as the canonical result.
- `teach-canvas` preserves mission grounding, source quality, working-memory restraint, retrieval practice, and progressive learning principles without requiring standalone lesson HTML as the canonical result.
- Third-party Skill instructions cannot replace the Canvas Artifact contract.

### ACW-US-005 Proportional orchestration

As a user, I want Lucubro to use only as much orchestration as the request deserves, so that small requests remain efficient and complex work can still be decomposed.

Acceptance logic:

- The default coffee journey does not create multiple permanent Employees.
- A Manager may invoke one research specialist subrun when useful.
- Additional parallel specialist subruns require a concrete independence/breadth justification.
- Shared-state or tightly sequential work is not parallelized merely to look agentic.

### ACW-US-006 Source-backed research

As a user, I want important factual claims to remain inspectable, so that I can understand why I should trust the result.

Acceptance logic:

- Important roast-level and beginner-buying claims reference Evidence.
- Evidence distinguishes source claims from synthesis/recommendations.
- Media includes source/provenance information and a rights/embedding status when relevant.
- Raw chain-of-thought is never Evidence.

### ACW-US-007 Magazine-like learning deliverable

As a user, I want the answer to teach visually rather than bury me in text, so that a beginner can understand the subject quickly.

Acceptance logic:

- The coffee Artifact combines concise prose, real/source-backed imagery where allowed, comparison structures, and at least one meaningful lightweight interaction or retrieval check when appropriate.
- The live Canvas is not just a long Markdown article rendered inside cards.
- Every material factual block can expose related Evidence without filling the default surface with raw citations.

### ACW-US-008 Durable Canvas Artifact

As a user, I want useful output to remain available even when it is not a Project, so that small but valuable work is not disposable.

Acceptance logic:

- A Canvas Artifact survives reload/restart as part of durable Work.
- Stable block identity allows a specific part of the Artifact to be referenced later.
- Artifact identity does not depend on React component identity, provider session id, or Canvas position.

### ACW-US-009 Export

As a user, I want to export useful Canvas work, so that Lucubro output can leave the application.

Acceptance logic:

- The same canonical Artifact can produce Markdown and PDF exports.
- Export preserves meaningful content structure and provenance.
- Interactive-only behavior degrades truthfully to a static equivalent.

### ACW-US-010 Reuse without premature Project creation

As a returning user, I want a later related request to find my previous coffee work, so that continuity is useful before it becomes formal project management.

Acceptance logic:

- A later related request can locate and reference the prior coffee Artifact.
- The user can continue as Related Work without immediately creating a Project.
- Reused content retains source/evidence references.

### ACW-US-011 Progressive Project promotion

As a user, I want Lucubro to organize recurring related work when structure becomes valuable, so that Project management appears when needed rather than at the first question.

Acceptance logic:

- Repeated coffee Work can be grouped/promoted after a persistent learning objective or multi-Work frontier becomes evident.
- Promotion preserves existing Work/Artifact identities and references.
- A single saved Work is insufficient evidence for Project promotion.

### ACW-US-012 Issue discipline

As a user, I want Issues only when there is something worth independently tracking, so that Lucubro does not turn every idea into ticket bureaucracy.

Acceptance logic:

- The initial coffee request creates no Issue.
- A Project may gain an Issue only for durable unresolved/actionable frontier such as an external dependency, comparison task, follow-up experiment, or tracked decision.

### ACW-US-013 Cross-Canvas reference

As a user, I want to reuse part of an old Artifact in another workspace/canvas, so that useful knowledge composes instead of being copied blindly.

Acceptance logic:

- A stable Artifact/block reference can be attached to another Work/Canvas.
- The reference records whether content is linked/live or captured as a snapshot according to supported V1 behavior.
- Provenance remains inspectable after reuse.

## Requirements

- **ACW-REQ-001 Luna-only admission:** Every AI Run/subrun in this slice must be admitted only when the approved Codex Luna Max profile is attested.
- **ACW-REQ-002 No Fast:** Fast mode must be disabled for every admitted AI execution attempt.
- **ACW-REQ-003 No fallback:** Missing/unknown/mismatched runtime profile data must block execution rather than fall back to another model/profile/mode.
- **ACW-REQ-004 Authority separation:** Provider full access must not expand the Lucubro Delegation Envelope.
- **ACW-REQ-005 Skill metadata discovery:** The planner must be able to choose among eligible Skills from compact metadata before loading full Skill bodies.
- **ACW-REQ-006 Mount attestation:** Actual Skill mounts must produce Lucubro-verifiable identity/version/hash receipts.
- **ACW-REQ-007 Research adapter:** Lucubro must provide a research methodology Skill whose product result is Evidence/research state rather than a mandatory standalone repository Markdown report.
- **ACW-REQ-008 Teach adapter:** Lucubro must provide a teaching methodology Skill that emits/structures Canvas-ready teaching semantics rather than treating standalone HTML lessons as the canonical Lucubro output.
- **ACW-REQ-009 Sequencing:** When source-backed knowledge is required, research must precede teaching synthesis unless current durable Evidence already satisfies the research need.
- **ACW-REQ-010 Inspectable planning:** Work planning/classification results must be represented as public product state without exposing private chain-of-thought.
- **ACW-REQ-011 Proportional staffing:** Specialist subruns may be created when justified, but temporary specialization must not create durable Employees by default.
- **ACW-REQ-012 Manager control:** The Primary Manager must retain the user-facing Work thread while specialist subruns return bounded results/evidence to the Manager.
- **ACW-REQ-013 Evidence graph:** Material factual Artifact claims must be connectable to inspectable Evidence/source references.
- **ACW-REQ-014 Media provenance:** Source-backed media must retain provenance and export/embedding eligibility state.
- **ACW-REQ-015 Semantic Artifact identity:** Canvas Artifact identity must be independent of renderer implementation and Canvas position.
- **ACW-REQ-016 Stable block references:** Artifact blocks required for reuse must have stable identity/reference semantics.
- **ACW-REQ-017 Multi-render export:** One canonical Artifact must support live Canvas rendering and Markdown/PDF export without creating divergent product truth.
- **ACW-REQ-018 Graceful static export:** Interactions must degrade to meaningful static representations in Markdown/PDF.
- **ACW-REQ-019 Saved Work persistence:** Useful Work/Artifacts must persist even when no Project exists.
- **ACW-REQ-020 Related Work continuity:** Future Work must be able to reference/reuse prior Work/Artifacts without Project creation.
- **ACW-REQ-021 Progressive Project promotion:** Project creation/promotion must be based on durable continued-work signals, not merely Artifact existence or a single saved request.
- **ACW-REQ-022 Issue discipline:** Issue creation must require independently trackable unresolved Project frontier, not routine Work decomposition.
- **ACW-REQ-023 Cross-canvas reference:** Artifact/block references must survive cross-Canvas reuse with provenance intact.
- **ACW-REQ-024 No raw reasoning:** Raw model reasoning must not become planning state, Evidence, Artifact content provenance, or Project memory.
- **ACW-REQ-025 Honest skill/runtime evidence:** UI/product state must distinguish selected Skills, actually mounted Skills, requested runtime profile, and attested runtime profile.
- **ACW-REQ-026 Restart continuity:** Saved Work, Canvas Artifact identity, Evidence links, and references must survive Lucubro restart independently of provider sessions.
- **ACW-REQ-027 Project compatibility:** If Work later joins a Project, existing Work/Artifact/Evidence identities must remain stable and the Project Persistence contract must continue to hold.
- **ACW-REQ-028 Canvas continuity:** Artifact inspection and evidence expansion must preserve the persistent Company Canvas shell and Primary Manager relationship.

## Durability Ladder

Lucubro must support at least these conceptual durability levels:

1. Run/Subrun: one execution attempt.
2. Work: one durable user intent/outcome.
3. Canvas Artifact: durable deliverable attached to Work.
4. Related Work: durable relationship between independent Work/Artifacts.
5. Project: durable shared context/frontier across continuing Work.
6. Issue: independently trackable unresolved Project work when justified.

The ladder is not a mandatory linear wizard. The system may recognize relationships over time while preserving existing identities.

## Canonical Coffee Acceptance Journey

The highest-value V1 acceptance journey is:

1. Start Lucubro with real-runtime policy still closed by default.
2. Prove the Runtime Admission layer can independently reject an unattested/non-Luna/Fast-enabled/mismatched Codex configuration.
3. Admit the exact approved Luna Max/default/Fast-disabled/full-access profile under a valid Delegation Envelope.
4. User asks the beginner coffee-roast question with no Project setup.
5. Lucubro forms one durable Work and records an inspectable planning result.
6. The planner identifies that external research is required and selects `research-lucubro` from skill metadata.
7. Lucubro mounts `research-lucubro` and records a mount receipt.
8. Manager runs a bounded research specialist subrun using Luna Max and captures Evidence/source results.
9. Manager determines that beginner teaching synthesis is now appropriate, selects/mounts `teach-canvas`, and records its mount receipt.
10. `teach-canvas` produces Canvas-ready semantic teaching content without using standalone `lessons/*.html` as the canonical deliverable.
11. Lucubro composes a magazine-like Coffee Roast Canvas Artifact containing concise explanation, visual comparison, source-backed media where allowed, beginner buying guidance, evidence links, and a lightweight interaction/retrieval element.
12. The Work completes with inspectable Evidence and the Artifact remains available after reload/restart.
13. Confirm no Project, Issue, or unnecessary permanent Employee was created for this one request.
14. Export the same Artifact to Markdown and PDF and confirm content/provenance remain meaningful.
15. User later asks a related coffee question; Lucubro locates the prior Artifact and creates Related Work/reference continuity without forcing a Project.
16. After enough continued related Work develops a persistent objective/frontier, Lucubro can propose or perform an inspectable Project promotion while preserving prior Work/Artifact identities.
17. A specific Artifact block can be referenced from another Canvas/Work with provenance intact.
18. Throughout the journey, every AI execution attempt is attested as the approved Luna profile and no Fast/other-model fallback occurs.

Passing this journey demonstrates:

> Lucubro can autonomously compose trustworthy work, preserve proportional structure, and turn ordinary intent into durable Canvas output without requiring the user to manage agents, skills, or projects manually.

## Success Signals

Autonomous Canvas Work v1 is successful when all of the following are true:

1. The Coffee Canary passes end-to-end without pre-creating a Project.
2. Every AI Run/subrun in the journey is verifiably admitted as Luna Max/default/Fast-disabled/full-access and remains subject to the Delegation Envelope.
3. Research and teaching Skills are selected from metadata, actually mounted, and independently evidenced.
4. Research precedes synthesis when durable evidence is insufficient.
5. No Skill directly owns the final Lucubro UI format.
6. The result is a semantic Canvas Artifact, not a provider transcript, HTML lesson dump, or Markdown-only report.
7. Material factual claims and media retain inspectable provenance.
8. The same Artifact can render live and export to Markdown/PDF.
9. A single useful Work can remain saved indefinitely without becoming a Project.
10. Later related Work can reuse the prior Artifact before Project promotion.
11. Project promotion happens only when durable continuing-work signals justify shared context/frontier.
12. Specialist subruns do not create unnecessary durable Employees.
13. Cross-Canvas Artifact/block reuse preserves identity and provenance.
14. Restart/provider-session loss does not erase Work, Artifact, Evidence, or reference continuity.

## Relationship to Existing Lucubro Contracts

### Company Canvas / issue #19

This spec extends the Work-first semantic Canvas thesis. It does not create a mandatory Projects dashboard, arbitrary infinite whiteboard, or runtime-first UI.

### Project Persistence v1

Project Persistence remains responsible for durable Project identity, Project Sources, checkpoints, reconciliation, and provider-independent Project continuation. Autonomous Canvas Work decides when ordinary saved Work should remain independent, relate to prior Work, or eventually grow into that Project context.

### Work/Run execution slice

`SPEC.md` continues to define Work/Run/Evidence/approval boundaries. This spec adds a planning/skill/orchestration layer above the Run adapter without making the runtime adapter own Work semantics.

### Runtime Policy

`RUNTIME-POLICY.md` remains authoritative for the approved profile. This spec makes profile admission/attestation a prerequisite for real AI execution rather than weakening the existing gate.

## Traceability

- Issue #19 Work-first / Quick Task / Project-growth direction -> ACW-US-001, ACW-US-010, ACW-US-011, ACW-US-012 -> ACW-REQ-019 through ACW-REQ-022.
- Existing Runtime Policy -> ACW-US-002 -> ACW-REQ-001 through ACW-REQ-004 and ACW-REQ-025.
- Existing research methodology -> ACW-US-003, ACW-US-004, ACW-US-006 -> ACW-REQ-005 through ACW-REQ-009 and ACW-REQ-013.
- Existing teach methodology -> ACW-US-004, ACW-US-007 -> ACW-REQ-008, ACW-REQ-009, ACW-REQ-015 through ACW-REQ-018.
- Existing Employee/Worker/Run distinction -> ACW-US-005 -> ACW-REQ-010 through ACW-REQ-012.
- Existing Evidence/Artifact product truth -> ACW-US-006, ACW-US-008 -> ACW-REQ-013 through ACW-REQ-019 and ACW-REQ-024.
- Project Persistence provider-independent continuity -> ACW-US-008, ACW-US-010, ACW-US-011 -> ACW-REQ-019 through ACW-REQ-027.
- Company Canvas continuity -> ACW-US-007, ACW-US-013 -> ACW-REQ-015 through ACW-REQ-018, ACW-REQ-023, ACW-REQ-028.

## Deferred to Plan

The technical plan should decide, without changing the requirements above:

- Runtime Admission/attestation protocol and adapter seams;
- Skill Registry storage/discovery format;
- Skill Mount Receipt schema and hashing rules;
- Work Planning Pass schema and public event projection;
- manager/subrun APIs and orchestration limits;
- Evidence Graph schema and source/media capture policy;
- exact `research-lucubro` and `teach-canvas` Skill package contents;
- Canvas Artifact IR schema and supported V1 block types;
- live renderer boundaries;
- Markdown/PDF export implementation;
- Artifact/block reference URI and snapshot/live-reference policy;
- Related Work retrieval/matching policy;
- Project promotion scoring/threshold and user undo/override behavior;
- Coffee Canary fixtures, evaluation rubric, and TDD sequence.
