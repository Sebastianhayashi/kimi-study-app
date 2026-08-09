<div align="center">
  <img src="public/assets/brand/lucubro-mark.svg" width="68" height="68" alt="Lucubro">

# Lucubro

**A local-first AI company workbench for a single CEO.**

**An AI-native kinetic company canvas built on durable operational state.**

[![CI](https://github.com/Sebastianhayashi/lucubro/actions/workflows/ci.yml/badge.svg)](https://github.com/Sebastianhayashi/lucubro/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/Node.js-22%2B-339933?logo=nodedotjs&logoColor=white)](package.json)
[![License](https://img.shields.io/badge/license-ISC-002FA7)](LICENSE)

</div>

## Why Lucubro

Lucubro is for one person running a company with AI help.

The CEO should not have to operate a collection of agent sessions, provider consoles, project-management screens, infrastructure dashboards, and remote machines just to move work forward. Lucubro gives the CEO one durable relationship with **Alex, the Primary Manager**, one continuous company canvas, and a fleet of execution Workers that can keep doing the work even when the CEO is holding only an iPhone or iPad.

The governing product thesis has two axes:

> **Multica is Lucubro's operational backbone. Lucubro turns that backbone into an AI-native kinetic company canvas: the user expresses intent, and durable company structure materializes, changes, and recedes contextually around the Work.**
>
> **The user chooses outcomes. Lucubro chooses and supervises execution. Workers do the work. Evidence returns to durable company state.**

Multica is an operational reference, not a screen template. Lucubro keeps durable Work/Run separation, project-management depth, structured live activity, evidence, progressive disclosure, explicit authority, and truthful state while replacing rigid screen-first interaction with a continuously responsive AI-native canvas.

Provider/model choice is normally below the user's level of concern. The default question is not "Claude, Codex, Kimi, or another model?" It is "what is the cheapest reliable execution path that can actually complete this Work under the required quality, privacy, latency, risk, authority, and availability constraints?"

See:

- [`docs/company-workbench/PRODUCT-THESIS.md`](docs/company-workbench/PRODUCT-THESIS.md)
- [`docs/company-workbench/REMOTE-WORKER-RESEARCH.md`](docs/company-workbench/REMOTE-WORKER-RESEARCH.md)

## One company canvas

Conversation is not a disposable transcript and it is not a chat sidebar attached to another product. It is one input protocol for durable company state.

```text
CEO outcome
  ↓
Alex · Primary Manager
  ↓
Durable Work
  ↓
Named Employee / responsibility
  ↓
Worker + execution path
  ↓
Lucubro Run
  ↓
normalized public events
  ↓
Evidence · Project context · Knowledge · Needs You · Review · Decision
```

Two interaction rules govern the product:

> **Conversation drives the canvas.**
>
> **Quiet surface, kinetic intelligence.**

At rest, Lucubro is visually calm. When the user expresses intent or real product state changes, affected objects acknowledge, form, update, expand, and settle through coordinated motion.

A normal sequence is:

```text
intent acknowledged
  → Work forms
  → responsibility appears
  → Worker / execution path is selected
  → live execution updates the same Work object
  → Artifact and browser evidence grow inside it
  → Project context grows only when needed
  → relevant Knowledge attaches where it is used
  → Needs You appears only when judgment is required
  → the decision mutates the same durable object
  → stable state settles and motion stops
```

Animation follows real deterministic UI state or normalized product events. Lucubro does not use fake thinking, fake percentages, staged AI progress, or raw chain-of-thought to look alive.

## Digital employees, not exposed AI plumbing

Lucubro separates responsibility from execution infrastructure:

```text
Employee owns responsibility.
Assignment dispatches Work.
Run is one execution attempt.
Worker is where the Run executes.
Runtime / Model / Playbook is how that Run executes.
```

An Employee is not a machine and a model is not an Employee. Ben can remain responsible for a coding Work even if one Run uses a local model on a Linux Worker, another uses Codex on a Mac Worker, and a later Run is resumed through a different provider.

The normal CEO workflow should not depend on provider CLI syntax, model menus, session IDs, or API configuration. Important runtime actions are translated into product-level actions such as **Compact context**, **Pause**, **Cancel**, **Retry**, **Start fresh Run**, or **Take over browser**.

Provider-native controls are not deleted. An Execution inspector can progressively reveal normalized events, terminal tail, and an **Advanced runtime / Open provider terminal** escape hatch. Commands such as `/compact` remain available for expert intervention without becoming the canonical vocabulary for Work or Project state.

## Mobile control, self-hosted Workers

Mac, iPad, iPhone, and ordinary browsers are first-class Lucubro control surfaces. They do not have to be the machines that perform the Work.

The target topology supports both an all-in-one install and split control/Worker deployments:

```text
All-in-one self-hosted

Phone / iPad / Mac
        |
        v
Lucubro service + Worker on one trusted machine
        |
        +-- durable company state
        +-- provider runtimes
        +-- git / browser / tools
```

```text
Split control + Worker

Phone / iPad / Mac
        |
        v
Lucubro Control Plane / Relay
        ^
        | authenticated Worker-initiated channel
        |
Self-hosted Worker(s)
        |
        +-- isolated Run environments
        +-- Claude Code / Codex / local models / tools
        +-- browser execution
```

The split topology is a product direction, not a claim about the current prototype. The preferred design is for Workers to initiate authenticated outbound connections rather than requiring a home/office machine to expose an arbitrary public inbound port. Direct LAN or private-network access remains a valid self-hosted option.

Worker identity is durable. Run environments may be disposable. A Worker can reconnect or move networks without changing the identity of the Employee, Work, Project, or evidence it previously produced.

## Outcome-first capability routing

Users normally describe an outcome and constraints. Lucubro selects an execution path.

```text
Outcome
  → required capability / risk / authority
  → can an approved deterministic playbook do it?
  → responsible Employee + approved capability
  → eligible Worker set
  → eligible Runtime / tool / model set
  → quality / cost / latency / privacy / availability decision
  → Run
```

A simple maintenance request such as "update Codex" may not need an LLM at all if an approved deterministic playbook can safely perform and verify the update. A small low-risk transformation may use a cheaper/local model. A difficult coding change may justify a stronger coding agent. Browser QA requires a browser-capable Worker independently of which model is used.

The default objective is:

> **Minimize expected total cost subject to capability, expected quality, latency, privacy, risk/authority, and availability constraints.**

This is not blind cheapest-model routing. Rework, failures, and poor-quality output are part of total expected cost. Users can override routing for a Work/Run when they want expert control, and material routing choices should remain inspectable through a Routing Decision Record.

## Browser evidence, Live View, and takeover

A digital employee should be able to prove browser work without making the user watch every click.

The intended evidence ladder is:

1. **State** - current URL/title/action and normalized public events.
2. **Milestone screenshot** - captured at useful boundaries or on request.
3. **Replay evidence** - video and/or Playwright trace attached to the Run/Artifact.
4. **Live View** - on-demand streamed observation of the active browser session.
5. **Take over** - explicit human-in-the-loop click/type/scroll control when intervention is needed.

Takeover has an ownership boundary:

```text
Agent controls browser
  → user requests Take over
  → automated browser input pauses
  → user controls the session
  → user releases control or gives a new instruction
  → Lucubro records a handoff receipt
  → agent resumes from current page state
```

The agent and user must not race each other silently. Mobile should default to low-bandwidth state and screenshots, then load live frames only when the user asks to watch.

Evidence pipeline v1 now provides typed, durable Run Evidence with persisted metadata/content, worktree diff evidence, and deterministic mock browser screenshots. Screenshot Evidence materializes inside the live Work object when the event arrives and remains available after reload. Raw evidence bytes are stored outside the append-only Run event log; events carry durable Evidence references/metadata instead.

The deterministic screenshot is explicitly labeled mock evidence. Real browser capture, Playwright trace/video, remote Live View, and takeover are not implemented yet.

## Company Knowledge

Company Knowledge is durable Lucubro state, not a provider session's memory.

Candidate durable knowledge includes:

- Project plans and documents;
- accepted decisions and decision receipts;
- reusable research;
- accepted Artifacts and implementation notes;
- Employee role/capability guidance;
- Skills and Playbooks;
- Run learnings that are explicitly promoted into company knowledge.

Knowledge carries provenance and scope. Users should be able to inspect what the company currently knows, where an item came from, and which Work/Project is using it. Relevant Knowledge can attach contextually to current Work, while a broader Knowledge lens can support explicit search, inspection, and curation.

Provider-native session memory may accelerate one Run, but it is never canonical company knowledge.

## Domain objects are not pages

A recurring product rule is:

> **A domain noun does not earn top-level navigation merely because it exists.**

Lucubro distinguishes five surface types:

- **Domain object** - durable truth such as Work, Project, Issue, Employee, Worker, Run, Artifact, or Decision.
- **Canvas object** - the current visible projection of domain state.
- **Lens** - a focused structured view over domain objects while the Company Canvas Shell remains continuous.
- **Transient interaction** - acknowledgement, suggestion, loading/reconciliation, or receipt state.
- **Configuration surface** - provider/account/runtime/Worker/workspace/policy controls that appear when relevant.

That distinction keeps Lucubro from becoming a conventional SaaS dashboard with an AI chat layer.

### How major capabilities fit

- **Work** is the default action unit. Home remains Work-first across long Projects and lightweight tasks.
- **Project** is a durable Work Context that can grow around long-running or multi-part work. Issues / Map / Activity are Project lenses, not mandatory setup before the CEO can ask for something.
- **Employees** are durable identities and responsibility. They appear with the Work they own and can open a deeper responsibility/capability lens when needed.
- **Workers** are execution hosts. Their capabilities and health appear when they explain execution, risk, availability, or intervention, not as a default infrastructure dashboard.
- **Knowledge** is durable company context with provenance. It attaches to Work/Project and can also be inspected through a broader Knowledge lens when the user asks.
- **Usage / cost** belongs with the Work/Run/execution path that incurred it and with budget boundaries that materially affect decisions.
- **Account / provider** state is infrastructure. It normally stays behind Advanced/Settings and surfaces when credentials, quota, availability, or policy blocks current Work.
- **Artifacts** are evidence owned by Work. They do not compete with their owning Work as a parallel home-screen subject.

## Persistent Company Canvas Shell

The active Company UI keeps these anchors continuous:

- Lucubro identity;
- Alex, the Workspace-level Primary Manager relationship;
- command composer;
- Needs You attention;
- current Work Context;
- current canvas focus/lens;
- deep-link/browser-history state.

Normal focus changes happen inside the same DOM shell. Work, Employee responsibility, or execution settings can become the focused lens without unmounting the CEO-facing relationship or command surface. URLs still change through History API so refresh, back/forward, and deep links remain meaningful.

The current lens control is deliberately a single contextual `Focus` control rather than a row of product tabs. Future Project/Knowledge/Usage capabilities should not be added to it automatically; they must first earn a real contextual workflow.

## What works today

The deterministic Company Workbench slice currently exercises:

```text
CEO request
  → Intent object
  → durable Work
  → Ben · Software Engineer assignment
  → durable local Worker assignment
  → isolated mock Run
  → normalized live activity on the same Work object
  → optional Needs You authority boundary
  → typed Run Evidence
       → worktree diff
       → deterministic browser screenshot when requested
  → Ready for review
  → Accept or Rework
```

The current development branch includes the first **Company Operating Map** slice. It projects existing durable Work under the Employee who owns it, keeps Run/Evidence/decision state attached to the same Work object, survives reload, and makes Alex a company-level routing anchor rather than the visual center of a chat application.

It also includes **Local Worker v1**: Worker identity is durable, every Run records its `workerId`, bootstrap exposes safe Worker capability/health context, and the Company Operating Map can show where a Run executes without promoting provider/model names into the default CEO surface.

**Evidence pipeline v1** persists typed Evidence metadata and bytes outside the Run event log, exposes safe Evidence content endpoints, projects Evidence counts onto the operating map, materializes screenshot Evidence inside the live Work object, and restores the same Evidence in Durable Work detail after reload. The mock browser screenshot is deterministic and visibly labeled as such; it does not impersonate a real browser capture.

The UI also combines:

- reload-safe Durable Work Context;
- contextual canvas lenses for durable Work, Employee responsibility, and advanced execution state;
- a kinetic Execution setup with runtime choice and host Workspace selection;
- Needs You authority decisions and Artifact/Evidence review;
- deterministic mock product events for interaction development.

Reloading does not fabricate historical chat. Lucubro restores only durable state and evidence it can prove.

A Work reaches `Ready for review` only after Artifact evidence is available.

## Host Workspace picker

A repository path names a **workspace on the execution host**, not just a string and not necessarily the browser device.

Current behavior includes:

- one quiet line input whose neutral state wakes to Klein blue on focus;
- a disclosure triangle that opens an execution-host directory tree;
- expandable/collapsible directory nodes;
- path suggestions while typing, including `~/…` where applicable;
- real directory inspection and Git-repository detection;
- new-folder creation inside the configured root;
- keyboard suggestion navigation;
- GSAP lifecycle motion for focus, reading, selection, receipt, mount, replacement, and exit.

The workspace browser lists directories and directory metadata only. It does not expose arbitrary file-content reading, and normal tree listing omits hidden directories.

Configure the root with:

```bash
LUCUBRO_WORKSPACE_ROOT="$HOME"
```

### Browser device vs execution host

A browser on a Mac/iPhone can control Lucubro running on NixOS over a trusted network:

```text
Mac / iPhone browser
        ↓ LAN
NixOS Lucubro server
        ↓
NixOS filesystem + runtimes
```

Dragging a Mac folder into that browser cannot truthfully turn it into a NixOS path. Lucubro detects the client folder and explains the boundary instead of pretending it is runnable. A future direct-drop experience requires an explicit copy/import flow or a native same-host bridge.

## Motion and visual system

The Company Canvas uses a Klein-blue-centered system built around `#002FA7`.

Klein blue is the brand axis, not a paint bucket:

- blue - identity, primary action, focus, selection, active structure;
- amber - Needs You / authority boundary;
- green - accepted / available / evidence-ready;
- red - failed / destructive error;
- cool neutrals - most application surfaces.

Motion has three scales:

- **micro** - focus, selection, receipt, tree/disclosure behavior;
- **object** - Intent, Work, Artifact, Evidence, Decision, Worker-presence formation/update/settling;
- **scene** - canvas focus changes while the shell remains continuous.

GSAP owns choreography, not product truth. If GSAP fails or reduced motion is requested, all underlying state and actions remain understandable and usable.

See:

- [`docs/company-workbench/DESIGN-SYSTEM.md`](docs/company-workbench/DESIGN-SYSTEM.md)
- [`docs/company-workbench/MOTION-SYSTEM.md`](docs/company-workbench/MOTION-SYSTEM.md)

## Run locally

Requirements: Node.js 22+ and npm.

```bash
npm ci
LUCUBRO_COMPANY_MOCK_RUNTIME=1 npm start
```

Open:

```text
http://127.0.0.1:3200/company
```

The deterministic mock runtime is the recommended product-development path right now. It does not require Claude, Codex, API keys, or provider credentials.

### Trusted LAN preview

The server remains loopback-only by default. A local-network mock preview can be deliberately exposed:

```bash
LUCUBRO_WORKSPACE_ROOT="$HOME" \
LUCUBRO_ALLOW_LAN_WORKSPACE_BROWSER=1 \
LUCUBRO_COMPANY_MOCK_RUNTIME=1 \
LUCUBRO_COMPANY_HOST=0.0.0.0 \
LUCUBRO_COMPANY_PORT=3217 \
npm start
```

There is no authentication layer yet. Enabling LAN workspace browsing exposes directory names and directory creation within the configured root to devices that can reach the service. Do not expose this listener directly to the public internet.

This trusted-LAN preview is **not** the future remote Worker protocol. Public/off-LAN remote operation requires authenticated device/Worker pairing and an encrypted remote transport that has not been implemented yet.

## What Lucubro owns

Lucubro is the product source of truth for:

- Work / Assignment state;
- durable Employee identity;
- durable Worker identity and Run attachment;
- Run identity and lifecycle;
- authorization and approval history;
- typed Run Evidence metadata/content and Artifact evidence;
- CEO review decisions;
- append-only product events;
- future Company Knowledge/provenance state.

Runtime providers own execution-specific mechanics such as model context, provider session/thread IDs, provider-specific tool calls, and protocol details. Provider sessions are references from Lucubro Runs, never product identity.

## Permission model

`Auto` means a bounded **Delegation Envelope**, not unrestricted authority.

A coding Work may allow ordinary workspace read/write and local shell execution while keeping materially different authority separate, including network access, package installation, git push, destructive filesystem operations, permission expansion, host-level mutation, credential changes, and other external side effects.

Out-of-envelope actions become `Needs You` instead of silently expanding authority.

Remote Worker execution makes this boundary more important, not less. Worker pairing, capability roots, browser takeover, and host-wide maintenance must remain auditable and revocable.

## Runtime status

Adapters exist for Claude Code / Agent SDK work, Codex App Server work, and deterministic mock execution.

Real Claude/Codex execution is currently **paused as a product priority** while the Company Operating Map, Worker contract, Evidence pipeline, and UI/UX interaction model are being stabilized. Real-provider smoke tests are not a release gate, and the UI must not imply a provider is ready merely because a binary is installed.

## Repository architecture

```text
company-server.js
  ↓
lib/company/
  ├── company-service.js      Work-level orchestration
  ├── work-store.js           durable Work state
  ├── run-store.js            durable Run state + append-only events
  ├── worker-store.js         durable Worker identity
  ├── evidence-store.js       durable typed Evidence metadata/content
  ├── evidence-response.js    safe browser content policy for Evidence
  ├── run-orchestrator.js     execution lifecycle + Evidence normalization
  ├── approval-broker.js      Delegation Envelope → Needs You
  ├── worktree-manager.js     isolated coding worktrees
  ├── workspace-browser.js    confined host directory navigation
  └── runtime/                provider adapters + deterministic mock evidence

public/
  ├── company.html                 persistent Company Canvas Shell
  ├── company.js                   live Work/event/Evidence projection
  ├── company-operating-map.js     Work → Employee → Worker/Evidence projection
  ├── company-durable.js           reload-safe Work + Evidence Context
  ├── company-v3.js                semantic company-state projection
  ├── company-kinetic.js           Execution setup lifecycle motion
  ├── company-workspace.js         host tree/autocomplete/create-folder behavior
  ├── company-pages.js             contextual lens + History API controller
  ├── company-operating-map.css    operating-map visual hierarchy
  ├── company-canvas-shell.css     persistent lens/focus visual system
  └── company*.css                 product surfaces and state styling

docs/company-workbench/
  ├── PRODUCT-THESIS.md            governing product direction
  ├── REMOTE-WORKER-RESEARCH.md    primary-source Worker/routing/browser research
  ├── DESIGN-SYSTEM.md             visual + interaction system
  ├── MOTION-SYSTEM.md             event/component/scene motion contract
  └── SPEC.md                      current executable V1 engineering slice
```

Remote Worker transport/pairing, real browser observation, Capability Router, and Company Knowledge remain future modules. Local Worker v1 and typed Evidence v1 are implemented in the active Company slice.

## Quality gates

```bash
npm run check
npm test
npx playwright test
```

Company coverage includes Work/Run persistence, durable Worker attachment, typed Evidence persistence/content safety, live and reload-safe Evidence projection, authorization, Artifact-before-completion ordering, review decisions, Durable Work Context, Company Operating Map projection, live canvas behavior, Workspace tree/path behavior, contextual lens continuity/history, keyboard/focus, mobile containment, reduced motion, and Klein-blue design states.

Tests assert user-observable semantics rather than exact GSAP durations or transform values.

## Product principles

- Multica backbone, not Multica screen template.
- Conversation drives the canvas.
- Quiet surface, kinetic intelligence.
- Stable space, changing durable objects.
- Default Home is Work-first.
- One Workspace-level Primary Manager relationship.
- A domain object does not automatically become a top-level page.
- Employee owns responsibility; Worker is where a Run executes; Runtime/Model/Playbook is how it executes.
- Mobile/control clients and Workers may run on different devices.
- Users choose outcomes by default; Lucubro chooses and supervises execution.
- Prefer an approved deterministic playbook over an LLM when it is sufficient.
- Optimize expected total cost under capability, quality, latency, privacy, authority/risk, and availability constraints.
- Company Knowledge is durable Lucubro state; provider session memory is not canonical knowledge.
- Browser screenshots, trace/video, Live View, and takeover are evidence/intervention attached to a Run.
- Hide mechanisms, not responsibility, risk, durable state, evidence, or expert control.
- Provider-native terminal/CLI remains available as a scoped Advanced runtime escape hatch.
- The workspace path names the execution host, not the browser device.
- Live state may advance; authorization advances only across explicitly accepted material deltas.
- Auto delegates within an envelope; it does not erase the envelope.
- Motion acknowledges and explains real state. It never fabricates AI progress.
- A visible durable state needs an actionable path.

## Current limits

Important unfinished areas include:

- Primary Manager clarification, planning, and Work Proposal behavior is still minimal;
- Project domain/state growth from Work is not implemented in the new canvas model yet;
- local Worker identity and Run→Worker attachment are implemented, but remote capability advertisement, health semantics, pairing/revocation, and multi-Worker routing are not;
- authenticated off-LAN remote Worker transport is not implemented;
- browser Live View and human takeover are not implemented;
- typed diff Evidence and deterministic mock screenshot Evidence are implemented, but real browser screenshots, Playwright trace/video, and test-report capture are not connected yet;
- Capability Router and automatic cost/quality routing are not implemented;
- Company Knowledge has a governing product contract but not yet a canonical persisted store/provenance implementation;
- Usage/account have not yet been reintroduced contextually around execution and routing;
- Durable Work Context restores the latest attached Run rather than complete multi-Run history;
- Rework does not yet create the next Run automatically;
- approval waits are still in-memory and not restart-recoverable;
- cancellation and full Run recovery are incomplete;
- direct client-folder import is not implemented;
- multi-Employee collaboration, Playbooks, Required Gates, and Routing Decision Records are not yet full canvas surfaces;
- hosted authentication/billing/relay infrastructure is not part of the current local-first slice;
- real Claude/Codex testing is intentionally not the current focus.

## Active vs frozen code

**Active product:** Company Workbench (`company-server.js`, `lib/company/`, `public/company*`, `docs/company-workbench/`, and Company Workbench tests).

**Frozen legacy:** the previous AI learning workspace remains only for implementation history and regression protection. It should not receive new feature work except for safe migration, security, or repository integrity.

## Product documents

- [`docs/company-workbench/PRODUCT-THESIS.md`](docs/company-workbench/PRODUCT-THESIS.md) - governing product direction
- [`docs/company-workbench/REMOTE-WORKER-RESEARCH.md`](docs/company-workbench/REMOTE-WORKER-RESEARCH.md) - primary-source research for Worker, routing, and browser evidence
- [`docs/company-workbench/DESIGN-SYSTEM.md`](docs/company-workbench/DESIGN-SYSTEM.md) - visual and interaction system
- [`docs/company-workbench/MOTION-SYSTEM.md`](docs/company-workbench/MOTION-SYSTEM.md) - live canvas and motion contract
- [`docs/company-workbench/SPEC.md`](docs/company-workbench/SPEC.md) - current V1 engineering slice, not complete IA
- [`AGENTS.md`](AGENTS.md) - repository and agent contribution rules
- [`CONTRIBUTING.md`](CONTRIBUTING.md) - contribution and verification requirements
- [`SECURITY.md`](SECURITY.md) - security policy

## License

Code is available under the [ISC License](LICENSE). Third-party work is listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).