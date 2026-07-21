# First-run Onboarding Integration Contract

Status: **target integration contract; no production implementation in this commit**
Repository baseline: `main@e337f94523b891121225fffebd3b06e81ca68591`
State-machine companion: `docs/stabilization/FIRST_RUN_STATE_MACHINE.md`

## 1. Reference animation source

The design source for First-run is not `public/app.html` and not the frozen in-course Generation Preview.

| Field | Value |
|---|---|
| File | `kimi-study-first-run-quiet-carousel-demo(1).html` |
| SHA-256 | `48cf40459ed6aa13a0af13a06a0d28190d66aa773cedd91f1d48fd4eee92e742` |
| Size | `39,441 bytes` |
| Lines | `1,103` |
| HTML title | `Kimi Study · 安静建课过渡演示` |

The implementation agent must obtain a local copy whose SHA-256 matches this value before Patch B. A similarly named file is not an acceptable substitute.

## 2. Scope and non-goals

This contract defines the migration from the current immediate-generation upload route to a recoverable first-run flow:

`upload → real inspection → three mission answers → one Kimi run → truthful loading → one-shot ready exit → first lesson`

It does not implement the flow. The documentation commit must not modify `server.js`, `public/**`, `lib/**`, tests, package configuration, or data.

The following Generation Preview files are frozen and are not reused as First-run UI:

- `public/generation-preview-product.js`
- `public/generation-preview-product.css`
- `public/generation-events-client.js`
- `lib/generation-status.js`
- `lib/kimi-generation-runner.js`

Patch A may call existing generation services through stable functions. Patch B must not redesign the frozen preview.

## 3. Current-code evidence at `main@e337f945`

| Claim | Current file | Function/route | Exact current behavior | Target change | Confidence |
|---|---|---|---|---|---|
| Course IDs are not UUIDs | `server.js` | `POST /api/courses` | Uses `Date.now().toString(36)` | New onboarding IDs should be collision-resistant while legacy IDs remain readable | High |
| Upload starts Kimi immediately | `server.js` | `POST /api/courses` | Creates directory, moves to `book.<ext>`, writes `meta.json`, calls `runKimi(..., { track: true })`, returns `{ id }` | New onboarding upload persists and inspects first; `/start` launches Kimi later | High |
| Upload route does not create onboarding artifacts | `server.js` | `POST /api/courses` | No `onboarding.json`, `MISSION.md`, or `map.json` write in this route | Patch A adds `onboarding.json`; Mission route creates deterministic `MISSION.md` | High |
| Course list exposes generation summary | `server.js` | `GET /api/courses` | Returns ID, title, cover, extension, lesson count, existing job stage and updated time | Add onboarding state/error summary without breaking existing clients | High |
| Status combines job, files and lock | `server.js` | `GET /api/courses/:id/status` | Reads job, counts lessons, checks in-memory lock and derives canonical progress/phase | First-run loading reuses this evidence after generation starts | High |
| Stale active job becomes failure today | `server.js` | status/SSE stale checks | No lock plus `understanding`/`generating` older than 60 seconds is surfaced as failed | Target may persist `interrupted`; do not describe it as already implemented | High |
| SSE is already available | `server.js` | `GET /api/courses/:id/generation-events` | Sends `retry: 2000`, replays stored events, emits keepalive every 15 seconds and unsubscribes on close | First-run subscribes only after `/start` and reuses the same sanitized event stream | High |
| Host owns terminal completion | `server.js` | `runKimi(..., { track: true })` | Writes ready only after tracked run finishes and a lesson exists, then emits host `run-complete` | Onboarding reconciles to ready only after the first lesson is readable | High |
| Current app upload UI is a legacy modal | `public/app.html`, `public/glue.js` | `window.beginUpload` | Existing modal posts `/api/courses` then redirects to `/course/:id` after a short UI delay | New-course entry routes to dedicated First-run UI and calls onboarding API | High |
| Lessons load separately | `public/glue.js` | `loadLessons`, `showLesson` | Fetches `/lessons`, loads first lesson iframe, updates course chrome | Ready exit navigates into the existing course route; no duplicate lesson renderer | High |
| Fixture source and runtime data differ | `lib/runtime-config.js`, `scripts/build-test-fixtures.js`, `tests/support/test-server.js` | path resolvers | Deterministic fixtures default to `tests/.generated/fixtures`; live E2E course data is isolated under `tests/.runtime/courses` | Onboarding tests preserve the same boundary | High |

