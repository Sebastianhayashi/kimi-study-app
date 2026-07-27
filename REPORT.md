# REPORT — Lucubro Round 14

- 日期：2026-07-27
- 类型：implement / 消化轮
- 合同：`HANDOFF.md`
- 结果：T1—T4 全部完成；四道门禁全绿；无 BLOCKERS。

## 1. T1—T4 交付台账

| 任务 | 状态 | 实现证据 | 验证证据 |
|---|---|---|---|
| T1 生成取消按钮 | DONE | `public/new-course.html` 新增生成态取消、返回课程库、重新开始控件；`public/first-run-onboarding.js` 调用既有 `POST /api/courses/:id/operation/cancel`，维护 cancelled terminal latch，处理 409/网络失败/已结束竞态，停止轮询与 SSE 覆盖；`public/i18n.js` 增加 en/zh-CN/ja 文案。 | `tests/e2e/first-run-onboarding.spec.js` 覆盖取消成功、迟到 SSE 不复活、刷新恢复取消终态、返回课程库、重新开始；既有 `operation-recovery.spec.js` 的 cancel 状态机继续通过。 |
| T2 rubric 写入两条生成路径 | DONE | `lib/assessment-machine-contract.js` 新增唯一共享常量 `LESSON_PEDAGOGY_CONTRACT_LINES`；`server.js` 的 `FIRST_LESSON_MACHINE_CONTRACT` 同时注入 `FIRST_PROMPT` 与 `FIRST_ONBOARDING_PROMPT`；`lib/next-lesson.js` 在增量 prompt 中逐字展开同一常量。D3 预算仍为 900—1400 字、硬上限 1800 字、3 个主要 h2。 | `test/first-lesson-preflight.test.js` 的 drift guard 逐行验证共享契约出现在增量 prompt；源代码注入位置见 `server.js:145`、`lib/next-lesson.js:336`。 |
| T3 确定性 blocker | DONE | `lib/assessment-quality-gate.js` 增加中英文模糊动作 denylist，并对“诊断理解偏差”等合法动作前缀保守放行；`lib/lesson-publish-validator.js` 阻断缺失 worked-example 容器或少于 2 个步骤标记的 HTML。R3/R6/C6 仅生成 warning，不引入 LLM judge。首课与增量课继续共用 `validatePublishedLesson`。 | `test/assessment-quality-gate.test.js`、`test/lesson-publish-validator.test.js`、`test/first-lesson-preflight.test.js`、`test/next-lesson-preflight.test.js`；全量 unit 200/200。 |
| T4 试金石课程重置 CLI | DONE | 新增 `scripts/reset-course-for-first-lesson.js`。必须传 `--course`；只清空目标课程的 `lessons/`、`assessments/`、`curiosity/` 与生成 runtime；保留 Mission、材料、资源、地图、source profile、封面、meta 和 Mission session；原子重写 onboarding 为“Mission 已确认、首课未生成”；输出 `/new-course?course=...` 与 `/start` 下一步，并明确禁止 `/lessons/next`。 | `test/reset-course-for-first-lesson.test.js` 覆盖无 id、缺失课程、Mission 未确认、保留清单、清理清单、其他课程不受影响。未在交付数据上执行，符合合同。 |

## 2. T2 共享教学法契约（逐字）

以下文本只定义在 `lib/assessment-machine-contract.js` 的 `LESSON_PEDAGOGY_CONTRACT_LINES`，首课和增量课不各自复制：

```text
【R14 有效课节教学法契约（D3 预算内）】
本课只教 1 个可观察能力。claim.label 必须以可观察动作表述，例如“解释、判断、诊断、应用、创作”；禁止用“了解、理解、熟悉、掌握、知道”或 understand、know、learn about、be familiar with 作为能力动作。
核心讲解必须给出完成该能力所需的规则、机制或判断依据：说明为什么成立、如何判断、何时失效或边界在哪里；禁止只做材料摘要或换句话复述。
必须使用本课 sourceRefs 对应材料中的 1 个 worked example。HTML 中用一个带 data-worked-example 和 data-source-ref 的容器包住示例，并把至少 2 个关键步骤分别标为 data-worked-example-step；每一步都要说明“正在做什么”和“为什么这样做”。
练习答案、worked answer、acceptedAnswers、correctOptionId、correctOptionIds、correctOrder 与评分键不得出现在课节 HTML，只能存在于 Assessment JSON。
transfer 活动必须更换表面情境，同时应用同一深层能力，并直接形成、判断或修订 Mission 期望产出的真实片段、草稿、结构或下一步；禁止只换一种问法重复定义。
课节结尾必须明确指出“本课这一步如何推进学习者的真实产出”，并给出可以立刻执行的第一步；课程为行动服务，不为覆盖材料服务。
保持既有 D3 速度预算：正文目标 900—1400 个中文字符，硬上限 1800 个中文字符；活动挂载点前只写 3 个主要 h2 内容段，每段最多 2 个短段落，整课最多一个 ul（不超过 4 项）和一个 callout。
在该预算内保留一个机制优先的核心解释、一个带关键步骤的来源内 worked example、一个常见误区修正和一个连接真实产出的迁移提示；不要增加相似案例、百科式扩写或资源长清单。
```

