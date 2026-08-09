# Lucubro product thesis

Status: governing product direction

Lucubro is a local-first AI operating workbench for one person running a company.

The product inherits a durable operational model from the Multica direction, but it does not inherit a static application structure.

> **Multica is Lucubro's operational backbone. Lucubro turns that backbone into an AI-native kinetic company canvas: the user expresses intent, and durable company structure materializes, changes, and recedes contextually around the Work.**

A second principle governs execution:

> **The user chooses outcomes. Lucubro chooses and supervises execution. Workers do the work. Evidence returns to durable company state.**

This document sits above the current V1 engineering slice. Implementation specs may narrow scope, but they must not silently redefine this product thesis or turn domain nouns into navigation by default.

## Why Lucubro exists

A single CEO should not have to operate a collection of AI sessions, provider consoles, project-management screens, infrastructure dashboards, and remote machines just to move work forward.

Lucubro gives the CEO one durable relationship with a Primary Manager and one continuous work surface. The CEO expresses outcomes and makes material judgments. Lucubro keeps the resulting Work, responsibility, evidence, decisions, project structure, execution history, and company knowledge durable and inspectable.

The CEO should be able to use the same company from a Mac, iPad, iPhone, or ordinary browser while trusted self-hosted Workers continue executing on dedicated machines. The control surface is not required to be the machine that performs the Work.

The product should answer, with minimal navigation:

- What is moving now?
- Who or what is responsible?
- Where is this Work executing?
- What changed?
- What evidence exists?
- What is blocked?
- What actually needs my judgment?
- What durable company structure and knowledge has grown around this work?
- What did Lucubro choose to execute this Work, and why, when that choice is material?

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
  -> an eligible Worker and execution path are selected
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

The shell must remain usable as a responsive control surface on desktop and mobile-class devices. Mobile is not a reduced read-only dashboard: the user must still be able to issue intent, inspect Work, review evidence, make decisions, watch browser execution when useful, and intervene in a running task within the applicable authority boundary.

## Surface taxonomy

Every new visible concept must be classified before it receives navigation.

### Domain object

Durable product truth.

Examples: Work, Project, Issue, Employee, Worker, Run, Artifact, Decision.

A domain object does **not** automatically receive a top-level page.

### Canvas object

A visible projection of domain state in the current scene.

Examples: an active Work object, Employee ownership, Worker execution presence, Artifact evidence inside that Work, a Needs You decision attached to the owning Work.

### Lens

A focused structured view over domain objects without replacing the Company Canvas Shell.

Examples: durable Work index, Project Issues/Map/Activity, Employee responsibility inspector, Worker/execution inspector, Knowledge context, browser evidence.

### Transient interaction

Short-lived UI state that explains a local action.

Examples: intent acknowledgement, path suggestions, selection receipts, reading/reconciliation state.

Transient interaction is not durable product truth.

### Configuration surface

Infrastructure or policy configuration that is available when needed but is not the default CEO workflow.

Examples: provider/account state, runtime configuration, Worker pairing, workspace roots, permission policy.

## Canonical execution terminology

Lucubro separates responsibility from execution infrastructure.

```text
Employee owns responsibility.
Assignment dispatches Work.
Run is one execution attempt.
Worker is where the Run executes.
Runtime / Model / Playbook is how that Run executes.
```

An Employee is not a machine. A Worker is not an Employee. A model is not an Employee. A provider session is not a Work object.

This distinction lets the same Employee responsibility survive Worker changes, provider changes, model routing, session compaction, restarts, and failed Run attempts.

## How major capabilities belong in the product

### Work

Work is the default action unit. Home stays Work-first across Projects and lightweight tasks. Work owns current status, responsibility, evidence, blockers, review, and decision-bearing state.

### Project

Project is a durable Work Context for long-running, multi-part work. Users should not have to create one before expressing an intent. When the work needs persistent project structure, Project can grow around it and expose Issues, Map, Activity, Decisions, dependencies, and Artifacts as contextual lenses.

