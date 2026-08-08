# Lucubro Company Workbench design system

This document defines the visual and interaction system for the Company Workbench. It is product-specific. The Manager conversation stays primary, while durable Work, review evidence, approvals, execution controls, and motion appear when they carry decision value.

## Design read

- Product: single-person company AI operating workbench.
- Primary user: CEO / owner-operator.
- Language: calm, technical, decisive, minimal without feeling empty.
- Foundation: Geist typography, native CSS, current product DOM, GSAP for motivated motion.
- Design variance: 6/10.
- Motion intensity: 7/10.
- Visual density: 6/10.

The interface should feel quieter than a dashboard but more structured than a chat window. Motion can be expressive, but the resting surface remains restrained.

## Interaction character: Quiet surface, kinetic intelligence

Lucubro uses motion as part of the product language, not as decoration.

> **Quiet surface, kinetic intelligence.**

At rest, the interface is calm. When the user expresses intent, chooses an execution path, enters context, or crosses a decision boundary, the interface should respond continuously enough to make the system feel attentive and legible.

The standard interaction rhythm is:

1. **Acknowledge**: immediately show that the input or selection was received.
2. **Interpret / structure**: reveal the affected options or structure in a short coordinated sequence.
3. **Receipt**: provide one clear confirmation of the state that Lucubro actually owns.
4. **Settle**: return the surface to a quiet stable state with the chosen context preserved.

This rhythm should reduce steps, not add ceremonial animation between the user and their task.

### Honesty boundary

Motion must never claim more than the underlying product state proves.

Allowed examples:

- `Path received` after the browser receives repository-path text.
- a selected-runtime receipt after the user chooses a runtime.
- Work moving to `Ready for review` after the canonical Work/Run state and Artifact evidence say so.
- Needs You entering the attention layer after an actual approval request exists.

Disallowed examples:

- `Repository validated` before Lucubro has actually validated it.
- a fake percentage or staged progress animation that is not driven by real progress.
- `Agent working` merely because a button was pressed.
- `Completed` before canonical completion and required evidence exist.

Lucubro should feel alive because it responds to real state, not because it performs fake AI theatre.

## Color system

Klein blue is the brand axis, not the paint bucket. Brand blue is used for identity, primary actions, selected execution paths, active structure, review-ready states, focus, and selected controls. Neutral surfaces carry most of the page. Semantic colors are reserved for meaning.

### Brand blue scale

| Token | Value | Role |
| --- | --- | --- |
| `--brand-50` | `#f2f5ff` | subtle hover / selection fill |
| `--brand-100` | `#e8edff` | soft brand fill |
| `--brand-200` | `#cfd9ff` | low-emphasis borders |
| `--brand-300` | `#a9bbff` | subtle signal / trace |
| `--brand-400` | `#7898ff` | inactive brand indicator |
| `--brand-500` | `#3f6cff` | bright review accent |
| `--brand-600` | `#1d4be8` | strong accent |
| `--brand-700` | `#002fa7` | primary Lucubro blue |
| `--brand-800` | `#08277f` | hover / dark emphasis |
| `--brand-900` | `#0b205f` | deep brand ink |

`#002fa7` is the Klein-blue-inspired product primary. It is a role token, not a requirement that every blue surface use the same value.

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

The neutral family stays cool so Klein blue reads as intentional rather than pasted onto a warm UI. Muted text must remain readable at metadata sizes.

### Semantic colors

- Needs You / authority: amber `#9a5a12`
- Accepted / available / confirmed receipt: green `#176a4d`
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

Whitespace must connect related content. Large empty areas are not a feature. The default front door contains:

1. Manager relationship.
2. Outcome prompt.
3. Manager operating model.
4. Working set.
5. Durable Work Context when stored Work exists.
6. Current Conversation / Work evidence.
7. Composer.

## Radius and elevation

- Controls: 10px.
- Work / context objects: 14px.
- Popovers / composer: 18px.

Elevation is functional. Inline Work stays near-flat. Disclosure panels use medium elevation. The docked composer can use the strongest shadow because it floats over active Work.

Avoid card-on-card nesting unless the nested block has a distinct interaction contract.

## Core product surfaces

### Manager relationship

Alex is visible in the top bar and opening prompt. Presence uses semantic green only for availability. Avatar and product identity use Lucubro blue.

### Working set

The Working set is not a dashboard. It is a compact projection of actionable current and reload-restored durable Work.

It shows:

- Active Work.
- Review-ready Work.
- Needs You decisions.

Counts must come from real product state. Do not invent productivity metrics. A durable count is allowed only when the corresponding Work can be opened and acted on.

### Durable Work Context

Durable Work Context bridges Conversation and persistent company state. It appears only when stored Work exists and stays inline below the Working set.

The contract is:

- reload restores Work objects, not fabricated historical chat;
- each row exposes title, Employee, updated time, and semantic status;
- selecting a Work reveals the latest attached Run, recent activity, Artifact evidence, and execution metadata;
- review-ready Work exposes Accept / Rework directly;
- accepted and terminal Work remain inspectable without pretending to be active;
- loading copy says what is being recovered;
- evidence-load failure preserves the Work row and reports unavailable evidence rather than hiding the Work.

### Work

Work is the durable business object. It gets a thin brand signal rail and semantic status, but remains visually quieter than a blocking decision surface.

Status rules:

- Running / starting: neutral surface with blue signal.
- Ready for review: brand-blue review state.
- Needs You: amber authority state.
- Accepted: green final state.
- Failed: red error state.

### Artifact

Artifacts remain inline inside Work. Summaries say what evidence exists, for example `Code changes · 1 file`, rather than generic `Details` copy.

### Needs You

