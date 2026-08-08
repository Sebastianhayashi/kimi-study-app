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
- Muted text: `#758093`
- Border: `#e1e6ef`
- Strong border: `#cbd3e1`

The neutral family stays cool so the Klein blue reads as intentional rather than pasted onto a warm beige UI.

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
5. Conversation / Work evidence.
6. Composer.

## Radius and elevation

- Controls: 10px.
- Work / context objects: 14px.
- Popovers / composer: 18px.

Elevation is functional:

- Flat or near-flat for inline Work.
- Medium shadow for disclosure panels.
- Strongest shadow only for the fixed composer, because it floats over the conversation.

Avoid card-on-card nesting unless the nested block has a distinct interaction contract.

## Core product surfaces

### Manager relationship

Alex is visible in the top bar and in the opening prompt. Presence uses semantic green only for availability. The avatar and product identity use Lucubro blue.

### Working set

The Working set is not a dashboard. It is a compact state projection derived from the durable Work objects already present in the conversation.

It shows:

- Active Work.
- Review-ready Work.
- Needs You decisions.

Counts must come from real UI state. Do not invent productivity metrics.

### Work

Work is the durable business object. It receives a thin brand signal rail and a semantic status, but remains visually quieter than the composer or Needs You panel.

Status rules:

- Running / starting: neutral surface with blue signal.
- Ready for review: brand-blue review state.
- Needs You: amber authority state.
- Accepted: green final state.
- Failed: red error state.

### Artifact

Artifacts remain inline inside Work. The default state is collapsed. The summary must say what evidence is available, for example `Code changes · 1 file`, instead of a generic `Details` label.

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

The composer is the command surface, not the biggest card on the page. It remains fixed and immediately available, but its resting height is intentionally smaller than the previous version.

Execution setup remains a disclosure because repository and runtime details are implementation context, not CEO-level primary content.

## Motion system

Motion must communicate hierarchy, feedback, or state change.

GSAP owns:

1. top-bar / working-set entrance sequencing;
2. state-count changes;
3. Work transitions into Ready for review or Needs You.

Existing functional animations for messages and the Needs You panel remain in the current Company script.

Rules:

- Animate transforms and opacity rather than layout properties.
- Typical duration: 220 to 340ms.
- Primary easing: `power2.out`.
- Attention motion happens once on state change, never loops indefinitely.
- `prefers-reduced-motion: reduce` skips non-essential motion.
- `gsap.matchMedia()` owns responsive and reduced-motion setup and must be reverted on page lifecycle cleanup.
- No ScrollTrigger for this product surface. Scroll is navigation, not a storytelling timeline.

## Responsive contract

### Desktop, 861px and above

- 980px maximum conversation container.
- Manager relationship remains centered in top bar.
- Working set uses one description column and three compact numeric columns.

### Tablet, 561 to 860px

- Working set stacks description above metrics.
- Work stays aligned to the conversation avatar gutter when space allows.

### Mobile, 560px and below

- Brand wordmark may collapse to the mark.
- Manager remains identifiable.
- Needs You retains text plus count.
- Working set occupies the full conversation width.
- Work becomes full width.
- Composer retains safe-area spacing and never causes horizontal overflow.
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
- Loading copy describes the action, for example `Checking local workspace…`.

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

## Taste-skill audit notes

The external taste-skill is used as an audit lens for anti-template design, typography, spacing, color calibration, density, responsive behavior, and motivated motion.

It explicitly says it is not the primary pattern library for dashboards, data tables, or multi-step product UI. Lucubro therefore keeps its own conversation-first information architecture and durable Work model instead of applying landing-page patterns mechanically.

The desired result is minimal, not empty: fewer surfaces, stronger hierarchy, and more decision-bearing information per viewport.
