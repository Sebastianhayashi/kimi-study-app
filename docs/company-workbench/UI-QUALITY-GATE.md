# Company Workbench UI quality gate

This file is intentionally short. The repository-wide requirements remain in `AGENTS.md`.

For every material `/company` UI change, review the surface against:

- Checklist Design: Design System plus the relevant component, flow, and responsiveness checklists.
- GreenSock `gsap-skills`: use GSAP only where motion communicates state, hierarchy, causality, continuity, or focus.

Release evidence must cover desktop and mobile, keyboard focus, reduced motion, loading, empty, success, error, disabled, and Needs You states.

Current design direction:

- conversation first, not chat-only;
- quiet CEO workspace rather than agent dashboard;
- Alex relationship first, structured Work inline when needed;
- advanced runtime details stay behind progressive disclosure;
- one restrained accent plus semantic warning/error colors;
- no permanent left rail;
- no decorative AI gradients, fake terminal chrome, or card grids.