## 4. Current behavior, target behavior, migration delta

### 4.1 Current

```text
/app upload modal
  → POST /api/courses
  → course directory + book.ext + meta.json
  → Kimi starts immediately
  → redirect to /course/:id
  → in-course Generation Preview handles generation
```

### 4.2 Target

```text
/app “新建课程”
  → /new-course
  → POST /api/course-onboarding
  → /course/:id/onboarding (inspecting)
  → awaiting_mission
  → PUT /api/courses/:id/mission
  → POST /api/courses/:id/start
  → truthful status/SSE loading
  → host verifies ready + readable lesson
  → reference ready overlay exits once
  → /course/:id
```

### 4.3 Migration delta

- Keep legacy `POST /api/courses` temporarily for compatibility and mark it legacy in code comments/tests.
- The new First-run entry never calls the legacy endpoint.
- Do not allow both endpoints to handle one click; the `/app` handler must have one explicit route.
- Existing course routes, lesson renderer, Tutor, source viewer, notes, and the frozen Generation Preview remain unchanged except for navigation into/out of onboarding.

## 5. Reference animation inventory

### 5.1 Stages and primary DOM

| Stage | Selector | Primary elements | Production trigger |
|---|---|---|---|
| Upload | `[data-stage="upload"]` | `#uploadZone`, `#fileInput`, `#fileRow`, `#sampleButton`, `#uploadContinue` | New draft or no course ID |
| Reading | `[data-stage="reading"]` | `.reading-sweep`, `#readingCopy` | Onboarding `inspecting` |
| Mission | `[data-stage="mission"]` | `#missionMeta`, `#missionQuestion`, `#questionTitle`, `#options`, `#missionBack`, `#missionNext` | `awaiting_mission` |
| Loading | `[data-stage="loading"]` | `.visual-scene`, `#visualCaption`, `#progressFill`, `#progressValue`, `#statusLine`, `#processList`, `#backgroundButton` | `starting` or `generating` |
| Ready | `[data-stage="ready"]` | `.workspace-grid`, `#readyOverlay`, ready check and first-lesson action | Verified onboarding `ready` |

### 5.2 Visual behavior that must be preserved in Patch B

- Stage entry: `380ms cubic-bezier(.22,1,.36,1)`.
- Stage exit: `220ms ease`.
- Mission question exit: `160ms`; question entry: `280ms cubic-bezier(.22,1,.36,1)`.
- Reading sweep: `1.8s cubic-bezier(.45,0,.2,1) infinite`.
- Orbit: core breath `2.2s`; ring rotation `3.8s linear infinite`.
- Card scene: `2.7s ease-in-out infinite`.
- Node scene: `1.9s ease-in-out infinite`.
- Scan scene: `1.65s ease-in-out infinite`.
- Loading scene crossfade: `420ms cubic-bezier(.22,1,.36,1)`.
- Progress transform: `460ms cubic-bezier(.22,1,.36,1)`.
- Ready overlay opacity transition: `500ms ease`.
- Ready check entry: `420ms cubic-bezier(.22,1,.36,1)` after `80ms`.
- Responsive breakpoint at `820px` and the reference reduced-motion rule.

Patch B may extract the inline CSS/JS into production files, but it may not reinterpret these timings, layout ratios, colors, radii, scene artwork, or easing curves without explicit product approval.

### 5.3 Demo-only logic that must be replaced

