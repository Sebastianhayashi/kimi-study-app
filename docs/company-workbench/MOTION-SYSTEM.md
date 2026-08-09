# Lucubro motion system

Lucubro's motion language exists to make product state, causality, and focus legible. It is not a decorative layer added after the interface is designed.

The governing principles are:

> **Quiet surface, kinetic intelligence.**
>
> **Conversation drives the canvas.**

At rest, Lucubro is visually calm. When the user expresses intent, changes focus, or real product state changes, affected components acknowledge, transition, receipt, and settle.

This document follows the product hierarchy in [`PRODUCT-THESIS.md`](PRODUCT-THESIS.md). Motion never decides that a domain object should become a page or lens.

## Three scales of motion

### Micro motion

Short local feedback:

- focus line activation;
- runtime selection;
- path reading / suggestion / receipt;
- tree disclosure;
- button press and focus restoration;
- menu open/close.

### Object motion

Durable or decision-bearing object lifecycle:

- Intent mount / receipt replacement;
- Work formation;
- Employee/responsibility attachment;
- live event replacement inside Work;
- Artifact/evidence growth;
- Needs You / Decision appearance;
- Review / Accepted / Rework / Failed state transitions.

### Scene motion

Focus changes inside the persistent Company Canvas Shell:

- Manager canvas → Work lens;
- Work → Employee responsibility lens;
- Work/Project → evidence or execution lens;
- contextual lens → Manager canvas;
- browser back/forward restoring a previous lens.

Scene motion must preserve the stable shell: Lucubro identity, Alex relationship, composer, Needs You, and deep-link continuity remain conceptually present.

## Conversation-driven canvas

A CEO instruction should produce a continuous causal sequence on one stable surface:

```text
user intent
  → intent acknowledged
  → Work forms
  → responsibility / Run attaches
  → public Run events update the same Work object
  → evidence grows inside that object
  → Project context may grow around the Work
  → Needs You / Review changes the same object
  → stable state settles
```

The canvas feels alive because real state changes, not because the screen contains ambient animation.

### Stable space, changing objects

Lucubro does not imitate a freeform design canvas.

- Objects keep stable anchors while their state changes.
- New intent enters near the current work flow instead of opening a wizard.
- A Work object grows in place as responsibility, execution, evidence, review, and decision state arrive.
- Do not navigate away merely to show state that can mutate the current object.
- Do not scatter state into unrelated toasts when it belongs to a visible Work object.
- Stable company state stops moving.

## Event-driven object motion

Real-time motion is driven by normalized product events or deterministic local UI state.

Examples:

- Work creation mounts the durable Work object.
- `run.started` advances live execution state.
- normalized public `message.delta` updates one live region; raw chain-of-thought is never shown.
- `tool.started` / `tool.completed` update the execution receipt.
- `artifact.updated` / `artifact.produced` mount or update evidence.
- `approval.requested` moves the owning Work into an authority / Needs You state.
- `approval.resolved` changes the same Work according to the actual decision.
- `run.completed` moves Work to Review only after required evidence exists.
- CEO Accept / Rework changes the same durable object rather than producing a detached toast.

The UI must not invent intermediate AI stages unsupported by product state.

### Streaming behavior

When a runtime emits normalized public incremental output, Lucubro updates one live region rather than appending tiny messages:

```text
existing public live copy yields
  → newest public update enters
  → compact recent-event trace remains
  → evidence/decisions grow as durable sub-objects
```

This creates real-time generation feeling without exposing hidden reasoning or manufacturing fake tokens.

## Scene and lens choreography

A lens is a focus change inside the same Company Canvas Shell, not a separate product page.

### Lens selector open

```text
Focus control acknowledges
  → menu surface enters
  → current/available lenses enter in reading order
  → current lens remains visibly marked
```

The menu should feel summoned from the existing canvas, not launched as a navigation destination.

### Lens change

Canonical scene transition:

```text
current lens supporting content yields
  → current scene exits briefly
  → URL/history focus updates
  → target lens materializes in the same canvas region
  → target hierarchy settles
  → shell remains stable throughout
```

The transition should normally be short enough that the user perceives continuity rather than waiting for a page change.

### Back / forward

Browser history restores the same semantic lens state through the same scene transition. It must not require a full hard reload for normal in-product lens changes.

### Deep link

Opening a deep URL directly may construct the target lens immediately because there is no previous in-memory scene to transition from. The stable shell should still be the same shell used by normal navigation.

### Lens exit

When returning to Manager canvas or another lens:

```text
transient lens controls leave
  → lens content yields
  → next scene enters
  → composer / Alex / Needs You continuity remains
```

