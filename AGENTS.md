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

## Product document hierarchy

Use product documents in this order:

1. `docs/company-workbench/PRODUCT-THESIS.md` — governing product direction.
2. durable product/domain decisions and glossary.
3. `DESIGN-SYSTEM.md` / `MOTION-SYSTEM.md` — interaction expression.
4. `SPEC.md` — current executable V1 engineering slice, not complete product IA.
5. implementation code/tests — current realization.

If a lower layer conflicts with a higher layer, correct the lower layer. Do not infer product strategy from a temporary screen or current navigation implementation.

## Product invariants

- Multica is an operational backbone, not a screen template.
- Conversation first, not chat-only.
- **Conversation drives the canvas.** The Manager surface is a live company canvas whose durable objects change in response to user intent and real product events.
- **Quiet surface, kinetic intelligence.** Stable state is calm; real intent/state changes become perceptible through motivated motion.
- Stable space, changing objects. Prefer updating a visible Work / Artifact / Decision object in place over replacing it with disconnected messages, toasts, or new pages.
- One Workspace-level Primary Manager remains the default CEO-facing relationship across Work Context changes.
- Default Home is Work-first across Project and lightweight work.
- Hide detail, not durable structure.
- Lucubro owns Work, Run, authorization, Artifacts, decisions, and audit history.
- Provider session/thread ids are execution references, never product identity.
- Employee is durable identity; Work is assignment; Run is an execution attempt; Runtime is an execution engine.
- Auto means a scoped Delegation Envelope, never blanket permission.
- Out-of-envelope authority becomes `Needs You`.
- Raw model reasoning is not a product event and must not be persisted or presented as operational truth.
- A provider completion moves Work to review only after required evidence is available. CEO Accept/Rework is a separate durable decision.
- A visible durable state must have an actionable path. Do not create dead-end counts or status surfaces.
- A workspace path names the execution host. Never silently treat a browser-device folder as an execution-host path.

## Surface taxonomy gate

Before adding navigation or a permanent surface, classify the concept:

- **Domain object** — durable product truth such as Work, Project, Issue, Employee, Run, Artifact, Decision.
- **Canvas object** — a visible projection of domain state in the active scene.
- **Lens** — a focused structured view over domain objects inside the persistent Company Canvas Shell.
- **Transient interaction** — local acknowledgement, suggestion, loading/reconciliation, receipt, or focus state.
- **Configuration surface** — infrastructure/policy controls such as provider/account/runtime/workspace/permissions.

Hard rule:

> **A domain object does not automatically earn a top-level page or navigation item.**

Project, Knowledge, Usage, Account, Employees, Artifacts, and future nouns must be integrated according to their role and actual workflow. Do not create independent apps simply to prove that a capability exists.

Normal lens changes must preserve the Company Canvas Shell: Lucubro identity, Alex relationship, composer, Needs You, and browser/deep-link continuity. Deep URLs are allowed; page-centric interaction is not required.

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
- no provider/runtime details in the default CEO surface unless they change the current decision;
- live state updates mutate the object that owns the state instead of spraying disconnected notifications;
- a real-time animation has a real product event or deterministic local state behind it;
- lens changes preserve shell continuity and browser history;
- adding a domain concept does not automatically expand top-level navigation.

Document material checklist trade-offs in the PR when a rule is intentionally not applicable.

## Interaction character

Lucubro's interaction principles are:

> **Quiet surface, kinetic intelligence.**
>
> **Conversation drives the canvas.**

At rest, the product should be visually calm. When the user expresses intent, chooses context, enters a path, makes a decision, or receives new Work evidence, the affected objects should become active and explain the transition through motion.

Preferred interaction rhythm:

1. **Acknowledge** the user action immediately.
2. **Interpret / structure** the affected options or state in a short coordinated sequence.
3. **Receipt** the state Lucubro can truthfully confirm.
4. **Settle** back to a quiet stable surface with context preserved.

Motion should reduce cognitive steps. Do not insert animation that makes a deterministic local interaction feel slower.

### Live canvas event projection

The Manager canvas should project real events onto stable visible objects.

