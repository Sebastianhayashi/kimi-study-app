# HANDOFF — Lucubro Round 14（消化轮：课节 rubric 入管线 + 生成取消按钮）

> 日期：2026-07-27
> 类型：implement（按合同写代码；不是调研轮，禁止新开调研）
> 基线 commit：`a30c7ea83e1dcce752fa581295593f50b5cc1dda`（本文件在该 commit 之上加入，其余内容逐字一致）
> 创始人决策：`DECISIONS.md` D-006（调研冻结、R14 重定义），必读。

## 0. 这一轮是什么

过去六轮外包调研（RESEARCH-CORE、feedback-research、PM-AUDIT-R9、UX-AUDIT-R13 等）已经产出了完整结论，但**结论没有进入产品**。本轮不调研、不探索、不出 demo，只做两件事的消化：

1. **生成中无法取消**：后端取消 API 早已存在，前端从未接线。创始人原话："生成中还不让我取消。"
2. **课节看完不知道怎么行动**：创始人实测首课《区分演绎与归纳》（试金石课程 `333b9b698044d3f55e05c866981dcc7a`）后判定"太简单，看完根本不知道要如何行动"。对照 `RESEARCH-CORE.md` §3 的有效课节 rubric，该课挂 R4（无带来源 worked example）、R6（transfer 未换表面情境落到真实产出）、C6（学完好不等于能行动）。rubric 写在 markdown 里，生成 prompt 和发布门禁里都没有。

本轮的验收试金石：**用改造后的管线重生成同一课，创始人看完能说清"第一步做什么"。**

## 1. 必读材料（按顺序）

1. 本文件（合同）。
2. `DECISIONS.md` D-006（本轮边界与排期）。
3. `RESEARCH-CORE.md` §3（有效课节 rubric：R1—R12 发布阻断项、C1—C6 跨课监控、学习科学出处）——T2/T3 的需求源，逐条读。
4. `lib/next-lesson.js`（增量课节 prompt，`buildNextLessonPrompt` 292—358 行）。
5. `lib/assessment-machine-contract.js`（首课与增量课共用的 Assessment wire 契约）。
6. `lib/assessment-quality-gate.js`、`lib/lesson-publish-validator.js`、`lib/first-lesson-preflight.js`（发布门禁现状）。
7. `server.js` 126—168 行（`FIRST_PROMPT` / `FIRST_ONBOARDING_PROMPT` / `FIRST_LESSON_MACHINE_CONTRACT`）与 1295 行附近（取消 API）。
8. `public/generation-events-client.js` 及生成进度 UI 实际所在文件（自行定位，生成页在 `public/new-course.html`）。

## 2. 任务线

### T1 — 生成取消按钮（前端接通既有 API）

**现状**：`server.js:1295` 有 `POST /api/courses/:id/operation/cancel`（409 = 当前状态不可取消），`server.js:242` 有 `cancelledGenerationRuns`。前端 `public/generation-events-client.js` 中 cancel/abort 零引用。

**合同**：

- 生成进行中（active generation）的 UI 上出现明确、可点的「取消生成」控件；非生成态不出现或禁用。
- 点击后调用既有取消 API；成功 → UI 进入确定的已取消终态（不是无限转圈、不是假死），给出「返回课程库」与「重新开始」两个出口。
- 409 / 网络失败 / 已结束等竞态必须优雅处理：UI 与服务器真实状态对齐，不撒谎。
- 轮询/事件流客户端在取消后停止后续状态覆盖（取消终态不被迟到的进度事件复活）。
- 全部新可见文案进 `public/i18n.js` 的 en / zh-CN / ja 三语 phrase tuple。
- 测试：取消 API 状态机 unit 测试（如已有则补强）；Playwright E2E 覆盖「生成中点击取消 → 已取消终态 → 出口可用」。

### T2 — 课节 rubric 写进生成 prompt（硬结构要求）

**需求源**：`RESEARCH-CORE.md` §3 的 R1/R3/R4/R5/R6/C6。把以下条目写成 prompt 中逐字的硬结构要求，注入**两条生成路径**：

