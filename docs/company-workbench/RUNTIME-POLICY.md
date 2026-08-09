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

## Current product gate

Real Claude/Codex execution remains paused as a product-development priority while the Company Canvas, Worker, Evidence, authorization, and routing boundaries are stabilized. Installation/authentication readiness does not by itself authorize a real Run.

The deterministic mock runtime remains the default path for UI and Evidence development until real-provider execution is explicitly resumed.

## Product boundary

Provider/model configuration is execution infrastructure. Durable Work, Employee responsibility, Worker identity, Run identity, Evidence, authorization, and CEO review state remain Lucubro-owned product truth.