Needs You is the interruptive decision surface. Amber communicates authority change while approve actions remain brand blue.

The panel must support keyboard focus, Escape dismissal, click-away dismissal, empty state, multiple decision cards, and explicit approval / denial wording.

### Composer

The composer is the command surface, not the biggest card on the page. On a truly empty front door it follows the Working set in normal flow. Once current or durable Work exists, it becomes a fixed bottom dock so the CEO can issue the next instruction without losing Work context.

### Execution setup

Execution setup is progressive disclosure. Repository and runtime details are implementation context, not the default CEO surface.

When opened, however, it should feel unusually direct and responsive.

#### Runtime choice

- Do not hide execution engines inside a native select in the primary interaction.
- Present available and unavailable runtimes together as a compact horizontal / grid choice surface.
- Current examples are Claude Code, Codex, and Mock; future adapters enter the same rail from runtime state rather than bespoke UI.
- Each choice has a compact mark, name, and availability state.
- Unavailable runtimes stay visible but disabled. Availability is part of the user's mental model.
- Selection gives an immediate visual receipt and updates the compact Execution setup summary.
- Keyboard semantics use a radiogroup / radio choice model.

The native runtime value may remain hidden underneath as an implementation seam, but the user-facing interaction is the runtime rail.

#### Repository path

The repository path uses a line-based control rather than a boxed form field.

States:

- `empty`: quiet neutral line and explicit prompt;
- `focused`: the Klein-blue line wakes immediately;
- `reading`: a short one-shot trace moves across the line while local input is settling;
- `received`: the trace stops and a `Path received` receipt appears;
- error: use the established error semantics when actual validation fails later.

`Reading path…` is local interaction feedback. It must not imply that Lucubro has inspected the filesystem. Filesystem validation belongs to the real Work/start boundary.

Closing Execution setup should settle back into the composer and preserve a compact summary such as `repository-name · Mock`.

## Motion system

Motion communicates hierarchy, feedback, causality, continuity, focus, and state ownership.

GSAP owns coordinated product sequences, including:

1. top-bar / Working set entrance;
2. state-count changes;
3. Work transitions into Ready for review or Needs You;
4. one-time entrance of restored Durable Work and selected detail;
5. Execution setup entrance / exit;
6. runtime-choice reveal and selection receipt;
7. repository-path reading / receipt feedback.

### Timing grammar

- acknowledgement: roughly 80 to 160ms;
- selection / local receipt: roughly 180 to 280ms;
- coordinated reveal: roughly 220 to 420ms;
- no deliberate delay should make a deterministic local action feel slower than it is.

Use `power2.out` as the default settling ease. Use stronger eases only when they reinforce state change rather than adding bounce for its own sake.

### Implementation rules

- Prefer GSAP timelines for coordinated multi-step sequences instead of arbitrary delay chains.
- Prefer transforms and `autoAlpha` / opacity over layout properties.
- Use stagger for related choices that enter as one group.
- Do not animate width, height, top, left, margin, or padding when a transform can communicate the same transition.
- Kill or revert animations on lifecycle teardown.
- Use `will-change` only on elements that actually animate.
- `prefers-reduced-motion: reduce` skips non-essential motion and lands directly in the meaningful end state.
- Product state must remain understandable when GSAP fails to load.
- No ScrollTrigger on this workbench. Scroll is navigation, not a storytelling timeline.
- No infinite ambient loops whose only purpose is to make the product feel "AI".

## Responsive contract

### Desktop, 861px and above

- 980px maximum conversation container.
- Manager relationship remains centered in the top bar.
- Working set uses one description column and three compact numeric columns.
- Durable Work expands inline.
- Runtime choices use a compact multi-column rail.

### Tablet, 561 to 860px

- Working set stacks description above metrics.
- Work stays aligned to the conversation gutter where space allows.
- Durable Work remains inline without horizontal page scrolling.
- Runtime choices may compress but keep names and availability readable.

### Mobile, 560px and below

- Brand wordmark may collapse to the mark.
- Manager remains identifiable.
- Needs You retains text plus count.
- Working set occupies the full conversation width.
- Current and durable Work become full width.
- Runtime choices become a contained horizontal scroll rail instead of overflowing the viewport.
- Repository path remains a full-width line control.
- Empty-state composer follows content flow; Work-context composer docks with safe-area spacing.
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
- Repository path: empty, focused, reading, received, error, disabled.
- Disclosure: collapsed, expanded, hover, focus, close/exit.
- Needs You: empty, decision present, approve, deny, dismiss.
- Work: starting, in progress, Needs You, review, accepted, failed.
- Durable Work: empty, list, selected, evidence loading, evidence error, review decision, terminal state.
- Loading copy describes the action instead of using a generic `Loading` label.

### Responsiveness

- Fluid layout.
- Explicit mobile / tablet / desktop behavior.
- Responsive type sizes.
- Touch target sizing.
- Information hierarchy remains intact after collapse.
- Motion does not create horizontal page overflow.

### Accessibility

- Keyboard operation.
- Visible focus.
- Reduced motion.
- Live regions announce dynamic product state only.
- Color is never the only carrier of status.
- Runtime choices expose selection semantics.
- Expandable Work rows expose expanded state and a clear detail destination.

## Taste-skill audit notes

The external taste-skill is used as an audit lens for anti-template design, typography, spacing, color calibration, density, responsive behavior, and motivated motion.

It explicitly says it is not the primary pattern library for dashboards, data tables, or multi-step product UI. Lucubro therefore keeps its own conversation-first information architecture and durable Work model instead of mechanically applying landing-page patterns.

The desired result is minimal, not empty: fewer surfaces, stronger hierarchy, more decision-bearing information, and richer feedback at the exact moments the user expresses intent.
