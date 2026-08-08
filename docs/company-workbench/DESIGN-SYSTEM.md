# Lucubro Company Workbench design system

This document defines the visual and interaction system for the Company Workbench. It is product-specific. Alex remains the primary interface, while durable Work, Employees, evidence, decisions, execution controls, and motion become visible when they carry operational value.

## Design read

- Product: single-person company AI operating workbench.
- Primary user: CEO / owner-operator.
- Language: calm, technical, decisive, minimal without feeling empty.
- Foundation: Geist typography, native CSS, current product DOM, GSAP for motivated motion.
- Design variance: 6/10.
- Motion intensity: 7/10.
- Visual density: 6/10.

The interface should feel quieter than a dashboard but more alive than a chat window.

## Core interaction model

Lucubro has two linked interaction principles:

> **Quiet surface, kinetic intelligence.**
>
> **Conversation drives the canvas.**

The Manager surface is a live company canvas. Conversation is the input protocol that creates and mutates durable product objects.

The canvas is not a freeform diagram editor. Spatial anchors remain predictable while Work, Employee assignment, Run state, Artifact evidence, and decisions change in place.

A normal sequence is:

```text
Intent
  → Work formed
  → Employee / Run attached
  → live normalized events
  → Artifact / Needs You / Review
  → stable state
```

When the user or system is not changing state, motion stops.

### Interaction rhythm

1. **Acknowledge**: immediately show that input or selection was received.
2. **Interpret / structure**: reveal the affected structure in a short coordinated sequence.
3. **Receipt**: confirm only state Lucubro actually owns or has evidence for.
4. **Settle**: return the surface to a quiet stable state with context preserved.

Animation should reduce uncertainty, not add ceremony.

### Honesty boundary

Allowed examples:

- `Intent received` after the submission begins.
- `Work formed` after the Work API returns durable Work.
- `Repository found` after the host workspace API inspects the directory.
- a runtime selection receipt after the user chooses a runtime.
- `Ready for review` only after canonical Run completion and Artifact evidence.
- Needs You only after a real approval request.

Disallowed examples:

- fake thinking;
- fake token streams;
- fake percentages;
- staged AI progress unsupported by product events;
- `Repository found` when the browser merely received path text;
- `Agent working` because a button was pressed;
- raw chain-of-thought.

Lucubro should feel alive because it responds to real state, not because it performs fake AI theatre.

## Color system

Klein blue is the brand axis, not the paint bucket. Brand blue is used for identity, primary actions, active structure, selection, live canvas state, focus, and review-ready structure. Neutral surfaces carry most of the application. Semantic colors are reserved for meaning.

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

The neutral family stays cool so Klein blue reads as intentional rather than pasted on top.

### Semantic colors

- Needs You / authority: amber `#9a5a12`
- Accepted / available / evidence-ready: green `#176a4d`
- Failed / destructive error: red `#a23f37`

Semantic colors never compete with the brand for general CTA ownership.

## Typography

Geist remains the only product type family.

- Display: 630 weight, tight tracking, balanced wrapping.
- Product headings: 620 to 660.
- Body: 400 to 500 with roughly 60 to 70 character measure.
- Metadata: 560 to 650, never rely on low-contrast 400-weight microcopy.
- Numeric state: tabular figures.

Hierarchy is created through size, weight, line height, spacing, and structure before color.

## Spacing and rhythm

Use a 4px base rhythm with common steps of 8, 12, 16, 20, 24, 32, 40, and 56px.

Whitespace must connect related content. Large empty areas are not a feature. The Manager front door contains:

1. Manager relationship.
2. Outcome prompt.
3. Manager operating model.
4. Working set.
5. Durable Work Context when stored Work exists.
6. Live canvas objects produced by current intent and real events.
7. Composer.

When live Work appears, the intro may visually compact so active company state becomes the center of gravity without removing the Manager relationship.

## Radius and elevation

- Controls: 10px.
- Work / context objects: 14 to 17px.
- Popovers / composer: 18px.

Elevation is functional. Inline Work stays relatively flat. Disclosure panels use medium elevation. The docked composer can use the strongest shadow because it floats over active Work.

Avoid card-on-card nesting unless the nested block has a distinct interaction contract.

## Product information architecture

The Company shell exposes four sections without a permanent sidebar:

- **Manager**: live canvas and command front door.
- **Work**: durable Work index.
- **Employees**: durable identities and real assignment counts.
- **Settings**: runtime availability and host workspace state.

The section navigation is compact and horizontal. It must not compete with Alex as the product relationship layer.

## Core product surfaces

### Manager relationship

Alex is visible in the top bar and opening prompt. Presence uses semantic green only for availability. Avatar and product identity use Lucubro blue.

### Working set

