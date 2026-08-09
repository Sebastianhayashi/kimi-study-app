# Tasks: Lucubro Autonomous Canvas Work v1

Status: executable task map
Depends on: `AUTONOMOUS-CANVAS-WORK-V1-SPEC.md`, `AUTONOMOUS-CANVAS-WORK-V1-PLAN.md`

## Reconciliation

The earlier task map incorrectly hard-coded `research-lucubro` and `teach-canvas` as the initial Skill inventory. Those task-specific Skill packages have been removed.

The corrected task map treats complete approved Matt/gstack-style bundles as the capability inventory and tests generic routing across unrelated user requests.

## Progress

- ACW-T001..T004: complete with targeted red/green coverage. Luna profile verification and runtime-policy admission fail closed.
- ACW-T005: complete. Fake App Server tests cover `model/list`, effective `config/read`, `permissionProfile/list`, experimental API opt-in, and unknown-state reporting.
- ACW-T006: complete at the preflight seam. `createCodexAppServerRuntime().preflight()` collects machine state but intentionally does not claim admission. Actual thread-start attestation remains part of the trusted-Worker gate.
- ACW-T007: pending. Exact trusted-Worker Luna model/profile/mode/Fast receipt has not been captured.
- ACW-T008: complete with targeted red/green coverage. Codex Run cannot bypass a Lucubro-owned authority boundary.
- ACW-T009: partial. The fail-closed authority-boundary contract is wired before Codex Run spawn; a concrete trusted-Worker sandbox implementation and attestation are still required before real execution.
- ACW-T101..T104: complete with targeted red/green coverage for durable manifests, full-tree materialization, atomic activation/rollback, and restart persistence.
- ACW-T105: partial. Matt Pocock and gstack manifests are pinned to exact upstream commits and MIT provenance; their complete real bundles have not yet been materialized on the trusted Worker and recorded with root digests.
- ACW-T201..T207: complete with targeted red/green coverage for recursive full-catalog indexing, routing metadata, invocation policy, lazy bodies, dependency closure, path containment, compatibility overlays, and exact-commit overlay invalidation.
- ACW-T301: complete at the planner-validation seam. Coffee sees the full catalog and selects existing `research` plus user-intent-authorized `teach`; no Coffee-specific Skill is introduced.
- ACW-T302: complete at the planner-validation seam. Website Build composes existing discovery/spec/design/implementation/review/QA capabilities from the same catalog; no Website-specific Skill is introduced.
- ACW-T303: candidate complete at the product seam. Validated public Work planning is persisted, ordinary non-repo Work uses Lucubro scratch execution space, and the HTTP seam no longer requires a fake repository for lightweight Work. Whole-repository CI is still pending.
- ACW-T304: complete. Planner proposals cannot fabricate runtime or Skill mount attestation and cannot persist raw reasoning fields.
- ACW-T305: complete with targeted red/green coverage. Same-process Codex mount verification uses `skills/extraRoots/set` plus forced `skills/list`, rejects unexpected/disabled/drifted Skills, and does not treat system Skills outside the mount root as selected.
- ACW-T306: implementation landed through the runtime/orchestrator seam. Verified mount receipts are bound to Run/Subrun and persisted as Run events; full repository CI is still pending.
- ACW-T307: complete with targeted red/green coverage. Run-scoped mount views copy complete selected Skill directories while excluding unselected Skill bodies from the runtime-visible root.
- ACW-T401..T404: candidate complete with targeted/shadow coverage. Specialist work is represented as disposable child Runs, cannot widen parent authority, schedules only after its own dependencies complete, and the Website canary composes existing Skills without creating durable Employees or Website-specific Skills.
- ACW-T501..T503: candidate complete with targeted/shadow coverage. Skill output is normalized into Evidence, proposed semantic Artifact content, workspace mutation, authority request, transient note, or sanitized unsupported output; material claims require real same-Work Evidence.
- ACW-T504: candidate complete at the contract/Run seam. Only explicitly requested relative paths can become file deliverables; produced bytes are durably Evidence-backed and the file receipt does not create Artifact/Canvas identity. Targeted Node contract coverage is green; whole-repository CI is pending.
- ACW-T601: candidate complete with targeted coverage. Renderer-owned HTML/React/Markdown-style state is rejected from canonical Canvas Artifact identity and stable block/reference semantics are tested.
- ACW-T602: candidate complete at the canonical IR/store seam. Canvas Artifacts persist stable Artifact/block ids, same-Work Evidence edges, snapshot references, semantic interactions with required static fallbacks, and requested-file references. The proposal-to-canonical assembler and browser projection remain pending in T603+.
- ACW-T603 onward: pending.
- Real Codex remains blocked. Current targeted tests and shadow integration harnesses are not a substitute for full repository CI.

