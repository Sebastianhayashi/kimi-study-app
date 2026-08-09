# Lucubro Autonomous Canvas Work v1

Status: proposed executable product slice
Decision date: 2026-08-09
Governing product direction: issue #19 and `PRODUCT-THESIS.md`
Depends on: `PROJECT-PERSISTENCE-V1-SPEC.md`, `SPEC.md`, `RUNTIME-POLICY.md`
Canonical acceptance journeys: Coffee Roast Beginner Guide and Website Build

## Goal

Make Lucubro the automation layer over a broad, pre-installed Skill ecosystem so users can state an outcome without learning Skill names, slash commands, agent prompts, staffing patterns, or project-management ceremony.

The product promise is:

> The user asks for the outcome. Lucubro discovers, composes, mounts, and supervises the right existing capabilities behind the Canvas.

Lucubro must consume complete managed Skill bundles such as Matt Pocock's engineering skills and gstack, plus other approved bundles over time. It must not require a new Lucubro-specific Skill to be authored whenever a new user task appears.

A request may remain lightweight saved Work, become related to earlier Work, or grow into Project context over time. Persistence does not imply Project creation. Temporary Skill specialization does not imply durable Employee creation.

All AI execution in this slice is restricted to the operator-approved Codex Luna Max profile. No other model/profile and no Fast mode are permitted.

This spec supersedes the earlier task-specific interpretation in which `research-lucubro` and `teach-canvas` were proposed as standalone replacement Skills. Host adaptation belongs in Lucubro's compatibility/output layer unless a genuinely new reusable methodology is missing from the installed ecosystem.

## Problem Statement

Lucubro already has durable Work, Run, Evidence, Worker, Project persistence foundations, a provider-neutral runtime boundary, a Delegation Envelope, and a semantic Company Canvas direction. The missing layer is a general Skill operating system.

A user should not need to know that a coffee question may require research and teaching methods, or that a website project may benefit from office-hours discovery, specification, design review, implementation, browser QA, code review, or release checks. Those workflows already exist in mature Skill ecosystems.

If Lucubro responds to every new category by writing another bespoke Skill, the product fails its core purpose. It merely moves prompt engineering from the user to the Lucubro developer and cannot generalize to tomorrow's task.

Lucubro therefore needs to answer these questions for arbitrary Work:

- Which installed Skill bundles are available on this Worker?
- Which individual Skills are relevant to this request?
- Which Skill bodies and dependencies must be mounted now, and which can remain unloaded?
- Which Skill sequences are ordered dependencies and which branches can run independently?
- Which Skill assumptions are compatible with Codex default mode and Lucubro tools?
- How should host-specific assumptions be adapted without forking the Skill methodology?
- When does one Luna execution suffice, and when should bounded specialist subruns be used?
- How are Skill selection and actual mount proven independently from model prose?
- How do outputs become Evidence and Canvas Artifacts instead of leaking third-party UI/file conventions into the product?
- How does useful Work persist without being forced into a Project?

## Scope

Autonomous Canvas Work v1 includes:

- Luna-only runtime admission for every AI Run and specialist subrun;
- managed whole-bundle installation and pinning for approved Skill ecosystems;
- initial approved bundles covering Matt Pocock skills and gstack, with room for additional providers;
- a Skill Bundle Manifest recording source, pinned ref/commit, license, host variant, digest, and materialized root;
- a Skill Catalog that indexes every eligible `SKILL.md` entrypoint from installed bundles using compact metadata;
- lazy body/resource loading so complete bundles can be installed without flooding model context;
- Skill dependency and capability resolution;
- a host compatibility layer that classifies Skills as native, overlay-required, or blocked for the active Codex/Lucubro environment;
- thin versioned compatibility overlays for host/tool/output mismatches without copying whole upstream Skills;
- optional use of upstream router/meta-skills such as bundle-provided routers while retaining Lucubro receipts;
- autonomous Skill selection, sequencing, and mount receipts;
- a Work planning/classification pass that decides durability, Skill graph, staffing/subruns, Evidence expectations, deliverable shape, and authority needs;
- bounded manager-style orchestration in which the Primary Manager retains user-facing control and may invoke specialist subruns;
- explicit distinction between durable Employees and disposable specialist roles/subruns;
- an Evidence Graph connecting claims, media, source pages, tool results, and Artifacts;
- a semantic Canvas Artifact model owned by Lucubro, independent from third-party Skill output formats;
- Markdown/PDF export and stable Artifact/block references;
- saved Work below Project level, Related Work continuity, progressive Project promotion, and disciplined Issue creation;
- at least two generalization canaries: a simple knowledge task and a multi-stage website-building task.

