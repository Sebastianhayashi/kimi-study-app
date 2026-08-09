# Lucubro Company Workbench design system

This document translates [`PRODUCT-THESIS.md`](PRODUCT-THESIS.md) into visual and interaction rules.

It does not define product strategy by inventing navigation. Domain objects, lenses, and configuration surfaces must follow the product thesis and durable domain decisions first.

## Design read

- Product: single-person company AI operating workbench.
- Primary user: CEO / owner-operator.
- Core metaphor: one persistent AI company canvas, not a collection of SaaS pages.
- Language: calm, technical, decisive, minimal without feeling empty.
- Foundation: Geist typography, native CSS, current product DOM, GSAP for motivated motion.
- Brand axis: Klein blue around `#002FA7`.
- Design variance: 6/10.
- Motion intensity: 7/10.
- Visual density: 6/10.

The interface should feel quieter than a dashboard but more alive than a chat window.

## Product inheritance

Multica is an operational backbone, not the UI template.

Lucubro preserves:

- durable Work/Issue state separate from Runs;
- evidence-first and decision-bearing structure;
- structured live activity instead of raw output;
- progressive disclosure;
- explicit authority and inspectability;
- low-noise, high-information-density surfaces;
- semantic status color;
- truthful unknown/loading/error states.

Lucubro departs from rigid screen-first interaction by allowing durable structure to materialize, update, focus, and recede around the current Work.

## Core interaction model

Two principles govern the product:

> **Quiet surface, kinetic intelligence.**
>
> **Conversation drives the canvas.**

Conversation is one input protocol for durable company state. It is not a disposable chat transcript and not a sidebar attached to a separate project-management application.

The Company Canvas is semantic, not a freeform diagram editor. Spatial anchors remain predictable while Work, responsibility, Project context, evidence, decisions, and execution state change in place.

A normal causal sequence is:

```text
Intent
  → durable Work forms
  → responsibility becomes visible
  → normalized live events update that Work
  → evidence grows inside the Work
  → Project context grows when warranted
  → Needs You / Review changes the same object
  → stable state settles
```

When the user or system is not changing state, motion stops.

### Interaction rhythm

1. **Acknowledge** — immediately show that an input or selection was received.
2. **Interpret / structure** — reveal the affected structure in a coordinated sequence.
3. **Receipt** — confirm only state Lucubro actually owns or can substantiate.
4. **Settle** — return the surface to a quiet stable state while context remains visible.

Animation should reduce uncertainty, not add ceremony.

## Surface taxonomy

Every visible concept must be classified before it receives navigation or permanent screen real estate.

### Domain object

Durable product truth: Work, Project, Issue, Employee, Run, Artifact, Decision.

A domain object does **not** automatically receive a top-level page.

### Canvas object

A visible projection of durable state in the active scene, for example an active Work object or Artifact evidence mounted inside it.

### Lens

A focused structured view over domain objects while the persistent Company Canvas Shell remains present.

Examples:

- durable Work index;
- Project Issues / Map / Activity;
- Employee responsibility/capability inspector;
- execution evidence or runtime state.

A lens can have a deep URL without becoming a separate application page.

### Transient interaction

Short-lived state such as an intent acknowledgement, path suggestions, selection receipt, loading/reconciliation state, or focus feedback.

Transient state must not be presented as durable truth.

### Configuration surface

Infrastructure or policy controls such as provider/account state, runtime configuration, workspace root, permissions, or advanced workforce configuration.

These surfaces appear when relevant and normally stay secondary to CEO work.

## Persistent Company Canvas Shell

The shell owns the stable relationship and input layer:

- Lucubro identity;
- Alex, the Workspace-level Primary Manager;
- command composer;
- Needs You attention;
- current Work Context;
- current canvas lens/focus;
- browser history / deep-link state.

Normal lens changes should update the scene inside this shell through History API rather than hard-reloading the product.

