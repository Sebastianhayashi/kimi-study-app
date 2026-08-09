# Runtime Policy

This document records operator-approved runtime constraints for the active Lucubro development environment. It is a policy boundary, not proof that real-provider execution is currently enabled in the product.

## Trusted NixOS self-hosted runner

The trusted GitHub Actions self-hosted NixOS machine has Codex installed and authenticated.

Approved Codex execution contract:

- provider: **OpenAI Codex**
- model id: **`gpt-5.6-luna`**
- reasoning effort: **`max`**
- collaboration mode: **`default`**
- Fast mode: **disabled**
- provider permission profile: **full access**
- provider model fallback: **disabled**

`max` is a reasoning-effort setting. It is not part of the provider model name and must not be encoded as a synthetic model/profile label such as `Luna Max`.

The provider catalog display name, currently observed as `GPT-5.6-Luna`, is diagnostic metadata only. Lucubro admission binds model identity to the exact provider model id `gpt-5.6-luna`, not to display text.

When real Codex execution is explicitly resumed, every Lucubro development Run/subrun on this Worker must satisfy the exact contract above unless the operator changes this policy.

Lucubro must not silently fall back to another model, reduce reasoning effort below `max`, change collaboration mode, enable Fast, or alter the required provider permission profile while claiming to satisfy this contract. Unknown or mismatched required state is blocked, not substituted.

`full access` describes the approved Codex/provider permission profile. It does **not** erase Lucubro's product-level Delegation Envelope. The adapter/execution boundary must preserve Lucubro authority semantics such as `Needs You` for actions outside the current Work envelope. Provider freedom and product authorization are separate layers; both requirements must hold at the same time.

## Machine evidence

Admission must be based on machine-readable evidence, not model prose. The trusted-host path must establish at least:

- exact model id `gpt-5.6-luna` from provider catalog/thread state;
- provider catalog capability for reasoning effort `max`;
- Lucubro runtime enforcement that every admitted `turn/start` requests `reasoningEffort: "max"`;
- default collaboration mode;
- non-Fast/default service-tier execution state;
- active full-access provider permission profile;
- provider fallback disabled;
- fresh ephemeral provider thread semantics;
- concrete Lucubro-owned authority boundary and its side-effect probes;
- exact approved Skill-bundle commits/root digests when Skill execution is involved.

A provider display label is never sufficient evidence of model identity.

## Current product gate

Real Codex exposure is fail-closed. Installation/authentication readiness or `LUCUBRO_ENABLE_REAL_RUNTIMES=1` alone does not authorize a Run.

The default Company server may expose the real Codex adapter only when all of the following are present for the exact deployed Lucubro commit:

1. explicit real-runtime exposure is requested;
2. a verified admission receipt satisfies the execution contract above;
3. a concrete Lucubro-owned systemd authority boundary is configured;
4. the runtime registry re-verifies the admitted execution fields before exposing Codex.

Other real providers remain blocked. The deterministic mock runtime remains available for product tests that do not require a real provider.

Injected runtime registries used by tests or explicit embeddings remain the caller's responsibility and are not silently wrapped by the default server policy.

## Product boundary

Provider/model configuration is execution infrastructure. Durable Work, Employee responsibility, Worker identity, Run identity, Evidence, authorization, and CEO review state remain Lucubro-owned product truth.