## Non-goals

Autonomous Canvas Work v1 does not include:

- authoring one new Lucubro Skill per user task category;
- replacing complete upstream bundles with a small hand-picked subset hard-coded for the Coffee Canary;
- flattening an entire Skill ecosystem into one giant `SKILL.md`;
- eagerly loading every installed Skill body into every Run;
- rewriting third-party Skill methodology merely because its original host has different UI or file conventions;
- automatically creating a Project for every saved request;
- automatically creating an Issue for every task or follow-up;
- creating a durable Employee merely because a specialist Skill or subrun is used;
- allowing a third-party Skill to own Lucubro navigation, Canvas rendering, or canonical product identity;
- making React, HTML, Markdown, PDF, or a vendor-specific file tree the canonical Artifact representation;
- storing raw provider chain-of-thought or using it as Evidence;
- allowing model self-report to prove Skill mounts, runtime profile, or tool execution;
- using Claude or any non-Codex model in Lucubro AI execution;
- using Codex Fast mode;
- silently falling back when Luna Max/default/non-Fast/full-access attestation is unavailable or mismatched;
- allowing provider full access to bypass the Lucubro Delegation Envelope;
- implementing a Freeform/Figma-style unconstrained infinite canvas;
- solving cloud collaboration or full multi-user synchronization in V1.

## Known Facts

- Issue #19 defines Lucubro as a persistent semantic Company Canvas in which Project structure grows around Work only when needed.
- Project Persistence v1 makes durable Project semantics independent of provider sessions and raw transcripts.
- Current runtime policy approves Codex Luna Max, default mode, Fast disabled, full access, while preserving Lucubro authority semantics above provider permissions.
- The current Codex adapter does not yet attest the complete approved Luna profile, so real runtime use remains gated.
- Matt Pocock's skills are explicitly designed to be small, composable, and installable as a complete skill set. The bundle also contains router/setup concepts for choosing among the set.
- gstack ships a broad specialist workflow set including product discovery, specification, engineering/design review, browser/QA, release, and supporting tools. It supports Codex as a host but some individual assumptions can still require host compatibility handling.
- Both initial upstream repositories are MIT-licensed, so managed vendoring or pinned installation is technically possible subject to normal attribution/packaging policy.
- Codex App Server exposes skill discovery/root APIs that can support machine-observable mounted capability state.

## Assumptions

- V1 remains single-user and self-hosted.
- The trusted Worker can materialize complete approved Skill bundles into Lucubro-managed roots.
- Bundles are pinned for deterministic behavior and updated deliberately rather than tracking upstream `main` invisibly during a Run.
- The Primary Manager remains the user-facing orchestrator.
- The same approved Luna Max runtime may perform different specialist roles using different bounded contexts and mounted Skills.
- A host compatibility overlay is separate from upstream Skill content and records the upstream version it adapts.
- A compatibility overlay should be generic by host/capability/output mismatch wherever possible, not task-specific.
- Coffee is a simple canary. Website Build is a broader canary intended to prove the architecture generalizes beyond one workflow.

## Open Questions

1. Should approved bundles ship vendored with Lucubro releases, be materialized on first setup from pinned Git commits, or support both modes?
2. What exact Codex App Server fields can prove Luna Max/default/Fast-disabled/full-access, and what trusted-host receipt is required for fields the provider does not expose directly?
3. How should static Skill dependencies be inferred when a bundle does not declare them in machine-readable metadata?
4. Which compatibility differences can be solved by a generic host capability adapter versus a small versioned Skill-specific overlay?
5. Which bundle updates can be accepted automatically after compatibility tests and which require operator review?
6. What exact threshold should promote Related Work into a Project?
7. What media-rights policy determines whether remote media may be embedded in exported PDF output?

