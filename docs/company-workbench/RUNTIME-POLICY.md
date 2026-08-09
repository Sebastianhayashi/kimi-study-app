# Runtime Policy

This document records operator-approved runtime constraints for the active Lucubro development environment. It is a policy boundary, not proof that real-provider execution is currently enabled in the product.

## Trusted NixOS self-hosted runner

The trusted GitHub Actions self-hosted NixOS machine currently has Codex installed and authenticated.

Approved Codex execution profile:

- model/profile: **Luna Max**
- mode: **default**
- fast mode: **disabled**
- permissions: **full access**

When real Codex execution is explicitly resumed, Lucubro development and smoke tests on this Worker must use this approved profile unless the operator changes the policy.

Lucubro must not silently fall back to another model/profile, enable fast mode, or reduce/expand this permission profile while claiming to be using the approved configuration. A mismatch should be treated as unavailable or blocked, not as an automatic substitution.

`full access` describes the approved Codex/provider host-access profile. It does **not** erase Lucubro's product-level Delegation Envelope. When real Codex resumes, the adapter/execution boundary must still preserve Lucubro authority semantics such as `Needs You` for actions outside the current Work envelope. Provider freedom and product authorization are separate layers; both requirements must hold at the same time.

## Current product gate

Real Claude/Codex execution remains paused as a product-development priority while the Company Canvas, Worker, Evidence, authorization, and routing boundaries are stabilized. Installation/authentication readiness does not by itself authorize a real Run.

Default `company-server.js` runtime registration therefore wraps real provider adapters in a paused policy. They remain visible as unavailable execution options even if the host binary and credentials are ready. The deterministic mock runtime remains the default path for UI and Evidence development.

`LUCUBRO_ENABLE_REAL_RUNTIMES=1` is the explicit server-level escape hatch. **Keep it unset until the approved Codex profile above is enforced and verified by the adapter/smoke-test path.** The environment flag is authorization to expose real adapters; it is not itself model/mode/permission enforcement.

Injected runtime registries used by tests or explicit embeddings remain the caller's responsibility and are not silently wrapped by the default server policy.

## Product boundary

Provider/model configuration is execution infrastructure. Durable Work, Employee responsibility, Worker identity, Run identity, Evidence, authorization, and CEO review state remain Lucubro-owned product truth.
