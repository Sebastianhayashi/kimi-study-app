# Lucubro motion system

Lucubro's motion language exists to make product state legible. It is not a decorative layer added after the interface is designed.

The governing principle is:

> **Quiet surface, kinetic intelligence.**

At rest, Lucubro is visually calm. When the user expresses intent or product state changes, the affected components should acknowledge, transition, receipt, and settle.

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

Execution setup is the current reference implementation.

### Open

```text
panel surface
  → panel identity
  → Runtime field
  → runtime choices, staggered
  → Repository path
  → path line
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

### Repository path

Repository path uses a line-based interaction:

```text
empty
  → focused
  → reading local input
  → Path received
```

When typing resumes after `Path received`, the receipt exits before the reading state takes over again. The reading trace itself enters and exits once; it does not loop.

`Path received` confirms only that Lucubro's UI received the path text. Filesystem validation requires real Work/start evidence.

### Close

The explicit close choreography is:

```text
receipts
  → runtime availability status
  → Repository path
  → runtime choices, reverse stagger
  → Runtime field
  → panel identity
  → panel surface
  → disclosure collapses
```

The close sequence is deliberately faster than the open sequence.

## Timing grammar

Typical targets:

- acknowledgement: 80 to 160ms;
- small exit: 100 to 160ms;
- local selection / receipt: 180 to 260ms;
- component entrance: 180 to 280ms;
- coordinated panel entrance: about 260 to 420ms total;
- coordinated panel exit: about 180 to 300ms total.

Do not add dead time merely to make an animation noticeable.

## GSAP implementation rules

Use the official GSAP skill guidance as the implementation reference.

- Prefer `gsap.timeline()` for sequences.
- Use timeline position parameters instead of arbitrary chained delays.
- Prefer transforms and `autoAlpha` / opacity.
- Use stagger for related list items.
- Use `clearProps` or explicit cleanup so inline motion styles do not become product state.
- Kill timelines and tweens during lifecycle teardown.
- Use `will-change` only on elements that actually animate.
- Do not use ScrollTrigger on ordinary Company Workbench scrolling.
- Avoid animating layout properties when transforms communicate the same motion.

## Reduced motion and failure behavior

With `prefers-reduced-motion: reduce`:

- skip non-essential entering and exiting choreography;
- move directly to the meaningful active or hidden state;
- keep all selection, receipt, Work, review, and approval semantics intact.

If GSAP fails to load, all underlying controls and state transitions must still work. Animation is an enhancement to comprehension, never a dependency for correctness.

## Honesty boundary

Motion may communicate only state Lucubro can substantiate.

Allowed:

- input received;
- runtime selected;
- local UI reading/settling;
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