## Product Definitions

### Skill Bundle

A Skill Bundle is a managed collection of upstream or local Skills materialized as one versioned capability source. A bundle retains its own individual Skill entrypoints and resources.

Minimum identity:

- `bundleId`;
- source repository/provider;
- pinned ref/commit/version;
- license/provenance;
- host variant when the provider generates host-specific Skills;
- root/content digest;
- installation/update state.

### Skill Catalog

The Skill Catalog is the Lucubro-owned index over all eligible Skills in all approved bundles. It exposes compact metadata for routing without loading every body.

A catalog row should retain at least bundle identity, skill name, description, entrypoint, content hash, dependency/capability metadata when known, and compatibility state.

### Skill Resolver

The Skill Resolver converts a Work objective plus current durable context into a candidate/selected Skill graph. It may select one Skill, a sequence, a router/meta-skill, or several independent branches.

The resolver is not hard-coded to Coffee, websites, or any fixed vertical.

### Dependency Closure

Dependency Closure is the minimum set of selected Skills, referenced Skills, scripts/resources, and required capability roots needed for one Run/subrun. The whole bundle remains installed, while only the closure is activated/loaded for the execution.

### Host Compatibility Layer

The Host Compatibility Layer adapts Skill assumptions to the Lucubro Codex host without cloning the whole Skill.

Examples include:

- mapping unsupported user-question mechanisms to Lucubro Needs You/request-input behavior;
- mapping browser/tool assumptions to an available Lucubro/Codex capability;
- translating host-specific final-output conventions into Lucubro Evidence/Artifact ingestion;
- blocking a Skill when a required capability cannot be truthfully provided.

Compatibility state is `native`, `overlay-required`, or `blocked` and must be version/provenance aware.

### Skill Mount Receipt

A Skill Mount Receipt is durable execution evidence identifying what was actually available to a Run/subrun. It must include Skill/bundle identity, pinned source/hash, execution identity, mount root/method, observed runtime state, and compatibility overlay identity when one was applied.

### Work Planning Pass

The Work Planning Pass converts user intent into inspectable execution structure without exposing private chain-of-thought. It may classify:

- complexity;
- durability level;
- Project/Issue action;
- selected Skill graph;
- specialist subrun shape;
- Evidence requirements;
- deliverable/Artifact shape;
- authority and unavailable-capability needs.

### Specialist Subrun

A Specialist Subrun is a bounded execution attempt with a specific objective, Skill closure, context, and Delegation Envelope. It may use the same Luna Max model as the Manager and is not automatically a durable Employee.

### Evidence Graph

The Evidence Graph connects Artifact claims/content to inspectable source pages, tool results, research findings, media provenance, durable Lucubro Evidence, and verified product state.

### Canvas Artifact

A Canvas Artifact is a durable semantic deliverable composed of stable content blocks and evidence/reference edges. Third-party Skill outputs can inform or produce inputs to the Artifact, but the Skill does not own its renderer or product identity.

### Related Work and Project Promotion

Related Work can reference earlier Work/Artifacts without a Project. Project Promotion occurs only when continued work develops a persistent objective, multiple Work items, accumulating state, or unresolved frontier.

## Core Product Principles

1. Whole Skill ecosystems are installed as capability inventory; individual Skills are mounted lazily.
2. The user never needs to learn the Skill inventory to get value from it.
3. Upstream Skill methodology remains upstream; Lucubro host adaptation remains a separate layer.
4. New task categories should normally require routing, not new Skill authoring.
5. Skill selection and actual mount are different states and require different evidence.
6. Skill owns methodology, not Lucubro UI.
7. Run owns execution, not Project identity.
8. Evidence owns substantiation, not provider prose.
9. Artifact owns the deliverable, not the renderer.
10. Work may persist indefinitely without becoming a Project.
11. Employee owns durable responsibility, not temporary specialization.
12. Provider profile is execution infrastructure, not product identity.