### Employee

Employee is a durable company identity. Employees appear where responsibility matters. Deeper role/capability configuration belongs in an inspector or workforce configuration surface, not an HR dashboard by default.

### Worker

Worker is a durable execution-host identity. A Worker may be the same physical machine that hosts Lucubro, a dedicated Mac mini or Linux box, a VM, or another paired execution host.

A Worker advertises execution capabilities rather than becoming a user-facing provider dashboard. Relevant capabilities include operating system/architecture, approved workspace roots, toolchains, browser automation, installed runtimes, model access, special hardware, permission envelopes, health, load, and availability.

The current Work may reveal its Worker when that information helps the user understand progress, risk, availability, or intervention. Otherwise Worker infrastructure remains subordinate to the Work.

### Knowledge

Company Knowledge is durable Lucubro state, not a provider session's memory.

Knowledge can include Project documents and plans, accepted decisions, reusable research, accepted Artifacts, Employee role/capability guidance, Skills/playbooks, and explicitly promoted Run learnings. Knowledge carries provenance and scope so the user can inspect what the company knows, where it came from, and which Work or Project is using it.

Knowledge first appears contextually around Work/Project. A broader Knowledge lens/library is valid when the user needs to search, inspect, curate, or archive company knowledge. Provider-native memory can accelerate a Run, but it is never the canonical company knowledge store.

### Usage and cost

Usage belongs with the Work/Run/runtime that incurred it and with budget or authority boundaries that make it decision-relevant. A global cost lens may exist later, but token telemetry is not the product's home screen.

Cost is also an input to execution routing. The user should not have to choose a provider merely to optimize spend. Lucubro should prefer the lowest expected total cost that still satisfies capability, expected quality, latency, privacy, risk/authority, and availability constraints.

### Account and provider state

Provider/account state is infrastructure. It normally stays behind Advanced/Settings and surfaces contextually when credentials, quota, availability, or policy blocks current Work.

Initial setup may pair provider accounts and credentials once. Normal Work should reuse those connections without repeatedly asking the user to configure APIs or choose a provider. Raw credentials should remain in the trusted execution environment that needs them whenever practical; mobile/control clients should normally receive capability and health state, not secrets.

### Artifact

Artifact is evidence owned by Work. It should normally appear inside the Work that produced it. Archive/search can exist later without making outputs compete with their operational context.

## Remote control and Worker execution

Lucubro must support a user who is away from the execution machine.

Two deployment shapes are valid without changing the domain model.

### All-in-one self-hosted

```text
Mac / iPad / iPhone / browser
          |
          v
Lucubro service + Worker on one trusted machine
          |
          +-- durable company state
          +-- provider runtimes
          +-- git / browser / tools
```

### Split control and Worker

```text
Mac / iPad / iPhone / browser
          |
          v
Lucubro Control Plane / Relay
          ^
          | authenticated outbound channel
          |
paired Worker(s)
          |
          +-- isolated Run environment
          +-- provider runtimes / tools
          +-- browser execution
```

The preferred future remote topology is Worker-initiated outbound authenticated transport, so a user's home or office Worker does not require an arbitrary public inbound port merely to receive Work. Private LAN/VPN-style direct access remains a valid self-hosted transport option.

The product contract is transport-independent: a Worker can reconnect, move networks, or be temporarily unavailable without changing the identity of the Employee, Work, Project, or prior evidence.

Remote Worker design requires explicit pairing/revocation, encrypted authenticated transport, scoped workspace roots, capability advertisement, health state, and auditable authorization boundaries.

## Outcome-first capability routing

Provider/model selection is an execution decision, not normally a CEO task.

Lucubro should route from the desired outcome downward:

```text
Outcome
  -> required capability / risk / authority
  -> can an approved deterministic playbook do it?
  -> responsible Employee and approved capability set
  -> eligible Worker set
  -> eligible Runtime / tool / model set
  -> quality-cost-latency-privacy-availability decision
  -> Run
```

