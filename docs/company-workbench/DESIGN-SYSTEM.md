# Lucubro Company Workbench design system

This document defines the visual and interaction system for the Company Workbench. It is intentionally product-specific. The Manager conversation stays primary, while durable Work, review evidence, approvals, and execution controls remain visible when they carry decision value.

## Design read

- Product: single-person company AI operating workbench.
- Primary user: CEO / owner-operator.
- Language: calm, technical, decisive, sparse without feeling empty.
- Foundation: existing Geist typography, native CSS, current product DOM, GSAP for motivated motion only.
- Design variance: 6/10.
- Motion intensity: 5/10.
- Visual density: 6/10.

The interface should feel quieter than a dashboard but more structured than a chat window.

## Color system

Klein blue is the brand axis, not the paint bucket. Brand blue is used for identity, primary actions, active structure, review-ready states, focus, and selected controls. Neutral surfaces carry most of the page. Semantic colors are reserved for meaning.

### Brand blue scale

| Token | Value | Role |
| --- | --- | --- |
| `--brand-50` | `#f2f5ff` | subtle hover / selection fill |
| `--brand-100` | `#e8edff` | soft brand fill |
| `--brand-200` | `#cfd9ff` | low-emphasis borders |
| `--brand-300` | `#a9bbff` | decorative signal / timeline |
| `--brand-400` | `#7898ff` | inactive brand indicator |
| `--brand-500` | `#3f6cff` | bright review accent |
| `--brand-600` | `#1d4be8` | strong accent |
| `--brand-700` | `#002fa7` | primary Lucubro blue |
| `--brand-800` | `#08277f` | hover / dark emphasis |
| `--brand-900` | `#0b205f` | deep brand ink |

`#002fa7` is used as the Klein-blue-inspired product primary. The design system treats it as a role token, not as a requirement that every blue surface use the exact same value.

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

The neutral family stays cool so the Klein blue reads as intentional rather than pasted onto a warm beige UI. The muted text token is intentionally dark enough for normal-size metadata on both the main canvas and white surfaces instead of treating low contrast as a visual style.

### Semantic colors

- Needs You / authority: amber `#9a5a12`
- Accepted / available: green `#176a4d`
- Failed / destructive error: red `#a23f37`

Semantic colors never compete with the brand for general CTA ownership.

## Typography

Geist remains the only product type family.

- Display: 630 weight, tight tracking, balanced wrapping.
- Product headings: 620 to 660.
- Body: 400 to 500 with roughly 60 to 70 character measure.
- Metadata: 560 to 650, never rely on low-contrast 400-weight microcopy.
- Numeric state: tabular figures.

The hierarchy is created through size, weight, line height, and spacing before color.

## Spacing and rhythm

Use a 4px base rhythm with common steps of 8, 12, 16, 20, 24, 32, 40, and 56px.

Whitespace must connect related content. Large empty areas are not a feature. The default desktop front door contains:

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

Elevation is functional:

- Flat or near-flat for inline Work.
- Medium shadow for disclosure panels.
- Strongest shadow only when the composer is docked over an active conversation.

Avoid card-on-card nesting unless the nested block has a distinct interaction contract.

## Core product surfaces

### Manager relationship

Alex is visible in the top bar and in the opening prompt. Presence uses semantic green only for availability. The avatar and product identity use Lucubro blue.

### Working set

The Working set is not a dashboard. It is a compact state projection derived from actionable current Work and reload-restored durable Work that has a corresponding interaction path.

It shows:

- Active Work.
- Review-ready Work.
- Needs You decisions.

Counts must come from real product state. Do not invent productivity metrics. A durable count is allowed only when the corresponding Work can be opened and acted on. A visible count without an actionable destination is a dead end.

### Durable Work Context

Durable Work Context is the bridge between Conversation and persistent company state. It appears only when stored Work exists.

It is not a second navigation system and not a permanent sidebar. The surface sits inline below the Working set and shows a compact recent Work list. Selecting a Work expands its detail in place.

The contract is:

- reload restores Work objects, not fabricated historical chat;
- each row exposes title, Employee, updated time, and current semantic status;
- selecting a row reveals the latest attached Run, recent activity, Artifact evidence, and execution metadata;
- review-ready Work exposes Accept / Rework directly in the durable detail;
- accepted and terminal Work remain inspectable without pretending to be active;
- loading copy says what is being recovered, for example `Loading Work evidence…`;
- an evidence-load failure preserves the Work row and reports that evidence is unavailable rather than making the Work disappear.

The current surface may show a bounded recent set. A dedicated history browser is a separate future product decision.

### Work