### 注入路径

1. 首课普通路径：`FIRST_PROMPT` → `FIRST_LESSON_MACHINE_CONTRACT` → `LESSON_PEDAGOGY_CONTRACT_LINES`。
2. 首次建课路径：`FIRST_ONBOARDING_PROMPT` → 同一个 `FIRST_LESSON_MACHINE_CONTRACT`。
3. 增量课路径：`buildNextLessonPrompt()` 直接展开同一个 `LESSON_PEDAGOGY_CONTRACT_LINES`。
4. 两条路径继续在相同教学法契约后附加既有 Assessment wire contract 与各自确定性 preflight 命令。

## 3. 新 blocker 正反例测试清单

### 3.1 模糊动词 denylist

**应阻断：**

- 中文：`了解反馈回路`、`理解关键机制`、`熟悉评审流程`、`掌握论证方法`、`知道何时使用`。
- 英文：`Understand feedback loops`、`Know the framework`、`Learn about induction`、`Be familiar with the process`。

**不得误伤：**

- `诊断理解偏差`
- `判断是否理解机制`
- `解释已掌握方法的边界`
- `Diagnose understanding gaps`
- `Explain what learners know`

判断规则只审 claim 的起始能力动作；合法可观察动作优先，后续宾语中出现“理解/掌握/know”等词不会触发误杀。

### 3.2 worked example 结构标记

**应阻断：**

- 无 `data-worked-example` 容器。
- 有容器但少于 2 个 `data-worked-example-step`。
- 只在 HTML 注释中放置伪标记（对应反例单测）；扫描器同时排除 `script` 与 `style` 中的伪标记。

**应通过：**

- 至少一个真实元素带 `data-worked-example` 与 `data-source-ref`。
- 至少两个真实元素带 `data-worked-example-step`。
- 对应 Assessment、挂载点和其他既有发布合同同时有效。

### 3.3 非阻断 warning

- R3：页面文本未显式呈现规则、机制、判断依据或边界线索。
- R6：transfer 文案未显式呈现新/不同/现实表面情境线索。
- C6：课节未显式连接真实产出或立即可做的第一步。

以上只进入 `warnings`；发布 `ok` 仍只由确定性 errors/blockers 决定。

## 4. T1 状态与竞态说明

- 可取消状态沿用服务器合同：`queued`、`running`、`interrupted`；其他状态隐藏或禁用取消控件。
- 成功取消后设置客户端 `generationTerminal = 'cancelled'`，停止 poll timer、SSE、elapsed timer，冻结取消态动效。
- 迟到 SSE 和 poll 在 terminal latch 下直接忽略，不能把页面复活为生成中。
- 409 时重新读取 canonical operation：cancelled → 取消终态；ready → ready；failed/interrupted → 失败恢复；仍 active → 恢复监控并明确提示。
- 网络失败不伪造取消成功；控件恢复可操作并显示错误。
- 刷新后从 `operation.state === 'cancelled'` 恢复相同终态。
- “重新开始”复用既有 `/retry`，不新增 API，不修改取消 API 语义。

## 5. T4 使用与安全边界

```bash
node scripts/reset-course-for-first-lesson.js \
  --course 333b9b698044d3f55e05c866981dcc7a
```

可选测试数据根目录：

```bash
node scripts/reset-course-for-first-lesson.js \
  --data-dir /path/to/courses \
  --course <course-id>
```

工具保留 `mission-session.json` 是有意行为：既有 `launchOnboardingGeneration()` 会读取该真实 Teach Mission session 继续生成首课；删除它会破坏合同要求的既有首课路径。工具不调用 Kimi、不调用 HTTP、不处理其他课程。

重置后：

1. 打开 `/new-course?course=<course-id>`；或调用 `POST /api/courses/<course-id>/start`。
2. 不得调用 `POST /api/courses/<course-id>/lessons/next`，因为无首课时该入口按既有合同返回 409。

## 6. 改动清单

### 生产代码

- `server.js`：仅首课 prompt 常量区注入共享 rubric。
- `lib/assessment-machine-contract.js`：共享教学法契约。
- `lib/next-lesson.js`：增量 prompt 注入共享契约并替换旧 D3 重复段。
- `lib/assessment-quality-gate.js`：模糊动作 blocker。
- `lib/lesson-publish-validator.js`：worked-example blocker 与非阻断 warning。
- `public/new-course.html`：取消/返回/重新开始控件及最小响应式样式。
- `public/first-run-onboarding.js`：取消状态机、竞态对齐、迟到事件锁、刷新恢复、重新开始。
- `public/i18n.js`：8 组三语 phrase tuple。
- `scripts/reset-course-for-first-lesson.js`：新 CLI。