The Working set is not a dashboard. It is a compact projection of actionable current and durable Work.

It shows:

- Active Work.
- Review-ready Work.
- Needs You decisions.

Counts come from real product state. Do not invent productivity metrics. A durable count is allowed only when the corresponding Work can be opened and acted on.

### Live canvas intent

A submitted instruction enters the Manager canvas as an **Intent object**, not a conventional chat bubble.

States:

- `receiving`: the request is being sent/structured into Work;
- `formed`: the Work API has returned durable Work and Employee assignment;
- `failed`: durable Work could not be formed.

The receipt text changes in place. Do not append several manager bubbles to explain one causal transition.

### Live Work object

A current Work object is the primary real-time surface.

It contains:

- durable Work identity and Employee;
- semantic Work status;
- one live state region for the newest normalized public Run state;
- a compact recent-event trace;
- Artifact evidence when it exists;
- Execution details as secondary disclosure;
- Needs You or Review actions when required.

Public incremental runtime updates replace the live state region. They do not create one bubble per token/event.

The object should visually retain identity while its left signal rail and live state adopt neutral, authority, evidence-ready, or error semantics.

### Durable Work Context

Durable Work Context bridges the current canvas and persistent company state. It appears only when stored Work exists and stays inline below the Working set.

The contract is:

- reload restores Work objects, not fabricated historical chat;
- each row exposes title, Employee, updated time, and semantic status;
- selecting a Work reveals the latest attached Run, recent activity, Artifact evidence, and execution metadata;
- review-ready Work exposes Accept / Rework directly;
- accepted and terminal Work remain inspectable without pretending to be active;
- loading copy says what is being recovered;
- evidence-load failure preserves the Work row and reports unavailable evidence rather than hiding the Work.

### Work index

The Work section is a list of durable Work, not a dashboard of metrics. Rows expose title, Employee/time context, semantic status, and an actionable return path to Work Context.

### Employees

Employees are durable identities. The Employees section shows only identities returned by product state. Do not fabricate departments, headcount, roles, or performance metrics to fill the page.

### Artifact

Artifacts remain inside the Work that owns them. Summaries say what evidence exists, for example `Code changes · 1 file`, rather than generic `Details` copy.

Artifact mount/update motion is event-driven. Evidence does not appear before the corresponding Artifact event.

### Needs You

Needs You is the interruptive decision surface. Amber communicates authority change while approve actions remain brand blue.

The panel must support keyboard focus, Escape dismissal, click-away dismissal, empty state, multiple decision cards, and explicit approval / denial wording.

The owning Work remains visible and moves into the same authority tone while the decision is pending.

### Composer

The composer is the command surface, not the biggest card on the page. On a truly empty front door it follows the Working set in normal flow. Once current or durable Work exists, it becomes a fixed bottom dock so the CEO can issue the next instruction without losing Work context.

Submission should visually connect the input action to the new Intent object and use the normal Execution setup exit lifecycle rather than instantly hiding the disclosure.

### Execution setup

Execution setup is progressive disclosure. Workspace and runtime details are implementation context, not the default CEO surface.

When opened, however, it should feel unusually direct and responsive.

#### Runtime choice

- Do not hide execution engines inside a native select in the primary interaction.
- Present available and unavailable runtimes together as a compact horizontal / grid choice surface.
- Claude Code, Codex, Mock, and future adapters use the same runtime-choice contract.
- Each choice has a compact mark, name, and availability state.
- Unavailable runtimes stay visible but disabled.
- Selection gives an immediate receipt and updates the compact summary.
- Keyboard semantics use a radiogroup / radio model.

The native runtime value may remain hidden underneath as an implementation seam.

#### Host Workspace picker

Workspace is an execution-host concept.

The default visual control remains one quiet line, but it can expand into real navigation when needed.

Capabilities:

- disclosure triangle opens an inline execution-host directory tree;
- tree nodes expand/collapse on demand;
- typed path prefixes show real host directory suggestions;
- selecting a path triggers real host inspection;
- host inspection may truthfully return `Repository found` or `Folder found`;
- a `New folder` action creates a real directory inside the configured root;
- manually entered paths outside the browsable root remain allowed as unverified input and are validated later at the Work boundary;
- normal tree listing omits hidden directories;
- the picker does not expose arbitrary file-content reads.

States:

- `empty`: quiet neutral line;
- `focused`: Klein-blue line wakes;
- `reading`: one-shot trace while host suggestion/inspection is resolving;
- `received`: manual path received but not host-verified;
- `folder-found`: real host directory evidence;
- `repository-found`: real host Git evidence;
- error: failed host access or invalid operation.

#### Client folder drag

A browser on another machine cannot turn a client folder into an execution-host path merely by dragging it into the page.

If a client-side directory is dropped while the execution host is remote:

