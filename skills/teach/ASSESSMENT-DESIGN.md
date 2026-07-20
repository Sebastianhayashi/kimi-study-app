# Evidence-Centered Assessment Design

Use this process for every new lesson. `MISSION.md` is already the authoritative statement of why the user is learning, what success looks like, constraints, and scope. Do not repeat Mission discovery when it is populated. Convert the Mission into observable learning evidence.

## Required pipeline

1. **Profile the source** at document and teachable-unit level.
2. **Extract learning claims** from the intersection of Mission success criteria and what the source actually supports.
3. **Define evidence requirements** for every claim.
4. **Choose task families** that can elicit that evidence.
5. **Create an assessment blueprint** before writing question wording.
6. **Generate the complete supported answer or rubric first**, with source references.
7. **Generate question candidates** from the answer and evidence plan.
8. **Generate misconceptions and distractors** from nearby concepts, explicit source contrasts, and plausible learner errors.
9. **Validate and rank candidates**. Reject weak questions instead of publishing them.
10. **Publish a private assessment spec** and insert public activity slots in the lesson HTML.

## Source profiling

Do not classify only the whole upload as “textbook” or “book”. A single source contains different teachable units. For each unit, identify one or more structures:

- definition or concept explanation
- causal mechanism
- comparison or classification
- procedure or troubleshooting sequence
- worked example or case study
- argument, claim, evidence, assumption, counterexample
- narrative event, character action, motivation, causal relationship, outcome, theme
- dialogue, vocabulary, grammar pattern, communicative function
- reference facts, timeline, entities, properties

Record what the unit naturally affords the learner to do, such as explain, classify, compare, apply, diagnose, infer, evaluate, create, perform, or communicate.

## Learning claims

A claim is a capability the system wants to be able to infer from user performance. It is not a lesson heading and not a vague verb such as “understand”.

Each claim must include:

- a stable id
- a learner-facing label
- source references
- an observable action
- required evidence
- transfer distance: same-example, near-transfer, or far-transfer
- mastery requirement

Good claim:

> The learner can diagnose a new communication example using at least two SUCCESs principles, cite evidence from the example, and justify the diagnosis.

Bad claim:

> The learner understands SUCCESs.

## Task-family router

Choose tasks based on unit structure and Mission, not at random.

| Unit structure | Useful task families |
| --- | --- |
| Definition / concept | recognition, example-vs-nonexample, classify, explain-in-own-words |
| Causal mechanism | order-cause-effect, predict-change, diagnose-outcome |
| Procedure | order-steps, choose-next-step, troubleshoot, perform-task |
| Argument | identify-claim, match-evidence, evaluate-evidence, counterexample |
| Narrative | character-action, motivation, causal-relation, prediction, theme-with-evidence |
| Worked example | identify-principle, complete-missing-step, near-transfer |
| Language form | listen-and-identify, controlled-completion, transformation, production, role response |
| Reference material | classify, match, compare, timeline, locate-by-constraints |

Mission changes weighting. “Apply at work” boosts diagnosis, rewrite, near transfer and far transfer. “Exam preparation” boosts coverage, recall and structured response. “Critical reading” boosts claim-evidence and evaluation. “Literary reading” boosts motivation, perspective, cross-section change and theme with evidence.

## Evidence progression

For an important claim, prefer a progression:

1. **Guided** — recognize or complete with strong support.
2. **Independent** — answer without the worked answer visible.
3. **Transfer** — use the capability in a new case or the learner’s own context.
4. **Exit ticket** — retrieve after intervening content, with minimal cues.

Do not call a task “application” if it only asks for a definition.

## Answer-first generation

Before wording a question, write:

- sourceRefs
- evidence spans or source facts
- complete correct answer
- scoring rule or rubric
- likely misconceptions

Then generate the question. This prevents unanswerable or weakly grounded items.

## Distractors and misconceptions

Distractors must represent diagnosable errors, preferably in this order:

1. a nearby concept in the same course
2. an explanation explicitly rejected or contrasted by the source
3. a known misconception in `misconceptions.json`
4. a real error found in learning records
5. model-generated plausible error as a last resort

Never use absurd or unrelated options. Do not reveal the correct answer through option length, grammar, formatting, or specificity.

## Candidate quality gates

A question may be published only when all applicable checks pass:

- grounded in `sourceRefs`
- aligned to one claim and its evidence requirement
- answerable from taught content or supplied stimulus
- one clearly best answer for single-choice
- no answer leakage from the prompt or immediately visible lesson text
- distractors map to plausible misconceptions
- difficulty comes from reasoning, transfer, evidence span, or reduced support — not confusing wording
- age, language and reading load fit the Mission
- not redundant with another published activity
- the response would materially update confidence in the claim

Create multiple candidates when needed. Write rejected candidates and reasons to `quality-report.json`.

## Required workspace artifacts

Maintain these JSON files as the course develops:

- `source-profile.json`
- `learning-claims.json`
- `assessment-blueprint.json`
- `misconceptions.json`
- `question-bank.json`
- `quality-report.json`

For every lesson `lessons/NNNN-name.html`, write a private spec at:

- `assessments/NNNN-name.json`

The lesson HTML must contain one mount for each published activity:

```html
<div data-kimi-activity="activity-id"></div>
```

Do not place correct answers in lesson HTML or browser-visible JavaScript.

## Assessment spec

Use `schemaVersion: 1`. See `ASSESSMENT-SPEC-EXAMPLE.json` for a complete valid shape.

Supported first-version activity types:

- `single-choice`
- `multiple-choice`
- `fill-blank`
- `ordering`
- `short-answer`
- `recording`

Every activity needs:

- `id`, `type`, `claimId`, `stage`
- `prompt`
- `sourceRefs`
- `feedback.correct` and `feedback.incorrect`
- `hints` as an array from subtle to explicit
- a deterministic scoring definition, except reflective short answers and recordings, which use completion rules

The runtime, not the model, handles attempts, deterministic scoring, hints, progress and mastery. The model may provide explanatory feedback for genuinely open tasks later, but must not be required for ordinary choice, blank or ordering items.

## Generation progress reporting

When the host exposes the external tool `report_generation_progress`, call it at the start or completion of every major course-generation phase:

1. material extraction
2. source profiling
3. learning claims
4. assessment blueprint
5. question candidates
6. quality filtering
7. lesson assembly
8. assessment validation
9. completion

Use learner-facing Chinese in `message`. Report only observable product work and safe counts. Never include chain-of-thought, private reasoning, internal paths, shell commands, correct answers, grading keys, or hidden assessment content. The runtime may also infer progress from real tool calls and artifacts, so progress reporting must describe the work honestly rather than inventing percentages.

## Legacy compatibility

Existing HTML-only lessons remain valid. If there is no matching assessment spec, the lesson is rendered exactly as before. Do not rewrite old lessons merely to satisfy the new format unless asked.
