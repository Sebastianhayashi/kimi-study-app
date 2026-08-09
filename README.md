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

The CEO should not have to operate a collection of agent sessions, provider consoles, project-management screens, and infrastructure dashboards just to move work forward. Lucubro gives the CEO one durable relationship with **Alex, the Primary Manager**, and one continuous work surface where company state can form around the work itself.

The governing product thesis is:

> **Multica is Lucubro's operational backbone. Lucubro turns that backbone into an AI-native kinetic company canvas: the user expresses intent, and durable company structure materializes, changes, and recedes contextually around the Work.**

Multica is an operational reference, not a screen template. Lucubro keeps durable Work/Run separation, structured live activity, evidence, progressive disclosure, explicit authority, and truthful state while replacing rigid screen-first interaction with a continuously responsive AI-native canvas.

See [`docs/company-workbench/PRODUCT-THESIS.md`](docs/company-workbench/PRODUCT-THESIS.md).

## One company canvas

Conversation is not a disposable transcript and it is not a chat sidebar attached to another product. It is an input protocol for durable company state.

```text
CEO intent
  ↓
Alex · Primary Manager
  ↓
Durable Work
  ↓
Named Employees / responsibility
  ↓
Lucubro Run
  ↓
normalized public events
  ↓
Evidence · Project context · Needs You · Review · Decision
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
  → live execution updates the same Work object
  → Artifact evidence grows inside it
  → Project context grows only when needed
  → Needs You appears only when judgment is required
  → the decision mutates the same durable object
  → stable state settles and motion stops
```

Animation follows real deterministic UI state or normalized product events. Lucubro does not use fake thinking, fake percentages, staged AI progress, or raw chain-of-thought to look alive.

## Domain objects are not pages

A recurring product rule is:

> **A domain noun does not earn top-level navigation merely because it exists.**

Lucubro distinguishes five surface types:

- **Domain object** — durable truth such as Work, Project, Issue, Employee, Run, Artifact, or Decision.
- **Canvas object** — the current visible projection of domain state.
- **Lens** — a focused structured view over domain objects while the Company Canvas Shell remains continuous.
- **Transient interaction** — acknowledgement, suggestion, loading/reconciliation, or receipt state.
- **Configuration surface** — provider/account/runtime/workspace/policy controls that appear when relevant.

That distinction keeps Lucubro from becoming a conventional SaaS dashboard with an AI chat layer.

### How major capabilities fit

- **Work** is the default action unit. Home remains Work-first across long Projects and lightweight tasks.
- **Project** is a durable Work Context that can grow around long-running or multi-part work. Issues / Map / Activity are Project lenses, not mandatory setup before the CEO can ask for something.
- **Employees** are durable identities and responsibility. They appear with the Work they own and can open a deeper responsibility/capability lens when needed.
- **Knowledge** first appears as context, source, memory, or evidence attached to Work/Project. A global library is not assumed before a real retrieval/archive workflow justifies it.
- **Usage / cost** belongs with the Work/Run/runtime that incurred it and with budget boundaries that materially affect decisions.
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
  → isolated mock Run
  → normalized live activity on the same Work object
  → optional Needs You authority boundary
  → diff Artifact
  → Ready for review
  → Accept or Rework
```

The UI combines:

- a live Manager canvas for current intent and Work mutation;
- a Working set for actionable Active Work / Review / Needs You state;
- reload-safe Durable Work Context;
- contextual canvas lenses for durable Work, Employee responsibility, and advanced execution state;
- a kinetic Execution setup with runtime choice and host Workspace selection.

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

A browser on a Mac/iPhone can control Lucubro running on NixOS:

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

- blue — identity, primary action, focus, selection, active structure;
- amber — Needs You / authority boundary;
- green — accepted / available / evidence-ready;
- red — failed / destructive error;
- cool neutrals — most application surfaces.

Motion has three scales:

- **micro** — focus, selection, receipt, tree/disclosure behavior;
- **object** — Intent, Work, Artifact, Decision formation/update/settling;
- **scene** — canvas focus changes while the shell remains continuous.

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

## What Lucubro owns

Lucubro is the product source of truth for:

- Work / Assignment state;
- durable Employee identity;
- Run identity and lifecycle;
- authorization and approval history;
- Artifact evidence;
- CEO review decisions;
- append-only product events.

Runtime providers own execution-specific mechanics such as model context, provider session/thread IDs, provider-specific tool calls, and protocol details. Provider sessions are references from Lucubro Runs, never product identity.

## Permission model

`Auto` means a bounded **Delegation Envelope**, not unrestricted authority.

A coding Work may allow ordinary workspace read/write and local shell execution while keeping materially different authority separate, including network access, package installation, git push, destructive filesystem operations, permission expansion, and other external side effects.

Out-of-envelope actions become `Needs You` instead of silently expanding authority.

## Runtime status

Adapters exist for Claude Code / Agent SDK work, Codex App Server work, and deterministic mock execution.

Real Claude/Codex execution is currently **paused as a product priority** while the Canvas Shell, Work Core, and UI/UX contract are being stabilized. Real-provider smoke tests are not a release gate, and the UI must not imply a provider is ready merely because a binary is installed.

## Repository architecture

```text
company-server.js
  ↓