| Demo behavior | Exact demo value | Production replacement |
|---|---:|---|
| Reading copy advances by timer | `1150ms` | Real inspection status/evidence |
| Reading automatically ends | `2550ms` | Onboarding state becomes `awaiting_mission` |
| Fake sample object | hard-coded EPUB name and size | A real packaged, licensed sample file or no sample action |
| Loading progress | `requestAnimationFrame` over `10800ms` | Existing canonical `/status.progress` |
| Loading phase thresholds | `0–18–38–56–73–89–100` | Existing explicit phase/status evidence |
| Ready transition delay | `650ms` | Trigger only after host-confirmed ready; preserve delay as presentation timing |
| Ready overlay hide | `1500ms` | Preserve one-shot overlay timing, then open the real first lesson |
| Background button | only changes button text | Navigate to `/app` without cancelling the server run |

The demo’s `setTimeout` calls used only for CSS text/question transitions may remain when they do not claim backend progress. Timers that decide business state must be removed.

## 6. Mission questions and stable values

Every question is required for Milestone 1B. Visible wording and descriptions come from the reference file; stable values are the target API representation.

### Question 1 — desired outcome

Prompt: `学完这份材料后，你最希望自己能做到什么？`

| Value | Visible option | Description |
|---|---|---|
| `understand_main_ideas` | 理解主要观点 | 能清楚解释核心概念与框架。 |
| `remember_key_content` | 记住关键内容 | 适合复习、考试或长期记忆。 |
| `apply_real_scenarios` | 应用到真实场景 | 能把方法用于工作、写作或生活。 |
| `critical_reading` | 进行批判性阅读 | 能判断证据、边界与可能的反例。 |

### Question 2 — learning style

Prompt: `你希望课程更接近哪种学习方式？`

| Value | Visible option | Description |
|---|---|---|
| `explain_then_practice` | 短讲解后马上练习 | 每个概念都配一个小任务。 |
| `understand_then_practice` | 先完整理解再练习 | 先建立框架，再集中应用。 |
| `cases_and_questions` | 以案例和问题为主 | 从真实情境中理解方法。 |

### Question 3 — session length

Prompt: `你通常一次能投入多少时间？`

| Value | Visible option | Description |
|---|---|---|
| `minutes_5_10` | 5 到 10 分钟 | 适合碎片时间。 |
| `minutes_15_25` | 15 到 25 分钟 | 适合完整完成一节课。 |
| `minutes_30_plus` | 30 分钟以上 | 可以加入更多练习和拓展。 |

## 7. Persistence contract

### 7.1 Authority matrix

| Data | Authority |
|---|---|
| First-run state, source metadata, inspection, mission answers, attempts | `onboarding.json` |
| Course title and archive flag | existing `meta.json` |
| Kimi run stage, run ID, timestamps, mode and terminal error | existing job persistence |
| Learner-facing mission | deterministic `MISSION.md` compiled from enumerated answers |
| Ready/lesson availability | actual lesson files plus lesson endpoint readability |
| Generation progress and phase | existing generation status/events; never duplicated as invented onboarding progress |

### 7.2 Proposed `onboarding.json`

```json
{
  "version": 1,
  "state": "awaiting_mission",
  "courseId": "0123456789abcdef0123456789abcdef",
  "createdAt": "2026-07-21T00:00:00.000Z",
  "updatedAt": "2026-07-21T00:00:00.000Z",
  "source": {
    "originalFilename": "material.epub",
    "storedFilename": "book.epub",
    "extension": ".epub",
    "mimeType": "application/epub+zip",
    "sizeBytes": 2936013,
    "sha256": "..."
  },
  "inspection": {
    "status": "complete",
    "format": "epub",
    "inspectedAt": "2026-07-21T00:00:00.000Z",
    "errorCode": null,
    "errorMessage": null
  },
  "mission": {
    "version": 1,
    "outcome": "apply_real_scenarios",
    "learningStyle": "explain_then_practice",
    "sessionLength": "minutes_15_25",
    "completedAt": "2026-07-21T00:00:00.000Z"
  },
  "generation": {
    "attempts": 0,
    "activeRunId": null,
    "startedAt": null,
    "readyAt": null,
    "failedAt": null,
    "errorCode": null,
    "errorMessage": null
  }
}
```

`generation.activeRunId` is a recovery mirror, not a replacement for existing job persistence. Reconciliation must prefer actual job/run evidence and repair stale mirrors.

### 7.3 Atomic writes

All JSON and Mission writes must:

1. serialize to a uniquely named temporary file in the same course directory;
2. flush/close the file;
3. rename over the destination atomically;
4. never expose a partially written JSON document;
5. retain `version` for future migrations.

## 8. Deterministic `MISSION.md`

Mission is generated by host code from the three enumerated values. Kimi must not invent, overwrite, or re-ask these answers.

```markdown
# Mission

## Desired outcome
{{outcome_label}}

{{outcome_description}}

## Preferred learning approach
{{learning_style_label}}

{{learning_style_description}}

## Session length
{{session_length_label}}

{{session_length_description}}

## Success definition
Build lessons that let the learner demonstrate the selected outcome within the selected session length, using the selected learning approach. Every explanation, example, practice task, hint and assessment must remain grounded in the uploaded source.
```

Only labels/descriptions from the server-owned enum table are inserted. The API does not accept arbitrary Markdown for these fields. `MISSION.md` becomes authoritative input to the teaching skill. The generation prompt must explicitly say that an existing complete Mission is authoritative and must not be replaced.

## 9. API contract

### 9.1 `POST /api/course-onboarding`

Purpose: create a draft, safely persist one source, and begin real inspection without starting Kimi.

Request: `multipart/form-data`

- `file`: required, one file.
- `title`: optional plain text title.
- `Idempotency-Key`: recommended request header; duplicate successful requests with the same key return the same course for a bounded period.

Accepted extensions for Milestone 1B:

- `.pdf`
- `.epub`
- `.md`
- `.markdown`
- `.txt`

Word formats are rejected and are not advertised.

Response after source persistence:

```http
HTTP/1.1 201 Created
Location: /api/courses/<id>/onboarding
```

```json
{
  "id": "0123456789abcdef0123456789abcdef",
  "state": "inspecting",
  "onboardingUrl": "/course/0123456789abcdef0123456789abcdef/onboarding"
}
```

Errors:

- `400 missing_file`
- `413 file_too_large`
- `415 unsupported_format`
- `422 invalid_source_name`
- `500 persist_failed`

Target IDs should use `crypto.randomUUID().replace(/-/g, '')`, preserving compatibility with the current alphanumeric ID validator. Existing base-36 IDs remain valid.

### 9.2 `GET /api/courses/:id/onboarding`

Purpose: recover first-run state after navigation, refresh, or server restart.

Success:

```json
{
  "id": "...",
  "state": "awaiting_mission",
  "source": {
    "originalFilename": "material.epub",
    "extension": ".epub",
    "sizeBytes": 2936013
  },
  "inspection": {
    "status": "complete",
    "errorCode": null,
    "errorMessage": null
  },
  "mission": {
    "outcome": null,
    "learningStyle": null,
    "sessionLength": null
  },
  "generation": {
    "attempts": 0,
    "activeRunId": null
  },
  "lessons": 0,
  "canStart": false,
  "canRetry": false
}
```

Responses: `200`, `404 course_not_found`, `409 onboarding_not_available` for a legacy course without onboarding data unless a migration view is explicitly implemented.

The endpoint is read-only and idempotent.

### 9.3 `PUT /api/courses/:id/mission`

Precondition: inspection complete and onboarding is `awaiting_mission`.

Request:

```json
{
  "outcome": "apply_real_scenarios",
  "learningStyle": "explain_then_practice",
  "sessionLength": "minutes_15_25"
}
```

Behavior:

- Validate all three values against server enums.
- Atomically update `onboarding.json` and compile `MISSION.md`.
- A retry with the same body is idempotent.
- Do not launch Kimi.

Responses:

- `200` with normalized mission and `canStart: true`
- `400 invalid_mission`
- `404 course_not_found`
- `409 inspection_incomplete`
- `409 generation_already_started`

### 9.4 `POST /api/courses/:id/start`

Precondition: source inspection complete, complete Mission persisted, no terminal deletion/archive conflict.

Behavior:

1. acquire the existing course lock atomically;
2. if a run is already active, return its status instead of launching another process;
3. persist onboarding `starting`;
4. call the existing tracked Kimi runner with a prompt that treats `MISSION.md` as authoritative;
5. persist/link the real run ID and reconcile to `generating`;
6. retain existing sanitized events and host-owned completion.

