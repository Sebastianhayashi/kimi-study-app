# Plan: Lucubro Autonomous Canvas Work v1

## Goal alignment

- Governing product direction: issue #19 and `PRODUCT-THESIS.md`.
- Feature requirements: `AUTONOMOUS-CANVAS-WORK-V1-SPEC.md` (`ACW-REQ-001` through `ACW-REQ-028`).
- Persistence dependency: `PROJECT-PERSISTENCE-V1-SPEC.md` / PR #27.
- Work/Run boundary: `SPEC.md`.
- Runtime boundary: `RUNTIME-POLICY.md`.
- Generalization canaries: Coffee Roast Beginner Guide and Website Build.

## Reconciliation note

The initial plan incorrectly treated `research-lucubro` and `teach-canvas` as new standalone capability packages. That was the wrong abstraction. Those task-specific adapter Skills have been removed from PR #28.

The corrected architecture is:

```text
approved whole Skill bundles
        ↓
managed versioned roots
        ↓
full metadata catalog
        ↓
Work planner / Skill resolver
        ↓
dependency + compatibility closure
        ↓
lazy Skill mounts with receipts
        ↓
Luna Manager / specialist subruns
        ↓
Evidence + Lucubro Artifact ingestion
        ↓
Company Canvas / export / persistence
```

Host adaptation is a separate compatibility/output layer. It should not duplicate upstream Skill methodology.

## Current facts

- Project persistence backend foundations already exist on the stacked parent branch.
- Real provider execution remains paused by default.
- Current Codex adapter launches `codex app-server`, starts/resumes threads, starts turns, maps public events, routes approvals, collects machine-readable preflight state, and verifies run-scoped Skill mounts before thread start when a mount request is present.
- Current adapter does not yet attest the exact approved Luna Max/default/Fast-disabled/full-access profile end-to-end on the trusted Worker.
- Current official Codex App Server protocol exposes useful machine-verifiable seams including `model/list`, `config/read`, `permissionProfile/list`, `skills/list`, and `skills/extraRoots/set`.
- Matt Pocock's Skill repository and gstack are complete composable Skill ecosystems, not per-task packages.
- Upstream Skills may contain host-specific assumptions about tools, invocation policy, output files, browser automation, or subagents.
- Matt's invocation contract distinguishes user-only Skills from model-invokable Skills. Lucubro must preserve that distinction rather than silently making every catalog entry implicitly callable.

## Assumptions

- The exact provider model id corresponding to the operator label `Luna Max` must be learned/confirmed from the trusted runtime rather than guessed in product code.
- Lucubro should fail closed when a requested profile property cannot be verified.
- Approved Matt/gstack bundles should be available as complete managed roots pinned to exact source state before production use.
- Complete installation does not mean complete prompt injection. Only compact metadata enters routing; only the selected/dependency Skill directories enter a Run-scoped mount view.
- Host differences should be handled through versioned compatibility/output adapters instead of editing or copying upstream Skill source.
- The Manager remains the orchestration owner; specialist roles are subruns unless durable Employee responsibility already exists for an independent reason.

## Technical approach

Deliver tracer-bullet slices. Each slice starts with a failing test at the highest stable boundary and ends with regression gates.

### Slice 0: Luna Runtime Admission

Purpose: make real Codex impossible to start unless the approved execution profile is proven.

- Add a provider-neutral runtime admission result shape with requested profile, observed/attested profile, mismatches, and evidence/provenance.
- Add a Codex-specific profile verifier for Luna Max, default mode, Fast disabled, full access.
- Query/consume Codex App Server machine-readable state rather than trusting model prose:
  - model catalog / selected model;
  - runtime-effective config;
  - permission profile catalog / active profile;
  - service/speed tier state when available.
- Treat any unknown required field as blocked until a deterministic trusted-host preflight proves it.
- Keep `LUCUBRO_ENABLE_REAL_RUNTIMES=1` necessary but no longer sufficient.
- Preserve Delegation Envelope checks after provider admission.
- Place provider execution inside a Lucubro-owned authority boundary so provider full access does not become host-wide authority.

Validation:

- exact profile passes only after trusted-Worker attestation;
- wrong model/profile blocks;
- Fast/speed-tier mismatch blocks;
- missing attestation blocks;
- wrong permission profile blocks;
- explicit real-runtime flag without admission still blocks;
- missing/unenforced product authority boundary blocks before provider spawn;
- mock runtime remains unaffected.

### Slice 1: Managed Skill Bundles

