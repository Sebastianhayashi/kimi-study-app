# Lucubro repository rules

## Active product

Lucubro Company Workbench is the primary product direction.

Active product code:

- `company-server.js`
- `lib/company/`
- `public/company.html`
- `public/company.css`
- `public/company.js`
- `docs/company-workbench/`
- Company Workbench tests

The previous learning-workspace product is frozen legacy. Do not add product features to it. Change legacy code only when required for repository integrity, migration, security, or regression compatibility while the Company Workbench becomes the default product.

## Product invariants

- Conversation first, not chat-only.
- Hide detail, not durable structure.
- Lucubro owns Work, Run, authorization, Artifacts, decisions, and audit history.
- Provider session/thread ids are execution references, never product identity.
- Employee is durable identity; Work is assignment; Run is an execution attempt; Runtime is an execution engine.
- Auto means a scoped Delegation Envelope, never blanket permission.
- Out-of-envelope authority becomes `Needs You`.
- Raw model reasoning is not a product event and must not be persisted or presented as operational truth.
- A provider completion moves Work to review. CEO Accept/Rework is a separate durable decision.

## UI/UX release checklist

Before considering any user-facing UI/UX change complete, review the affected surface against Checklist Design:

- Design System: https://www.checklist.design/design-system
- the relevant component checklist(s);
- the relevant flow checklist(s);
- responsiveness/mobile behavior where applicable.

At minimum verify:

- typography hierarchy and readable measure;
- spacing rhythm and alignment;
- semantic color and contrast;
- component states: default, hover, active, focus-visible, disabled, loading, success, empty, error;
- keyboard accessibility and accessible names;
- responsive collapse behavior;
- loading and terminal-state consistency;
- reduced-motion behavior;
- no permanent UI region unless it earns persistent attention;
- no dashboard/card noise that competes with the Manager relationship;
- no provider/runtime details in the default CEO surface unless they change the current decision.

Document material checklist trade-offs in the PR when a rule is intentionally not applicable.

## Motion and GSAP

Use the official GreenSock GSAP AI skills as the implementation reference for product motion:

https://github.com/greensock/gsap-skills

Install for a local agent with:

```bash
npx skills add https://github.com/greensock/gsap-skills
```

The skills support Claude Code, Codex and other agent hosts. Prefer the relevant GSAP skill for the task (`gsap-core`, `gsap-timeline`, `gsap-scrolltrigger`, `gsap-performance`, framework-specific guidance, etc.).

Motion rules:

- Motion must communicate state, hierarchy, causality, continuity, or focus. Do not animate merely to make the UI feel "AI".
- Prefer transforms and opacity over layout properties.
- Prefer timelines for coordinated sequences over chains of arbitrary delays.
- Clean up GSAP contexts/listeners on lifecycle teardown.
- Respect `prefers-reduced-motion` and provide a meaningful low-motion state.
- Do not add ScrollTrigger or heavy motion to ordinary application scrolling unless the interaction truly depends on scroll position.
- Product state must remain understandable when animation is disabled.

## Verification

For product changes, use the highest useful seam:

```bash
npm run check
npm test
npx playwright test
```

Company Workbench changes should add/modify tests at the Work/Run/API/browser seam rather than testing private implementation details.

Real-provider behavior should additionally be exercised on a trusted local device through the manual self-hosted runner workflow when that workflow is configured. Never let untrusted pull requests target a personal self-hosted runner.