Idempotency:

- `awaiting_mission`: launch once and return `202`.
- `starting`/`generating`: return existing run with `202`.
- `ready`: return ready with `200`.
- `failed`/`interrupted`: return `409 retry_required`.

### 9.5 `POST /api/courses/:id/retry`

Precondition: onboarding is `failed` or `interrupted`, source and Mission remain valid, and no run is active.

Behavior: increment attempts, clear only the previous terminal generation error, and start one new tracked run. Do not overwrite source or Mission.

Responses: `202`, `404`, `409 not_retryable`, `409 run_already_active`.

## 10. Source inspection

Patch A must define format-specific, bounded inspection that proves the source is structurally usable without generating course content.

Minimum checks:

- common: safe normalized filename, accepted extension, size limit, SHA-256, regular file, stored inside the course directory;
- PDF: header/signature and parser-open success with at least one page;
- EPUB: ZIP/container structure and readable package metadata/spine;
- Markdown/TXT: decodable text and non-empty meaningful content;
- no source contents copied into logs or error responses.

MIME and extension must both be considered. A MIME mismatch is not automatically trusted merely because the extension is accepted.

## 11. Frontend routes and recovery

Target routes:

- `/new-course`: upload stage before a course ID exists.
- `/course/:id/onboarding`: recover `inspecting`, `awaiting_mission`, `starting`, `generating`, `failed`, `interrupted`, or `ready`.
- `/course/:id`: existing learning workspace after ready.

`/app` behavior:

- “新建课程” opens `/new-course`.
- An onboarding course card displays real state: reading material, waiting for setup, creating course, failed/interrupted, or ready.
- Opening an unfinished onboarding course returns to `/course/:id/onboarding`.
- Opening ready course goes to `/course/:id`.

## 12. Truthful animation/event binding

### Upload and inspection

- File name, extension and bytes come from the selected file and server response.
- The reading sweep loops while state remains `inspecting`.
- `readingCopy` may show only verified inspection actions, such as opening the file container or confirming a readable structure.
- The UI enters Mission only when GET onboarding reports `awaiting_mission`.

### Loading

- Subscribe to existing generation SSE and poll existing status as fallback.
- Progress uses canonical `status.progress` only.
- Process rows use canonical history and sanitized public events.
- Metrics display only when supplied by real status/events.
- No raw Wire `think` content or hidden chain-of-thought is shown.
- Unknown waiting remains on the current scene with neutral looping motion.

### Ready

Ready presentation starts only after:

- onboarding reconciles to `ready`;
- `lessons > 0`;
- the first lesson can be fetched/read.

Then:

1. set loading to `100%` and final verified copy;
2. preserve the reference `650ms` presentation delay;
3. enter the ready workspace;
4. preserve the `1500ms` overlay display and `500ms` opacity exit;
5. navigate to `/course/:id` after the overlay transition, unless the user activates “开始第一课” sooner;
6. never replay this sequence on ordinary later course opens.

Reduced motion keeps the same state ordering but compresses presentation-only waits; it never skips readiness checks.

## 13. “在后台继续”

The button must:

- navigate to `/app`;
- leave the server Kimi process and event persistence untouched;
- close only the browser EventSource for this page;
- show the course card with its real state;
- restore the exact First-run stage when reopened;
- route directly to learning when the course is ready.

It must not call a cancellation endpoint, clear the lock, delete the draft, or merely change its own label.

## 14. Failure and retry UX

| Failure | State/error | User action |
|---|---|---|
| Unsupported extension | request rejected before draft or draft marked failed | choose another file |
| File too large | `file_too_large` | choose a smaller file |
| Corrupt/unreadable source | inspection `failed` | replace source by starting a new draft |
| Mission write failure | remain/reconcile `awaiting_mission` with error | retry save; do not start Kimi |
| Kimi launch failure | `failed` | retry with same source/Mission |
| Kimi run failure | `failed` | inspect safe error summary and retry |
| Server restart/lost process | `interrupted` target behavior | explicit retry; never auto-launch on page load |
| Job ready but lesson unreadable | readiness failure | stop success sequence and expose retry/support action |