Purpose: make broad reusable capability inventory available without hand-picking Skills for the current task.

- Add durable bundle manifests containing source provider/repository, exact pinned commit, license/provenance, host variant, root digest, and installation state.
- Materialize the complete upstream bundle tree outside user project diffs.
- Use staging + digest verification + atomic activation/rollback.
- For remote pinned bundles, learn root digest from observed exact materialization rather than inventing a pre-download digest.
- Pin initial provider manifests for Matt Pocock skills and gstack.

Validation:

- a fixture bundle retains README/scripts/resources and Skills from multiple paths, not a selected subset;
- digest mismatch never produces a partially active bundle;
- restart reloads the same manifest/provenance;
- exact upstream commit is required.

### Slice 2: Full Skill Catalog + Dependency/Compatibility Graph

Purpose: expose the complete capability inventory to routing while keeping context lean and respecting upstream contracts.

- Recursively index every eligible `SKILL.md` inside every active approved bundle.
- Expose compact metadata only: name, description, version, top-level triggers, allowed tools, bundle/commit, path, content hash, and invocation policy.
- Keep Skill bodies/resources lazy and re-check their content hash when loaded.
- Read both Skill frontmatter and adjacent Codex `agents/openai.yaml` invocation policy. A mismatch fails safe and is diagnostic.
- Preserve user-only upstream policy. User-only Skills may not be silently model-invoked.
- Resolve Skill-to-Skill composition and local resource/script references within bundle boundaries.
- Reject path escape/symlink dependencies.
- Keep compatibility as an exact-version registry with `native`, `overlay-required`, or `blocked`; bundle commit drift invalidates old compatibility policy.

### Slice 3: Work Planner + Skill Resolver + Verified Mount Receipts

Purpose: turn ordinary user intent into a validated Skill graph without exposing Skill ceremony to the user.

- Give the planner the full compact catalog, never all Skill bodies.
- Treat planner output as an untrusted proposal.
- Validate every selected Skill against the current Catalog, compatibility state, invocation policy, and dependency closure.
- Distinguish `model` activation from `user-intent` activation. A user-only Skill may only resolve through an explicit current-user-intent path with an inspectable exact evidence span; it may not be model-activated or pulled implicitly as a dependency.
- Reject planner attempts to fabricate runtime admission, provider-session identity, mounted-Skill receipts, or raw reasoning.
- Build a run-scoped mount view outside the user repo containing the complete directories of selected/dependency Skills only. Do not expose other installed Skill bodies.
- Reject duplicate Skill invocation names inside one mount view.
- On the same `codex app-server` process that executes the Run:
  1. initialize;
  2. set the run-scoped root through `skills/extraRoots/set`;
  3. force `skills/list`;
  4. verify local content hashes, exact paths, expected names, and enabled state;
  5. reject unexpected Skills visible inside the mount root;
  6. emit a Run/Subrun-bound mount receipt;
  7. only then start/resume the thread and start the turn.
- Persist `skill.mounted` through the normal append-only Run event log.

Coffee expected plan:

- durability: saved Work;
- Project: none;
- Issue: none;
- existing research capability selected when evidence is needed;
- teaching capability only when current user intent explicitly authorizes that user-only Skill path;
- evidence: required;
- deliverable: Canvas Artifact.

Website expected plan:

- use the same complete catalog;
- compose existing office-hours/discovery, spec, design/prototype, implementation, review, browser/QA, and delivery capabilities only when justified;
- never create a website-specific Skill to pass the canary.

### Slice 4: Manager + Specialist Subrun orchestration

Purpose: make proportional multi-agent work real without manufacturing Employees.

- Introduce specialist subrun records beneath the owning Work/Manager orchestration state.
- Use the same Luna Runtime Admission, authority boundary, Skill receipts, and Delegation Envelope for every subrun.
- Give each subrun a bounded objective, selected Skill closure, context, and authority envelope.
- Return normalized public result/evidence to the Manager.
- Parallelize only independent breadth work with an explicit planning justification.

### Slice 5: Heterogeneous Skill Output -> Evidence + Artifact Ingestion

Purpose: reuse upstream methodology without inheriting vendor host output as Lucubro product truth.

- Classify upstream results into Evidence, Artifact semantic content, explicit requested file/diff deliverables, authority requests, transient notes, and unsupported host output.
- Keep external source/tool provenance inspectable regardless of which Skill produced it.
- Keep upstream HTML/Markdown/workspace layout from becoming canonical Canvas identity by accident.
- Apply host output transforms as overlays, not source forks.

