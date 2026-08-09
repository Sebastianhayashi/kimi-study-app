# Codex Luna Admission Notes

Status: implementation research note
Date: 2026-08-10
Purpose: support ACW-T005 through ACW-T009 without weakening the real-runtime gate.

## Correct execution identity

The approved execution contract is a set of independent machine-verifiable fields:

- provider: OpenAI Codex;
- model id: `gpt-5.6-luna`;
- reasoning effort: `max`;
- collaboration mode: `default`;
- Fast: disabled;
- provider permission profile: full access;
- provider fallback: disabled.

`max` is reasoning effort. It is not part of the model name and must not be represented as a synthetic `Luna Max` model/profile identity.

The trusted NixOS Worker has already shown that the provider catalog entry uses exact id/model `gpt-5.6-luna` and display text `GPT-5.6-Luna`. Display text is diagnostic only and must never be the admission key.

## Verified protocol seams

Current Codex App Server exposes machine-readable surfaces useful to Lucubro admission and Skill attestation:

- `model/list`: available model catalog plus reasoning/speed/service-tier metadata, including supported reasoning efforts;
- `config/read`: runtime-effective configuration after config layering;
- `permissionProfile/list`: available permission profile ids and policy eligibility;
- thread start/resume/fork responses: actual selected model/provider/service tier and active permission profile when exposed;
- `skills/list`: discovered Skills for one or more working directories;
- `skills/extraRoots/set`: runtime Skill discovery/mount control surface.

Lucubro consumes these protocol values as evidence. Model prose is not attestation.

## Model and reasoning evidence

Model identity and reasoning effort require separate proof:

1. `model/list` must uniquely contain the exact provider model id `gpt-5.6-luna`.
2. That catalog entry must advertise support for reasoning effort `max`.
3. The real no-fallback thread must actually report model `gpt-5.6-luna` from provider `openai`.
4. Lucubro's admitted runtime path must mechanically force every real `turn/start` to use `collaborationMode.mode = "default"` and `settings.reasoningEffort = "max"`.

The provider display label may change without changing model identity. A display-label mismatch must not block an otherwise exact id match, while an exact-id mismatch must always block.

## Fast mode

Fast/speed state is configuration/execution state, not reasoning effort. Catalog support for a `fast` speed tier does not mean Fast is enabled.

Admission requires the actual execution path to use the default/non-Fast service tier. Lucubro must not infer this from latency, model output, or the catalog's default recommendation.

## Full access versus Delegation Envelope

The approved provider permission profile is full access, but provider permission and product authority are distinct layers.

Lucubro therefore places the provider process inside a Lucubro-owned systemd authority boundary compiled from the Work Delegation Envelope. Provider full access only applies inside that product-owned boundary. Workspace escape, disallowed network access, destructive host mutation, and protected Git push are separately probed on the trusted Worker.

## Admission rule

Real Codex is available only when all are true for the exact deployed Lucubro commit:

1. explicit real-runtime exposure is enabled;
2. exact model id `gpt-5.6-luna` is proven;
3. the model catalog proves `max` reasoning effort is supported;
4. the Lucubro runtime contract proves admitted turns request reasoning effort `max`;
5. default collaboration mode is enforced;
6. Fast is proven disabled for the actual thread/turn path;
7. provider full-access state is proven and allowed;
8. provider fallback is disabled and the provider thread is ephemeral;
9. Lucubro product-level authority enforcement is concrete and side-effect probes pass;
10. required Skill bundles/mounts are tied to exact source/digest receipts when Skills are used;
11. the Run/subrun uses the same admitted contract.

Unknown means blocked. There is no fallback to another model, weaker reasoning effort, alternate collaboration mode, Fast tier, or provider.