## User Stories

### ACW-US-001 Outcome-first use

As a user, I want to ask for an outcome without knowing Skill names, so that Lucubro removes prompt/agent workflow expertise from the user journey.

Acceptance:

- Coffee and website requests begin from ordinary language.
- The user is not asked to choose from Matt/gstack Skill menus before Work can form.
- The selected Skill graph remains inspectable after the fact.

### ACW-US-002 Luna-only execution

As the product owner, I want every AI execution attempt to use the exact approved Luna profile, so runtime behavior cannot silently drift.

### ACW-US-003 Complete bundle availability

As a user, I want Lucubro to have broad capabilities already available, so a new type of task does not require developers to author another one-off Skill first.

Acceptance:

- Approved complete bundles are materialized and indexed.
- Adding Website Build does not require creating `website-lucubro` or cloning gstack skills.
- New upstream Skills become available through a controlled bundle update/index cycle.

### ACW-US-004 Autonomous Skill routing

As a user, I want Lucubro to select and compose the appropriate installed Skills for my request, so I do not need to learn slash commands or workflow order.

Acceptance:

- Routing operates from the complete catalog metadata.
- Only selected bodies/dependencies are loaded for a Run.
- The resolver can choose different graphs for simple and complex Work.

### ACW-US-005 Host adaptation without forks

As the product owner, I want useful upstream Skill methodology preserved while incompatible host assumptions are adapted separately, so the ecosystem remains upgradeable.

Acceptance:

- Upstream Skill files remain source-identifiable.
- Compatibility overlays are small, versioned, and independently inspectable.
- A blocked capability is surfaced rather than improvised.

### ACW-US-006 Proportional orchestration

As a user, I want Lucubro to use only as much orchestration as the Work deserves, so small Work stays efficient and complex Work can use specialists.

### ACW-US-007 Trustworthy Evidence

As a user, I want material factual claims and external media to remain inspectable, regardless of which Skill produced them.

### ACW-US-008 Canvas deliverable

As a user, I want the final result in Lucubro's semantic Canvas rather than a pile of vendor-specific reports/files, unless I explicitly requested those files as deliverables.

### ACW-US-009 Durable lightweight Work

As a user, I want useful output to persist even when it is not a Project.

### ACW-US-010 Reuse before Project

As a returning user, I want later Work to find/reference useful earlier Artifacts before Project structure is justified.

### ACW-US-011 Progressive Project promotion

As a user, I want Project structure to appear when continued Work needs it, not because any Skill happened to create a file or checkpoint.

### ACW-US-012 Cross-Canvas reference and export

As a user, I want Artifact/block references and Markdown/PDF export to preserve meaning and provenance across Workspaces/Canvases.

### ACW-US-013 Broad workflow generalization

As a user, I want the same automation substrate to handle a multi-stage website task, so the system proves it is not a Coffee-specific demo.

Acceptance:

- The planner can discover relevant upstream product-discovery, specification, design/prototyping, implementation, review, browser/QA, and delivery capabilities from installed bundles.
- Lucubro may use `office-hours`, spec/review/design/QA-style Skills when they fit the Work, without the user naming them.
- The exact graph is evidence-driven and may omit unnecessary stages.

## Requirements