The cheapest valid execution may use no model at all. For example, a routine approved maintenance task may be handled by a deterministic playbook. A small low-risk task may use a cheaper/local model. A difficult coding task may justify a stronger coding agent. Browser QA requires browser capability regardless of which model writes text.

The default objective is:

> **Minimize expected total cost subject to capability, expected quality, latency, privacy, risk/authority, and availability constraints.**

This is not blanket cheapest-model routing. A cheap path that is unlikely to finish correctly is not cheap in total expected cost.

The user may override routing at the Work/Run level when expert control is useful. Material routing choices should remain inspectable through the Routing Decision Record rather than becoming invisible magic.

## Browser evidence, live observation, and takeover

A digital employee must be able to prove browser work without forcing the user to watch every step.

Lucubro should expose browser execution progressively:

1. **State** — current URL/title/action and normalized public events. Lowest-bandwidth default.
2. **Milestone screenshot** — automatically or explicitly captured at useful boundaries.
3. **Replay evidence** — video and/or trace attached to the Run/Artifact.
4. **Live View** — on-demand streamed view of the active browser session.
5. **Take over** — explicit human-in-the-loop browser control when the user needs to intervene.

Takeover has a strict ownership transition:

```text
Agent controls browser
  -> user requests Take over
  -> automated browser input pauses
  -> user controls the session
  -> user releases control or gives a new instruction
  -> Lucubro records the handoff receipt
  -> agent resumes from the current page state
```

Agent and human input must not race each other silently.

Mobile observation should adapt bandwidth and detail. A compact state view plus milestone screenshots may be sufficient most of the time; live frames are loaded when the user asks to watch. Browser recordings/traces are evidence, not the durable Work itself.

## Runtime controls and terminal escape hatches

Hiding provider mechanics by default does **not** mean deleting provider capability or removing expert control.

Lucubro should prevent the normal CEO workflow from depending on provider-specific CLI syntax, session housekeeping, or a raw terminal. It should translate important provider controls into product-level execution actions attached to a Run or Work whenever a stable provider-neutral meaning exists.

Examples include:

- compact or reduce runtime context;
- pause or cancel a Run;
- continue, retry, or start a fresh Run;
- change an approved model/runtime for a subsequent Run;
- inspect normalized execution events and public logs;
- inspect or change the Delegation Envelope within authorization rules;
- reconnect or repair provider state when execution is blocked.

Provider-native commands such as `/compact` remain execution capabilities. They should not become primary Lucubro vocabulary when Lucubro can express the same intent more durably, for example **Compact context** or **Start fresh Run**.

Progressive disclosure should normally be:

```text
Work
  -> Execution inspector
      -> normalized public events and evidence
      -> terminal tail when useful
      -> Advanced runtime
          -> provider-native interactive terminal / commands
```

For expert users, Lucubro may expose an explicit **Advanced runtime** or **Open provider terminal** escape hatch from the relevant Run/Execution inspector. That escape hatch is secondary, clearly scoped to the selected Run, and never becomes the canonical source of Work, Project, Employee, Worker, Artifact, Decision, Knowledge, or authorization state.

Raw chain-of-thought remains hidden. A provider session may be compacted, restarted, or discarded while Lucubro's durable company state survives.

The product principle is:

> **Hide runtime mechanics by default; preserve expert control and provider escape hatches.**

## Motion is product behavior

Lucubro's distinctive motion is not decorative polish. It makes the causal relationship between user intent, AI/system events, and durable company state perceptible.

Motion exists at three scales:

- **micro**: focus, selection, receipt, path reading, disclosure;
- **object**: Intent/Work/Artifact/Decision/Worker-presence mount, replacement, expansion, settle;
- **scene**: focus changes between Work, Project context, Employee/evidence/execution/Knowledge lenses while the shell remains continuous.

