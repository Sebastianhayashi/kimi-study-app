'use strict';

// 诊断性 Assessment 机器契约（D2）。首课与后续课共用同一段文本：
// lib/next-lesson.js 的增量 prompt 与 server.js 的首课 prompt 都从这里取，
// 保证两条生成路径给模型的 wire schema 逐字一致。修改本文件会同时影响两条路径。
const ASSESSMENT_MACHINE_CONTRACT_LINES = [
  '【D2 诊断性 Assessment 机器契约】',
  '本轮 Assessment 必须恰好包含 1 个 claim 和 2 个 activities。宁可减少题量，也不要发布一眼可猜的题。',
  'Activity 1 是 independent 阶段的单选 hinge question：4 个结构和长度相近的选项；3 个错误选项都必须对应一个明确 misconceptionId；正确答案不能靠最长、最专业、关键词复现或排除荒谬选项猜出。',
  'claim.description 必须说明“这个能力如何推进用户的期望产出或满足成功证据”，不能留空或只复述 label。',
  'Activity 2 是 transfer 阶段的 short-answer：必须直接推进或演练 Mission 期望产出，例如形成真实作品片段、修订判断、现实场景演练或下一步可用结构；仍需应用本课能力并解释理由。minimumLength 至少 40，它只表示输入完整性下限，不是质量或成功证据。',
  '结构必须遵守下面形状：',
  '{',
  '  "schemaVersion": 1,',
  '  "lessonId": "LESSON_BASE",',
  '  "title": "本课标题",',
  '  "claims": [{"id":"claim-1","label":"可观察能力","description":"该能力如何推进期望产出或成功证据","sourceRefs":["source:book#真实位置"],"mastery":{"requiredPassed":2,"requiredStages":["independent","transfer"]}}],',
  '  "activities": [',
  '    {"id":"hinge-1","type":"single-choice","claimId":"claim-1","stage":"independent","prompt":"需要比较、推断或诊断的问题","options":[{"id":"a","label":"平行选项"},{"id":"b","label":"平行选项","misconceptionId":"m1"},{"id":"c","label":"平行选项","misconceptionId":"m2"},{"id":"d","label":"平行选项","misconceptionId":"m3"}],"correctOptionId":"a","misconceptions":[{"id":"m1","belief":"具体误解","feedback":"针对性反馈"},{"id":"m2","belief":"具体误解","feedback":"针对性反馈"},{"id":"m3","belief":"具体误解","feedback":"针对性反馈"}],"sourceRefs":["source:book#真实位置"],"feedback":{"correct":"说明正确推理","incorrect":"提示比较关键差异"},"hints":[{"content":"不泄露答案的提示"}]},',
  '    {"id":"transfer-1","type":"short-answer","claimId":"claim-1","stage":"transfer","prompt":"推进或修订期望产出的一个真实片段，并解释本课能力如何支持判断","scoring":{"mode":"completion","minimumLength":40},"sourceRefs":["source:book#真实位置"],"feedback":{"correct":"给出与成功证据相连的自查标准","incorrect":"要求补充产出片段、证据和理由"},"hints":[{"content":"提示使用本课原则，但不替用户作答"}]}',
  '  ]',
  '}',
  'LESSON_BASE、sourceRefs、误解和选项必须替换成当前内容的真实值。所有 distractor 必须是合理误解，不得使用荒谬、无关或明显较短的选项。',
];

// 有效课节教学法契约（R14 / RESEARCH-CORE §3）。首课与后续课必须逐字复用：
// server.js 的首课 prompt 与 lib/next-lesson.js 的增量 prompt 都从这里取。
// 这是既有 D3 速度预算内的元素规范，不允许通过增加篇幅来满足。
const LESSON_PEDAGOGY_CONTRACT_LINES = [
  '【R14 有效课节教学法契约（D3 预算内）】',
  '本课只教 1 个可观察能力。claim.label 必须以可观察动作表述，例如“解释、判断、诊断、应用、创作”；禁止用“了解、理解、熟悉、掌握、知道”或 understand、know、learn about、be familiar with 作为能力动作。',
  '核心讲解必须给出完成该能力所需的规则、机制或判断依据：说明为什么成立、如何判断、何时失效或边界在哪里；禁止只做材料摘要或换句话复述。',
  '必须使用本课 sourceRefs 对应材料中的 1 个 worked example。HTML 中用一个带 data-worked-example 和 data-source-ref 的容器包住示例，并把至少 2 个关键步骤分别标为 data-worked-example-step；每一步都要说明“正在做什么”和“为什么这样做”。',
  '练习答案、worked answer、acceptedAnswers、correctOptionId、correctOptionIds、correctOrder 与评分键不得出现在课节 HTML，只能存在于 Assessment JSON。',
  'transfer 活动必须更换表面情境，同时应用同一深层能力，并直接形成、判断或修订 Mission 期望产出的真实片段、草稿、结构或下一步；禁止只换一种问法重复定义。',
  '课节结尾必须明确指出“本课这一步如何推进学习者的真实产出”，并给出可以立刻执行的第一步；课程为行动服务，不为覆盖材料服务。',
  '保持既有 D3 速度预算：正文目标 900—1400 个中文字符，硬上限 1800 个中文字符；活动挂载点前只写 3 个主要 h2 内容段，每段最多 2 个短段落，整课最多一个 ul（不超过 4 项）和一个 callout。',
  '在该预算内保留一个机制优先的核心解释、一个带关键步骤的来源内 worked example、一个常见误区修正和一个连接真实产出的迁移提示；不要增加相似案例、百科式扩写或资源长清单。',
];

// 预检指令模板：两条路径各自注入自己的预检命令。
function preflightInstruction(validatorCommand) {
  return [
    '',
    '写完两个文件后，必须运行下面的本地确定性预检。该命令不会调用模型：',
    validatorCommand,
    '若命令退出码非 0，读取其 JSON errors，只修正本轮两个新文件并重新运行；预检成功后不得再改文件。不要在预检成功前结束任务。',
  ];
}

module.exports = {
  ASSESSMENT_MACHINE_CONTRACT_LINES,
  LESSON_PEDAGOGY_CONTRACT_LINES,
  preflightInstruction,
};
