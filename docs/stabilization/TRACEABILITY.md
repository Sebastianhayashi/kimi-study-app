# 稳定化可追踪矩阵

| Journey | 前端模块 | 后端/API | Fixture | Phase 3+ 测试 |
|---|---|---|---|---|
| J01 上传生成 | `glue.js` app branch | `POST /api/courses`, `/status` | `generatingcourse` | `upload-generation.spec.js` |
| J02 生成状态 | `generation-preview.js`, `generation-events-client.js` | `/status`, `/generation-events` | generating/interrupted/failed | `generation-state.spec.js` |
| J03 课程导航 | `glue.js`, `course.html` | `/lessons`, lesson route | `readycourse` | `lesson-navigation.spec.js` |
| J04 原文阅读 | `source-viewer.js` | `/sources`, static splat | source matrix | `source-viewer.spec.js` |
| J05 划词提问 | `select.js`, `margin-notes.js`, `glue.js` | `/chat` | `readycourse` | `selection-tutor.spec.js` |
| J06 笔记 | `margin-notes*.js` | `/notes` | `notescourse` | `notes.spec.js` |
| J07 互动练习 | `activity-runtime.js` | `/activities`, `/attempt`, `/progress` | ready/invalidassessment | `activities.spec.js` |
| J08 Tutor | `glue.js`, `assistant-markdown.js` | `/chat`, `/chat/reset` | `notescourse` | `tutor.spec.js` |
| J09 下一课 | `glue.js`, generation modules | `/lessons/next`, `/status` | ready/generating | `next-lesson.spec.js` |

## Fixture 目录

运行：

```bash
npm run fixtures:build
```

生成：

```text
tests/.generated/fixtures/
  manifest.json
  courses/
    readycourse/
    notescourse/
    invalidassessment/
    generatingcourse/
    interruptedcourse/
    failedcourse/
    emptycourse/
  sources/
    text-pdf.pdf
    outline-pdf.pdf
    landscape-pdf.pdf
    scanned-pdf.pdf
    broken-pdf.pdf
    epub2.epub
    epub3.epub
    chinese.epub
    missing-resource.epub
    broken.epub
    sample.txt
    sample.md
    sample.html
    sample.png
```

所有内容均为程序生成的最小测试材料，不包含真实用户材料。
