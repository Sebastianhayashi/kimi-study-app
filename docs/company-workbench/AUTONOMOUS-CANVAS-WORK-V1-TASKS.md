# Tasks: Lucubro Autonomous Canvas Work v1

Status: executable task map
Depends on: `AUTONOMOUS-CANVAS-WORK-V1-SPEC.md`, `AUTONOMOUS-CANVAS-WORK-V1-PLAN.md`

## Slice 0: Luna Runtime Admission

- **ACW-T001 [test]** Add pure verifier tests for exact approved profile, wrong profile/model, Fast enabled, wrong/default mode, wrong permission profile, and missing required attestation. Requirements: ACW-REQ-001..004,025. Files: `test/company-codex-profile.test.js`.
- **ACW-T002 [impl]** Add Codex profile policy/verifier with a fail-closed admission result. Requirements: ACW-REQ-001..004,025. Files: `lib/company/runtime/codex-profile.js`.
- **ACW-T003 [test]** Extend runtime-policy tests so `enableRealRuntimes` alone cannot expose Codex when admission is not verified. Requirements: ACW-REQ-001..004. Files: `test/company-runtime-policy.test.js`.
- **ACW-T004 [impl]** Gate real Codex runtime exposure on an admission wrapper while keeping mock behavior unchanged. Requirements: ACW-REQ-001..004. Files: `lib/company/runtime/policy.js`.
- **ACW-T005 [test]** Add fake app-server tests for machine-readable preflight inputs (`model/list`, effective config, permission profile/active profile, speed/service tier where available). Requirements: ACW-REQ-001..003,025. Files: `test/company-codex-app-server-admission.test.js` or existing adapter test file.
- **ACW-T006 [impl]** Add adapter preflight/attestation collection without enabling real runtime by default. Requirements: ACW-REQ-001..004,025. Files: `lib/company/runtime/codex-app-server.js` plus focused helper(s).
- **ACW-T007 [ops]** On trusted Worker, record exact machine-readable id corresponding to `Luna Max`; keep real execution blocked until this receipt is captured. Requirements: ACW-REQ-001..003. Files: runtime verification evidence/documentation only.

## Slice 1: Skill Registry + Mount Receipt

- **ACW-T101 [test]** Add registry tests for compact metadata, immutable hash, approved skill allowlist, and lazy body loading. Requirements: ACW-REQ-005,006.
- **ACW-T102 [impl]** Implement Lucubro Skill Registry and register `research-lucubro` / `teach-canvas`. Requirements: ACW-REQ-005,006.
- **ACW-T103 [test]** Add adapter tests for `skills/list` / selected skill roots and mismatch behavior. Requirements: ACW-REQ-005,006,025.
- **ACW-T104 [impl]** Implement skill mount request + receipt bound to Run/subrun identity. Requirements: ACW-REQ-006,025.

## Slice 2: Work Planning Pass

- **ACW-T201 [test]** Coffee fixture classifies as saved Work, no Project, no Issue, research then teach, one research specialist, Evidence required, Canvas Artifact deliverable. Requirements: ACW-REQ-009..012,019..022.
- **ACW-T202 [impl]** Add durable/public Work planning state and validation schema. Requirements: ACW-REQ-010,024.
- **ACW-T203 [test]** Verify plan cannot fabricate mounted Skills/runtime attestation from model prose. Requirements: ACW-REQ-025.

## Slice 3: Specialist Subruns

- **ACW-T301 [test]** Manager can invoke one bounded research subrun without creating Employee state. Requirements: ACW-REQ-011,012.
- **ACW-T302 [impl]** Add specialist subrun orchestration records/events and reuse Runtime Admission/Delegation Envelope. Requirements: ACW-REQ-001..004,011,012.
- **ACW-T303 [test]** Parallelize only explicitly independent branches; keep research->teach sequential. Requirements: ACW-REQ-009,011,012.

## Slice 4: Research -> Evidence Graph

- **ACW-T401 [test]** Validate Research Packet claim/evidence/media/uncertainty contract. Requirements: ACW-REQ-007,013,014,024.
- **ACW-T402 [impl]** Persist normalized claim-to-evidence edges and media provenance/rights state. Requirements: ACW-REQ-013,014.

## Slice 5: Teach -> Canvas Artifact IR

- **ACW-T501 [test]** Reject HTML/JSX canonical output and unsupported factual blocks without evidence refs. Requirements: ACW-REQ-008,013,015..018.
- **ACW-T502 [impl]** Add Canvas Artifact + stable block identity + semantic interaction/static fallback contract. Requirements: ACW-REQ-015..018.

## Slice 6: Canvas renderer

- **ACW-T601 [browser test]** Render Coffee Artifact as a mixed visual/text/interactive magazine-like scene inside the persistent Company Canvas. Requirements: ACW-REQ-013..018,028.
- **ACW-T602 [impl]** Implement owned Lucubro block renderers and contextual Evidence affordances. Requirements: ACW-REQ-013..018,028.

## Slice 7: Export

- **ACW-T701 [test]** Same Artifact exports truthful Markdown and PDF with evidence/provenance and static interaction fallbacks. Requirements: ACW-REQ-017,018.
- **ACW-T702 [impl]** Add IR-driven Markdown/PDF exporters without DOM scraping. Requirements: ACW-REQ-017,018.

## Slice 8: Related Work + references

- **ACW-T801 [test]** Later coffee Work finds/references prior Artifact without Project creation. Requirements: ACW-REQ-019,020,023,026.
- **ACW-T802 [impl]** Add Artifact/block reference graph and V1 snapshot/reference semantics. Requirements: ACW-REQ-020,023.

## Slice 9: Progressive Project promotion

- **ACW-T901 [test]** One coffee Work never promotes; repeated related Work with persistent objective/frontier can promote while preserving ids. Requirements: ACW-REQ-021,027.
- **ACW-T902 [impl]** Add inspectable/reversible promotion policy and Project association. Requirements: ACW-REQ-021,027.
- **ACW-T903 [test]** Initial/simple Work creates no Issue; only independently trackable Project frontier qualifies. Requirements: ACW-REQ-022.

## Slice 10: Coffee Canary

- **ACW-T1001 [e2e]** Run complete Coffee Canary from ordinary request through Luna admission, skill mounts, research Evidence, teach synthesis, Canvas Artifact, restart, export, related Work reuse, and promotion threshold. Requirements: all V1 requirements.
- **ACW-T1002 [evidence]** Persist exact runtime/skill/evidence receipts for the canary. Requirements: ACW-REQ-001..006,013,025.

## Gate discipline

- Execute tasks in red -> green -> refactor order inside each slice.
- Do not start real Codex Coffee work before ACW-T001..T007 are satisfied on the trusted Worker.
- Do not implement Project promotion before Related Work and stable Artifact references exist.
- Do not implement visual polish before the Artifact/Evidence contracts are stable.
- Every slice must pass `npm run check`, `npm test`, and relevant Chromium regression tests before being called verified.
