# Lucubro motion system

Lucubro's motion language exists to make product state legible. It is not a decorative layer added after the interface is designed.

The governing principles are:

> **Quiet surface, kinetic intelligence.**
>
> **Conversation drives the canvas.**

At rest, Lucubro is visually calm. When the user expresses intent or product state changes, the affected components should acknowledge, transition, receipt, and settle.

The Manager surface is not treated as a chat transcript with cards appended below it. It is a live company canvas. Conversation is the input protocol that changes durable objects on that canvas.

## Conversation-driven canvas

A CEO instruction should produce a continuous causal sequence on one stable surface:

```text
user intent
  → intent received
  → Work formed
  → Employee / Run attached
  → public Run events update the same Work object
  → evidence appears inside that object
  → Needs You / Review changes that object in place
  → stable state settles
```

The canvas should feel alive because real state is changing, not because the screen contains ambient animation.

### Stable space, changing objects

Lucubro does not imitate a freeform design canvas. The spatial frame should remain predictable.

- Objects keep stable visual anchors while their state changes.
- A new intent enters near the current work flow instead of opening a separate wizard.
- A Work object grows in place as Employee, Run, evidence, review, and decision state arrive.
- Do not navigate away just to show a state that can be expressed as a mutation of the current object.
- Do not scatter state into unrelated toasts when it belongs to a visible Work object.
- When an object is no longer active, motion stops. Stable company state should be visually quiet.

### Event-driven motion

Real-time motion must be driven by real product events.

Examples:

- `Work created` mounts the durable Work object.
- `run.started` advances its live execution state.
- a normalized public `message.delta` updates the live copy inside the Work object. Raw chain-of-thought is never shown.
- `tool.started` and `tool.completed` update the live execution receipt.
- `artifact.updated` or `artifact.produced` mounts or updates the evidence region.
- `approval.requested` moves the object into an authority / Needs You state.
- `approval.resolved` returns the object to execution when appropriate.
- `run.completed` only moves the object to Review after required evidence exists.
- CEO Accept / Rework changes the same durable object instead of replacing it with a completion toast.

The UI must not invent intermediate AI stages that do not exist in product state.

### Streaming behavior

When a runtime emits normalized public incremental output, Lucubro should update one live region rather than append dozens of tiny chat messages.

The preferred behavior is:

```text
existing live copy exits or yields
  → newest public update enters
  → recent event history keeps a compact trace
  → evidence and decisions grow as durable sub-objects
```

This gives the sensation of a system generating in real time without exposing hidden reasoning or manufacturing fake tokens.

## Component lifecycle contract

Interactive components use a complete lifecycle:

```text
mount
  → entering
  → active
  → exiting
  → unmount / hidden / replacement
```

A component must not normally jump directly from hidden to active or from active to removed when the transition is visible to the user.

### Entering

Entering motion explains where a component came from and what now matters.

- Parent container establishes the surface first.
- Header / identity follows.
- Decision-bearing controls enter next.
- Supporting copy and status settle last.
- Related sibling choices use a short stagger rather than independent delays.
- Entrance order follows reading and decision order, not DOM novelty.

### Active

The component reaches a visually stable resting state.

- No ambient looping is required.
- Controls are interactive only after the relevant entering transition has made them legible.
- The resting state must work without animation.

### Exiting

Exit motion is a first-class state, not the reverse-engineered absence of an entrance.

- Receipts and transient status leave first.
- Supporting status leaves before primary controls.
- Repeated choices leave in a short reverse stagger.
- The parent surface leaves last.
- DOM replacement, `hidden`, or disclosure collapse happens only after the visible exit completes when the user initiated the close/replacement.
- Exit should be shorter than entrance so the interface never feels reluctant to get out of the user's way.

### Replacement

When one visible component set is replaced by another, use:

```text
old component(s) exit
  → DOM/state replacement
  → new component(s) enter
```

Do not instantly replace visible controls and then animate the new controls on top of the discontinuity.

## Execution setup choreography

Execution setup is one reference implementation of the lifecycle system.

### Open

```text
panel surface
  → panel identity
  → Runtime field
  → runtime choices, staggered
  → Workspace path
  → path line / tree when requested
  → runtime availability status
```

The visual hierarchy stays calm, but the sequence makes the panel feel assembled in response to the user's intent.

### Runtime list load / refresh

Runtime availability comes from product state. If the visible runtime set changes while Execution setup is open:

```text
existing runtime choices exit in reverse order
  → choice DOM is replaced
  → new runtime choices enter in decision order
  → current selection settles
```

Unavailable providers remain visible and disabled.

### Runtime selection

Selecting another runtime uses two linked transitions:

1. the previous selected component releases its selected state;
2. the new selected component and receipt enter.

If a previous textual receipt is visible, it exits before its text is replaced. Do not mutate visible receipt text in place without transition.

### Workspace path

Workspace path uses a line-based interaction and may expand into an execution-host tree:

```text
empty
  → focused
  → reading host path / suggestions
  → host directory found or Path received
```

When typing resumes after a receipt, the receipt exits before the reading state takes over again. The reading trace itself enters and exits once; it does not loop.

`Repository found` is allowed only after the execution-host workspace API has inspected that directory. `Path received` confirms browser/UI receipt only.

### Close

The explicit close choreography is:

```text
receipts
  → runtime availability status
  → Workspace path / tree
  → runtime choices, reverse stagger
  → Runtime field
  → panel identity
  → panel surface
  → disclosure collapses
```

The close sequence is deliberately faster than the open sequence. Submission must use this same exit path rather than instantly toggling the disclosure closed.

## Timing grammar

Typical targets:

- acknowledgement: 80 to 160ms;
- small exit: 100 to 160ms;
- local selection / receipt: 180 to 260ms;
- component entrance: 180 to 280ms;
- real-time event replacement: 120 to 240ms;
- evidence-region entrance: 180 to 300ms;
- coordinated panel entrance: about 260 to 420ms total;
- coordinated panel exit: about 180 to 300ms total.

Do not add dead time merely to make an animation noticeable. Real-time UI must feel faster than the underlying work, never slower because animation is waiting to perform.

## GSAP implementation rules

Use the official GSAP skill guidance as the implementation reference.

- Prefer `gsap.timeline()` for sequences.
- Use timeline position parameters instead of arbitrary chained delays.
- Prefer transforms and `autoAlpha` / opacity.
- Use stagger for related list items.
- Use one-shot pulses for real incoming events; do not use infinite activity loops.
- Use `clearProps` or explicit cleanup so inline motion styles do not become product state.
- Kill timelines and tweens during lifecycle teardown.
- Use `will-change` only on elements that actually animate.
- Do not use ScrollTrigger on ordinary Company Workbench scrolling.
- Avoid animating layout properties when transforms communicate the same motion.
- Keep domain state ownership outside animation modules. Motion reacts to product state; it does not decide product state.

## Reduced motion and failure behavior

With `prefers-reduced-motion: reduce`:

- skip non-essential entering and exiting choreography;
- move directly to the meaningful active or hidden state;
- keep all selection, receipt, Work, review, approval, workspace, and canvas semantics intact;
- continue updating live textual state from real events without movement.

If GSAP fails to load, all underlying controls and state transitions must still work. Animation is an enhancement to comprehension, never a dependency for correctness.

## Honesty boundary

Motion may communicate only state Lucubro can substantiate.

Allowed:

- intent received;
- Work created;
- runtime selected;
- execution-host directory found;
- local UI reading/settling;
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

The desired sensation is that Lucubro is continuously responsive to the user and to real system events, not that the interface is pretending to be busy.