- **ACW-REQ-001 Luna-only admission:** Every AI Run/subrun must be admitted only under the exact approved Codex Luna Max profile.
- **ACW-REQ-002 No Fast:** Fast mode must be disabled for every admitted AI execution attempt.
- **ACW-REQ-003 No fallback:** Missing/unknown/mismatched runtime profile data must block execution.
- **ACW-REQ-004 Authority separation:** Provider full access must not expand the Lucubro Delegation Envelope.
- **ACW-REQ-005 Managed bundles:** Lucubro must materialize approved complete Skill bundles as versioned managed capability roots.
- **ACW-REQ-006 Bundle provenance:** Every bundle must retain source, pinned version/ref, digest, license/provenance, and host-variant identity.
- **ACW-REQ-007 Full catalog indexing:** The Skill Catalog must index all eligible Skill entrypoints in each approved bundle rather than a hand-picked Coffee subset.
- **ACW-REQ-008 Progressive loading:** Routing may use compact metadata first and must not eagerly inject all Skill bodies into context.
- **ACW-REQ-009 Dependency closure:** Selected Skills must expand to the minimum required dependency/resource/capability closure.
- **ACW-REQ-010 Compatibility classification:** Every selected Skill must be native, overlay-required, or blocked for the active host/version.
- **ACW-REQ-011 Overlay separation:** Host compatibility overlays must remain separate from upstream Skill source and retain provenance/version applicability.
- **ACW-REQ-012 General routing:** Work planning must select Skills from the catalog without requiring new task-specific Skill authoring for ordinary new categories.
- **ACW-REQ-013 Mount attestation:** Actual mounted Skills must produce Lucubro-verifiable bundle/skill/hash/execution receipts.
- **ACW-REQ-014 Inspectable planning:** Skill graph/staffing/durability/deliverable decisions must be public product state without raw chain-of-thought.
- **ACW-REQ-015 Proportional staffing:** Specialist subruns may be created when justified but must not create durable Employees by default.
- **ACW-REQ-016 Manager control:** The Primary Manager retains the user-facing Work while specialists return bounded results/Evidence.
- **ACW-REQ-017 Evidence graph:** Material factual Artifact claims must be connectable to inspectable source/tool Evidence.
- **ACW-REQ-018 Media provenance:** Source-backed media must retain provenance and export/embedding eligibility state.
- **ACW-REQ-019 Artifact ownership:** Third-party Skill output must be ingested into Lucubro-owned Artifact/Evidence contracts rather than becoming canonical UI state directly.
- **ACW-REQ-020 Semantic Artifact identity:** Canvas Artifact and stable block identity must be renderer-independent.
- **ACW-REQ-021 Multi-render export:** One canonical Artifact must support Canvas, Markdown, and PDF projections with truthful static fallbacks.
- **ACW-REQ-022 Saved Work persistence:** Useful Work/Artifacts must persist even when no Project exists.
- **ACW-REQ-023 Related Work continuity:** Future Work can reference/reuse prior Work/Artifacts without Project creation.
- **ACW-REQ-024 Progressive Project promotion:** Project creation/promotion depends on durable continuing-work signals, not one saved request.
- **ACW-REQ-025 Issue discipline:** Issues require independently trackable unresolved Project frontier.
- **ACW-REQ-026 Cross-Canvas reference/restart:** Artifact/block references, Evidence links, and saved Work identities survive reuse and restart independently of provider sessions.
- **ACW-REQ-027 Honest runtime/Skill evidence:** Product state distinguishes catalog availability, selected Skills, mounted Skills, requested runtime profile, and attested runtime profile.
- **ACW-REQ-028 No raw reasoning or per-task authoring dependency:** Raw chain-of-thought is never product state, and V1 success must not depend on authoring new bespoke Skills for each acceptance task.

## Durability Ladder

1. Run/Subrun: one execution attempt.
2. Work: one durable user intent/outcome.
3. Canvas Artifact: durable deliverable attached to Work.
4. Related Work: durable relationship between independent Work/Artifacts.
5. Project: durable shared context/frontier across continuing Work.
6. Issue: independently trackable unresolved Project work when justified.

This ladder is not a setup wizard.

## Canary A: Coffee Roast Beginner Guide

1. User asks a beginner coffee-roast/buying question with no Skill or Project terminology.
2. Lucubro forms one saved Work and queries the full Skill Catalog.
3. Planner selects an appropriate research/browsing capability from installed bundles or existing approved local capabilities, plus a teaching/explanation capability when evidence is sufficient.
4. Selected Skills are mounted from their original managed bundles and produce mount receipts.
5. Any host-specific output assumption is adapted through the compatibility/output layer rather than by replacing the upstream Skill with a Coffee-specific fork.
6. Research/tool results become Evidence.
7. Synthesis becomes a source-backed, magazine-like Canvas Artifact.
8. Reload/export/reuse work while no Project or Issue is created for the single request.