## Slice 0: Luna Runtime Admission

- **ACW-T001 [test]** Add pure verifier tests for exact approved profile, wrong profile/model, Fast enabled, wrong/default mode, wrong permission profile, and missing required attestation. Requirements: ACW-REQ-001..004,027. Files: `test/company-codex-profile.test.js`.
- **ACW-T002 [impl]** Add Codex profile policy/verifier with fail-closed admission. Requirements: ACW-REQ-001..004,027. Files: `lib/company/runtime/codex-profile.js`.
- **ACW-T003 [test]** Prove `enableRealRuntimes` alone cannot expose Codex without verified admission and cannot expose another real provider. Requirements: ACW-REQ-001..004. Files: `test/company-runtime-policy.test.js`.
- **ACW-T004 [impl]** Gate real Codex exposure on Luna admission while keeping mock behavior unchanged. Requirements: ACW-REQ-001..004. Files: `lib/company/runtime/policy.js`.
- **ACW-T005 [test]** Add fake app-server tests for machine-readable preflight inputs: `model/list`, `config/read`, permission profile/active profile, and speed/service tier where available. Requirements: ACW-REQ-001..003,027.
- **ACW-T006 [impl]** Add adapter preflight/attestation collection without enabling real runtime by default. Leave unprovable required properties unknown. Requirements: ACW-REQ-001..004,027.
- **ACW-T007 [ops]** On trusted Worker, record exact machine-readable model id for operator label `Luna Max`, plus effective mode/Fast/permission evidence. Keep real execution blocked until receipt exists. Requirements: ACW-REQ-001..003.
- **ACW-T008 [test]** Prove provider `full access` cannot bypass Lucubro Delegation Envelope for network/git/destructive actions. Requirements: ACW-REQ-004.
- **ACW-T009 [impl]** Add product-layer authority enforcement that remains effective under provider full access and does not rely solely on Codex sandbox restrictions. Requirements: ACW-REQ-004.

## Slice 1: Managed Skill Bundles

- **ACW-T101 [test]** Define bundle-manifest tests for source repo/provider, pinned ref/commit, license/provenance, host variant, root digest, installation state, and restart persistence. Requirements: ACW-REQ-005,006.
- **ACW-T102 [impl]** Implement `SkillBundleStore` / managed bundle root abstraction outside normal user project diffs. Requirements: ACW-REQ-005,006.
- **ACW-T103 [test]** Add fixture bundle materialization tests proving the entire bundle is retained, not a hand-picked subset of Skills. Requirements: ACW-REQ-005,007,028.
- **ACW-T104 [impl]** Implement pinned bundle materialization/import seam with atomic version activation and rollback. Requirements: ACW-REQ-005,006.
- **ACW-T105 [integration]** Add initial provider manifests for Matt Pocock skills and gstack Codex-compatible bundle materialization. Pin exact source state before real use. Requirements: ACW-REQ-005,006.

## Slice 2: Full Skill Catalog + Dependency/Compatibility Graph

