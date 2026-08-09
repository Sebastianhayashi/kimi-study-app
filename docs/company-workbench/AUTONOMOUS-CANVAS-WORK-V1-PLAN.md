# Plan: Lucubro Autonomous Canvas Work v1

## Goal alignment

- Governing product direction: issue #19 and `PRODUCT-THESIS.md`.
- Feature requirements: `AUTONOMOUS-CANVAS-WORK-V1-SPEC.md` (`ACW-REQ-001` through `ACW-REQ-028`).
- Persistence dependency: `PROJECT-PERSISTENCE-V1-SPEC.md` / PR #27.
- Work/Run boundary: `SPEC.md`.
- Runtime boundary: `RUNTIME-POLICY.md`.
- Canonical acceptance fixture: Coffee Roast Beginner Guide.

## Current facts

- Project persistence backend foundations already exist on the stacked parent branch.
- Real provider execution remains paused by default.
- Current Codex adapter launches `codex app-server`, starts/resumes threads, starts turns, maps public events, and routes approvals.
- Current adapter does not attest the exact approved Luna Max/default/Fast-disabled/full-access profile.
- Current official Codex App Server protocol exposes useful machine-verifiable seams including `model/list`, `config/read`, `permissionProfile/list`, `skills/list`, thread permission/profile projections, and selected skill/capability roots.
- `research-lucubro` and `teach-canvas` Skill packages now define Lucubro-native methodology/output contracts and have passed the Skill validator/package flow.

## Assumptions

- The exact provider model id corresponding to the operator label `Luna Max` must be learned/confirmed from the trusted runtime rather than guessed in product code.
- Lucubro should fail closed when a requested profile property cannot be verified.
- Skill discovery/mounting should use Codex App Server skill APIs/roots where supported rather than relying on prompt claims.
- The Manager remains the orchestration owner; specialist roles are subruns unless durable Employee responsibility already exists for an independent reason.

## Technical approach

Deliver tracer-bullet slices. Each slice starts with a failing test at the highest stable boundary and ends with regression gates.

### Slice 0: Luna Runtime Admission

Purpose: make real Codex impossible to start unless the approved execution profile is proven.

- Add a provider-neutral runtime admission result shape with requested profile, observed/attested profile, mismatches, and evidence/provenance.
- Add a Codex-specific profile verifier for the operator policy: Luna Max, default mode, Fast disabled, full access.
- Query/consume Codex App Server machine-readable state rather than trusting model prose:
  - model catalog / selected model;
  - runtime-effective config;
  - permission profile catalog / active profile;
  - service/speed tier state when available.
- Treat any unknown required field as blocked until a deterministic preflight proves it by an approved alternate source.
- Keep `LUCUBRO_ENABLE_REAL_RUNTIMES=1` necessary but no longer sufficient. Real runtime exposure additionally requires successful admission.
- Preserve Delegation Envelope checks after provider admission.

Validation:

- exact profile passes;
- wrong model/profile blocks;
- Fast/speed-tier mismatch blocks;
- missing attestation blocks;
- wrong permission profile blocks;
- explicit real-runtime flag without admission still blocks;
- mock runtime remains unaffected.

### Slice 1: Skill Registry + Mount Receipt

Purpose: prove the model can select methodology and Lucubro can prove what was actually mounted.

- Add a Skill Registry over approved Lucubro skills with compact metadata and immutable content identity/hash.
- Register `research-lucubro` and `teach-canvas`.
- Expose compact metadata to the Work planning pass.
- Integrate Codex `skills/list` / supported skill roots for actual runtime discovery.
- Add a mount request/receipt containing skill name, source/root, version/content hash, Run/subrun id, and observed mount result.
- Never treat model text such as “I loaded research” as mount evidence.

Validation:

- selection metadata can be listed without loading full bodies;
- mounted skill hash matches registry source;
- unknown/unapproved skill cannot be silently mounted;
- receipt survives Run persistence;
- Manager and subrun receipts remain distinguishable.

### Slice 2: Work Planning Pass

Purpose: convert user intent into inspectable execution structure without exposing chain-of-thought.

- Add a structured planning state above Run creation.
- Inputs: user intent, related durable Work/Artifacts, Project context when present, skill metadata, authority/runtime availability.
- Outputs: complexity, durability class, Project/Issue action, skill sequence, staffing/subrun shape, evidence needs, deliverable type, blocked capabilities.
- Keep planning output compact/public and separate from private reasoning.

Coffee expected plan:

- durability: saved Work;
- Project: none;
- Issue: none;
- skills: research-lucubro -> teach-canvas;
- staffing: Manager + one bounded research specialist subrun;
- evidence: required;
- deliverable: Canvas Artifact.

### Slice 3: Manager + Specialist Subrun orchestration

Purpose: make proportional multi-agent work real without manufacturing Employees.

- Introduce specialist subrun records beneath the owning Work/Manager orchestration state.
- Use the same Luna Runtime Admission for every subrun.
- Give each subrun a bounded objective, skill mounts, context, and Delegation Envelope.
- Return normalized public result/evidence to the Manager.
- Parallelize only independent breadth work with an explicit planning justification.

Validation:

- one simple research subrun does not create an Employee;
- two independent research branches may run in parallel when the plan explicitly requests them;
- tightly sequential research->teach remains sequential;
- subrun failure/blocked authority is visible to Manager without fabricating completion.

### Slice 4: Research Packet -> Evidence Graph

Purpose: convert external investigation into durable, claim-addressable evidence.