The shell must not disappear when the user focuses durable Work, an Employee, evidence, or execution settings.

### Canvas focus control

The current implementation uses one compact `Focus` control instead of a permanent row of product tabs.

It exists to change the current lens, not to advertise every domain noun in the system.

Current implementation lenses may include:

- Manager canvas;
- Work;
- Employees / responsibility;
- advanced execution settings.

This list is **not** the canonical product IA. Project, Knowledge, Usage, Account, Artifact, and future concepts must not be appended automatically. They become lenses or contextual surfaces only when a real workflow earns them.

## Information hierarchy

The CEO should normally perceive this order:

1. relationship / current company context;
2. current Work and responsibility;
3. live meaningful change;
4. blocker / risk / Needs You;
5. evidence / Artifact / Review;
6. project or execution detail when relevant;
7. infrastructure details only when they affect the decision.

Mechanisms should not visually outrank outcomes.

## Color system

Klein blue is the brand axis, not the paint bucket.

Brand blue is used for identity, primary action, focus, selection, active structure, and review-ready structure. Neutral surfaces carry most of the application. Semantic colors remain reserved for meaning.

### Brand blue scale

| Token | Value | Role |
| --- | --- | --- |
| `--brand-50` | `#f2f5ff` | subtle hover / selection fill |
| `--brand-100` | `#e8edff` | soft brand fill |
| `--brand-200` | `#cfd9ff` | low-emphasis borders |
| `--brand-300` | `#a9bbff` | subtle signal / event trace |
| `--brand-400` | `#7898ff` | inactive brand indicator |
| `--brand-500` | `#3f6cff` | bright structural accent |
| `--brand-600` | `#1d4be8` | strong accent |
| `--brand-700` | `#002fa7` | primary Lucubro blue |
| `--brand-800` | `#08277f` | hover / dark emphasis |
| `--brand-900` | `#0b205f` | deep brand ink |

### Neutrals

- Canvas: `#f6f7fb`
- Elevated canvas: `#f0f3f9`
- Surface: `#fbfcff`
- Strong surface: `#ffffff`
- Primary ink: `#121722`
- Secondary ink: `#323b4a`
- Muted text: `#667184`
- Border: `#e1e6ef`
- Strong border: `#cbd3e1`

Muted metadata used at small sizes must maintain readable contrast. Do not lighten text merely to make the interface look more delicate.

### Semantic colors

- Needs You / authority: amber `#9a5a12`
- Accepted / available / evidence-ready: green `#176a4d`
- Failed / destructive error: red `#a23f37`

Semantic colors never compete with Klein blue for general CTA ownership.

## Typography

Geist remains the product type family.

- Display: roughly 630 weight, tight tracking, balanced wrapping.
- Product headings: 620–660.
- Body: 400–500 with roughly 60–70 character measure.
- Metadata: 560–650, especially at 10–12px sizes.
- Numeric state: tabular figures.

Hierarchy comes from size, weight, line-height, spacing, and structure before color.

## Spacing and rhythm

Use a 4px base rhythm with common steps of 8, 12, 16, 20, 24, 32, 40, and 56px.

Whitespace must connect related content. Large empty acreage is not a feature.

The Manager canvas can contain:

1. Manager relationship;
2. outcome prompt;
3. Working set;
4. Durable Work Context when stored Work exists;
5. live Intent / Work objects;
6. contextual evidence and decisions;
7. command composer.

When live Work appears, intro content may compact so active state becomes the center of gravity without erasing the Manager relationship.

## Radius and elevation

- Controls: around 10px.
- Work/context objects: around 14–17px.
- Popovers/composer: around 18px.

Elevation is functional. Inline Work remains relatively flat. Temporary menus/disclosures use moderate elevation. The docked composer may use the strongest shadow because it floats over active state.

Avoid card-on-card nesting unless the nested block has a distinct interaction contract.

## Core canvas objects

### Manager relationship

