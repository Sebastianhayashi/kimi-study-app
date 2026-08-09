# Lucubro product thesis

Status: governing product direction

Lucubro is a local-first AI operating workbench for one person running a company.

The product inherits a durable operational model from the Multica direction, but it does not inherit a static application structure.

> **Multica is Lucubro's operational backbone. Lucubro turns that backbone into an AI-native kinetic company canvas: the user expresses intent, and durable company structure materializes, changes, and recedes contextually around the Work.**

This document sits above the current V1 engineering slice. Implementation specs may narrow scope, but they must not silently redefine this product thesis or turn domain nouns into navigation by default.

## Why Lucubro exists

A single CEO should not have to operate a collection of AI sessions, provider consoles, project-management screens, and infrastructure dashboards just to move work forward.

Lucubro gives the CEO one durable relationship with a Primary Manager and one continuous work surface. The CEO expresses outcomes and makes material judgments. Lucubro keeps the resulting Work, responsibility, evidence, decisions, project structure, and execution history durable and inspectable.

The product should answer, with minimal navigation:

- What is moving now?
- Who or what is responsible?
- What changed?
- What evidence exists?
- What is blocked?
- What actually needs my judgment?
- What durable company structure has grown around this work?

## What Lucubro keeps from the Multica direction

The inherited backbone is operational, not visual.

Lucubro keeps these principles:

- durable Work/Issue state is distinct from a Run/execution attempt;
- project state survives provider sessions;
- live activity is structured and low-noise rather than raw terminal output;
- evidence and decisions remain attached to the Work that gives them meaning;
- unknown state is not presented as a known zero;
- detail is progressively disclosed according to decision relevance;
- authorization is explicit and inspectable;
- stable state remains visually calm;
- live state can update continuously without becoming a transcript waterfall.

Lucubro deliberately departs from a rigid screen-first interpretation. AI software should be able to reveal, grow, mutate, and retire structure as the user's intent becomes clearer.

## The interaction model

Two principles govern the experience:

> **Conversation drives the canvas.**
>
> **Quiet surface, kinetic intelligence.**

Conversation is not a separate chat product. It is one input protocol for changing durable company state.

The Company Canvas is semantic, not an infinite whiteboard. Spatial anchors remain predictable. Objects grow and change in place so the user can maintain spatial memory while the underlying company state evolves.

A normal causal sequence is:

```text
User intent
  -> intent acknowledged
  -> durable Work forms
  -> responsibility becomes visible
  -> public execution state updates the same Work
  -> evidence attaches to that Work
  -> Project context grows when long-running structure is warranted
  -> relevant Knowledge attaches when it is used
  -> Needs You appears only when authority or commitments require judgment
  -> the decision mutates the same durable object
  -> stable state settles and motion stops
```

Animation follows real product state. It must never fabricate thinking, progress, validation, or completion.

## One persistent Company Canvas Shell

The shell is continuous across normal product use.

It owns:

- Lucubro identity;
- Alex, the Workspace-level Primary Manager relationship;
- the command composer;
- Needs You attention;
- current Work Context;
- current canvas focus/lens;
- scene transitions and deep-link state.

Changing focus should normally mutate the scene inside this shell rather than hard-loading a different application page.

URLs still matter. A lens or durable context can have a deep URL for reload, browser history, and sharing. Deep linking does not require page-centric interaction.

## Surface taxonomy

Every new visible concept must be classified before it receives navigation.

### Domain object

Durable product truth.

Examples: Work, Project, Issue, Employee, Run, Artifact, Decision.

A domain object does **not** automatically receive a top-level page.

### Canvas object

A visible projection of domain state in the current scene.

Examples: an active Work object, Artifact evidence inside that Work, a Needs You decision attached to the owning Work.

### Lens

A focused structured view over domain objects without replacing the Company Canvas Shell.

Examples: durable Work index, Project Issues/Map/Activity, Employee responsibility inspector, execution evidence.

### Transient interaction

Short-lived UI state that explains a local action.

Examples: intent acknowledgement, path suggestions, selection receipts, reading/reconciliation state.

Transient interaction is not durable product truth.

### Configuration surface

Infrastructure or policy configuration that is available when needed but is not the default CEO workflow.

Examples: provider/account state, runtime configuration, workspace roots, permission policy.

## How major capabilities belong in the product

### Work

Work is the default action unit. Home stays Work-first across Projects and lightweight tasks. Work owns current status, responsibility, evidence, blockers, review, and decision-bearing state.

### Project

Project is a durable Work Context for long-running, multi-part work. Users should not have to create one before expressing an intent. When the work needs persistent project structure, Project can grow around it and expose Issues, Map, Activity, Decisions, dependencies, and Artifacts as contextual lenses.

### Employee

Employee is a durable company identity. Employees appear where responsibility matters. Deeper role/capability configuration belongs in an inspector or workforce configuration surface, not an HR dashboard by default.

### Knowledge

Knowledge first exists as context, source, memory, or evidence used by Work/Project. A global library may be justified later by a real retrieval/archive workflow. The existence of Knowledge does not itself justify a top-level Knowledge app.

### Usage and cost

Usage belongs with the Work/Run/runtime that incurred it and with budget or authority boundaries that make it decision-relevant. A global cost lens may exist later, but token telemetry is not the product's home screen.

### Account and provider state

Provider/account state is infrastructure. It normally stays behind Advanced/Settings and surfaces contextually when credentials, quota, availability, or policy blocks current Work.

### Artifact

Artifact is evidence owned by Work. It should normally appear inside the Work that produced it. Archive/search can exist later without making outputs compete with their operational context.

## Motion is product behavior

Lucubro's distinctive motion is not decorative polish. It makes the causal relationship between user intent, AI/system events, and durable company state perceptible.

Motion exists at three scales:

- **micro**: focus, selection, receipt, path reading, disclosure;
- **object**: Intent/Work/Artifact/Decision mount, replacement, expansion, settle;
- **scene**: focus changes between Work, Project context, Employee/evidence/execution lenses while the shell remains continuous.

The interface should be quiet when nothing changes. Motion should become noticeable precisely when the system receives an intent or real state changes.

## Hard product rules

- One Workspace has one default CEO-facing Primary Manager relationship.
- Default Home is Work-first, not Project-first and not provider-first.
- Project/Issue/Quick Task are Work Contexts, not new CEO relationships.
- A domain noun does not earn top-level navigation merely by existing.
- Conversation and structured Work are the same product shell.
- Stable space, changing objects.
- Hide mechanisms, not responsibility, risk, durable state, or evidence.
- A visible durable state must have an actionable path.
- Motion follows deterministic local state or normalized product events.
- No fake thinking, fake staged AI progress, fake validation, or raw chain-of-thought.
- Product/domain state remains canonical when GSAP is absent.
- Real Claude/Codex integration remains below this product contract and can be resumed after the canvas contract is stable.

## Document hierarchy

Use the repository documents in this order:

1. `PRODUCT-THESIS.md` — why the product exists and the governing interaction/domain direction.
2. Product decision log / domain decisions — durable terminology and locked decisions.
3. `DESIGN-SYSTEM.md` and `MOTION-SYSTEM.md` — how the thesis is expressed in UI and interaction.
4. `SPEC.md` — the current executable V1 engineering slice, not the complete product information architecture.
5. implementation code/tests — current realization of the above.

When lower layers conflict with higher layers, correct the lower layer instead of treating implementation history as product truth.
