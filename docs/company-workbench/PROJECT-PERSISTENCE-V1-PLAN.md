# Plan: Lucubro Project Persistence v1

## Goal alignment

- Related stories: US-001 through US-010 in `PROJECT-PERSISTENCE-V1-SPEC.md`.
- Related requirements: REQ-001 through REQ-020.
- Governing product direction: issue #19 and `PRODUCT-THESIS.md`.

## Technical approach

Deliver Project Persistence in tracer-bullet slices while preserving the existing Work -> Run -> Evidence contract.

### Slice 1: durable Project + read-only discovery

- Add a Lucubro-owned Project store under the existing Company data root.
- Allow Work to reference a Project by stable `projectId`.
- Discover repository-owned instructions/context/ADR/spec artifacts non-destructively.
- Preserve provenance as source kind + repository-relative path.
- Reject discovered sources that resolve outside the Project root.
- Expose durable Project summaries through Company bootstrap without changing the default canvas hierarchy yet.

### Slice 2: continuation checkpoint + reconciliation

- Maintain a compact Project checkpoint derived from durable Lucubro state and explicit references.
- Record source fingerprints/references needed to detect stale continuation state.
- Rebuild continuation state from current canonical sources when checkpoint references are stale.
- Keep checkpoint subordinate to current repository/tracker state.

### Slice 3: bounded continuation context

- Compile a bounded, source-backed continuation payload for Project-bound Work.
- Include objective, relevant project sources, verified prior state, current frontier, next safe action, and Delegation Envelope.
- Keep provider session resume optional. A fresh session must receive equivalent durable Project context.

### Slice 4: Project canvas lens

- Project context appears as a lens around Work inside the persistent Company Canvas Shell.
- Surface provenance, current objective, verified state, frontier, stale source state, and relevant decisions/specs.
- Preserve Alex/composer/Needs You and browser-history continuity.

### Slice 5: restart/new-session acceptance journey

- Fixture repository with Matt-style durable sources.
- Adopt Project, run mock Work, produce Evidence, accept Work, persist checkpoint.
- Restart Lucubro with no provider session continuity.
- Start fresh Project-bound execution from current canonical sources.
- Change a canonical source and prove stale continuation state is reconciled.

## Key decisions

- DEC-001: Project is a durable context above Work, not a replacement for Work/Run.
- DEC-002: Repository-owned context remains canonical in place. Project state stores references/operational continuity, not a duplicate editable knowledge base.
- DEC-003: Discovery is read-only and source-boundary-safe.
- DEC-004: Semantic repository mutations use ordinary Work/Evidence/Review semantics.
- DEC-005: Provider session ids are optional execution references, never continuity identity.
- DEC-006: Real Claude/Codex remains gated; deterministic mock runtime proves the persistence contract first.
- DEC-007: Cross-machine Lucubro-owned operational-state sync is deferred behind a future backend boundary.

## Interfaces / boundaries

- `ProjectStore`: durable Project identity, Work association metadata, continuation checkpoint.
- `ProjectDiscovery`: repository-root-bounded source discovery with provenance.
- `ProjectContinuation`: source reconciliation and bounded execution context.
- `CompanyService`: creates/loads Project-bound Work without moving Project ownership into runtime adapters.
- `RunOrchestrator/runtime adapters`: consume already-bounded continuation input; do not own Project state.
- `Company Canvas`: projection/inspection only; never source of truth.

## Risks

- Large context trees can overfill model context if relevance/budgeting is weak.
- Git clone/path identity can diverge from Project identity.
- Symlinks or malformed repository guidance can escape the intended workspace boundary if discovery is naive.
- A checkpoint can become stale and misleading if reconciliation is implicit.
- Auto-writing semantic files could create an unreviewable second memory system.

## Validation strategy

- Unit tests for Project durability, discovery provenance, symlink/path containment, Work association, checkpoint reconciliation, and context budgeting.
- Integration tests through CompanyService/API for Project-bound Work and restart recovery.
- Browser acceptance path through deterministic mock runtime.
- Full `npm run check`, `npm test`, and Chromium E2E before the slice is considered ready.
- Real-provider smoke tests remain out of scope until runtime profile enforcement/attestation is implemented.