Passing proves lightweight autonomous composition.

## Canary B: Website Build

1. User asks Lucubro to develop a website from an outcome-level brief without naming Skills.
2. Planner queries the same complete Skill Catalog, not a website-specific hard-coded menu.
3. When appropriate, the selected graph may include upstream office-hours/product discovery, specification, design/prototype review, implementation, code review, browser/QA, and delivery capabilities.
4. Skill dependencies/resources are mounted lazily from their bundles with compatibility and mount receipts.
5. Luna may use bounded specialist subruns when independent breadth justifies them, but temporary roles do not create permanent Employees.
6. The Work may grow into Project context because it is multi-stage and persistent, but Project promotion is a separate durability decision from Skill routing.
7. Intermediate Evidence/Artifacts and final Canvas/deliverables remain Lucubro-owned and inspectable.

Passing proves that the architecture generalizes beyond Coffee without creating new per-task Skills.

## Success Signals

Autonomous Canvas Work v1 succeeds when:

1. Complete approved Matt/gstack bundles are available as managed versioned roots.
2. The catalog indexes the full eligible inventory while only relevant Skill bodies are loaded per execution.
3. Coffee passes without custom Coffee Skills or Project ceremony.
4. Website Build passes without creating a new website-specific Skill package.
5. Skill selection and actual mount are separately evidenced.
6. Host incompatibilities are handled by explicit overlays or blocks, not silent improvisation.
7. Every AI execution is admitted as Luna Max/default/Fast-disabled/full-access and remains subject to the Delegation Envelope.
8. Specialist subruns remain proportional and do not manufacture Employees.
9. Evidence and Artifact identity remain independent of provider sessions and vendor output formats.
10. Saved Work can persist/reuse before Project promotion.
11. Canvas/Markdown/PDF projections derive from one canonical Artifact state.
12. A bundle update can be pinned, tested, rolled forward/back, and traced to exact upstream content.

## Relationship to Existing Lucubro Contracts

### Company Canvas / issue #19

The Canvas remains the persistent product shell. Skill ecosystems are backstage capability infrastructure, not navigation.

### Project Persistence v1

Project Persistence remains responsible for Project identity, source-backed continuation, checkpoints, and reconciliation. Skill routing does not force Project creation.

### Work/Run execution slice

`SPEC.md` continues to define Work/Run/Evidence/approval boundaries. Autonomous Canvas Work adds bundle/catalog/resolver/orchestration layers above runtime adapters.

### Runtime Policy

`RUNTIME-POLICY.md` remains authoritative. Bundle breadth does not permit alternate models or Fast mode.

## Traceability

- Outcome-first Company Canvas -> ACW-US-001,003,004,013 -> ACW-REQ-005..014,028.
- Existing Runtime Policy -> ACW-US-002 -> ACW-REQ-001..004,027.
- Matt/gstack composable bundle model -> ACW-US-003..005,013 -> ACW-REQ-005..013,028.
- Existing Employee/Worker/Run distinction -> ACW-US-006 -> ACW-REQ-015,016.
- Existing Evidence/Artifact truth -> ACW-US-007,008,012 -> ACW-REQ-017..021,026.
- Project Persistence -> ACW-US-009..011 -> ACW-REQ-022..026.

## Deferred to Plan

The technical plan should decide:

- bundle materialization/update/rollback mechanism;
- initial pinned Matt/gstack source refs;
- catalog and dependency/capability schema;
- compatibility-overlay registry and precedence;
- Codex `skills/list` / skill-root integration and mount receipt schema;
- Runtime Admission/attestation protocol;
- Work Planning Pass and Skill graph schema;
- specialist subrun orchestration limits;
- Evidence ingestion contracts across heterogeneous Skills;
- Canvas Artifact IR/render/export contracts;
- Related Work/reference/promotion policy;
- Coffee and Website Build evaluation fixtures and TDD sequence.