Alex remains visible as the CEO-facing Primary Manager identity. Changing Work Context or lens must not silently imply a different default Manager relationship.

### Working set

The Working set is a compact projection, not a dashboard.

It may expose:

- Active Work;
- Review-ready Work;
- Needs You decisions.

Counts come from real product state and require an actionable path. Do not invent productivity metrics.

### Intent object

A submitted instruction enters the canvas as an Intent object rather than a conventional chat bubble.

States:

- `receiving` — submission is being converted into durable Work;
- `formed` — Work creation succeeded;
- `failed` — Work could not be formed.

The receipt changes in place. Do not append several manager messages to explain one causal transition.

### Live Work object

The Work object is the primary real-time surface.

It can contain:

- durable Work identity;
- responsible Employee;
- semantic Work state;
- one live state region for newest normalized public execution state;
- compact recent-event trace;
- Artifact evidence;
- execution detail as secondary disclosure;
- Needs You or Review actions when required.

Public incremental runtime updates replace the live state region. They do not create one bubble per token or tool event.

### Durable Work Context

Reload restores durable Work and evidence, not fabricated historical conversation.

The context can expose title, responsibility, updated time, semantic state, latest attached Run, recent meaningful activity, Artifact evidence, and review actions.

Evidence-load failure preserves the Work object and reports unavailable evidence rather than making the Work disappear.

### Project context

Project is a durable Work Context for long-running, multi-part work. It is not mandatory setup before the CEO can express intent.

When implemented, Project can grow around Work and expose Issues / Map / Activity / Decisions / dependencies / Artifact history as lenses inside the persistent shell.

Do not create an empty Projects app merely to prove that Project exists.

### Employee responsibility

Employees are durable identities. Employee information appears where responsibility matters and can open a contextual inspector for role/capability details.

Do not fabricate departments, headcount, performance metrics, or an org-chart dashboard to fill space.

### Knowledge

Knowledge should first appear as context/source/memory/evidence used by Work/Project. A global library is permitted only when a real search/archive workflow justifies it.

### Usage and account state

Usage/cost appears with the Work/Run/runtime that incurred it or when a budget boundary affects a decision.

Provider/account state is infrastructure and normally remains Advanced/Settings unless it blocks current Work.

### Artifact

Artifacts stay attached to owning Work. Summary copy should say what evidence exists, such as `Code changes · 1 file`, rather than generic `Details`.

### Needs You

Needs You is the interruptive authority surface.

Amber communicates the authority boundary while approve actions remain Klein blue. The owning Work remains visible and continuous while the decision is pending.

### Composer

The composer is the persistent command surface, not the biggest card in the product.

On an empty Manager scene it may follow content in normal flow. With active Work or a focused non-Manager lens it can dock so the CEO can redirect work without leaving current context.

### Execution setup

Execution setup remains progressive disclosure. Runtime/workspace mechanics are not the default CEO surface, but when opened they should feel unusually direct and responsive.

#### Runtime choice

- visible runtime rail instead of a native select as the primary UI;
- available and unavailable runtimes share one contract;
- unavailable choices stay visible but disabled;
- selection gives immediate truthful receipt;
- keyboard semantics follow radio-group behavior.

#### Host Workspace picker

Workspace is an execution-host concept.

The default control is one quiet line that becomes active only when needed.

Capabilities:

- disclosure triangle opens execution-host directory tree;
- nodes expand/collapse on demand;
- typed prefixes show real host directory suggestions;
- selected path receives real host inspection;
- `Repository found` / `Folder found` only after inspection evidence;
- `New folder` creates a directory inside configured root;
- hidden directories omitted from normal listing;
- no arbitrary file-content read API.

Visual states:

- `empty` — neutral gray line;
- `focused` — Klein-blue line wakes;
- `reading` — blue line + one-shot reading trace;
- `received` — manual path received, not necessarily verified;
- host-found repository/folder — verified receipt;
- error — failed host access or invalid operation.

