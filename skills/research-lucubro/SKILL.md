---
name: research-lucubro
description: Research a user or Work question for Lucubro using high-trust, source-backed investigation and return an Evidence-ready Research Packet rather than a standalone report. Use when a Lucubro task contains material external factual claims, comparisons, recommendations, current information, media sourcing, or uncertainty that should be resolved before synthesis or teaching. Prefer primary/authoritative sources, preserve provenance at claim level, identify uncertainty, and never treat model memory as evidence.
---

# Research Lucubro

## Purpose

Produce trustworthy research state for a Lucubro Work. Return source-backed claims and evidence candidates that another skill, the Manager, or the Canvas Artifact composer can safely synthesize.

Do not own the final UI, lesson, report layout, Project decision, or staffing decision.

## Workflow

1. Read the research objective, audience/use case, existing Evidence, authority/tool limits, and requested deliverable constraints.
2. Decide which claims actually require external verification. Reuse current durable Evidence when it already answers a claim.
3. Investigate authoritative sources first. Prefer primary sources, official standards, first-party documentation, original datasets, research papers, or the source that owns the fact.
4. For recommendations or contested topics, gather enough independent evidence to distinguish source facts from synthesis and judgment.
5. Capture claim-level provenance while researching. Never postpone citation reconstruction until the end.
6. Capture media candidates only when they materially improve explanation. Record source page and reuse/embedding status when known; mark unknown rights explicitly.
7. Reconcile conflicting sources. State the conflict and the reason for any preferred interpretation.
8. Return a bounded Research Packet using the contract in `references/research-packet.md`.

## Evidence rules

- Treat URLs, document ids, repository paths, dataset ids, publication metadata, and captured Lucubro Evidence ids as provenance, not decoration.
- Never invent a source, quote, statistic, image license, publication date, or consensus.
- Separate `source_fact` from `synthesis` and `recommendation`.
- Mark volatile/current facts with the observation date.
- If a claim cannot be verified within the available tools or authority, return it as unresolved instead of filling the gap from model memory.
- Do not persist raw chain-of-thought. Public notes may explain source choice or uncertainty without exposing private reasoning.

## Lucubro boundaries

- Do not create a Project or Issue. Return research to the owning Work/Manager.
- Do not create durable Employees. A research specialist role is an execution role only.
- Do not write a repository Markdown report unless the owning Work explicitly requests one as a deliverable. The default result is a Research Packet/Evidence contribution.
- Do not turn evidence into a final teaching narrative. Hand source-backed findings to the next synthesis step.
- Do not widen the Delegation Envelope. If a required source/tool is outside authority, surface the blocked capability.

## Completion gate

Before returning, confirm that:

- every material factual finding has inspectable provenance;
- unresolved claims are labeled;
- source facts are distinguishable from synthesis/recommendations;
- media candidates include provenance and rights/embedding status when known;
- the packet is small enough for downstream synthesis and does not dump entire source documents.

Read `references/research-packet.md` when constructing the final packet.
