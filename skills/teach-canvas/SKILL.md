---
name: teach-canvas
description: Turn source-backed knowledge inside a Lucubro Work into a concise, beginner-appropriate, evidence-linked teaching experience expressed as semantic Canvas Artifact blocks, never as standalone HTML or React. Use after sufficient research/evidence exists when the user wants to understand, learn, compare, decide, practice, or remember a topic. Ground teaching in the user's mission, control cognitive load, use visual explanation and retrieval practice when useful, and preserve evidence references for material factual content.
---

# Teach Canvas

## Purpose

Transform trustworthy knowledge into a Lucubro-native learning deliverable. Produce semantic teaching blocks and progression guidance that the Canvas renderer can present interactively and export later.

Do not generate the canonical Artifact as HTML, React, PDF, or Markdown. Do not own source research.

## Workflow

1. Read the user's current mission/outcome, audience level, Research Packet/Evidence, prior related Work/learning state, and Canvas/export constraints.
2. Check evidence sufficiency. If a material teaching claim lacks support, return a research gap instead of teaching from model memory.
3. Select one concrete learning win for the current Artifact. Keep the scope smaller than the whole domain.
4. Build the shortest concept sequence that lets the learner achieve that win.
5. Prefer show-don't-tell structures where they improve comprehension: comparison, annotated media, sequence, spectrum, decision tree, or worked example.
6. Add a lightweight retrieval/practice loop only when it reinforces the learning objective. Do not turn every Artifact into a quiz.
7. Keep explanations compact enough for working memory. Move detail, caveats, and provenance behind inspectable blocks rather than flooding the default Canvas.
8. Attach evidence references to material factual blocks.
9. Return a Canvas Teaching Packet using `references/canvas-teaching-packet.md`.

## Teaching principles

- Ground the teaching in what the user wants to do, not in a generic syllabus.
- Treat fluent recognition as different from durable learning. Use retrieval or application when storage strength matters.
- Keep difficulty low for knowledge acquisition and introduce desirable difficulty for practice.
- Fit the next challenge to the learner's apparent level and prior durable learning state when available.
- Prefer one tangible win over exhaustive coverage.
- Recommend primary/high-trust resources for deeper study through evidence/source references rather than uncited prose.
- If the user's goal is a one-time decision rather than long-term learning, favor decision support over forced pedagogy.

## Lucubro boundaries

- Do not emit `lessons/*.html`, `reference/*.html`, React components, or freeform page code as canonical output.
- Do not create a Project, Issue, or Employee. Teaching is a Work capability.
- Do not alter canonical Project Sources or learning state silently. Durable semantic updates must use the owning Work's normal persistence/review path.
- Do not widen the Delegation Envelope.
- Do not copy the entire Research Packet into the Artifact. Reference Evidence and expose detail contextually.

## Completion gate

Before returning, confirm that:

- the Artifact has one explicit learning/decision outcome;
- the block sequence is understandable without a wall of text;
- every material factual block links to Evidence;
- unsupported claims have become research gaps, not prose;
- any practice has a feedback expectation;
- the packet is renderer-neutral and exportable.

Read `references/pedagogy.md` for the teaching policy and `references/canvas-teaching-packet.md` for the output contract.
