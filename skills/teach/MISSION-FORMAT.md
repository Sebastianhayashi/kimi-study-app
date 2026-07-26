# MISSION.md Format

`MISSION.md` lives at the workspace root. It captures the _reason_ the user is learning this topic. Every teaching decision — what to teach next, which resources to surface, which exercises to design — should trace back to this document.

## Template

```md
# Mission: {Topic}

## Why
{1-3 sentences describing the current problem: situation, obstacle, timing, and why it matters now. Avoid abstract framings like "to understand X".}

## Success looks like
- {Expected output: the checkable artifact, decision, action, or deliverable the user intends to complete}
- {Success evidence: an observable sign that the output works in the intended situation}
- {Additional success evidence, if needed}
- {…}

## Constraints
- {Time, budget, prior commitments, learning preferences, anything that bounds the approach}

## Out of scope
- {Adjacent topics the user explicitly does not want to chase right now — protects the zone of proximal development}
```

## Rules

- **One mission per workspace.** If the user wants to learn two unrelated things, that is two workspaces.
- **Concrete over abstract.** "Run a half marathon by October" beats "get fitter." "Ship a Rust CLI to my team" beats "learn Rust."
- **Ordered success semantics.** The first `Success looks like` bullet is always the expected output. Every later bullet is success evidence for that output.
- **Coverage is a constraint, not an outcome.** "Read every chapter" or "cover the whole book" cannot stand alone as the expected output. Put it under Constraints when it is genuinely required.
- **Transfer-ready output.** The expected output must be something a later transfer activity can directly advance, rehearse, revise, or evaluate.
- **Push back on vagueness.** If the user cannot articulate why, interview them before writing anything. A bad mission is worse than no mission.
- **Revise when reality shifts.** Missions change. When the user's goal moves, update this file — don't leave a stale mission steering future sessions.
- **Keep it short.** If `MISSION.md` runs past a screen, it has stopped being a compass and started being a plan.