Do not animate unrelated shell anchors out merely because the focus changes.

## Component lifecycle contract

Visible interactive components use:

```text
mount
  → entering
  → active
  → exiting
  → hidden / unmount / replacement
```

A visible component should not normally jump directly from hidden to active or active to removed.

### Entering

- Parent surface establishes itself first.
- Identity/header follows.
- decision-bearing controls enter next.
- supporting copy/status settles last.
- related siblings use short stagger.
- order follows reading/decision order.

### Active

- no ambient loop is required;
- state becomes visually stable;
- interaction must remain usable without animation.

### Exiting

- receipts/transient status leave first;
- supporting status leaves before primary controls;
- repeated choices leave in reverse stagger;
- parent surface leaves last;
- DOM replacement/`hidden` happens after visible exit when the user can perceive the transition;
- exit is normally shorter than entrance.

### Replacement

```text
old visible content exits
  → DOM/state replacement
  → new content enters
```

Do not instantly replace visible content and then animate the replacement on top of the discontinuity.

## Execution setup choreography

Execution setup remains a reference implementation of the lifecycle contract.

### Open

```text
panel surface
  → panel identity
  → Runtime field
  → runtime choices stagger
  → Workspace path
  → path/tree when requested
  → availability status
```

### Runtime refresh

```text
existing choices reverse-exit
  → choice DOM/state replaces
  → new choices enter
  → current selection settles
```

Unavailable providers stay visible and disabled.

### Runtime selection

Previous selected state releases; new selection and receipt enter. Visible receipt text exits before replacement.

### Workspace path

```text
empty neutral line
  → focused Klein-blue line
  → reading suggestions/host inspection
  → Path received / Folder found / Repository found
```

Focus is independent from receipt state. Focusing a previously received path still wakes the Klein-blue line.

When typing resumes, old receipt exits before reading state takes over. The reading trace is one-shot, not a loop.

`Repository found` is allowed only after execution-host inspection. `Path received` confirms UI receipt only.

### Close

```text
receipts
  → availability status
  → Workspace path/tree
  → runtime choices reverse-stagger
  → Runtime field
  → panel identity
  → panel surface
  → disclosure collapse
```

Submission uses this same exit lifecycle rather than instantly hiding the disclosure.

## Timing grammar

Typical targets:

- acknowledgement: 80–160ms;
- small exit: 100–160ms;
- local selection / receipt: 180–260ms;
- component entrance: 180–280ms;
- live event replacement: 120–240ms;
- evidence entrance: 180–300ms;
- scene/lens transition: roughly 180–360ms;
- coordinated disclosure entrance: roughly 260–420ms;
- coordinated disclosure exit: roughly 180–300ms.

Do not add dead time merely to make animation noticeable. Real-time UI must never feel slower because motion is waiting to perform.

## GSAP implementation rules

Use the official GreenSock GSAP skill guidance as implementation reference.

- Prefer `gsap.timeline()` for coordinated sequences.
- Use timeline position parameters instead of arbitrary chained delays.
- Prefer transforms and `autoAlpha` / opacity.
- Use stagger for related list items and reverse stagger for exit.
- Use one-shot pulses for real incoming events; never infinite ambient AI activity loops.
- `clearProps`/cleanup must prevent inline motion styles becoming state.
- Kill timelines/tweens on lifecycle teardown.
- Use `will-change` only where animation actually occurs.
- Do not use ScrollTrigger for ordinary Company Workbench scrolling.
- Avoid layout-property animation when transforms communicate the same transition.
- Domain state and lens selection remain outside GSAP ownership. Motion reacts to state.

## Reduced motion and failure behavior

With `prefers-reduced-motion: reduce`:

- skip non-essential choreography;
- land directly in the same semantic state;
- preserve selection, lens history, receipts, Work, review, approvals, Workspace, and canvas behavior;
- continue live textual updates from real events.

If GSAP fails to load, all underlying controls and state transitions still work. Animation is an enhancement to comprehension, not a correctness dependency.

## Honesty boundary

Motion may communicate only substantiated state.

Allowed:

- intent received;
- Work created;
- lens focus changed;
- runtime selected;
- local path focus / reading input;
- execution-host directory found;
- normalized public runtime update;
- real Work state transition;
- real Needs You request;
- Artifact/review state backed by stored events.

Not allowed:

- fake thinking;
- fake staged progress;
- fake repository validation;
- fake agent activity;
- fake completion;
- raw model chain-of-thought as animation content.

The desired sensation is continuous, truthful responsiveness: the canvas feels intelligent because user intent and real company state visibly cause change.
