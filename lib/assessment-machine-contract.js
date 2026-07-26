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
  preflightInstruction,
};