- **ACW-T201 [test]** Scan a fixture bundle containing many `SKILL.md` entrypoints and assert the complete eligible inventory is indexed. Requirements: ACW-REQ-007,008.
- **ACW-T202 [impl]** Implement full Skill Catalog indexing with compact metadata and lazy body/resource loading. Requirements: ACW-REQ-007,008.
- **ACW-T203 [test]** Add dependency-closure tests for Skill references, scripts/resources, and required capability roots. Requirements: ACW-REQ-009.
- **ACW-T204 [impl]** Implement `SkillDependencyResolver`. Requirements: ACW-REQ-009.
- **ACW-T205 [test]** Add compatibility tests for `native`, `overlay-required`, and `blocked`, including an unsupported user-question/tool assumption. Requirements: ACW-REQ-010,011.
- **ACW-T206 [impl]** Implement versioned `SkillCompatibilityRegistry` / overlay lookup separate from upstream Skill source. Requirements: ACW-REQ-010,011.
- **ACW-T207 [test]** Prove a bundle update invalidates/re-evaluates overlays whose version range no longer matches. Requirements: ACW-REQ-006,011.

## Slice 3: Planner, Skill Resolver, and Mount Receipts

- **ACW-T301 [test]** Coffee fixture starts from ordinary language, queries the full catalog, selects existing research/browsing and teaching/explanation capabilities when justified, and creates no bespoke Coffee Skill. Requirements: ACW-REQ-012..014,022,024,028.
- **ACW-T302 [test]** Website fixture starts from an outcome-level brief and can select office-hours/product discovery, spec, design/prototype, implementation, review, browser/QA, and delivery capabilities from installed bundles as appropriate without a new website-specific Skill. Requirements: ACW-REQ-012..014,028.
- **ACW-T303 [impl]** Add durable/public Work planning state containing Skill graph, dependency closure, staffing, durability, Evidence, deliverable, and blocked-capability decisions. Requirements: ACW-REQ-012,014.
- **ACW-T304 [test]** Verify planner cannot fabricate mounted Skills/runtime evidence from model prose. Requirements: ACW-REQ-013,027.
- **ACW-T305 [test]** Add fake Codex `skills/list` / selected-root tests and mismatch behavior for complete bundles. Requirements: ACW-REQ-013,027.
- **ACW-T306 [impl]** Implement mount request + receipt bound to Run/subrun, exact bundle/Skill hash, root/method, observed runtime state, and overlay identity. Requirements: ACW-REQ-013,027.
- **ACW-T307 [test]** Verify unselected Skill bodies are not injected into execution context even though their bundle is installed. Requirements: ACW-REQ-008.

## Slice 4: Manager + Specialist Subruns

- **ACW-T401 [test]** Manager can invoke a bounded specialist subrun using a selected Skill closure without creating Employee state. Requirements: ACW-REQ-015,016.
- **ACW-T402 [impl]** Add specialist subrun orchestration records/events and reuse Luna admission, Skill receipts, and Delegation Envelope. Requirements: ACW-REQ-001..004,013,015,016.
- **ACW-T403 [test]** Parallelize only independent branches and preserve ordered Skill dependencies. Requirements: ACW-REQ-009,015,016.
- **ACW-T404 [test]** Website Build can use multiple specialist phases/subruns without exposing staffing/Skill ceremony to the user. Requirements: ACW-REQ-012,015,016.

## Slice 5: Heterogeneous Skill Output -> Evidence + Artifact Ingestion

- **ACW-T501 [test]** Classify outputs from different fixture Skills into Evidence, Artifact semantic content, file/diff mutation, authority request, transient note, and unsupported host output. Requirements: ACW-REQ-017..019,028.
- **ACW-T502 [impl]** Implement generic Skill output ingestion without making vendor-specific file trees or HTML canonical product state. Requirements: ACW-REQ-017..019.
- **ACW-T503 [test]** Prove material factual content retains source/tool Evidence regardless of which upstream Skill produced it. Requirements: ACW-REQ-017,018.
- **ACW-T504 [test]** Prove explicit requested files remain deliverables when appropriate while Canvas identity remains independent. Requirements: ACW-REQ-019,020.

