'use strict';

const { normalizeLessonSpecShape } = require('./activity-engine');

const CHOICE_TYPES = new Set(['single-choice', 'multiple-choice']);
const ADVANCED_STAGES = new Set(['independent', 'transfer', 'exit-ticket']);
const REQUIRED_MASTERY_STAGES = ['independent', 'transfer'];

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function median(values) {
  const items = values.slice().sort((a, b) => a - b);
  if (!items.length) return 0;
  const middle = Math.floor(items.length / 2);
  return items.length % 2 ? items[middle] : (items[middle - 1] + items[middle]) / 2;
}

function correctIds(activity) {
  const ids = [];
  if (typeof activity?.correctOptionId === 'string' && activity.correctOptionId.trim()) {
    ids.push(activity.correctOptionId.trim());
  }
  if (Array.isArray(activity?.correctOptionIds)) {
    ids.push(...activity.correctOptionIds.map(String).map((item) => item.trim()).filter(Boolean));
  }
  return new Set(ids);
}

function auditChoice(activity, index, { exactOptions = null } = {}) {
  const blockers = [];
  const warnings = [];
  const at = `activities[${index}]`;
  const options = Array.isArray(activity?.options) ? activity.options : [];
  if (exactOptions != null && options.length !== exactOptions) {
    blockers.push(`${at} must contain exactly ${exactOptions} options`);
  } else if (options.length < 3) {
    blockers.push(`${at} needs at least three options`);
  }

  const correct = correctIds(activity);
  if (correct.size !== 1) blockers.push(`${at} must identify exactly one correct option`);
  const correctOption = options.find((option) => isObject(option) && correct.has(option.id));
  if (correct.size === 1 && !correctOption) blockers.push(`${at} correct option id is not present in options`);

  const distractors = options.filter((option) => !isObject(option) || !correct.has(option.id));
  if (exactOptions === 4 && distractors.length !== 3) blockers.push(`${at} must contain exactly three distractors`);

  const misconceptions = Array.isArray(activity?.misconceptions) ? activity.misconceptions : [];
  const misconceptionIds = new Set();
  for (const misconception of misconceptions) {
    const id = typeof misconception?.id === 'string' ? misconception.id.trim() : '';
    if (!id) continue;
    if (misconceptionIds.has(id)) blockers.push(`${at} has duplicate misconception id ${id}`);
    misconceptionIds.add(id);
  }
  for (const option of distractors) {
    if (!isObject(option)) {
      blockers.push(`${at} contains a malformed distractor`);
      continue;
    }
    if (!option.misconceptionId) blockers.push(`${at} distractor ${option.id || '?'} has no misconceptionId`);
    else if (!misconceptionIds.has(option.misconceptionId)) blockers.push(`${at} distractor ${option.id} references an unknown misconception`);
  }

  const wrongLengths = distractors
    .map((option) => String(option?.label || '').trim().length)
    .filter(Boolean);
  const correctLength = String(correctOption?.label || '').trim().length;
  const typicalWrong = median(wrongLengths);
  if (correctLength >= 16 && typicalWrong > 0 && correctLength > typicalWrong * 2.2 && correctLength - typicalWrong >= 10) {
    blockers.push(`${at} correct option is conspicuously longer than distractors`);
  }
  const prompt = String(activity?.prompt || '').toLowerCase();
  const correctLabel = String(correctOption?.label || '').trim().toLowerCase();
  if (correctLabel.length >= 8 && prompt.includes(correctLabel)) blockers.push(`${at} prompt leaks the correct option text`);
  const normalizedLabels = options.map((option) => String(option?.label || '').replace(/\s+/g, ' ').trim().toLowerCase());
  if (normalizedLabels.some((label) => !label)) blockers.push(`${at} answer options must have non-empty labels`);
  if (new Set(normalizedLabels).size !== normalizedLabels.length) blockers.push(`${at} has duplicate answer options`);
  if (!ADVANCED_STAGES.has(activity?.stage)) warnings.push(`${at} is guided; pair it with independent or transfer evidence`);
  return { blockers, warnings };
}

function normalizedText(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().toLowerCase();
}

function repeatsLabel(description, label) {
  const descriptionText = normalizedText(description).replace(/[，。,.!?！？:：;；()（）\[\]【】]/g, '');
  const labelText = normalizedText(label).replace(/[，。,.!?！？:：;；()（）\[\]【】]/g, '');
  return Boolean(descriptionText && labelText && (descriptionText === labelText || descriptionText === `能够${labelText}` || descriptionText === `能${labelText}`));
}

function transferLooksOutputLinked(transfer) {
  const text = normalizedText([transfer?.title, transfer?.prompt, transfer?.stimulus, transfer?.feedback?.correct, transfer?.feedback?.incorrect].filter(Boolean).join(' '));
  return /(?:产出|作品|片段|草稿|修订|修改|方案|回答|大纲|结构|决策|行动|现实场景|下一步|交付|提交|发布|output|artifact|draft|revise|revision|deliverable|outline|decision|action|real-world|next step|成果物|下書き|修正|構成|判断|行動|提出)/i.test(text);
}

