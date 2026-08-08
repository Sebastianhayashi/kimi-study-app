<div align="center">
  <img src="public/assets/brand/lucubro-mark.svg" width="68" height="68" alt="Lucubro">

# Lucubro

**A local-first AI company workbench for one person running a company.**

Talk to one Primary Manager. Keep the actual Work, evidence, decisions, and execution history durable underneath the conversation.

[![CI](https://github.com/Sebastianhayashi/lucubro/actions/workflows/ci.yml/badge.svg)](https://github.com/Sebastianhayashi/lucubro/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/Node.js-22%2B-339933?logo=nodedotjs&logoColor=white)](package.json)
[![License](https://img.shields.io/badge/license-ISC-002FA7)](LICENSE)

</div>

## The product

Lucubro is an operating workbench for a single CEO or owner-operator.

The front door is a conversation with **Alex, the Primary Manager**. The product underneath that conversation is not chat history. It is durable company state:

```text
CEO
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

The core interaction rule is:

> **Conversation first. Structure when needed.**

Lucubro keeps implementation mechanics quiet until they change a decision. Work, Runs, Artifacts, approvals, and review state remain structured and recoverable instead of disappearing into a model transcript.

## What works today

The current Company Workbench includes a complete deterministic product slice:

```text
CEO request
  → Work is created
  → Ben · Software Engineer is assigned
  → isolated mock Run
  → normalized activity
  → optional Needs You authority boundary
  → diff Artifact
  → Ready for review
  → Accept or Rework
```

The UI now has two complementary layers:

- **Manager Conversation** for intent, updates, and current Work.
- **Durable Work Context** for Work that survives a page reload, including current status, Run metadata, Artifact evidence, and review actions.

Reloading the page does **not** fabricate an old conversation. Instead, Lucubro restores the durable Work objects it can actually prove from stored state and events.

### Working set

The front door projects three decision-bearing counts:

- Active Work
- Review
- Needs you

These are operational state, not productivity vanity metrics.

### Needs You

`Needs You` is reserved for authority or commitment changes. It is intentionally separate from routine execution progress.

### Review

A Work item reaches `Ready for review` only after evidence has crossed the Work boundary. Artifact evidence is available before completion is presented to the CEO.

## Design system

The Company Workbench uses a Klein-blue-centered product system built around `#002FA7`.

Klein blue is the brand axis, not a paint bucket. Most surfaces remain cool neutral; semantic colors are reserved for meaning:

- blue: brand, primary action, review-ready structure;
- amber: Needs You / authority boundary;
- green: accepted / available;
- red: failed / destructive error.

The interface is intentionally **minimal, not empty**. Conversation remains primary, while Work, Artifact, review, and authority controls receive enough visual weight to be useful every day.

UI work is reviewed against:

- Checklist Design for typography, states, accessibility, responsiveness, loading, and component behavior;
- the project design-taste audit rules for hierarchy, density, anti-template discipline, and redesign quality;
- GSAP patterns for motivated motion, lifecycle cleanup, and reduced-motion behavior.

See [`docs/company-workbench/DESIGN-SYSTEM.md`](docs/company-workbench/DESIGN-SYSTEM.md).

## Run it locally

Requirements:

- Node.js 22+
- npm

Install dependencies:

```bash
npm ci
```

Start the Company Workbench with the deterministic mock runtime:

```bash
LUCUBRO_COMPANY_MOCK_RUNTIME=1 npm start
```

Open:

```text
http://127.0.0.1:3200/company
```

The mock runtime is the recommended way to inspect the product and run browser tests. It does not require Claude, Codex, API keys, or model credentials.

### Preview on your local network

The server remains loopback-only by default. To deliberately expose a mock preview to trusted devices on the same LAN:

```bash
LUCUBRO_COMPANY_MOCK_RUNTIME=1 \
LUCUBRO_COMPANY_HOST=0.0.0.0 \
LUCUBRO_COMPANY_PORT=3217 \
npm start
```

Then open `http://<your-lan-ip>:3217/company` from another device on the same network.

This is a local preview mode, not a hosted deployment. There is no authentication layer yet. Do not expose this listener directly to the public internet. Your host firewall may also need to allow the chosen TCP port.

## What Lucubro owns

Lucubro is the product source of truth for:

- Work and Assignment state;
- durable Employee identity;
- Run identity and lifecycle;
- authorization and approval history;
- Artifact evidence;
- CEO review decisions;
- append-only product events.

Runtime providers own execution-specific mechanics:

- model/provider context;
- provider session or thread IDs;
- provider-specific tool calls;
- protocol and wire details.

A provider session can be referenced by a Lucubro Run. It never becomes the Employee or Work identity.

## Permission model

`Auto` means a bounded **Delegation Envelope**, not unrestricted authority.

A coding Work may allow ordinary workspace read/write and local shell execution while keeping materially different authority separate, for example:

- network access or package installation;
- git push and remote mutation;
- destructive filesystem operations;
- permission expansion;
- other external side effects.

Out-of-envelope actions become `Needs You` instead of silently escalating execution authority.

## Runtime status

Provider integrations exist behind runtime adapters:

- Claude Code adapter
- Codex App Server adapter
- deterministic mock adapter

Real Claude/Codex execution is currently **paused as a product priority** while the Work Core and UI/UX are being completed. Real-provider smoke tests are not a release gate and the UI must not imply that a provider is ready merely because a binary is installed.

The current product and browser-test path uses the deterministic mock runtime.

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
  └── runtime/
      ├── claude-agent-sdk.js
      ├── codex-app-server.js
      └── mock.js

public/
  ├── company.html             conversation-first shell
  ├── company.js               current Work interaction
  ├── company-durable.js       reload-safe Work Context
  ├── company-v3.js            Working set + state motion
  ├── company-v3.css           Klein-blue product system
  └── company-durable.css      durable Work surface

docs/company-workbench/
  ├── SPEC.md                  V1 product contract
  └── DESIGN-SYSTEM.md         visual + interaction system
```

## Quality gates

Run the static and Node gates:

```bash
npm run check
npm test
```

Run Chromium product journeys:

```bash
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
- keyboard and focus behavior;
- mobile viewport containment;
- reduced motion;
- Klein-blue design tokens and adaptive composer behavior.

## Product principles

- Conversation first, not chat-only.
- Hide detail, not durable structure.
- Employee is durable identity; Assignment / Work is dispatch; Run is one execution attempt.
- Live state may advance; authorization advances only across explicitly accepted material deltas.
- Auto delegates within an envelope; it does not erase the envelope.
- UI may compress decisions, but authorization remains Work-granular.
- Motion communicates hierarchy, state, causality, continuity, or focus. It is not decoration.
- A visible product state needs an actionable path. Lucubro should not show dead-end counts or decorative status.

## Current limits

Lucubro is under active development. Important unfinished areas include:

- Primary Manager clarification, planning, and Work Proposal behavior is still minimal;
- durable Work Context currently restores the active/latest Run rather than a complete multi-Run history browser;
- Rework records the state transition but does not yet create the next Run automatically;
- approval waits are still in-memory and are not restart-recoverable;
- cancellation and full Run recovery are not complete;
- multi-Employee collaboration, Playbooks, Required Gates, and Routing Decision Records are not yet full product surfaces;
- there is no hosted account, authentication, billing, cloud queue, or production deployment model;
- real Claude/Codex smoke tests are intentionally not the current development focus.

## Active vs. frozen code

**Active product:** Company Workbench

- `company-server.js`
- `lib/company/`
- `public/company*`
- `docs/company-workbench/`
- Company Workbench tests

**Frozen legacy:** the previous AI learning workspace remains in the repository for implementation history and regression protection. It should not receive new feature work unless needed for safe migration, security, or repository integrity.

## Product documents

- [`docs/company-workbench/SPEC.md`](docs/company-workbench/SPEC.md) - V1 product contract
- [`docs/company-workbench/DESIGN-SYSTEM.md`](docs/company-workbench/DESIGN-SYSTEM.md) - visual and interaction system
- [`AGENTS.md`](AGENTS.md) - repository and agent contribution rules
- [`CONTRIBUTING.md`](CONTRIBUTING.md) - contribution and verification requirements
- [`SECURITY.md`](SECURITY.md) - security policy

## License

Code is available under the [ISC License](LICENSE). Third-party work is listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
