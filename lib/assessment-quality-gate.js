'use strict';

const CHOICE_TYPES = new Set(['single-choice', 'multiple-choice']);
const ADVANCED_STAGES = new Set(['independent', 'transfer', 'exit-ticket']);

function median(values) {
  const items = values.slice().sort((a, b) => a - b);
  if (!items.length) return 0;
  const middle = Math.floor(items.length / 2);
  return items.length % 2 ? items[middle] : (items[middle - 1] + items[middle]) / 2;
}

function correctIds(activity) {
  if (typeof activity.correctOptionId === 'string') return new Set([activity.correctOptionId]);
  if (Array.isArray(activity.correctOptionIds)) return new Set(activity.correctOptionIds);
  return new Set();
}

function auditChoice(activity, index) {
  const blockers = [];
  const warnings = [];
  const at = `activities[${index}]`;
  const options = Array.isArray(activity.options) ? activity.options : [];
  if (options.length < 3) blockers.push(`${at} needs at least three options`);
  const correct = correctIds(activity);
  const distractors = options.filter((option) => !correct.has(option.id));
  const misconceptionIds = new Set((Array.isArray(activity.misconceptions) ? activity.misconceptions : []).map((item) => item?.id));
  for (const option of distractors) {
    if (!option?.misconceptionId) blockers.push(`${at} distractor ${option?.id || '?'} has no misconceptionId`);
    else if (!misconceptionIds.has(option.misconceptionId)) blockers.push(`${at} distractor ${option.id} references an unknown misconception`);
  }
  const correctOption = options.find((option) => correct.has(option.id));
  const wrongLengths = distractors.map((option) => String(option?.label || '').trim().length).filter(Boolean);
  const correctLength = String(correctOption?.label || '').trim().length;
  const typicalWrong = median(wrongLengths);
  if (correctLength >= 16 && typicalWrong > 0 && correctLength > typicalWrong * 2.2 && correctLength - typicalWrong >= 10) {
    blockers.push(`${at} correct option is conspicuously longer than distractors`);
  }
  const prompt = String(activity.prompt || '').toLowerCase();
  const correctLabel = String(correctOption?.label || '').trim().toLowerCase();
  if (correctLabel.length >= 8 && prompt.includes(correctLabel)) blockers.push(`${at} prompt leaks the correct option text`);
  const normalizedLabels = options.map((option) => String(option?.label || '').replace(/\s+/g, ' ').trim().toLowerCase());
  if (new Set(normalizedLabels).size !== normalizedLabels.length) blockers.push(`${at} has duplicate answer options`);
  if (!ADVANCED_STAGES.has(activity.stage)) warnings.push(`${at} is guided; pair it with independent or transfer evidence`);
  return { blockers, warnings };
}

function auditAssessmentQuality(spec) {
  const blockers = [];
  const warnings = [];
  const activities = Array.isArray(spec?.activities) ? spec.activities : [];
  activities.forEach((activity, index) => {
    if (CHOICE_TYPES.has(activity?.type)) {
      const result = auditChoice(activity, index);
      blockers.push(...result.blockers);
      warnings.push(...result.warnings);
    }
    if (ADVANCED_STAGES.has(activity?.stage) && activity?.type === 'short-answer') {
      const minimum = Number(activity?.scoring?.minimumLength || 0);
      if (minimum > 0 && minimum < 16) warnings.push(`activities[${index}] short-answer minimumLength is too low to elicit an explanation`);
    }
  });
  if (activities.length && !activities.some((activity) => ADVANCED_STAGES.has(activity.stage))) {
    blockers.push('assessment needs independent, transfer, or exit-ticket evidence');
  }
  return { ok: blockers.length === 0, blockers, warnings };
}

module.exports = { ADVANCED_STAGES, CHOICE_TYPES, auditAssessmentQuality };