### 测试

- `test/assessment-quality-gate.test.js`
- `test/lesson-publish-validator.test.js`
- `test/first-lesson-preflight.test.js`
- `test/next-lesson-preflight.test.js`
- `test/reset-course-for-first-lesson.test.js`（新增）
- `tests/e2e/first-run-onboarding.spec.js`

### 交付文档与证据

- `REPORT.md`
- `r14-gate-logs/01-check.log`
- `r14-gate-logs/02-unit.log`
- `r14-gate-logs/03-playwright.log`
- `r14-gate-logs/04-readme.log`

## 7. 四道门禁原始结果

完整原始 stdout/stderr 保存在上述四个日志文件中；以下为同一日志的最终结果，不是重新整理的替代运行。

| 顺序 | 原始命令 | 结果 | 完整日志 SHA-256 |
|---:|---|---|---|
| 1 | `npm run check` | PASS | `1d481bd3cc6245b7aedd92f16bbb7c4890174b21a321453ea79903bb2cd9122b` |
| 2 | `npm test` | **200/200 PASS**；基线 194，只增不减 | `fdade75103673062d4c0c0f9303bcdc94f4f364090e8671ba084db5a18a9b0e1` |
| 3 | `npx playwright test` | **79/79 PASS**；基线 78，只增不减；1 worker；无 retry、skip 或 flaky | `9127476d1b2724a27718ddd9e6a84cd34e748d086c540948ab30fb01c025b030` |
| 4 | `npm run verify:readme` | PASS；en / zh-CN / ja media 与结构 parity 均通过 | `1f58979170e1956eabd75ff5883b0ea5ebbac21b43c22bc2d0fddbb06dbc910b` |

Playwright 使用仓库既有依赖与系统 Chromium。沙箱的全局 Chromium `URLBlocklist` 仅在测试进程运行期间临时允许 localhost，结束后已恢复为原策略；项目文件和依赖未因此改变。

补充语法验证：`node --check scripts/reset-course-for-first-lesson.js` PASS。CLI 还由 unit 测试实际加载和执行。

## 8. 红线自检

| 红线 | 结果 | 证据 |
|---|---|---|
| 零新依赖 | PASS | `package.json` SHA-256 `fb8a1ffb…0f0e7b6` 与原包一致；`package-lock.json` SHA-256 `7a76f481…843afb` 与原包一致。 |
| 不动 Flag-A artifact | PASS | `lib/artifact-store.js`、`lib/artifact-critique.js`、`lib/course-activity.js`、`public/artifact*.html/js` 逐字节一致；Flag-A E2E 4 项全绿。 |
| 不动 `data/` | PASS | 59 个文件联合 manifest SHA-256：原包与交付均为 `37760a806cb6f6fc2b23234691c5d6340e75a726ec3b4ca0d08f9a3db54dc202`。 |
| `lib/` 仅改授权文件 | PASS | 仅 `assessment-machine-contract.js`、`assessment-quality-gate.js`、`lesson-publish-validator.js`、`next-lesson.js` 有 diff；`first-lesson-preflight.js` 无需改动。其余 `lib/` 逐字节一致。 |
| `server.js` 限定范围 | PASS | 唯一 diff 是 126—168 附近首课 prompt 常量区；取消 API 与其他 server 语义未改。 |
| 不动 tutor / landing / README / 工作台结构 / Mission 访谈 | PASS | 对应文件与原包逐字节一致；四道门禁覆盖既有旅程。 |
| 不弱化既有测试 | PASS | 未删除、skip 或放宽既有测试；unit 194→200，E2E 78→79。 |
| 禁止新开调研 | PASS | 仅使用合同、D-006、`RESEARCH-CORE.md` §3 与仓库源码。 |

## 9. FIXED-EXTRA

均属于合同允许的小问题：

1. 恢复既有测试要求的精确 D3 文案“硬上限 1800 个中文字符”，避免共享契约发生无意义措辞漂移。
2. worked-example marker 扫描先排除 HTML 注释、script 与 style，防止伪标记绕过 blocker。
3. 新取消 E2E 的 API mock 从单 page 提升为 browser context，使“刷新后恢复取消终态”测试真实覆盖新页面；生产代码未因此调整。

## 10. BLOCKERS

无。

## 11. 本地验收注意事项

1. 解压后复跑四道门禁。
2. 执行 T4 CLI 重置试金石课程 `333b9b698044d3f55e05c866981dcc7a`。
3. 从 `/new-course?course=333b9b698044d3f55e05c866981dcc7a` 走既有首课生成路径。
4. 创始人阅读重生成的《区分演绎与归纳》，判定是否能明确说出“第一步做什么”。
5. 在真实生成过程中点击“取消生成”，验证取消终态、返回课程库、重新开始及刷新恢复。
