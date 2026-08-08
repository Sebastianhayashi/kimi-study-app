<div align="center">
  <img src="public/assets/brand/lucubro-mark.svg" width="68" height="68" alt="Lucubro">

# Lucubro

**A local-first AI company workbench for a single CEO.**

Talk to one Primary Manager. Keep the actual Work, evidence, decisions, and execution history durable underneath the conversation.

[![CI](https://github.com/Sebastianhayashi/lucubro/actions/workflows/ci.yml/badge.svg)](https://github.com/Sebastianhayashi/lucubro/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/Node.js-22%2B-339933?logo=nodedotjs&logoColor=white)](package.json)
[![License](https://img.shields.io/badge/license-ISC-002FA7)](LICENSE)

</div>

## The product

Lucubro is an operating workbench for one person running a company.

The front door is **Alex, the Primary Manager**. Conversation is not treated as a disposable chat transcript. It is the input protocol for durable company state:

```text
CEO intent
  ↓
Alex · Primary Manager
  ↓
Durable Work
  ↓
Named Employees
  ↓
Lucubro Run
  ↓
Runtime adapter
  ↓
Evidence · Needs You · Review · Decision
```

Two interaction rules govern the product:

> **Conversation first. Structure when needed.**
>
> **Conversation drives the canvas.**

The Manager surface is a live company canvas. A user instruction enters as an intent, forms durable Work, attaches an Employee and Run, and then changes in place as real product events arrive. Work, Artifact, approval, and review state do not disappear into model transcripts.

## Conversation-driven canvas

The canvas is spatially stable but stateful. It is not a freeform diagram editor and it is not a stack of chat cards.

A normal interaction looks like:

```text
user intent
  → intent received
  → Work formed
  → Ben / Run attached
  → public runtime events update the same Work object
  → Artifact evidence grows inside that object
  → Needs You or Review changes it in place
  → stable state settles and motion stops
```

The current mock runtime already exercises this through the same Run event stream used by provider adapters. `run.started`, normalized public employee updates, tool events, Artifact events, approvals, and terminal Run events update one live Work surface rather than creating dozens of tiny chat messages.

Raw model reasoning is never shown. Real-time animation follows normalized product events only.

## Product sections

Lucubro has four Company sections:

- **Manager** — `/company` — Alex, current Working set, live canvas, durable Work Context, Needs You, and the command composer.
- **Work** — `/company/work` — durable Work index backed by stored Work state.
- **Employees** — `/company/employees` — durable identities currently known by the product. No synthetic org chart is generated.
- **Settings** — `/company/settings` — truthful runtime availability and execution-host workspace state.

Manager remains the front door. The other sections expose durable structure without turning Lucubro into a dashboard-first product.

## What works today

The deterministic Company Workbench slice is:

```text
CEO request
  → Work is created
  → Ben · Software Engineer is assigned
  → isolated mock Run
  → normalized live activity
  → optional Needs You authority boundary
  → diff Artifact
  → Ready for review
  → Accept or Rework
```

The UI has three complementary layers:

- **Live Manager canvas** for intent and current state mutation.
- **Working set** for Active Work, Review, and Needs You counts that have real action paths.
- **Durable Work Context** for Work that survives a page reload, including current status, latest Run metadata, Artifact evidence, and review actions.

Reloading does **not** fabricate an old conversation. Lucubro restores only durable state and evidence it can prove.

A Work item reaches `Ready for review` only after evidence has crossed the Work boundary. Artifact evidence is available before completion is presented to the CEO.

## Host Workspace picker

Execution setup treats a repository path as a **workspace on the execution host**, not merely as a string.

The current picker supports:

- a disclosure triangle that opens an inline host directory tree;
- expandable/collapsible directory nodes;
- choosing a directory without typing its full path;
- suggestions while typing a path, including `~/…` when Home is inside the configured root;
- real host directory inspection and Git-repository detection;
- creating a new folder inside the configured workspace root;
- keyboard navigation of suggestions;
- animated mount, replacement, receipt, and exit states;
- manually entered paths outside the browsable root as unverified paths that are validated later at the Work boundary.

The browser API is intentionally confined. It lists directories and directory metadata. It does not expose arbitrary file-content reading. Hidden directories are omitted from the normal tree.

Configure the browsable execution-host root with:

```bash
LUCUBRO_WORKSPACE_ROOT="$HOME"
```

### Browser device vs. execution host

The browser and the runtime may be on different physical machines:

```text
Mac / iPhone browser
        ↓
LAN
        ↓
NixOS Lucubro server
        ↓
NixOS filesystem + runtimes
```

A folder dragged from the Mac is therefore **not automatically a NixOS path**. Browser directory APIs give a user-authorized client-side directory handle/content, not a trustworthy remote-host absolute path.

Lucubro currently detects a dropped client folder and explains that boundary instead of pretending it can execute there. Direct folder drop must become one of two explicit products later:

1. a copy/import flow that transfers the client directory into a host workspace; or
2. a native/desktop bridge where Lucubro runs on the same machine and intentionally maps the selected directory into execution state.

Until then, the host tree is the canonical browser-based workspace selector.

## Interaction character

Lucubro follows another interaction principle:

> **Quiet surface, kinetic intelligence.**

At rest, the interface is calm. When the user expresses intent or real system state changes, the affected objects become active long enough to explain causality, then settle again.

The preferred rhythm is:

```text
Acknowledge
  → Interpret / structure
  → Receipt
  → Settle and continue
```

Examples:

- Execution setup assembles its controls as one coordinated sequence.
- Runtime choices enter as a group and leave in reverse order.
- Runtime selection produces a receipt rather than silently mutating a select value.
- Workspace path focus, suggestion, tree expansion, directory inspection, and folder creation each have explicit state motion.
- Sending an instruction creates an intent object, then forms a Work object in the same canvas.
- Live Run events replace the current live state inside that Work object instead of creating noisy transient notifications.
- Artifact evidence mounts inside the Work object when a real Artifact event arrives.
- Needs You and Review alter the same object in place.
- Submission uses the same Execution setup exit choreography as manual close. Visible components do not disappear by bypassing their lifecycle.

Motion may communicate **reception, local interpretation, selection, hierarchy, causality, or confirmed product state**. It must never invent AI work.

See [`docs/company-workbench/MOTION-SYSTEM.md`](docs/company-workbench/MOTION-SYSTEM.md).

## Design system

The Company Workbench uses a Klein-blue-centered product system built around `#002FA7`.

Klein blue is the brand axis, not a paint bucket. Most surfaces remain cool neutral; semantic colors are reserved for meaning:

- blue: brand, primary action, active structure, selection, live canvas state;
- amber: Needs You / authority boundary;
- green: accepted / available / evidence-ready states;
- red: failed / destructive error.

The interface is intentionally **minimal, not empty**. Information density should come from real Work, evidence, decisions, Employees, workspace context, and live state rather than decorative cards.

UI work is reviewed against:

- Checklist Design for typography, states, accessibility, responsiveness, loading, and component behavior;
- the project design-taste audit rules for hierarchy, density, anti-template discipline, and redesign quality;
- official GSAP patterns for timelines, transform/opacity motion, lifecycle cleanup, performance, and reduced-motion behavior.

See [`docs/company-workbench/DESIGN-SYSTEM.md`](docs/company-workbench/DESIGN-SYSTEM.md).

## Run it locally

Requirements: Node.js 22+ and npm.

```bash
npm ci
LUCUBRO_COMPANY_MOCK_RUNTIME=1 npm start
```

Open:

```text
http://127.0.0.1:3200/company
```

The deterministic mock runtime is the recommended way to inspect the product and run browser tests. It does not require Claude, Codex, API keys, or model credentials.

### Preview on a trusted local network

The server remains loopback-only by default. A basic mock preview can be deliberately exposed to the LAN with:

```bash
LUCUBRO_COMPANY_MOCK_RUNTIME=1 \
LUCUBRO_COMPANY_HOST=0.0.0.0 \
LUCUBRO_COMPANY_PORT=3217 \
npm start
```

Host workspace browsing is blocked for non-loopback clients unless explicitly enabled. For a trusted LAN preview that may browse/create directories under the configured root:

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

- Work and Assignment state;
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

Out-of-envelope actions become `Needs You` instead of silently escalating execution authority.

## Runtime status

Runtime adapters currently exist for:

- Claude Code / Agent SDK integration work;
- Codex App Server integration work;
- deterministic mock execution.

Real Claude/Codex execution is currently **paused as a product priority** while the Work Core and UI/UX are being completed. Real-provider smoke tests are not a release gate, and the UI must not imply a provider is ready merely because a binary is installed.

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
  └── runtime/
      ├── claude-agent-sdk.js
      ├── codex-app-server.js
      └── mock.js

public/
  ├── company.html             shared Company shell + section views
  ├── company.js               live Manager canvas + Work event projection
  ├── company-durable.js       reload-safe Work Context
  ├── company-v3.js            Working set + state projection
  ├── company-kinetic.js       runtime + Execution setup lifecycle motion
  ├── company-workspace.js     host tree / autocomplete / create-folder behavior
  ├── company-pages.js         Manager / Work / Employees / Settings routing
  ├── company-v3.css           Klein-blue product system
  ├── company-durable.css      durable Work surface
  ├── company-kinetic.css      runtime rail + line-based path control
  ├── company-workspace.css    host workspace tree and suggestion surface
  └── company-pages.css        multi-section shell + live canvas styling

docs/company-workbench/
  ├── SPEC.md                  V1 product contract
  ├── DESIGN-SYSTEM.md         visual + interaction system
  └── MOTION-SYSTEM.md         canvas/event/component motion contract
```

## Quality gates

```bash
npm run check
npm test
npx playwright test
```

Company Workbench coverage includes:

- Work / Run identity and durable state;
- Delegation Envelope behavior;
- provider event normalization;
- Needs You approval behavior;
- Artifact-before-completion ordering;
- Work review decisions;
- reload-safe Durable Work Context;
- conversation-driven live canvas behavior;
- runtime selection and full component lifecycle motion;
- confined host workspace listing, suggestion, inspection, and folder creation;
- Manager / Work / Employees / Settings routes;
- keyboard and focus behavior;
- mobile viewport containment;
- reduced motion;
- Klein-blue design tokens and adaptive composer behavior.

## Product principles

- Conversation first, not chat-only.
- Conversation drives the canvas.
- Stable space, changing durable objects.
- Hide detail, not durable structure.
- Employee is durable identity; Assignment / Work is dispatch; Run is one execution attempt.
- The workspace path names the execution host, not the browser device.
- Client-local folders must never be silently misrepresented as execution-host paths.
- Live state may advance; authorization advances only across explicitly accepted material deltas.
- Auto delegates within an envelope; it does not erase the envelope.
- UI may compress decisions, but authorization remains Work-granular.
- Quiet surface, kinetic intelligence.
- Motion acknowledges and explains real state. It never fabricates AI progress.
- A visible product state needs an actionable path.

## Current limits

Lucubro is under active development. Important unfinished areas include:

- Primary Manager clarification, planning, and Work Proposal behavior is still minimal;
- Durable Work Context restores the latest attached Run rather than a complete multi-Run history browser;
- Rework records the state transition but does not yet create the next Run automatically;
- approval waits are still in-memory and are not restart-recoverable;
- cancellation and full Run recovery are not complete;
- direct client-folder import is not implemented; browser drop currently detects the client directory and explains the host/client boundary;
- multi-Employee collaboration, Playbooks, Required Gates, and Routing Decision Records are not yet full product surfaces;
- there is no hosted account, authentication, billing, cloud queue, or production deployment model;
- real Claude/Codex smoke tests are intentionally not the current development focus.

## Active vs. frozen code

**Active product:** Company Workbench (`company-server.js`, `lib/company/`, `public/company*`, `docs/company-workbench/`, and Company Workbench tests).

**Frozen legacy:** the previous AI learning workspace remains in the repository for implementation history and regression protection. It should not receive new feature work unless needed for safe migration, security, or repository integrity.

## Product documents

- [`docs/company-workbench/SPEC.md`](docs/company-workbench/SPEC.md) - V1 product contract
- [`docs/company-workbench/DESIGN-SYSTEM.md`](docs/company-workbench/DESIGN-SYSTEM.md) - visual and interaction system
- [`docs/company-workbench/MOTION-SYSTEM.md`](docs/company-workbench/MOTION-SYSTEM.md) - live canvas and component lifecycle motion contract
- [`AGENTS.md`](AGENTS.md) - repository and agent contribution rules
- [`CONTRIBUTING.md`](CONTRIBUTING.md) - contribution and verification requirements
- [`SECURITY.md`](SECURITY.md) - security policy

## License

Code is available under the [ISC License](LICENSE). Third-party work is listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
