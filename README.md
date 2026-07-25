<div align="center">

<img src="public/assets/brand/lucubro-mark.svg" width="72" height="72" alt="Lucubro">

# Lucubro

**Turn the material you already have into a course built around what you need to do.**

[简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [Try it locally](#run-lucubro) · [Product model](docs/PRODUCT.md)

[![CI](https://github.com/Sebastianhayashi/lucubro/actions/workflows/ci.yml/badge.svg)](https://github.com/Sebastianhayashi/lucubro/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/Node.js-22%2B-339933?logo=nodedotjs&logoColor=white)](package.json)
[![License](https://img.shields.io/badge/license-ISC-blue)](LICENSE)

</div>

![Lucubro learning workspace](public/assets/product/hero-showcase.webp)

## Start with a real outcome

Lucubro turns books, textbooks, articles, past papers, and your own documents into a learning workspace. You choose what you want to accomplish; Lucubro organizes the source into a goal, a course path, interactive lessons, practice, notes, and source-grounded help.

It is designed for two kinds of work:

- **Prepare and improve.** Bring a textbook, worksheet, exam paper, or exercise set. Lessons focus on what you can demonstrate through answers and practice—not only what you say you understand.
- **Solve a real problem.** Bring the books and articles relevant to a piece of writing, a presentation, a work problem, or a current project. The course helps you turn reading into a usable output.

Both modes follow the same loop:

```text
problem → material → action → evidence → adjustment
```

## What you can do

- Upload EPUB, PDF, Markdown, or plain text.
- Clarify the outcome before the course is generated.
- Read interactive lessons and complete checks, retries, and transfer exercises.
- Open the original source beside the lesson.
- Highlight a passage, write an anchored note, or keep a Lucubro answer.
- Review notes from every course in one notebook and return to the exact lesson.
- See daily lesson, note, and practice activity in a contribution-style study grid.
- Ask Lucubro with the current lesson and source attached.
- Continue with the next lesson while keeping the course, notes, and learning record together.

![A real course generated from *Made to Stick*](public/assets/product/course-workspace.webp)

## A workspace for learning, not another chat

The course page keeps each job in a predictable place:

- **Course navigation** on the left: current lesson, progress, course outline, goal, and plan.
- **The lesson** in the center: the primary reading and practice surface.
- **Lucubro Assistant** on the right: explanations and feedback grounded in the current course.
- **Notes in context**: a compact panel in the normal workspace, margin notes when focus or full-screen mode creates enough space, and a bottom sheet on mobile.
- **Source reading**: focused source view or side-by-side lesson and source.

The course library resumes the exact lesson you left. The notebook works across courses, so reviewing notes never requires opening courses one by one.

## What Lucubro keeps

Each course is a durable local workspace containing the source, learning goal, course plan, lessons, assessments, notes, activity, tutor context, and generation state. A failed generation does not discard the uploaded material or confirmed goal.

Today, Lucubro records lesson opens, notes, and practice attempts. Richer user artifacts—such as a revised paragraph, completed problem set, presentation draft, or project output—are part of the product direction and are not yet fully implemented.

## Run Lucubro

### Requirements

- Node.js 22+
- The [`kimi` CLI](https://github.com/MoonshotAI/kimi-cli), installed and authenticated

The CLI is currently Lucubro's local generation runtime. It is an implementation dependency, not a separate product identity inside the learning experience.

```bash
kimi login
git clone https://github.com/Sebastianhayashi/lucubro.git
cd lucubro
npm ci
npm start
```

Open `http://localhost:3000`.

### Explore without a model call

```bash
npm ci
npm run demo:seed
LUCUBRO_DATA_DIR=tests/.runtime/courses PORT=3107 npm start
```

Open `http://localhost:3107/app`. The fixture workspace is isolated from `data/courses`.

## Languages

The interface defaults to English. Simplified Chinese and Japanese are available from the language switcher. Course and source content keep the language selected during course creation.

## Quality and current limits

Lucubro is an experimental open-source product, not a production SaaS.

- Course generation is non-deterministic and protected by structural validation and quality gates.
- Uploaded course data is stored locally; model requests use the configured CLI service.
- Production accounts, multi-user permissions, billing, cloud queues, and horizontal scaling are outside the current scope.
- PDF and EPUB compatibility is tested, but a broader real-world document matrix is still needed.

The repository includes Node contract tests and Playwright journeys for landing, library, onboarding, ready/generating/failed courses, notes, source reading, mobile drawers, and state consistency.

```bash
npm run check
npm test
npm run fixtures:build
LUCUBRO_DATA_DIR=tests/.runtime/courses npm run fixtures:seed -- --clean
npm run test:e2e:ci
```

See [Product](docs/PRODUCT.md), [Workflow](docs/WORKFLOW.md), [Architecture](docs/ARCHITECTURE.md), [Quality](docs/QUALITY.md), and [Limitations](docs/LIMITATIONS.md).

## Contributing

Useful contributions include real source-format fixtures, accessibility and mobile improvements, learning-evidence experiments, note and source-reader regression tests, and usability research based on real outcomes.

Read [CONTRIBUTING.md](CONTRIBUTING.md). Report security issues through [SECURITY.md](SECURITY.md).

## License

Code is available under the [ISC License](LICENSE). Third-party work is listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Lucubro is an independent open-source project and is not an official Moonshot AI product.
