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
- Current Codex adapter launches `codex app-server`, starts/resumes threads, starts turns, maps public events, and routes approvals.
- Current adapter does not yet attest the complete approved Luna Max/default/Fast-disabled/full-access profile.
- Current Codex App Server exposes useful machine-verifiable seams including `model/list`, `config/read`, `permissionProfile/list`, `skills/list`, skill roots, and thread profile projections.
- Matt Pocock's repository is distributed as a complete composable Skill set and contains routing/setup patterns over that set.
- gstack ships a broad specialist workflow library and supports Codex as a host, while some individual Skill assumptions can still require host-specific compatibility handling.
- Both initial upstream repositories are MIT licensed.
- Task-specific `research-lucubro` / `teach-canvas` Skill packages have been removed from the feature branch.

## Assumptions

- The exact provider model id corresponding to the operator label `Luna Max` must be confirmed from the trusted runtime and never guessed in product code.
- Lucubro fails closed when a required runtime property cannot be verified.
- Complete approved Skill bundles are installed/materialized once, while individual Skill bodies/resources are loaded only when selected.
- Upstream Skill content remains source-identifiable and pinned.
- The Manager remains the orchestration owner; temporary specialist roles are subruns unless durable Employee responsibility independently exists.
- Host compatibility overlays are smaller than the upstream Skill and record the bundle/Skill versions they apply to.
- The planner may use an upstream router/meta-skill when useful, but Lucubro still records selected/mounted downstream capability evidence.

## Technical approach

Deliver tracer-bullet slices. Each slice starts with failing tests at the highest stable boundary and ends with regression gates.

### Slice 0: Luna Runtime Admission

Purpose: make real Codex impossible to start unless the approved execution profile is proven and Lucubro authority remains effective.

Existing completed work:

- pure fail-closed Luna profile verifier;
- runtime policy no longer treats `LUCUBRO_ENABLE_REAL_RUNTIMES=1` as sufficient;
- non-Codex real providers remain blocked for this slice.

Remaining:

- collect app-server machine state for model/config/permission/speed/default-mode evidence;
- capture trusted Worker receipt for the exact Luna Max provider id;
- prove product-layer Delegation Envelope enforcement under provider full access;
- keep real execution closed until all admission/authority checks pass.

### Slice 1: Managed Skill Bundle Store

Purpose: make broad existing Skill ecosystems available once instead of authoring capability one task at a time.

Add a `SkillBundleStore` / managed bundle root abstraction with a manifest such as:

```text
bundleId
sourceType
sourceRepository
pinnedRef
resolvedCommit
license
hostVariant
rootPath
digest
installedAt
updatedAt
status
```

Initial providers:

- `mattpocock/skills`;
- `garrytan/gstack` using its Codex-compatible materialization path;
- optional local/built-in roots already approved by Lucubro.

Implementation rules:

- materialize the complete approved bundle, not a Coffee-specific subset;
- keep bundle files outside normal user project diffs;
- pin exact source state for determinism;
- retain license/source attribution;
- support rollback to a prior bundle version;
- do not silently update a bundle in the middle of a Work.

Validation:

- full bundle root survives restart;
- exact upstream/ref/digest is inspectable;
- update changes the bundle version atomically;
- previous version can be restored;
- user repository remains clean.

### Slice 2: Full Skill Catalog + Dependency/Compatibility Graph

Purpose: make the entire bundle inventory routable without injecting all instructions into model context.

Add:

- catalog scanner for all eligible `SKILL.md` entrypoints under approved roots;
- compact metadata rows containing bundle, name, description, entrypoint, hash, host variant, and capability/dependency metadata when known;
- `SkillDependencyResolver` for referenced Skills/resources/scripts/capabilities;
- `SkillCompatibilityRegistry` with `native`, `overlay-required`, and `blocked` states;
- versioned overlays for real host incompatibilities.

Compatibility overlays should solve categories such as:

- unsupported user-question mechanisms;
- unavailable browser/tool capabilities;
- host-specific file/output conventions;
- provider-specific control instructions that conflict with Luna-only/runtime policy.

Do not create a new Skill merely to adapt final output to the Lucubro Canvas.

Validation:

- catalog count reflects the complete installed bundle inventory;
- metadata can be queried without reading every body;
- selected Skill body is loaded lazily;
- dependency closure is deterministic;
- blocked Skills cannot be selected as executable;
- overlay provenance is explicit.

### Slice 3: Work Planner + Skill Resolver + Mount Receipts

Purpose: turn ordinary user intent into an inspectable Skill graph without making the user learn the ecosystem.

Planner inputs:

- user intent;
- Related Work/Artifact history;
- Project context when present;
- full catalog metadata;
- current runtime/authority/tool availability;
- compatibility states.

Planner outputs:

- durability class;
- Project/Issue action;
- selected Skill graph;
- dependency closure;
- staffing/subrun shape;
- Evidence expectations;
- deliverable/Artifact shape;
- blocked capabilities.

Execution steps:

1. resolve candidate Skills from metadata;
2. optionally invoke an upstream router/meta-skill when that is the most appropriate capability;
3. compute dependency and compatibility closure;
4. mount exact selected roots/Skills through Codex skill APIs/roots;
5. verify actual runtime visibility using `skills/list` or the strongest available machine seam;
6. persist Skill Mount Receipts bound to Run/subrun id and exact bundle/Skill hashes.

Never treat model prose such as "I used office-hours" as mount evidence.

Coffee expected behavior:

- saved Work;
- no Project/Issue;
- research/browsing methodology selected from the installed ecosystem when external evidence is needed;
- teaching/explanation methodology selected when useful;
- no Coffee-specific Skill package.

Website expected behavior:

- planner can discover relevant office-hours/product discovery, spec, design/prototype, implementation, code-review, browser/QA, and delivery capabilities from the same catalog;
- exact stages depend on the Work and can be omitted when unnecessary;
- no `website-lucubro` Skill is authored.

### Slice 4: Manager + Specialist Subrun Orchestration

Purpose: compose selected Skills proportionally while the Primary Manager retains the user-facing Work.

- Each subrun uses the same Luna admission gate.
- Each subrun receives a bounded objective, selected Skill closure, context, and Delegation Envelope.
- Independent breadth may run in parallel.
- Ordered dependencies remain sequential.
- Specialist roles do not create durable Employees automatically.
- Subrun results return normalized public state/Evidence to the Manager.

Validation:

- simple Coffee does not manufacture multiple Employees;
- Website Build can use several specialist phases/subruns without user orchestration;
- failure/block state is visible without fabricated completion.

### Slice 5: Heterogeneous Skill Output -> Evidence + Artifact Ingestion

Purpose: stop third-party host conventions from becoming Lucubro product architecture.

Introduce a generic output ingestion layer that classifies outputs into:

- Evidence/source/tool result;
- Artifact semantic content candidate;
- file/diff/repository mutation;
- decision/request for user authority;
- transient execution note;
- unsupported/blocked host output.

Rules:

- preserve upstream-produced files when the Work genuinely requests those files;
- do not make a Skill's HTML/Markdown file tree the canonical Canvas identity merely because its original host expects it;
- attach source/tool provenance at claim/block level where relevant;
- do not preserve raw chain-of-thought.

### Slice 6: Canvas Artifact IR + Renderer + Export

Purpose: make Lucubro's deliverable model independent from whichever Skill produced the content.

- canonical Artifact id and stable block ids;
- evidence/reference edges;
- semantic interaction descriptions with static fallbacks;
- Lucubro-owned renderers inside the persistent Company Canvas;
- Markdown/PDF exporters from Artifact IR, never DOM scraping;
- real/source-backed media with explicit provenance/embedding rights state.

### Slice 7: Related Work + Reference Graph + Project Promotion

Purpose: keep useful continuity below Project level and introduce structure only when it pays for itself.