function deeperTransferLooksStrict(transfer) {
  const text = normalizedText([transfer?.prompt, transfer?.stimulus, transfer?.feedback?.correct, transfer?.feedback?.incorrect].filter(Boolean).join(' '));
  return /(?:边界|条件|反例|权衡|机制|因果|严格|更难|限制|理由链|evidence|boundary|condition|counterexample|trade-off|mechanism|causal|rigor|constraint|境界|条件|反例|トレードオフ|仕組み|厳密)/i.test(text);
}

function auditAssessmentQuality(rawSpec, context = {}) {
  const spec = normalizeLessonSpecShape(rawSpec);
  const blockers = [];
  const warnings = [];
  const claims = Array.isArray(spec?.claims) ? spec.claims : [];
  const activities = Array.isArray(spec?.activities) ? spec.activities : [];

  if (claims.length !== 1) blockers.push(`assessment must contain exactly one claim; found ${claims.length}`);
  if (activities.length !== 2) blockers.push(`assessment must contain exactly two activities; found ${activities.length}`);

  const claim = claims[0];
  if (isObject(claim)) {
    const mastery = isObject(claim.mastery) ? claim.mastery : {};
    const requiredStages = Array.isArray(mastery.requiredStages) ? mastery.requiredStages.map(String) : [];
    for (const stage of REQUIRED_MASTERY_STAGES) {
      if (!requiredStages.includes(stage)) blockers.push(`claim mastery must require ${stage} evidence`);
    }
    if (Number(mastery.requiredPassed || 0) < 2) blockers.push('claim mastery.requiredPassed must be at least 2');
    const description = normalizedText(claim.description);
    if (!description) warnings.push('axis-b mission alignment: claim.description is empty');
    else if (repeatsLabel(description, claim.label)) warnings.push('axis-b mission alignment: claim.description only repeats the claim label');
  }

  const hingeIndexes = [];
  const transferIndexes = [];
  activities.forEach((activity, index) => {
    if (activity?.type === 'single-choice' && activity?.stage === 'independent') hingeIndexes.push(index);
    if (activity?.type === 'short-answer' && activity?.stage === 'transfer') transferIndexes.push(index);
  });

  if (hingeIndexes.length !== 1) {
    blockers.push(`assessment must contain exactly one independent single-choice hinge question; found ${hingeIndexes.length}`);
  }
  if (transferIndexes.length !== 1) {
    blockers.push(`assessment must contain exactly one transfer short-answer; found ${transferIndexes.length}`);
  }

  if (hingeIndexes.length === 1) {
    const index = hingeIndexes[0];
    const hinge = activities[index];
    const result = auditChoice(hinge, index, { exactOptions: 4 });
    blockers.push(...result.blockers);
    warnings.push(...result.warnings);
    if (claim?.id && hinge.claimId !== claim.id) blockers.push(`activities[${index}].claimId must reference the single assessment claim`);
  }

  if (transferIndexes.length === 1) {
    const index = transferIndexes[0];
    const transfer = activities[index];
    const minimum = Number(transfer?.scoring?.minimumLength || 0);
    // This is only an input-completeness floor. Reaching the length does not prove quality or Mission success.
    if (minimum < 40) blockers.push(`activities[${index}] transfer short-answer minimumLength must be at least 40`);
    if (claim?.id && transfer.claimId !== claim.id) blockers.push(`activities[${index}].claimId must reference the single assessment claim`);
    if (!transferLooksOutputLinked(transfer)) warnings.push(`axis-b mission alignment: activities[${index}] transfer does not visibly advance or rehearse the expected output`);
    if (context.latestFeedback?.signal === 'deeper' && !deeperTransferLooksStrict(transfer)) {
      warnings.push(`axis-b feedback response: activities[${index}] does not make deeper transfer stricter through mechanism, boundary, or reasoning`);
    }
  }

  if (context.latestFeedback?.signal === 'faster' && context.curiosityPresent) {
    warnings.push('axis-b feedback response: faster feedback should omit optional Curiosity expansion');
  }
  if (context.latestFeedback?.signal === 'skip_irrelevant' && context.repeatsSkippedNeighborhood) {
    warnings.push('axis-b feedback response: skip_irrelevant was followed by the same claim or source neighborhood');
  }

  activities.forEach((activity, index) => {
    if (CHOICE_TYPES.has(activity?.type) && !hingeIndexes.includes(index)) {
      const result = auditChoice(activity, index);
      blockers.push(...result.blockers);
      warnings.push(...result.warnings);
    }
  });

  return { ok: blockers.length === 0, blockers, warnings, document: spec };
}

module.exports = {
  ADVANCED_STAGES,
  CHOICE_TYPES,
  REQUIRED_MASTERY_STAGES,
  auditAssessmentQuality,
  auditChoice,
};
