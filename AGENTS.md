# Lucubro repository rules

## Active product

Lucubro Company Workbench is the primary product direction.

Active product code:

- `company-server.js`
- `lib/company/`
- `public/company*`
- `docs/company-workbench/`
- Company Workbench tests

The previous learning-workspace product is frozen legacy. Do not add product features to it. Change legacy code only when required for repository integrity, migration, security, or regression compatibility while the Company Workbench becomes the default product.

## Product invariants

- Conversation first, not chat-only.
- Hide detail, not durable structure.
- Lucubro owns Work, Run, authorization, Artifacts, decisions, and audit history.
- Provider session/thread ids are execution references, never product identity.
- Employee is durable identity; Work is assignment; Run is an execution attempt; Runtime is an execution engine.
- Auto means a scoped Delegation Envelope, never blanket permission.
- Out-of-envelope authority becomes `Needs You`.
- Raw model reasoning is not a product event and must not be persisted or presented as operational truth.
- A provider completion moves Work to review only after required evidence is available. CEO Accept/Rework is a separate durable decision.
- A visible durable state must have an actionable path. Do not create dead-end counts or status surfaces.

## UI/UX release checklist

Before considering any user-facing UI/UX change complete, review the affected surface against Checklist Design:

- Design System: https://www.checklist.design/design-system
- relevant component checklist(s);
- relevant flow checklist(s);
- responsiveness/mobile behavior where applicable.

At minimum verify:

- typography hierarchy and readable measure;
- spacing rhythm and alignment;
- semantic color and contrast;
- component states: default, hover, active, focus-visible, disabled, loading, success, empty, error;
- keyboard accessibility and accessible names;
- responsive collapse behavior;
- loading and terminal-state consistency;
- reduced-motion behavior;
- no permanent UI region unless it earns persistent attention;
- no dashboard/card noise that competes with the Manager relationship;
- no provider/runtime details in the default CEO surface unless they change the current decision.

Document material checklist trade-offs in the PR when a rule is intentionally not applicable.

## Interaction character

Lucubro's interaction principle is:

> **Quiet surface, kinetic intelligence.**

At rest, the product should be visually calm. When the user expresses intent, chooses context, enters a path, makes a decision, or receives new Work evidence, the interface should become more active and explain the transition through motion.

Preferred interaction rhythm:

1. **Acknowledge** the user action immediately.
2. **Interpret / structure** the affected options or state in a short coordinated sequence.
3. **Receipt** the state Lucubro can truthfully confirm.
4. **Settle** back to a quiet stable surface with context preserved.

Motion should reduce cognitive steps. Do not insert animation that makes a deterministic local interaction feel slower.

### Interaction honesty

Animation is not permission to invent AI work.

- Local input can animate `received`, `selected`, `reading input`, or another deterministic UI state.
- `validated`, `connected`, `running`, `review-ready`, `completed`, or similar claims must be bound to the real API/domain/provider state that proves them.
- Never create fake percentages, staged loading steps, thinking indicators, or ambient activity solely to imply that an AI is busy.
- Do not expose raw model reasoning in an attempt to make the interface feel more alive.
- The product should feel intelligent because it continuously responds to real state and compresses decisions, not because it performs fake progress theatre.

### Execution setup pattern

Execution setup remains progressive disclosure.

- The user-facing runtime control is a visible choice rail, not a native select.
- Claude Code, Codex, Mock, and future adapters share the same runtime-choice contract.
- Unavailable runtimes remain visible but disabled so availability is legible.
- A hidden native/select value may remain as an internal compatibility seam when existing form logic owns the canonical runtime value.
- Runtime selection produces an immediate receipt and updates the compact summary.
- Repository path uses a line-based input, not a large boxed field.
- Path focus wakes the line; input settling may show a short reading trace; `Path received` confirms browser/UI receipt only.
- Actual filesystem validation belongs to the Work/start boundary and must use real evidence.

## Motion and GSAP

Use the official GreenSock GSAP AI skills as the implementation reference:

https://github.com/greensock/gsap-skills

Install for a local agent with:

```bash
npx skills add https://github.com/greensock/gsap-skills
```

Detailed lifecycle choreography is specified in [`docs/company-workbench/MOTION-SYSTEM.md`](docs/company-workbench/MOTION-SYSTEM.md).

Prefer the relevant GSAP skill for the task (`gsap-core`, `gsap-timeline`, `gsap-performance`, framework-specific guidance, etc.).

Motion rules:

- Motion must communicate state, hierarchy, causality, continuity, focus, acknowledgement, or receipt.
- Visible components use a complete `mount → entering → active → exiting → unmount/hidden/replacement` lifecycle when that transition is user-visible.
- Do not instantly replace a visible component set. Exit the old set, replace state/DOM, then enter the new set.
- Exit choreography should normally be shorter than entrance choreography.
- Prefer transforms and `autoAlpha`/opacity over layout properties.
- Prefer timelines and position parameters for coordinated sequences over arbitrary delay chains.
- Use stagger for related choices that enter as a group and reverse stagger when they leave as a group.
- Use `will-change` only on elements that actually animate.
- Clean up or kill GSAP timelines/tweens/listeners on lifecycle teardown.
- Respect `prefers-reduced-motion` and land directly in meaningful end states.
- Do not add ScrollTrigger or heavy motion to ordinary application scrolling unless the interaction truly depends on scroll position.
- Do not add infinite ambient animation merely to make the product feel AI-powered.
- Product state and interaction must remain understandable when animation or the GSAP CDN is unavailable.

## Verification

For product changes, use the highest useful seam:

```bash
npm run check
npm test
npx playwright test
```

Company Workbench changes should add/modify tests at the Work/Run/API/browser seam rather than testing private implementation details.

For kinetic UI changes, verify at minimum:

- selection semantics and keyboard/focus state;
- deterministic receipts are truthful;
- component entrance and exit have a defined lifecycle;
- visible replacement does not jump directly between DOM states;
- mobile containment and touch reachability;
- reduced-motion end states;
- unavailable provider states remain legible;
- animation is not required for the underlying action to work.

Real-provider behavior should additionally be exercised on a trusted local device through the manual self-hosted runner workflow when that work is intentionally resumed. Never let untrusted pull requests target a personal self-hosted runner.
