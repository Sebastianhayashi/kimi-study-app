# Canvas Teaching Packet Contract

Return semantic content only. JSON is preferred when the host requests machine-readable output; otherwise preserve these fields exactly in structured Markdown.

## Required fields

- `title`.
- `learner_outcome`: one concrete thing the user should understand, decide, or be able to do.
- `audience_state`: beginner/intermediate/advanced or a more precise truthful description.
- `research_gaps[]`: missing evidence that blocks or qualifies teaching.
- `blocks[]`, each with:
  - `id`: stable local block id.
  - `type`: use the smallest fitting semantic type such as `hero`, `explanation`, `comparison`, `spectrum`, `sequence`, `annotated_media`, `decision_tree`, `worked_example`, `checklist`, `retrieval_check`, `callout`, or `source_panel`.
  - `purpose`: why this block exists in the learning sequence.
  - `content`: concise structured content, not renderer code.
  - `evidence_refs[]`: required for material factual content.
  - `media_refs[]`: optional references to approved/source-backed media candidates.
  - `interaction`: optional semantic interaction description with static fallback.
- `completion_signal`: what would show the learner achieved the stated outcome.
- `deeper_next_step`: optional next learning action, kept outside the main flow.

## Rendering rules

- Never include HTML, JSX, CSS, animation code, or PDF layout instructions as canonical content.
- Keep interaction semantic, for example `compare_on_select` or `choose_then_feedback`, so Lucubro renderers own implementation.
- Every interactive block must state a meaningful static fallback for Markdown/PDF export.
- Use a `source_panel` or contextual evidence affordance rather than scattering raw URLs through every paragraph.