- User instructions enter as intent objects.
- Successful Work creation transforms that intent into durable Work context rather than a separate wizard result.
- `run.started`, normalized public employee updates, tool events, Artifact events, approvals, and terminal Run events update the same Work object.
- Use one live textual region for incremental public updates. Do not append token-sized or event-sized chat bubbles.
- Artifact evidence grows inside the Work object that owns it.
- `Needs You` and Review may add decision surfaces, but the owning Work remains visually continuous.
- Once an object reaches a stable state, animation stops.

### Scene/lens continuity

Normal context inspection uses scene focus, not product-page replacement.

- current supporting content yields;
- target lens enters the same canvas region;
- History API records the deep route;
- Alex/composer/Needs You remain stable shell anchors;
- browser back/forward restores the semantic lens through the same controller;
- a hard reload is reserved for direct navigation/reload, not ordinary in-product lens switching.

### Interaction honesty

Animation is not permission to invent AI work.

- Local input can animate `received`, `selected`, `reading input`, focus, or another deterministic UI state.
- `validated`, `connected`, `running`, `review-ready`, `completed`, or similar claims must be bound to real API/domain/provider state that proves them.
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
- Workspace path uses a line-based input with an optional execution-host tree, not a large boxed field.
- Workspace path is neutral at rest and must wake to Klein blue whenever the input has focus, regardless of whether the path already has a receipt state.
- Typing a partial host path may show real directory suggestions.
- The tree may list directories and create directories only within the configured host root. Do not expose arbitrary file content through this picker.
- Client-folder drag/drop must state the browser-device / execution-host boundary honestly until an explicit import/native bridge exists.
- Actual filesystem validation belongs to real host inspection or the Work/start boundary and must use real evidence.

## Motion and GSAP

Use the official GreenSock GSAP AI skills as the implementation reference:

https://github.com/greensock/gsap-skills

Install for a local agent with:

```bash
npx skills add https://github.com/greensock/gsap-skills
```

Detailed lifecycle and canvas choreography is specified in [`docs/company-workbench/MOTION-SYSTEM.md`](docs/company-workbench/MOTION-SYSTEM.md).

Prefer the relevant GSAP skill for the task (`gsap-core`, `gsap-timeline`, `gsap-performance`, framework-specific guidance, etc.).

Motion rules:

- Motion must communicate state, hierarchy, causality, continuity, focus, acknowledgement, or receipt.
- Real-time canvas motion must be triggered by deterministic local state or normalized product events.
- Visible components use a complete `mount → entering → active → exiting → unmount/hidden/replacement` lifecycle when that transition is user-visible.
- Scene/lens motion preserves shell anchors and changes focus instead of staging a fake page load.
- Do not instantly replace a visible component set. Exit the old set, replace state/DOM, then enter the new set.
- Exit choreography should normally be shorter than entrance choreography.
- Prefer transforms and `autoAlpha`/opacity over layout properties.
- Prefer timelines and position parameters for coordinated sequences over arbitrary delay chains.
- Use stagger for related choices that enter as a group and reverse stagger when they leave as a group.
- One-shot event pulses are allowed. Infinite ambient activity animation is not.
- Use `will-change` only on elements that actually animate.
- Clean up or kill GSAP timelines/tweens/listeners on lifecycle teardown.
- Respect `prefers-reduced-motion` and land directly in meaningful end states.
- Do not add ScrollTrigger or heavy motion to ordinary application scrolling unless the interaction truly depends on scroll position.
- Product state and interaction must remain understandable when animation or the GSAP CDN is unavailable.
- Animation code reacts to domain state. It must not become the owner of domain state.

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
- live canvas state is driven by real Work/Run events;
- Artifact / Needs You / Review appears on the owning durable object;
- scene/lens changes preserve shell, URL, browser history, and composer access;
- mobile containment and touch reachability;
- reduced-motion end states;
- unavailable provider states remain legible;
- animation is not required for the underlying action to work.

Real-provider behavior should additionally be exercised on a trusted local device through the manual self-hosted runner workflow only when that work is intentionally resumed. Never let untrusted pull requests target a personal self-hosted runner.