The interface should be quiet when nothing changes. Motion should become noticeable precisely when the system receives an intent or real state changes.

Remote execution strengthens this requirement: when a Worker receives Work, a Run starts, browser evidence arrives, a handoff occurs, or a routing decision changes, the canvas should make that causal change perceptible without turning provider event streams into visual noise.

## Hard product rules

- One Workspace has one default CEO-facing Primary Manager relationship.
- Default Home is Work-first, not Project-first and not provider-first.
- Project/Issue/Quick Task are Work Contexts, not new CEO relationships.
- A domain noun does not earn top-level navigation merely by existing.
- Conversation and structured Work are the same product shell.
- Stable space, changing objects.
- Employee owns responsibility; Worker is where a Run executes; Runtime/Model/Playbook is how it executes.
- The control surface and Worker may run on different devices without changing durable Work identity.
- Mobile is a first-class control surface for intent, evidence, decisions, observation, and bounded intervention.
- Users choose outcomes by default; provider/model selection is a routing responsibility unless the user overrides it.
- Routing optimizes expected total cost under capability, quality, latency, privacy, authority/risk, and availability constraints.
- A deterministic approved playbook is preferred over an LLM when it is sufficient for the Work.
- Company Knowledge is Lucubro-owned durable state; provider memory is not canonical company knowledge.
- Browser Live View and takeover are evidence/intervention surfaces attached to a Run, not a replacement for Work state.
- Human takeover must pause conflicting automated browser input and produce an auditable handoff receipt.
- Hide runtime mechanisms by default, but preserve responsibility, risk, durable state, evidence, expert control, and explicit provider escape hatches.
- A visible durable state must have an actionable path.
- Motion follows deterministic local state or normalized product events.
- No fake thinking, fake staged AI progress, fake validation, or raw chain-of-thought.
- Product/domain state remains canonical when GSAP is absent.
- Remote execution requires authenticated pairing, revocation, scoped capabilities, and auditable authorization.
- Evidence needed for review/audit must survive disposable Run environments.
- Real Claude/Codex integration remains below this product contract and can be resumed after the canvas, Worker, evidence, and routing boundaries are stable.

## Near-term implementation order

1. **Company Operating Map v1** — make real Work, Employee ownership, Run/evidence state, and decisions legible on the default canvas.
2. **Worker domain** — add durable Worker identity/capabilities/health and attach Runs to Workers. The current trusted NixOS host can become the first real Worker once the contract is implemented.
3. **Evidence pipeline** — normalize screenshots, Playwright trace/video, diffs, test reports, and public logs as Run-owned evidence.
4. **Browser observe mode** — add an on-demand, initially read-only live browser view.
5. **Human takeover** — add explicit pause/takeover/release ownership and receipts.
6. **Remote transport** — add authenticated Worker-initiated remote connectivity; retain direct private-network deployment as an option.
7. **Capability Router** — route deterministic playbooks vs agents first, then choose eligible runtime/model according to capability and quality/cost constraints.
8. **Company Knowledge** — formalize canonical Knowledge/provenance and contextual/global inspection.
9. **Provider escape hatches** — complete the Execution Inspector and scoped native terminal controls.
10. **Real-agent resume** — reconnect provider execution only after these product boundaries are stable.

## Document hierarchy

Use the repository documents in this order:

1. `PRODUCT-THESIS.md` — why the product exists and the governing interaction/domain direction.
2. Product decision log / domain decisions — durable terminology and locked decisions.
3. `REMOTE-WORKER-RESEARCH.md` and other primary-source research — evidence supporting product/architecture decisions; research does not silently override locked product decisions.
4. `DESIGN-SYSTEM.md` and `MOTION-SYSTEM.md` — how the thesis is expressed in UI and interaction.
5. `SPEC.md` — the current executable V1 engineering slice, not the complete product information architecture.
6. implementation code/tests — current realization of the above.

When lower layers conflict with higher layers, correct the lower layer instead of treating implementation history as product truth.