lib/company/
  ├── company-service.js      Work-level orchestration
  ├── work-store.js           durable Work state
  ├── run-store.js            durable Run state + append-only events
  ├── run-orchestrator.js     execution lifecycle
  ├── approval-broker.js      Delegation Envelope → Needs You
  ├── worktree-manager.js     isolated coding worktrees
  ├── workspace-browser.js    confined host directory navigation
  └── runtime/                provider adapters + mock

public/
  ├── company.html             persistent Company Canvas Shell
  ├── company.js               live Work/event projection
  ├── company-durable.js       reload-safe Work Context
  ├── company-v3.js            Working set projection
  ├── company-kinetic.js       Execution setup lifecycle motion
  ├── company-workspace.js     host tree/autocomplete/create-folder behavior
  ├── company-pages.js         contextual lens + History API controller
  ├── company-canvas-shell.css persistent lens/focus visual system
  └── company*.css             product surfaces and state styling

docs/company-workbench/
  ├── PRODUCT-THESIS.md        governing product direction
  ├── DESIGN-SYSTEM.md         visual + interaction system
  ├── MOTION-SYSTEM.md         event/component/scene motion contract
  └── SPEC.md                  current executable V1 engineering slice
```

## Quality gates

```bash
npm run check
npm test
npx playwright test
```

Company coverage includes Work/Run persistence, authorization, Artifact-before-completion ordering, review decisions, Durable Work Context, live canvas behavior, Workspace tree/path behavior, contextual lens continuity/history, keyboard/focus, mobile containment, reduced motion, and Klein-blue design states.

Tests assert user-observable semantics rather than exact GSAP durations or transform values.

## Product principles

- Multica backbone, not Multica screen template.
- Conversation drives the canvas.
- Quiet surface, kinetic intelligence.
- Stable space, changing durable objects.
- Default Home is Work-first.
- One Workspace-level Primary Manager relationship.
- A domain object does not automatically become a top-level page.
- Hide mechanisms, not responsibility, risk, durable state, or evidence.
- Employee is durable identity; Assignment / Work is dispatch; Run is one execution attempt.
- The workspace path names the execution host, not the browser device.
- Live state may advance; authorization advances only across explicitly accepted material deltas.
- Auto delegates within an envelope; it does not erase the envelope.
- Motion acknowledges and explains real state. It never fabricates AI progress.
- A visible durable state needs an actionable path.

## Current limits

Important unfinished areas include:

- Primary Manager clarification, planning, and Work Proposal behavior is still minimal;
- Project domain/state growth from Work is not implemented in the new canvas model yet;
- Knowledge does not yet have a locked durable domain contract;
- Usage/account are not independent product apps and have not yet been reintroduced contextually;
- Durable Work Context restores the latest attached Run rather than complete multi-Run history;
- Rework does not yet create the next Run automatically;
- approval waits are still in-memory and not restart-recoverable;
- cancellation and full Run recovery are incomplete;
- direct client-folder import is not implemented;
- multi-Employee collaboration, Playbooks, Required Gates, and Routing Decision Records are not yet full canvas surfaces;
- hosted account/authentication/billing/cloud queues are out of the current local-first slice;
- real Claude/Codex testing is intentionally not the current focus.

## Active vs frozen code

**Active product:** Company Workbench (`company-server.js`, `lib/company/`, `public/company*`, `docs/company-workbench/`, and Company Workbench tests).

**Frozen legacy:** the previous AI learning workspace remains only for implementation history and regression protection. It should not receive new feature work except for safe migration, security, or repository integrity.

## Product documents

- [`docs/company-workbench/PRODUCT-THESIS.md`](docs/company-workbench/PRODUCT-THESIS.md) — governing product direction
- [`docs/company-workbench/DESIGN-SYSTEM.md`](docs/company-workbench/DESIGN-SYSTEM.md) — visual and interaction system
- [`docs/company-workbench/MOTION-SYSTEM.md`](docs/company-workbench/MOTION-SYSTEM.md) — live canvas and motion contract
- [`docs/company-workbench/SPEC.md`](docs/company-workbench/SPEC.md) — current V1 engineering slice, not complete IA
- [`AGENTS.md`](AGENTS.md) — repository and agent contribution rules
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — contribution and verification requirements
- [`SECURITY.md`](SECURITY.md) — security policy

## License

Code is available under the [ISC License](LICENSE). Third-party work is listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