- Validate `research-lucubro` packet shape.
- Persist claims/evidence/media candidates as Lucubro-owned normalized state.
- Add claim-to-evidence edges and uncertainty state.
- Keep external locators/provenance inspectable.
- Introduce media rights/embedding eligibility state without guessing permissions.

### Slice 5: Teach Canvas -> Semantic Artifact IR

Purpose: convert source-backed findings into a renderer-neutral learning artifact.

- Validate `teach-canvas` packet shape.
- Introduce a canonical Canvas Artifact IR with stable Artifact id and stable block ids.
- Initial block vocabulary: explanation, comparison, spectrum, sequence, annotated media, decision tree, checklist, retrieval check, callout, source panel, hero.
- Require evidence refs for material factual blocks.
- Keep interactions semantic and require a static fallback.

### Slice 6: Live Canvas renderer

Purpose: deliver the magazine-like “show, don’t tell” experience inside the persistent Company Canvas.

- Render Artifact blocks through owned Lucubro components, not Skill HTML/JSX.
- Preserve Alex/composer/Needs You/context continuity.
- Use real source-backed imagery only when provenance and embedding policy permit it.
- Surface citations/evidence contextually rather than as a wall of URLs.
- Keep motion event/state-driven and reduced-motion equivalent.

### Slice 7: Markdown + PDF export

Purpose: make the same canonical Artifact portable.

- Build exporters from Artifact IR, not by scraping rendered DOM.
- Preserve headings, comparisons, captions, stable references, and evidence/source appendix.
- Replace live interactions with meaningful static states/instructions.
- Apply media embedding policy consistently.

### Slice 8: Related Work + Reference Graph

Purpose: preserve useful continuity below Project level and enable cross-Canvas reuse.

- Add stable Artifact/block reference semantics.
- Allow new Work to reference old Artifact/block state with provenance.
- Support a V1 snapshot/reference mode with explicit semantics.
- Add retrieval/linking based on user intent and durable state; do not silently mutate old Artifacts.

### Slice 9: Progressive Project promotion + Issue discipline

Purpose: organize repeated continuing work only when structure pays for itself.

- Define promotion signals: repeated related Work, persistent objective, accumulating durable state, unresolved frontier, explicit user request.
- A single saved Work or Artifact is never enough.
- Promotion preserves Work/Artifact/Evidence identities.
- Issue creation requires independently trackable unresolved Project frontier.
- Promotion/auto-organization must be inspectable and reversible.

### Slice 10: Coffee Canary full acceptance

Run the canonical journey through the real product seam:

ordinary request -> admitted Luna Manager -> plan -> research skill selection/mount -> research subrun -> Evidence -> teach skill mount -> semantic Artifact -> live Canvas -> restart -> export -> later related request -> reference reuse -> eventual Project promotion threshold.

The first real-provider Coffee Canary may run only after Slice 0 admission is verified on the trusted Codex host.

## Key decisions

- **ACW-DEC-001:** `LUCUBRO_ENABLE_REAL_RUNTIMES=1` is an exposure switch, not proof of the approved profile.
- **ACW-DEC-002:** Required runtime profile fields fail closed when unknown.
- **ACW-DEC-003:** Skill selection and Skill mount are separate states. Mount requires Lucubro-observed evidence.
- **ACW-DEC-004:** `research-lucubro` and `teach-canvas` are methodology adapters, not renderers.
- **ACW-DEC-005:** Specialist subruns are not Employees.
- **ACW-DEC-006:** Work may persist indefinitely without a Project.
- **ACW-DEC-007:** Canvas Artifact IR is canonical; React/Markdown/PDF are projections.
- **ACW-DEC-008:** Evidence edges attach at claim/block level.
- **ACW-DEC-009:** Project promotion is progressive and identity-preserving.
- **ACW-DEC-010:** Real Coffee Canary is gated behind runtime admission; earlier slices use deterministic/fake app-server tests.

## First TDD sequence

1. Add failing tests for a pure Codex profile verifier.
2. Implement the minimal verifier until those tests pass.
3. Add failing adapter tests proving `available()`/preflight blocks unless machine-readable profile evidence satisfies policy.
4. Integrate runtime admission into policy exposure so real-runtime flag alone cannot bypass it.
5. Run static + full Node suite.
6. Only then implement Skill Registry/mount tests.

## Traceability

- ACW-REQ-001..004,025 -> Slice 0 -> runtime admission/verifier/adapter/policy tests.
- ACW-REQ-005..009 -> Slice 1 and Slice 4/5 -> skill registry, mount receipts, adapter contracts.
- ACW-REQ-010..012 -> Slice 2/3 -> planning and subrun orchestration.
- ACW-REQ-013..014,024 -> Slice 4 -> Evidence Graph.
- ACW-REQ-015..018,028 -> Slice 5/6/7 -> Artifact IR/render/export.
- ACW-REQ-019..023,026..027 -> Slice 8/9/10 -> persistence/reference/promotion/restart acceptance.

## Out-of-band evidence required before real Luna smoke

Before enabling a real Coffee Canary on the trusted Worker, capture and persist an operator-verifiable receipt containing:

- Codex CLI/app-server version;
- exact runtime model/profile id corresponding to the operator-approved `Luna Max` label;
- runtime-effective selected model/config;
- active/default mode state;
- Fast/speed-tier state;
- active permission profile/full-access state;
- Lucubro Delegation Envelope used for the Work;
- mounted skill identities/hashes;
- exact Run/subrun ids.

If the installed Codex version cannot expose one of these required properties through app-server/config/catalog state, add a deterministic trusted-host preflight source or keep real execution blocked. Do not infer the missing property from model output.
