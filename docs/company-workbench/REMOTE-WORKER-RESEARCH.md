# Remote Worker and outcome-first execution research

Status: product research feeding `PRODUCT-THESIS.md` and issue #19

Date: 2026-08-09

## Research question

How should Lucubro support a user who controls their company from an iPhone, iPad, Mac, or browser while one or more self-hosted machines do the actual work, without forcing the user to operate provider CLIs, pick models for every task, or stare at raw terminal output?

The target experience is closer to managing a real digital employee:

- the user asks for an outcome;
- Lucubro chooses an execution path based on capability, quality, cost, latency, privacy, risk, and availability;
- a trusted Worker performs the work;
- the user can observe substantiated progress and evidence remotely;
- browser work can be watched live, recorded, or temporarily taken over by the user;
- provider CLI and terminal mechanics remain available as expert escape hatches but are not the normal workflow;
- company knowledge and durable Work survive any particular agent session, model, or Worker.

## Primary-source findings

### 1. A stable frontend can control agents across local and remote execution backends

OpenHands Agent Canvas describes itself as a self-hosted control center that can run OpenHands, Claude Code, Codex, Gemini, or ACP-compatible agents across local, remote, and cloud backends. It can connect the same frontend to multiple Agent Server instances and switch execution backends without changing the user-facing workspace.

Sources:

- https://www.openhands.dev/product/canvas
- https://github.com/OpenHands/OpenHands/blob/main/README.md
- https://github.com/OpenHands/OpenHands/blob/main/docs/architecture.md

OpenHands' Remote Agent Server documentation separates three responsibilities: client, agent server, and isolated workspace. The server handles agent execution, file/command operations, and real-time event streaming over HTTP/WebSocket while the client API remains stable across local and remote workspaces.

Source:

- https://docs.openhands.dev/sdk/guides/agent-server/overview

**Implication for Lucubro:** the Company Canvas and Worker should be logically separate even when both processes are deployed on the same self-hosted machine. The all-in-one install can collapse them operationally, but the product/domain boundary should remain explicit.

### 2. Remote Workers do not inherently require opening an inbound public port

GitHub's self-hosted runner architecture has the runner connect outward to GitHub to receive job assignments. The runner must be able to make outbound HTTPS connections on port 443. GitHub also recommends ephemeral runners for autoscaling because a clean one-job environment reduces exposure of sensitive resources from previous jobs and limits the effect of a compromised runner.

Source:

- https://docs.github.com/en/actions/reference/runners/self-hosted-runners

**Implication for Lucubro:** the preferred future remote topology should be Worker-initiated outbound transport to a Lucubro control plane/relay, rather than requiring the user to expose the Worker directly to the public internet. A persistent Worker identity can own many ephemeral or isolated Run environments.

### 3. Direct private access is still useful for fully self-hosted deployments

Tailscale Serve can privately expose a service running on a device to other authorized devices in the same tailnet, with HTTPS and normal tailnet access-control rules. Tailscale recommends binding the underlying service to localhost when relying on Serve identity headers.

Source:

- https://tailscale.com/docs/features/tailscale-serve

**Implication for Lucubro:** direct private networking can be an optional deployment path for users who want the control surface and Worker to remain entirely self-hosted. It should be a transport option, not a requirement of the Lucubro product model.

### 4. Provider CLIs increasingly expose protocols intended for richer clients

OpenAI's `codex app-server` is explicitly documented as the interface used to power rich clients such as the Codex VS Code extension. It exposes thread/turn/item primitives, streaming notifications, approvals, skills, auth endpoints, and JSON-RPC transport. Its network WebSocket transport is currently marked experimental/unsupported, while stdio is the default transport.

Source:

- https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md

**Implication for Lucubro:** provider-native app servers/CLIs should live behind a Worker adapter. Lucubro should normalize provider events into its own Run/Work event vocabulary. Mobile clients should never depend directly on a provider's unstable wire protocol.

### 5. Real-time browser observation and human takeover are established interaction patterns

Browserbase Session Live View provides an interactive browser window that can watch, click, type, and scroll in a running browser session. Its documented uses include debugging/observability, human-in-the-loop intervention, and embedding in desktop or mobile applications. Browserbase also records sessions for later replay.

Sources:

- https://docs.browserbase.com/platform/browser/observability/session-live-view
- https://docs.browserbase.com/platform/browser/observability/observability

Chrome DevTools Protocol exposes `Page.startScreencast`, which emits compressed frame data through `screencastFrame`; this API is experimental. The protocol also exposes screenshot capture. Because the screencast API is experimental, it is appropriate as an implementation adapter, not as Lucubro's stable product contract.

Source:

- https://chromedevtools.github.io/devtools-protocol/tot/Page/