- 首课：`server.js` 的 `FIRST_PROMPT`（147 行）与 `FIRST_ONBOARDING_PROMPT`（164 行）。
- 增量课：`lib/next-lesson.js` `buildNextLessonPrompt`（292—358 行）。

**实现约束**：两条路径已共用 `lib/assessment-machine-contract.js`。课节教学法要求也应提取为共享契约文本（可放入该文件或新建一个 `lib/` 模块），保证两条路径逐字一致——与既有 D2 契约的复用模式相同。

**必须写进 prompt 的 rubric 条目**（措辞以实现者为准，语义不得衰减）：

- **R1**：claim.label 必须是单一、可观察的能力，用动作动词表述（解释/判断/诊断/应用/创作）；禁止"了解/理解/熟悉/掌握/知道"类不可观察动词。
- **R3**：核心讲解必须给规则/机制（为什么成立、何时失效），禁止泛化摘要式复述。
- **R4**：必须有一个来源内的 worked example，且**标出关键步骤**（学习者能指出每一步在做什么、为什么）。该例子在 HTML 中带确定性结构标记（见 T3，标记方案由你定，如 `data-worked-example`），使门禁可机检。
- **R5**：练习答案不可出现在课节 HTML（既有 `PRIVATE_ANSWER_KEY` 检查已覆盖，保持）。
- **R6**：transfer 活动必须换表面情境，落到 Mission 期望产出的真实片段（产出/草稿/修订/下一步结构），不是换个问法考同一知识点。
- **C6**：每课结尾让学习者明确"这一步如何推进你的真实产出"——课节必须为行动服务，不为覆盖材料服务。

**预算纪律（重要）**：上述要求必须装进既有 D3 速度预算（正文 900—1400 中文字符、硬上限 1800、活动挂载点前 3 个 h2 段）。这是"预算内的元素规范"——把既有"一个核心解释、一个材料例子、一个常见误区修正、一个迁移提示"升级为满足 R3/R4 的具体形态，**不是**放宽预算写更长的课。`buildNextLessonPrompt` 的 D3 段落同步改写，保持预算数字不变。

### T3 — 发布门禁加确定性阻断（可机检子集）

**现状**：`lib/assessment-quality-gate.js` 只审 Assessment JSON；`lib/lesson-publish-validator.js` 对 HTML 只查挂载点、答案泄露、id 匹配。rubric 全部不在门禁里。

**合同**：只把**可确定性机检**的条目升级为发布阻断 blocker，其余保持 prompt 约束或非阻断 warning：

1. **模糊动词 denylist（blocker）**：claim.label 命中不可观察动词（中文至少含：了解、理解、熟悉、掌握、知道；英文至少含：understand、know、learn about、be familiar with）→ 发布阻断。保守设计防误伤（如"诊断理解偏差"这类以动作动词开头的合法 label 不得误杀），配充分单测覆盖正反例。
2. **worked example 标记（blocker）**：课节 HTML 缺少 T2 约定的确定性 worked example 标记，或关键步骤标记缺失 → 发布阻断。检查必须是纯结构性的（DOM/marker 存在性），不做语义判断。
3. **判断性条目不做 blocker**：机制深度、transfer 表面情境变换质量、C6 行动关联度——这些是语义判断，按 `RESEARCH-CORE.md` 原则只允许非阻断 warning，**禁止引入 LLM judge 作为唯一门禁**。
4. 新 blocker 同时接入两条预检路径：`lib/lesson-publish-validator.js`（增量，`validatePublishedLesson`）与 `lib/first-lesson-preflight.js`（首课），保证同一发布合同。
5. 全部新检查有 unit 测试；既有测试不得弱化或删除。

### T4 — 试金石课程重生成工具（本地验收用）

**目标**：交付一个可重复执行的本地工具（`scripts/` 下 CLI，不新增 HTTP 路由、不接生产 UI），把**指定 course id** 的课程重置到「MISSION.md 已确认、首课尚未生成」的状态，使既有首课生成路径可以重跑。