- stable Artifact/block references across Work/Canvas;
- Related Work retrieval/reuse before Project;
- progressive Project promotion based on continued objective/state/frontier;
- identity-preserving promotion;
- Issues only for independently trackable Project frontier.

### Slice 8: Generalization Eval Suite

#### Canary A: Coffee

Validate:

ordinary intent -> catalog routing -> existing research/teaching capabilities -> mount receipts -> Evidence -> Canvas Artifact -> restart/export/reuse -> no premature Project.

#### Canary B: Website Build

Validate:

ordinary website outcome -> office-hours/discovery when appropriate -> spec/planning -> design/prototype -> implementation -> review/browser QA -> deliverables/Canvas -> persistence/Project behavior.

The eval does not require one exact Skill chain. It requires the chain to be justified, mounted from existing bundles, compatible with the host, evidenced, and sufficient for the requested outcome.

A new acceptance vertical must normally be testable by changing the request/fixture, not by creating another Skill first.

## Key decisions

- **ACW-DEC-001:** `LUCUBRO_ENABLE_REAL_RUNTIMES=1` is an exposure switch, not runtime admission proof.
- **ACW-DEC-002:** Required Luna profile fields fail closed when unknown.
- **ACW-DEC-003:** Complete approved Skill ecosystems are installed as versioned bundles; individual Skills are lazily loaded/mounted.
- **ACW-DEC-004:** Upstream Skills remain canonical methodology sources. Host adaptation is a separate compatibility/output layer.
- **ACW-DEC-005:** Ordinary new task categories should be solved by routing existing capabilities, not by authoring one-off Skills.
- **ACW-DEC-006:** Skill selection and Skill mount are separate states with separate receipts.
- **ACW-DEC-007:** Specialist subruns are not Employees.
- **ACW-DEC-008:** Work may persist indefinitely without a Project.
- **ACW-DEC-009:** Canvas Artifact IR is canonical; React/Markdown/PDF are projections.
- **ACW-DEC-010:** Evidence edges attach at claim/block/tool-result level where applicable.
- **ACW-DEC-011:** Bundle updates are explicit, pinned, testable, and reversible.
- **ACW-DEC-012:** Coffee and Website Build must both pass before the Skill orchestration architecture is considered general.

## Corrected TDD sequence

1. Finish Luna Runtime Admission and independent authority enforcement.
2. Add failing tests for complete bundle manifest/materialization and restart behavior.
3. Add failing tests that scan an entire fixture bundle containing many Skills, not two hard-coded names.
4. Implement full catalog indexing with lazy body loading.
5. Add dependency/compatibility tests including native, overlay-required, and blocked Skills.
6. Add fake Codex `skills/list` tests proving selected Skill roots and mount receipts.
7. Add Work Planner tests for two unrelated fixtures: Coffee and Website Build.
8. Only after the generic substrate works, implement Evidence/Artifact ingestion and Canvas delivery.
9. Run full static, Node, Chromium, restart, and canary gates before claiming verification.

## Traceability

- ACW-REQ-001..004,027 -> Slice 0.
- ACW-REQ-005..011 -> Slice 1/2.
- ACW-REQ-012..014,027,028 -> Slice 3.
- ACW-REQ-015..016 -> Slice 4.
- ACW-REQ-017..021 -> Slice 5/6.
- ACW-REQ-022..026 -> Slice 7.
- All requirements -> Slice 8 Coffee + Website generalization eval.

## Out-of-band evidence required before real Luna smoke

Before any real canary on the trusted Worker, capture:

- Codex CLI/app-server version;
- exact machine-readable model id corresponding to the approved `Luna Max` label;
- effective selected model/config;
- default-mode state;
- Fast/speed-tier state;
- active permission profile/full-access state;
- Lucubro Delegation Envelope used for the Work;
- exact installed bundle refs/digests;
- exact selected/mounted Skill hashes and overlay identities;
- exact Run/subrun ids.

If required runtime or Skill-mount evidence cannot be proved, keep real execution blocked.