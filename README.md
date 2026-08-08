<div align="center">
  <img src="public/assets/brand/lucubro-mark.svg" width="68" height="68" alt="Lucubro">

# Lucubro

**A local-first AI company workbench for a single CEO.**

Give one Primary Manager a goal. Lucubro turns it into durable Work, assigns named AI Employees, runs coding agents inside bounded execution environments, and brings back only the decisions and evidence that need you.

[![CI](https://github.com/Sebastianhayashi/lucubro/actions/workflows/ci.yml/badge.svg)](https://github.com/Sebastianhayashi/lucubro/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/Node.js-22%2B-339933?logo=nodedotjs&logoColor=white)](package.json)
[![License](https://img.shields.io/badge/license-ISC-blue)](LICENSE)

</div>

## Product thesis

Lucubro is not a multi-agent terminal dashboard and not a wrapper around one model session.

The product model is:

```text
CEO
 ↓
Alex · Primary Manager
 ↓
Durable Work
 ↓
Named AI Employees
 ↓
Lucubro Run
 ↓
Claude Code / Codex / future runtimes
 ↓
Evidence, decisions, artifacts
```

The interaction model is deliberately quiet:

> **Conversation first. Structure when needed.**

The Manager conversation is the primary surface. Work, Runs, Artifacts, approvals, activity and audit history remain durable structured objects, but they only expand when the current decision needs them.

## What Lucubro owns

Lucubro owns the business-level truth:

- Work and Assignment state;
- durable Employee identity;
- Run identity and lifecycle;
- authorization and approval history;
- Artifacts and review decisions;
- audit/event history.

Agent providers own execution details:

- provider context and agent loops;
- provider session/thread mechanics;
- provider-specific tool calls and wire formats.

A Claude session or Codex thread can be attached to a Lucubro Run. It never becomes the Work ID or Employee identity.

## First vertical slice

The current product branch proves one real coding journey:

```text
CEO request
  → durable Work
  → Ben · Software Engineer
  → isolated git worktree
  → Claude Code or Codex runtime
  → normalized product events
  → Delegation Envelope
      ↳ in-envelope: continue automatically
      ↳ outside envelope: Needs You
  → diff / Artifact
  → Ready for review
  → Accept or Rework
```

This is the foundation for the broader Manager flow: intent clarification, Quick Task vs Project, Work Proposal, Next Wave, multi-Employee delegation, Playbooks and Required Gates.

## Run the Company Workbench

Install the repository dependencies:

```bash
npm ci
```

Start the Company Workbench with the deterministic mock runtime:

```bash
LUCUBRO_COMPANY_MOCK_RUNTIME=1 node company-server.js
```

Open:

```text
http://127.0.0.1:3200/company
```

The mock runtime is for product and browser testing. It does not require model credentials.

### Real agent runtimes

Lucubro keeps provider integrations behind runtime adapters.

- **Codex** targets `codex app-server` over its bidirectional stdio protocol.
- **Claude Code** targets the Claude Agent SDK behind a dynamic adapter.
- **BYO/local credentials** are the V1 model. Lucubro does not aggregate provider billing or own your model account.

Real-provider execution is still an explicit validation target. The UI and Work Core must not pretend a provider is available when its local runtime is not installed and authenticated.

## Permission model

`Auto` is not unrestricted shell access.

Lucubro compiles a scoped **Delegation Envelope** into provider execution permissions. The default coding envelope may allow ordinary workspace read/write and local shell execution while keeping materially different authority separate.

Examples that remain separately controlled include:

- network access and package installation;
- git push or other remote mutation;
- destructive filesystem operations;
- permission expansion and other external side effects.

Out-of-envelope actions pause at the decision boundary and appear as `Needs You` instead of silently escalating the agent.

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

public/company.*                conversation-first product surface

docs/company-workbench/SPEC.md executable V1 product contract
```

The current implementation intentionally lives beside the previous application while the pivot is stabilized. New product work should target the Company Workbench domain rather than extending the legacy learning product.

## UI and interaction contract

UI work follows two external quality references:

1. **Checklist Design**: every UI/UX change should be reviewed against the Design System checklist and the relevant component, flow and responsiveness checklists before it is considered complete.
2. **GSAP Skills**: animation and motion work should use the official GreenSock AI skills and GSAP patterns, including cleanup, performance and reduced-motion behavior.

The repository-level agent rules live in [`AGENTS.md`](AGENTS.md).

Product principles still take precedence over visual novelty:

- Conversation first, not chat-only.
- Hide detail, not durable structure.
- Professional Decision Compression over dashboard noise.
- Motion must communicate state, hierarchy or causality. It is not decoration.
- Accessibility, keyboard behavior, reduced motion, loading, error and terminal states are release requirements.

## Quality gates

The legacy repository already has a strong regression suite. The Company Workbench adds its own product-seam tests while keeping those gates green during the pivot.

```bash
npm run check
npm test
npx playwright test
```

New Company Workbench tests cover Work/Run identity, durable state, Delegation Envelope behavior, provider event normalization, approvals, browser interaction and review decisions.

## Product status

Lucubro Company Workbench is under active development.

**Active maintenance:** Company Workbench (`company-server.js`, `lib/company/`, `public/company.*`, `docs/company-workbench/`).

**Frozen legacy:** the previous AI learning workspace remains in the repository as historical code and regression coverage, but it is no longer the product direction and should not receive new feature work unless required for safe migration or repository integrity.

Current limits:

- real Claude/Codex smoke tests are not yet a release gate;
- Manager planning/decomposition is still minimal;
- multi-Employee collaboration and full Playbook/Gate UX are not yet implemented;
- no hosted accounts, billing, cloud queue or production deployment model yet;
- UI is a functional product shell, not final product-quality design.

## Design and product documents

- [`docs/company-workbench/SPEC.md`](docs/company-workbench/SPEC.md) — executable V1 product contract
- [`AGENTS.md`](AGENTS.md) — repository and UI-agent rules
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — repository contribution and verification requirements
- [`SECURITY.md`](SECURITY.md) — security policy

## Legacy learning workspace

The repository previously explored an AI-native learning workspace built around uploaded material, generated lessons and Kimi. That work is intentionally frozen during the Company Workbench pivot. Existing code and tests stay available as implementation history and regression protection, but the root README and `main` branch now describe the Company Workbench as Lucubro's primary product.

## License

Code is available under the [ISC License](LICENSE). Third-party work is listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