Work is the durable business object. It receives a thin brand signal rail and a semantic status, but remains visually quieter than the composer or Needs You panel.

Status rules:

- Running / starting: neutral surface with blue signal.
- Ready for review: brand-blue review state.
- Needs You: amber authority state.
- Accepted: green final state.
- Failed: red error state.

### Artifact

Artifacts remain inline inside Work. The summary must say what evidence is available, for example `Code changes · 1 file`, instead of a generic `Details` label.

In the current Conversation, Artifacts default to collapsed. In Durable Work Context, a review-ready Artifact may open by default because the explicit task is evidence review.

### Needs You

Needs You is the only interruptive decision surface. Amber communicates authority change, while the primary approve action stays brand blue.

The panel must support:

- keyboard focus;
- Escape dismissal;
- click-away dismissal;
- empty state;
- one or more decision cards;
- explicit approval and denial wording.

### Composer

The composer is the command surface, not the biggest card on the page. On a truly empty front door it stays in the normal content flow directly after the Working set, so the first screen feels intentional rather than hollow. Once current or durable Work exists, it becomes a fixed bottom dock so the CEO can issue the next instruction without losing Work context.

Execution setup remains a disclosure because repository and runtime details are implementation context, not CEO-level primary content.

## Motion system

Motion must communicate hierarchy, feedback, or state change.

GSAP owns:

1. top-bar / working-set entrance sequencing;
2. state-count changes;
3. Work transitions into Ready for review or Needs You;
4. one-time entrance of restored Durable Work and its selected detail.

Existing functional animations for messages and the Needs You panel remain in the current Company script.

Rules:

- Animate transforms and opacity rather than layout properties.
- Typical duration: 220 to 340ms.
- Primary easing: `power2.out`.
- Attention motion happens once on state change, never loops indefinitely.
- `prefers-reduced-motion: reduce` skips non-essential motion.
- `gsap.matchMedia()` owns responsive and reduced-motion setup where responsive motion differs and must be reverted on page lifecycle cleanup.
- No ScrollTrigger for this product surface. Scroll is navigation, not a storytelling timeline.

## Responsive contract

### Desktop, 861px and above

- 980px maximum conversation container.
- Manager relationship remains centered in top bar.
- Working set uses one description column and three compact numeric columns.
- Durable Work uses a compact two-column row: Work identity on the left, status on the right.
- Selected Work detail expands inline instead of opening a permanent side rail.

### Tablet, 561 to 860px

- Working set stacks description above metrics.
- Work stays aligned to the conversation avatar gutter when space allows.
- Durable Work remains inline and keeps status readable without horizontal scrolling.

### Mobile, 560px and below

- Brand wordmark may collapse to the mark.
- Manager remains identifiable.
- Needs You retains text plus count.
- Working set occupies the full conversation width.
- Current and durable Work become full width.
- Durable Work rows stack identity above status.
- Empty-state composer follows the content flow; Work-context composer docks with safe-area spacing.
- Touch actions keep at least 40 to 44px practical target height where space permits.

## Checklist Design release gate

Every Company UI change should explicitly verify:

### Design system

- Typography hierarchy, weight, leading, and usage are consistent.
- Brand colors have documented roles, not just hex values.
- Spacing, radius, and elevation follow shared tokens.

### Components and states

- Buttons: default, hover, active, focus-visible, disabled, loading.
- Inputs: label, placeholder, focus, invalid / error, disabled.
- Accordion / disclosure: collapsed, expanded, hover, focus.
- Needs You: empty, decision present, approve, deny, dismiss.
- Work: starting, in progress, Needs You, review, accepted, failed.
- Durable Work: empty, list, selected, evidence loading, evidence error, review decision, terminal state.
- Loading copy describes the action, for example `Checking local workspace…` or `Loading Work evidence…`.

### Responsiveness

- Fluid layout.
- Explicit mobile / tablet / desktop behavior.
- Responsive type sizes.
- Touch target sizing.
- Information hierarchy remains intact after collapse.

### Accessibility

- Keyboard operation.
- Visible focus.
- Reduced motion.
- Live regions only announce dynamic product state, not static onboarding content.
- Color is never the only carrier of status.
- Expandable Work rows expose their expanded state and have a clear detail destination.

## Taste-skill audit notes

The external taste-skill is used as an audit lens for anti-template design, typography, spacing, color calibration, density, responsive behavior, and motivated motion.

It explicitly says it is not the primary pattern library for dashboards, data tables, or multi-step product UI. Lucubro therefore keeps its own conversation-first information architecture and durable Work model instead of applying landing-page patterns mechanically.

The desired result is minimal, not empty: fewer surfaces, stronger hierarchy, and more decision-bearing information per viewport.