Focus is orthogonal to receipt state: a previously received path must still wake to Klein blue whenever the user focuses the input.

#### Client folder drag

A client-side folder dragged from another machine is not an execution-host path.

Detect and acknowledge it, explain the boundary, and require future explicit import/copy or native same-host bridging. Never overwrite host path state or claim it is runnable without evidence.

## Motion system

Motion communicates hierarchy, feedback, causality, continuity, focus, and state ownership.

Three scales are used:

- **micro** — focus, selection, receipt, disclosure, suggestions/tree;
- **object** — Intent/Work/Artifact/Decision mount/update/settle;
- **scene** — lens/focus changes while the shell remains continuous.

GSAP can coordinate:

1. shell / Working set entrance;
2. state-count changes;
3. Intent mount and receipt replacement;
4. Work formation;
5. live event replacement inside Work;
6. Artifact mount/update;
7. Needs You / Review / Accepted / Failed transitions;
8. Durable Work selection/detail;
9. lens menu and scene focus transitions;
10. Execution setup lifecycle;
11. runtime-choice lifecycle;
12. workspace focus/tree/suggestion/receipt/create-folder feedback.

Typical timing grammar:

- acknowledgement: 80–160ms;
- small exit: 100–160ms;
- local selection/receipt: 180–280ms;
- live event replacement: 120–240ms;
- evidence entrance: 180–300ms;
- scene/lens transition: roughly 180–360ms;
- coordinated disclosure reveal: 220–420ms.

No deliberate delay should make deterministic actions or real events feel slower than they are.

See [`MOTION-SYSTEM.md`](MOTION-SYSTEM.md).

## Responsive contract

### Desktop

- roughly 980–1060px maximum primary canvas width;
- Manager relationship remains legible in top bar;
- lens focus control is compact, not a permanent tab row;
- live Work retains stable signal gutter;
- contextual lenses preserve composer access;
- runtime choices use compact columns/rail;
- workspace tree stays inline in Execution setup.

### Tablet

- Working set can stack description above metrics;
- Work and lens content retain canvas alignment;
- runtime choices compress while names and availability remain readable;
- workspace tree uses bounded vertical scrolling.

### Mobile

- brand wordmark may collapse to mark;
- Alex remains identifiable;
- Needs You retains text + count;
- lens selector becomes a contained popover rather than horizontal product navigation;
- Work/Intent use full useful width;
- live state wraps instead of truncating essential copy;
- runtime choices can become horizontal scroll rail;
- workspace tree is vertically bounded;
- composer remains reachable with safe-area spacing;
- practical touch targets are about 40–44px where space allows;
- no lens/menu/tree motion may create horizontal page overflow.

## Checklist Design release gate

Every Company UI change is reviewed against Checklist Design for:

### System

- typography hierarchy and readable measure;
- spacing rhythm/alignment;
- semantic color and contrast;
- shared radius/elevation roles.

### Component states

- default / hover / active / focus-visible / disabled / loading / success / empty / error;
- inputs keep clear label/focus/error semantics;
- Runtime choice handles available/unavailable/selected/keyboard/receipt;
- Workspace path handles neutral/focus/reading/received/verified/error;
- Workspace tree handles collapsed/loading/expanded/empty/error/selected/create-folder;
- lens menu handles closed/open/current/focus/Escape/click-away;
- Intent handles receiving/formed/failed;
- Work handles forming/running/update/evidence/Needs You/review/accepted/failed/reconnecting;
- loading copy says what is actually happening instead of generic `Loading`.

### Accessibility

- keyboard navigation and focus restoration;
- semantic names/roles;
- skip navigation;
- touch target sizing;
- reduced motion lands on identical semantic state;
- GSAP failure does not remove functionality.

### Responsiveness

- fluid layout;
- explicit desktop/tablet/mobile behavior;
- information hierarchy survives collapse;
- no horizontal page overflow;
- fixed/sticky surfaces are reviewed using real viewport geometry.
