# Frontend redesign baseline

Branch: `codex/frontend-optimization`

Base commit: `3ae3bd4`

## Design read

Lucubro is an existing Chinese-first learning product for self-directed learners.
The redesign preserves its information architecture and state contracts while
moving the visual language toward calm, trustworthy, content-first product UI.

Page dials:

- Landing: variance 7, motion 4, density 3
- Course onboarding: variance 5, motion 4, density 4
- Library and course workspace: variance 5, motion 3, density 6

## Preserved contracts

- Routes: `/`, `/app`, `/new-course`, `/course/:id`
- Course generation, assessment, Tutor, notes, and study-surface APIs
- Existing DOM IDs, state classes, `data-*` hooks, and ARIA behavior used by tests
- Left context, center lesson, and right Tutor ownership
- One workflow-primary progress surface during generation
- Mobile overlay drawer and focus-return behavior

## Visual baseline

- [Landing](images/landing.jpg)
- [Library](images/library.jpg)
- [Course workspace](images/course.jpg)
- [Mobile lesson](images/mobile.png)
- [Failed generation](images/after.png)

## Audit findings

1. Color, radius, shadow, and typography tokens are repeated across four large
   HTML files and several appended override stylesheets.
2. The landing page uses a centered oversized hero, three equal process cards,
   repeated section labels, and Base64-embedded product pages.
3. The library has multiple historical visual layers, including a dark theme
   overwritten by a light theme and a later bookshelf treatment.
4. Onboarding uses decorative orbit, card, node, and scan scenes that are less
   informative than the real generation state.
5. The course workspace has strong product structure but excessive nested
   surfaces, very small UI copy, and competing chrome around the lesson.
6. Mobile preserves the correct drawers but the header and lesson title consume
   too much of the initial reading viewport.
7. Loading, ready, failed, and empty behavior is functionally strong but lacks a
   shared visual state language.

## Test baseline

- `npm run check`: pass
- `npm test`: 137 passed
- `npm run test:e2e:ci`: 55 passed
