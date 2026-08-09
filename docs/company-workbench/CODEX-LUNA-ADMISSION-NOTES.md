# Codex Luna Admission Notes

Status: implementation research note
Date: 2026-08-09
Purpose: support ACW-T005 through ACW-T009 without weakening the real-runtime gate.

## Verified protocol seams

Current Codex App Server exposes machine-readable surfaces useful to Lucubro admission and Skill attestation:

- `model/list`: available model catalog plus reasoning/speed/service-tier metadata;
- `config/read`: runtime-effective configuration after config layering;
- `permissionProfile/list`: available permission profile ids and policy eligibility;
- thread start/resume/fork responses: active permission profile/provenance when known in experimental clients;
- `skills/list`: discovered skills for one or more working directories;
- `skills/extraRoots/set` and selected capability/skill roots: runtime skill discovery/mount control surfaces.

Lucubro should consume these protocol values as evidence. Model prose is not attestation.

## Luna Max identity

`Luna Max` is the operator-approved Lucubro policy label. Product code must not guess which provider model id it maps to.

The trusted Worker must produce a machine-readable receipt for the exact installed Codex/App Server version and model id before real execution can be admitted.

## Fast mode

Fast/speed state is configuration/execution state, not something Lucubro should infer from latency or model output. Admission must fail closed if the installed Codex version cannot prove the effective non-Fast state for the execution attempt.

## Full access versus Delegation Envelope

There is a current implementation gap that blocks real execution:

- the operator-approved provider profile requires full access;
- the existing Lucubro Codex adapter currently relies on Codex sandbox policy derived from the Delegation Envelope to restrict workspace/network behavior;
- therefore provider full access and product-level authority are not yet independently enforced.

Real Codex must remain blocked until ACW-T008/T009 prove that Lucubro can enforce out-of-envelope actions under provider full access without relying solely on Codex sandbox restrictions.

## Admission rule

Real Codex is available only when all are true:

1. explicit real-runtime exposure is enabled;
2. exact Luna model identity is proven for the trusted runtime;
3. default-mode state is proven/controlled;
4. Fast is proven disabled;
5. provider full-access state is proven;
6. Lucubro product-level authority enforcement remains effective under that provider profile;
7. the Run/subrun uses the same admitted contract.

Unknown means blocked. There is no fallback to another model, mode, speed tier, or provider.