### Slice 6: Canvas Artifact IR + Renderer + Export

- Introduce canonical Canvas Artifact IR with stable Artifact/block ids and evidence/reference edges.
- Render through Lucubro-owned components.
- Preserve persistent Company Canvas shell, Alex/composer, and Needs You.
- Use source-backed imagery under explicit provenance/embedding policy.
- Export Markdown/PDF from IR, not DOM scraping.
- Give interactions meaningful static fallbacks.

### Slice 7: Related Work + References + Project Promotion

- Add stable Artifact/block references.
- Reuse prior Work/Artifacts without forcing Project creation.
- A single saved Work/Artifact is not enough to promote.
- Project promotion preserves identities and is inspectable/reversible.
- Issues require independently trackable unresolved Project frontier.

### Slice 8: Generalization Canaries

- Coffee Canary proves ordinary knowledge/learning work routes through the full ecosystem without bespoke Coffee Skill.
- Website Build proves discovery/spec/design/implementation/review/QA composition without bespoke Website Skill.
- A third unrelated fixture must require only a new request/eval fixture, not a new task-specific Skill or product branch.

## Key decisions

- **ACW-DEC-001:** `LUCUBRO_ENABLE_REAL_RUNTIMES=1` is an exposure switch, not proof of the approved profile.
- **ACW-DEC-002:** Required runtime profile fields fail closed when unknown.
- **ACW-DEC-003:** Complete upstream bundles are capability inventory; selected closures are execution inputs.
- **ACW-DEC-004:** Upstream Skill source remains intact. Host compatibility/output adaptation is separate and exact-versioned.
- **ACW-DEC-005:** Upstream invocation policy is part of Skill semantics. User-only Skills cannot be silently model-invoked.
- **ACW-DEC-006:** Skill selection and actual mount are separate. Mount requires same-process Lucubro-observed evidence.
- **ACW-DEC-007:** Unselected Skill bodies are not runtime-visible merely because their bundle is installed.
- **ACW-DEC-008:** Specialist subruns are not Employees.
- **ACW-DEC-009:** Work may persist indefinitely without a Project.
- **ACW-DEC-010:** Canvas Artifact IR is canonical; React/Markdown/PDF are projections.
- **ACW-DEC-011:** Evidence edges attach at claim/block level.
- **ACW-DEC-012:** Project promotion is progressive and identity-preserving.
- **ACW-DEC-013:** Real canaries remain gated behind trusted-Worker runtime/authority attestation.

## Validation strategy

- Unit tests for bundle manifests, materialization, catalog metadata/invocation policy, dependency closure, compatibility, mount views, and planner proposal validation.
- Fake App Server tests for machine preflight and same-process Skill mount verification.
- Runtime/orchestrator tests for Run/Subrun-bound `skill.mounted` receipts.
- Coffee and Website planner fixtures must query the same full catalog and may not introduce task-specific Skills.
- Full `npm run check`, `npm test`, and relevant Chromium regression tests before the slice is repository-verified.
- Trusted-Worker evidence before any real Luna smoke is provider-verified.

## Traceability

- ACW-REQ-001..004,027 -> Slice 0.
- ACW-REQ-005..011,028 -> Slices 1/2.
- ACW-REQ-012..014,027,028 -> Slice 3.
- ACW-REQ-015,016 -> Slice 4.
- ACW-REQ-017..019,028 -> Slice 5.
- ACW-REQ-019..021 -> Slice 6.
- ACW-REQ-022..026 -> Slice 7.
- Cross-vertical generalization -> ACW-REQ-012,028 -> Slice 8.

## Out-of-band evidence required before real Luna smoke

Before enabling a real Coffee or Website Canary on the trusted Worker, capture and persist an operator-verifiable receipt containing:

- Codex CLI/app-server version;
- exact runtime model/profile id corresponding to operator-approved `Luna Max`;
- runtime-effective selected model/config;
- active/default mode state;
- Fast/speed-tier state;
- active permission profile/full-access state;
- enforced Lucubro authority-boundary identity/effective policy;
- Delegation Envelope used for Work;
- exact bundle ids/commits/root digests;
- selected Skill identities/content hashes;
- compatibility overlay ids/versions when present;
- same-process Skill mount receipt;
- exact Run/subrun ids.

If installed Codex or the trusted host cannot prove one of these required properties, real execution remains blocked. Do not infer missing properties from model output.