- acknowledge the folder was detected;
- explain that it belongs to the browser device;
- do not overwrite the host workspace path;
- do not claim it is runnable;
- future support must use an explicit copy/import flow or native same-host bridge.

## Motion system

Motion communicates hierarchy, feedback, causality, continuity, focus, and state ownership.

GSAP owns coordinated product sequences including:

1. shell / Working set entrance;
2. state-count changes;
3. Intent mount and receipt replacement;
4. Work-object formation;
5. live Run event replacement inside the Work object;
6. Artifact mount/update;
7. Work transitions into Needs You, Review, Accepted, or Failed;
8. Durable Work entrance and selected detail;
9. Execution setup entrance / exit;
10. runtime-choice mount/replacement/selection;
11. workspace tree, suggestions, inspection receipts, and create-folder feedback.

### Timing grammar

- acknowledgement: roughly 80 to 160ms;
- small exit: roughly 100 to 160ms;
- selection / local receipt: roughly 180 to 280ms;
- real-time event replacement: roughly 120 to 240ms;
- evidence-region entrance: roughly 180 to 300ms;
- coordinated reveal: roughly 220 to 420ms.

No deliberate delay should make a deterministic action or real incoming event feel slower than it is.

### Implementation rules

- Prefer GSAP timelines for coordinated sequences instead of arbitrary delay chains.
- Prefer transforms and `autoAlpha` / opacity over layout properties.
- Use stagger for related choices that enter as one group and reverse stagger on exit.
- Use one-shot event pulses, never infinite ambient AI animation.
- Do not animate width, height, top, left, margin, or padding when a transform can communicate the same transition.
- Kill or revert animations on lifecycle teardown.
- Use `will-change` only on elements that actually animate.
- `prefers-reduced-motion: reduce` skips non-essential movement and lands directly in the same semantic state.
- Product state remains understandable when GSAP fails to load.
- No ScrollTrigger on ordinary application scrolling.
- Animation reacts to product/domain state. It never becomes the source of truth for that state.

See [`MOTION-SYSTEM.md`](MOTION-SYSTEM.md) for the complete lifecycle and event choreography.

## Responsive contract

### Desktop, 861px and above

- roughly 980 to 1060px maximum Manager canvas.
- Manager relationship remains centered in the top bar.
- Working set uses one description column and three compact numeric columns.
- Live Work objects keep a stable left canvas spine and readable evidence width.
- Durable Work expands inline.
- Runtime choices use a compact multi-column rail.
- Workspace tree remains inline inside Execution setup.

### Tablet, 561 to 860px

- Working set stacks description above metrics.
- Work stays aligned to the canvas gutter where space allows.
- Durable Work remains inline without horizontal page scrolling.
- Runtime choices compress but keep names and availability readable.
- Workspace tree uses bounded vertical scrolling.

### Mobile, 560px and below

- Brand wordmark may collapse to the mark.
- Manager remains identifiable.
- Needs You retains text plus count.
- Top-level Company navigation scrolls horizontally without page overflow.
- Working set occupies full canvas width.
- Canvas spine moves to the smallest useful gutter.
- Intent and Work become full width.
- Live state wraps its descriptive copy instead of truncating it.
- Runtime choices become a contained horizontal scroll rail.
- Workspace remains a full-width line control; the tree is vertically bounded.
- Empty-state composer follows content flow; active Work composer docks with safe-area spacing.
- Touch actions keep at least 40 to 44px practical target height where space permits.

## Checklist Design release gate

Every Company UI change should verify:

### Design system

- Typography hierarchy, weight, leading, and usage are consistent.
- Brand colors have documented roles, not only hex values.
- Spacing, radius, and elevation follow shared tokens.

### Components and states

- Buttons: default, hover, active, focus-visible, disabled, loading.
- Inputs: label, placeholder, focus, invalid/error, disabled.
- Runtime choice: available, unavailable, selected, keyboard focus, receipt.
- Workspace path: empty, focused, reading, received, host-found, error, disabled.
- Workspace tree: collapsed, loading, expanded, empty, error, selected, new-folder creation.
- Disclosure: collapsed, expanded, hover, focus, close/exit.
- Intent: receiving, formed, failed.
- Live Work: forming, running, update, tool state, evidence, Needs You, review, accepted, failed, reconnecting.
- Needs You: empty, decision present, approve, deny, dismiss.
- Durable Work: empty, list, selected, evidence loading, evidence error, review decision, terminal state.
- Loading copy describes the actual action instead of using a generic `Loading` label.

### Responsiveness

- Fluid layout.
- Explicit mobile / tablet / desktop behavior.
- Responsive type sizes.
- Touch target sizing.
- Information hierarchy remains intact after collapse.
- Motion and tree expansion do not create horizontal page overflow.