## 15. Security and data boundaries

- Use existing runtime data resolution and safety assertions.
- E2E data remains under `tests/.runtime/courses`; deterministic fixtures remain under `tests/.generated/fixtures`.
- Tests never use port `3000` and never seed `data/courses`.
- Reject path separators, NULs and unsafe source names; store source under server-chosen `book.<ext>`.
- Reject symlink targets and verify the final resolved path is inside the course directory.
- Do not inject uploaded text, file names, titles or error strings with `innerHTML` without escaping.
- Mission accepts enums, not arbitrary Markdown.
- Log IDs, stages, codes and bounded safe summaries; never log textbook bodies.
- Preserve production-data hash checks around E2E runs.

## 16. Test plan for implementation patches

### Patch A — Node/integration tests

- onboarding schema parsing and version rejection;
- valid state transitions and invalid transition rejection;
- atomic JSON/Mission writes;
- deterministic Mission mapping for all enum values;
- supported extension/MIME/size checks;
- PDF/EPUB/text inspection success and corrupt-source failure;
- traversal and symlink rejection;
- start idempotency under concurrent requests;
- existing active lock returns the same run;
- retry permitted only from terminal retryable states;
- recovery after stale active state;
- readiness requires a readable lesson;
- runtime/fixture/production data isolation.

### Patch B — Playwright

- blank user opens new course flow;
- real upload state and inspection transition;
- unsupported, oversized and corrupt files;
- all three exact mission questions and answer persistence;
- refresh recovery in inspection, each mission question, generation, failed and ready;
- duplicate start clicks launch once;
- truthful status/SSE phase mapping and no automatic phase rotation;
- background continuation and bookshelf recovery;
- failed and interrupted UX;
- one-shot ready overlay and first-lesson navigation;
- completed course bypasses onboarding;
- reduced motion, keyboard operation, focus visibility;
- 1366×768 plus mobile breakpoint;
- no console errors, page errors or unexpected 500 responses;
- frozen in-course Generation Preview regression suite remains green.

### Real Kimi smoke gate

A separate opt-in smoke test uses a tiny licensed TXT fixture and verifies:

- one Kimi process starts;
- Mission is honored and not overwritten;
- at least one lesson is produced;
- host completion is emitted after file verification;
- onboarding becomes ready and opens the lesson.

It must not run in the default deterministic E2E suite.

## 17. Patch split

### Patch A — backend state and API

Allowed scope:

- `server.js`
- new `lib/onboarding-*.js`
- narrowly necessary teaching-skill prompt wording
- Node tests and deterministic fixture support

Forbidden in Patch A:

- reference animation migration;
- changes to frozen Generation Preview;
- broad UI redesign.

### Patch B — First-run frontend integration

Allowed scope:

- dedicated First-run HTML/CSS/JS created from the verified reference source;
- `/app` new-course navigation and onboarding course-card routing;
- Playwright First-run tests.

Forbidden in Patch B:

- changing the frozen Generation Preview visual/timeline;
- inventing a second generation backend;
- timer-driven business state.

### Optional Patch C — real Kimi smoke and CI gate

- opt-in real-run script;
- CI workflow or documented manual gate;
- no production feature changes.

## 18. Definition of Done for Milestone 1B

- A user with no courses can upload one supported real file.
- The source is safely stored and genuinely inspected.
- The three exact answers persist and deterministically produce Mission.
- Kimi starts exactly once only after Mission is ready.
- Refresh and background navigation recover the correct stage.
- First-run loading advances only from truthful status/events.
- Hidden reasoning and fabricated metrics are never displayed.
- Failure stops the animation and offers a valid recovery path.
- Ready requires a readable lesson.
- The reference success transition plays once and opens the first lesson.
- Completed courses never re-enter First-run.
- Legacy courses remain usable.
- Tests remain isolated from port 3000 and `data/courses`.
- `npm run check`, Node tests, deterministic Playwright, frozen Generation Preview regressions and the opt-in real Kimi smoke gate pass.