Playwright can record videos and traces. Playwright traces can include DOM snapshots, screenshots, network activity, console messages, and timing. Video artifacts become available after the browser context closes.

Sources:

- https://playwright.dev/docs/videos
- https://playwright.dev/docs/trace-viewer
- https://playwright.dev/mcp/tools/tracing

**Implication for Lucubro:** browser execution should expose multiple evidence levels rather than one giant raw stream: compact status, milestone screenshots, live view on demand, and replay/trace artifacts after execution.

### 6. Model routing can optimize capability/cost without making model choice the user's job

OpenHands' SDK documents an LLM routing layer that can select different models according to request characteristics and report accumulated cost. The router is extensible through a common interface.

Sources:

- https://docs.openhands.dev/sdk/guides/llm-routing
- https://docs.openhands.dev/sdk/api-reference/openhands.sdk.llm

RouteLLM demonstrates a strong/weak model router with an explicit cost/quality threshold. Its design goal is to send simpler requests to cheaper models while preserving quality for requests that need a stronger model.

Source:

- https://github.com/lm-sys/RouteLLM

LiteLLM's router model supports routing groups, fallbacks, retry policies, usage-based routing, latency-based routing, and deployment budgets.

Source:

- https://github.com/BerriAI/litellm/blob/litellm_internal_staging/litellm/types/router.py

**Implication for Lucubro:** model routing should be below a broader Capability Router. The cheapest valid execution plan may use a deterministic tool/playbook and no LLM at all. When an LLM is required, model/provider choice is another routing decision constrained by capability, expected quality, latency, price, privacy, authority, and current availability.

## Proposed Lucubro product model

### Control Surface

The Lucubro UI is a responsive control surface usable from Mac, iPad, iPhone, and ordinary browsers. It renders durable company state and streams normalized product events. It is not the execution host.

### Worker

A **Worker** is a durable execution-host identity. It is not an Employee and not a Runtime.

A Worker advertises capabilities such as:

- OS / architecture;
- available repository roots;
- git / build / test toolchains;
- installed provider runtimes such as Claude Code or Codex;
- available local/API models;
- browser automation capability;
- optional GPU or special hardware;
- network/tool permissions;
- current health, load, and availability.

Canonical relationship:

```text
Employee owns responsibility.
Assignment dispatches Work.
Run is one execution attempt.
Worker is where the Run executes.
Runtime/Model/Playbook is how that Run executes.
```

### Collapsible deployment topology

Lucubro should support two deployment shapes without changing the domain model.

**All-in-one self-hosted**

```text
Phone / iPad / Mac
        |
        v
Lucubro service + Worker on one trusted machine
        |
        +-- Work / Project / Knowledge
        +-- provider runtimes
        +-- browser / git / tools
```

**Split control + Worker**

```text
Phone / iPad / Mac
        |
        v
Lucubro Control Plane / Relay
        ^
        | outbound authenticated channel
        |
Self-hosted Worker(s)
        |
        +-- Run sandbox/worktree
        +-- Claude Code / Codex / local model / tools
        +-- browser
```

The preferred remote transport is Worker-initiated outbound TLS/WebSocket or equivalent long-lived secure transport. Direct LAN/Tailscale/private-network access is an optional self-hosted path.

### Credential rule

Provider credentials belong with the trusted execution environment that uses them. The normal mobile/client experience should see connection health and capability, not raw secrets.

Initial setup may pair accounts/providers once. Subsequent Work should route through saved connections automatically. Re-authentication only surfaces when it materially blocks Work.

The control plane should avoid possessing Worker-local provider credentials when a capability token/reference is sufficient.

## Outcome-first capability routing

The user expresses desired outcome, constraints, and optionally a preference. They do not normally choose a provider or model.

The routing order should be:

```text
Outcome
  -> required capability / risk / authority
  -> deterministic playbook possible?
  -> Employee / approved skill or workflow
  -> eligible Worker set
  -> eligible Runtime / tool / model set
  -> quality-cost-latency-privacy decision
  -> Run
```

A simple task such as "update Codex" may be satisfied by a deterministic approved maintenance playbook with no LLM call. A small text transformation may route to a cheap/local model. A difficult coding change may route to a stronger coding agent. Browser QA may require a browser-capable Worker regardless of the language model.

The default objective is not "use the cheapest model". It is:

> **Minimize expected total cost subject to capability, expected quality, latency, privacy, risk/authority, and availability constraints.**

User overrides remain available at Work/Run level for expert control.

Every material routing choice should produce the existing Routing Decision Record rather than remaining invisible magic.

## Browser evidence and intervention contract

Lucubro should expose five browser evidence levels:

1. **State** — URL/title/current action and normalized events. Lowest bandwidth; default on mobile.
2. **Milestone screenshot** — captured automatically at useful boundaries or on request.
3. **Replay evidence** — video and/or Playwright trace attached to the Run/Artifact.
4. **Live View** — on-demand streamed frames of the current browser session.
5. **Take over** — explicit human-in-the-loop control for click/type/scroll when automation needs help.

Takeover must have a clear ownership transition:

```text
Agent controlling browser
  -> user requests Take over
  -> Lucubro pauses automated browser input
  -> user controls session
  -> user releases control / gives instruction
  -> Lucubro records receipt
  -> agent resumes from current page state
```

Do not allow simultaneous unsynchronized agent and human input.

Live View should adapt bandwidth/quality for mobile connections. A low-FPS screenshot/screencast stream is preferable to making full remote desktop the default.

## Terminal and provider mechanics

Default surfaces expose normalized actions, execution state, evidence, and meaningful logs.

Progressive disclosure:

```text
Work state
  -> Execution inspector
      -> structured public events / logs
      -> terminal tail when useful
      -> Advanced runtime
          -> interactive provider terminal / native command escape hatch
```

Provider commands such as `/compact` remain available through the advanced escape hatch, while Lucubro should expose stable product-level equivalents where possible, such as **Compact context** or **Start fresh Run**.

## Company Knowledge

Knowledge must not be reduced to a provider session's memory.

Lucubro should own a durable **Company Knowledge** layer with provenance and scope. Candidate inputs include:

- Project documents and plans;
- accepted decisions and decision receipts;
- reusable research;
- accepted Artifacts and implementation notes;
- Employee role/capability guidance;
- Skills / playbooks;
- distilled Run learnings that are explicitly promoted to durable knowledge.

The user should be able to open a Knowledge lens and inspect what the company currently knows, where each item came from, and which Work/Project uses it. Alex and Employees can attach relevant Knowledge to current Work automatically, but attachment and provenance remain visible.

Provider-native memory may accelerate a Run, but it is not canonical company knowledge.

## Security posture

Remote digital employees have machine-level consequences. The product must treat remote execution as privileged infrastructure.

Required direction:

- explicit device/Worker pairing and revocation;
- authenticated encrypted transport;
- Worker-initiated outbound connection by default for split deployments;
- scoped workspace roots and capability advertisement;
- one isolated worktree/sandbox per active coding Run;
- ephemeral Run environments where practical, while Worker identity remains durable;
- Delegation Envelope enforced at Lucubro boundary;
- host-wide mutations, credential changes, package-manager changes, or network expansion may require a stronger authority envelope than repo-local edits;
- evidence/logs survive Run environment cleanup;
- no raw chain-of-thought in remote streams.

## Product consequences

The Company Canvas must eventually make this topology legible without turning into an infrastructure dashboard.

A Work object should be able to show, contextually:

```text
Work
  Employee: Ben
  Worker: studio-nixos
  Execution: testing latest code
  Browser: Live / screenshot available
  Evidence: 4 screenshots · trace · diff
  Cost: $0.18
  Route: Auto · selected cheap coding runtime
  Needs you: none
```

The user can expand Worker, Runtime, Browser, Usage, Knowledge, or Terminal only when needed.

The primary visual question remains the outcome and the Work, not the model name.

## Recommended implementation sequence

1. **Company Operating Map v1** — current Work, Employee ownership, Run/evidence/decision become visible on the canvas using existing deterministic mock data.
2. **Worker domain** — add durable Worker identity/capabilities/health and attach each Run to a Worker. The current NixOS machine becomes the first real Worker.
3. **Evidence pipeline** — normalize screenshots, Playwright trace/video, diff, test report, and logs as Run-owned evidence/artifacts.
4. **Browser observe mode** — on-demand live browser view, initially read-only, backed by an adapter such as CDP screencast or another browser-session implementation.
5. **Human takeover** — explicit pause/takeover/release contract with audit receipts.
6. **Remote transport** — authenticated Worker-initiated connection for off-LAN access; keep private-network/Tailscale deployment as an optional route.
7. **Capability Router** — deterministic playbook vs agent vs model selection, then quality/cost/latency/privacy routing within eligible choices.
8. **Company Knowledge** — define canonical Knowledge object/provenance and build contextual/global lens.
9. **Provider escape hatches** — Execution Inspector and scoped advanced terminal, including provider-native controls such as compaction.
10. **Real-agent resume** — only after Worker, canvas projection, authorization, evidence, and routing boundaries are stable.

## Research conclusion

Lucubro should not compete by exposing more AI settings. It should compete by making heterogeneous execution infrastructure behave like a coherent digital company.

> **The user chooses outcomes. Lucubro chooses and supervises execution. Workers do the work. Evidence returns to durable company state. Provider and model details remain available for intervention, but they are not the normal unit of thought.**
