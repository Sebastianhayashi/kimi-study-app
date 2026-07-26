# Lucubro performance and server characterization baseline

Generated: 2026-07-26T12:25:20.981Z

> This is a read-only measurement. It changes no production behavior, API contract, dependency, or course data.

## Method

- Isolated fixture server: `http://127.0.0.1:3134` with `LUCUBRO_DATA_DIR=tests/.runtime/courses`.
- Route latency is one local cold-to-warm sample and is not a production capacity claim.
- Resource bytes are same-origin HTML-linked assets discovered without a browser cache.
- Event-loop delay is a short Node characterization sample, not a load test.

## Route and asset baseline

| Route | Status | HTML bytes | Same-origin requests | Resource bytes | Latency ms | Cache | Content type |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| / | 200 | 10063 | 13 | 448538 | 3.79 | none | text/html; charset=utf-8 |
| /app | 200 | 426831 | 8 | 282792 | 5.79 | none | text/html; charset=utf-8 |
| /notes | 200 | 5806 | 8 | 288712 | 1.03 | none | text/html; charset=utf-8 |
| /new-course | 200 | 37269 | 9 | 306723 | 1.17 | none | text/html; charset=utf-8 |
| /course/readycourse | 200 | 70194 | 21 | 449653 | 2.38 | none | text/html; charset=utf-8 |

## API error-contract baseline

| Endpoint | Status | Bytes | Latency ms | Content type |
| --- | ---: | ---: | ---: | --- |
| /api/courses | 200 | 10690 | 7.61 | application/json; charset=utf-8 |
| /api/activity | 200 | 183 | 2.48 | application/json; charset=utf-8 |
| /api/courses/readycourse/info | 200 | 49 | 1.16 | application/json; charset=utf-8 |
| /api/courses/missing-course/info | 200 | 24 | 0.98 | application/json; charset=utf-8 |

The table records the existing response status without interpreting or rewriting the contract. Interrupted and malformed fixture journeys remain covered by the Node and Playwright suites.

## Event-loop sample

- Sample elapsed: 122.21 ms
- Mean delay: 10.1 ms
- p95 delay: 10.142 ms
- Maximum delay: 10.158 ms

## Synchronous file-system owners

| Owner | Sync calls in source | Request-path candidate |
| --- | ---: | --- |
| server.js | 55 | yes, inspect per route before changing |
| lib/onboarding.js | 13 | no direct route assumption |
| lib/next-lesson.js | 12 | no direct route assumption |
| lib/operation-state.js | 10 | no direct route assumption |
| lib/generation-status.js | 5 | no direct route assumption |
| lib/source-digest.js | 4 | no direct route assumption |
| lib/generation-events.js | 3 | no direct route assumption |
| lib/lesson-publish-validator.js | 3 | no direct route assumption |
| lib/tutor-context.js | 3 | no direct route assumption |
| lib/runtime-config.js | 2 | no direct route assumption |
| lib/source-manifest.js | 2 | no direct route assumption |
| lib/standard-teach-mission.js | 2 | no direct route assumption |

The count is a source characterization, not proof of a performance defect. A later server patch must identify the route, measure event-loop impact, preserve atomic writes and recovery behavior, and improve a named metric before changing an owner.

## Targets for a later approved patch

- Preserve current status codes, local-data isolation, and atomic file replacement.
- Reduce a measured route or event-loop cost by at least 20 percent under the same fixture and command.
- Keep all Node and Playwright journeys green.
- Stop if the change requires an API contract, data-format migration, new dependency, or parallel state owner.