## Slice 6: Canvas Artifact IR + Renderer + Export

- **ACW-T601 [test]** Reject renderer code as canonical Artifact identity and require stable block/reference semantics. Requirements: ACW-REQ-019..021.
- **ACW-T602 [impl]** Add Canvas Artifact IR with stable Artifact/block ids, evidence/reference edges, semantic interactions, and static fallbacks. Requirements: ACW-REQ-019..021.
- **ACW-T603 [browser test]** Render Coffee Artifact as mixed visual/text/interactive magazine-like content inside persistent Company Canvas. Requirements: ACW-REQ-017..021.
- **ACW-T604 [browser test]** Render Website Build planning/results without exposing raw Skill plumbing as the default surface. Requirements: ACW-REQ-019,020.
- **ACW-T605 [test]** Same Artifact exports truthful Markdown and PDF from IR with Evidence/provenance and static interaction fallbacks. Requirements: ACW-REQ-021.
- **ACW-T606 [impl]** Add IR-driven Markdown/PDF exporters without DOM scraping. Requirements: ACW-REQ-021.

## Slice 7: Related Work + References + Project Promotion

- **ACW-T701 [test]** Later Coffee Work finds/references prior Artifact without Project creation. Requirements: ACW-REQ-022,023,026.
- **ACW-T702 [impl]** Add Artifact/block reference graph and V1 snapshot/reference semantics. Requirements: ACW-REQ-023,026.
- **ACW-T703 [test]** One lightweight Work never promotes solely because it has an Artifact; repeated related Work with persistent objective/frontier may promote while preserving ids. Requirements: ACW-REQ-024,026.
- **ACW-T704 [impl]** Add inspectable/reversible Project promotion policy. Requirements: ACW-REQ-024.
- **ACW-T705 [test]** Initial/simple Work creates no Issue; only independently trackable Project frontier qualifies. Requirements: ACW-REQ-025.
- **ACW-T706 [test]** Multi-stage Website Work can grow into Project context independently from whichever Skills were used. Requirements: ACW-REQ-022..026.

## Slice 8: Generalization Canaries

- **ACW-T801 [e2e]** Coffee Canary: ordinary request -> Luna admission -> full-catalog routing -> existing Skill mounts -> Evidence -> Canvas Artifact -> restart/export/reuse -> no premature Project. Requirements: all applicable V1 requirements.
- **ACW-T802 [e2e]** Website Build Canary: ordinary outcome -> full-catalog routing -> office-hours/discovery/spec/design/implementation/review/QA-style capabilities as justified -> deliverables/Canvas -> persistence/Project behavior. No website-specific Skill may be introduced to make the test pass. Requirements: all applicable V1 requirements.
- **ACW-T803 [evidence]** Persist exact runtime, bundle, Skill, overlay, mount, Evidence, Artifact, Work/Project receipts for both canaries. Requirements: ACW-REQ-001..014,017,027.
- **ACW-T804 [generalization]** Add one additional unrelated fixture whose implementation changes only the request/eval fixture, not the Skill inventory or product code. Requirements: ACW-REQ-012,028.

## Gate discipline

- Execute tasks in red -> green -> refactor order inside each slice.
- Do not start real Codex Work before ACW-T001..T009 are satisfied on the trusted Worker.
- Do not treat provider full access as Lucubro product authority.
- Do not create a new task-specific Skill to make Coffee, Website, or another canary pass unless the installed ecosystem genuinely lacks the methodology and the new Skill is broadly reusable beyond the canary.
- Complete bundles are installed; individual Skill bodies are loaded/mounted lazily.
- Upstream Skill source and Lucubro compatibility overlays remain separate and independently versioned.
- Do not implement Project promotion before Related Work and stable Artifact references exist.
- Do not implement visual polish before Skill routing, mount evidence, and Artifact/Evidence contracts are stable.
- Every slice must pass relevant unit/integration/static/Chromium gates before being called verified.