**合同**：

- 必须显式传 course id；无 id 或 id 不存在时拒绝执行。
- 只影响该课程目录：删除 `lessons/`、`assessments/`、`curiosity/` 内容，清理生成 runtime 状态（`job.json`、`next-lesson-transaction.json`、`generator-session.json` 等，以代码里实际状态文件为准）；**保留** `MISSION.md`、`RESOURCES.md`、`map.json`、`source-profile.json`、封面与材料。
- 不得触碰其他任何课程目录；不得触碰 `data/` 之外的任何代码。
- 重置后重跑首课走既有产品路径（注意 `server.js:1756`：无课节时 next-lesson 返回 409，首课必须走首课生成入口；`FIRST_ONBOARDING_PROMPT` 已处理"Mission 已确认"分支）。工具输出下一步操作说明（例如应调用的既有 API 或 UI 入口）。
- 工具本身的安全性有 unit 测试（拒绝无 id、保留文件清单、不越界）。

**注意**：重生成动作由本地验收方执行（你交付工具与文档，不在你的环境里跑真实生成，也不要求跑通 Kimi CLI）。

## 3. 红线

- **零新依赖**：`package.json` / `package-lock.json` 不得有任何 diff。
- **不动 Flag-A artifact 代码**与 `LUCUBRO_POL_V2` 语义。
- **不动 `data/`**：试金石课程数据由本地验收方处理，交付包不得修改任何课程数据。
- **lib/ 改动仅限**：`next-lesson.js`、`assessment-machine-contract.js`（或新建的共享契约模块）、`assessment-quality-gate.js`、`lesson-publish-validator.js`、`first-lesson-preflight.js`。其余 lib 文件不得动。
- **server.js 改动仅限**：首课 prompt 常量区（126—168 行附近）与 T1 取消接线必需的最小改动；取消 API 本身已存在，不得改其语义。
- **不动**：tutor 对话逻辑、landing、README 三语、课程工作台空间结构（D-005 沉浸式工作台是 R15，本轮禁止做）、teach skill 的 Mission 访谈流程。
- **不弱化既有测试**；四道门禁全绿前不得交付。
- **禁止新开调研**：不引用新的外部案例/研究，所有需求已在仓库内（RESEARCH-CORE.md 等）。

## 4. 门禁（交付前必须全绿，附原始日志）

1. `npm run check`
2. `npm test`（基线 194 passed；只允许增加）
3. `npx playwright test`（基线 78 passed；只允许增加）
4. `npm run verify:readme`

## 5. 交付物

- 代码补丁（完整仓库 zip，含 node_modules，与上传包同结构）。
- `REPORT.md`：交付台账（T1—T4 逐项 DONE/证据）、改动文件清单、新 blocker 的正反例测试清单、四道门禁原始结果、红线自检表（逐条 PASS/证据）。
- T2 的共享契约文本改动需在 REPORT 中逐字引用，并说明两条生成路径如何注入。

## 6. 本地验收协议（交付后由验收方执行，写入 REPORT 的注意事项即可）

1. 应用补丁，四道门禁本地复跑全绿。
2. 用 T4 工具重置试金石课程 `333b9b698044d3f55e05c866981dcc7a`，走产品路径重生成首课。
3. 创始人读重生成的《区分演绎与归纳》，判定：看完能否说清"第一步做什么"。
4. 创始人实测生成中取消按钮。

## 7. 容错机制

- 小问题（文案、样式细节、个别测试选择器脆、denylist 边界 case）：直接修，不必请示，在 REPORT 记录。
- 大问题（合同条款之间相互冲突、红线文件必须改动才能完成、门禁在你环境无法复现全绿）：**停下来**，在 REPORT 中写清阻塞点、已尝试路径、需要的决策，交付部分完成状态，不要硬闯红线。
- 对合同理解有歧义时，按"最小侵入 + 不破坏既有行为"原则选择解释，并在 REPORT 记录你的解释。
