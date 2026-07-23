'use strict';

const SUPPORTED_ACTIVITY_TYPES = new Set([
  'single-choice',
  'multiple-choice',
  'fill-blank',
  'ordering',
  'short-answer',
  'recording',
]);

const SUPPORTED_STAGES = new Set([
  'diagnostic',
  'worked-example',
  'guided',
  'independent',
  'transfer',
  'exit-ticket',
  'remediation',
]);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeCollectionShape(value) {
  if (Array.isArray(value)) return value;
  if (!isObject(value)) return value;
  return Object.entries(value).map(([key, item]) => {
    if (!isObject(item)) return item;
    return { ...item, id: typeof item.id === 'string' && item.id.trim() ? item.id : key };
  });
}

function normalizeValueCollection(value) {
  if (Array.isArray(value)) return value;
  if (!isObject(value)) return value;
  return Object.values(value);
}

function normalizeClaimShape(claim) {
  if (!isObject(claim)) return claim;
  const mastery = isObject(claim.mastery)
    ? { ...claim.mastery, requiredStages: normalizeValueCollection(claim.mastery.requiredStages) }
    : claim.mastery;
  return {
    ...claim,
    sourceRefs: normalizeValueCollection(claim.sourceRefs),
    mastery,
  };
}

function normalizeActivityShape(activity) {
  if (!isObject(activity)) return activity;
  const scoring = isObject(activity.scoring)
    ? { ...activity.scoring, requiredKeywords: normalizeValueCollection(activity.scoring.requiredKeywords) }
    : activity.scoring;
  return {
    ...activity,
    sourceRefs: normalizeValueCollection(activity.sourceRefs),
    hints: normalizeValueCollection(activity.hints),
    options: normalizeCollectionShape(activity.options),
    items: normalizeCollectionShape(activity.items),
    misconceptions: normalizeCollectionShape(activity.misconceptions),
    correctOptionIds: normalizeValueCollection(activity.correctOptionIds),
    correctOrder: normalizeValueCollection(activity.correctOrder),
    acceptedAnswers: normalizeValueCollection(activity.acceptedAnswers),
    scoring,
  };
}

function normalizeLessonSpecShape(spec) {
  if (!isObject(spec)) return spec;
  const claims = normalizeCollectionShape(spec.claims);
  const activities = normalizeCollectionShape(spec.activities);
  return {
    ...spec,
    claims: Array.isArray(claims) ? claims.map(normalizeClaimShape) : claims,
    activities: Array.isArray(activities) ? activities.map(normalizeActivityShape) : activities,
  };
}

function normalizeText(value, { caseSensitive = false } = {}) {
  let text = String(value == null ? '' : value)
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ');
  if (!caseSensitive) text = text.toLocaleLowerCase();
  return text;
}

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(String))];
}

function validateLessonSpec(spec) {
  const errors = [];
  spec = normalizeLessonSpecShape(spec);
  if (!isObject(spec)) return { ok: false, errors: ['spec must be an object'] };
  const claims = Array.isArray(spec.claims) ? spec.claims : [];
  const activities = Array.isArray(spec.activities) ? spec.activities : [];
  if (spec.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  if (typeof spec.lessonId !== 'string' || !spec.lessonId.trim()) errors.push('lessonId is required');
  if (!Array.isArray(spec.claims) || spec.claims.length === 0) errors.push('claims must be a non-empty array');
  if (!Array.isArray(spec.activities) || spec.activities.length === 0) errors.push('activities must be a non-empty array');

  const claimIds = new Set();
  for (const [index, claim] of claims.entries()) {
    const at = `claims[${index}]`;
    if (!isObject(claim)) { errors.push(`${at} must be an object`); continue; }
    if (typeof claim.id !== 'string' || !claim.id.trim()) errors.push(`${at}.id is required`);
    else if (claimIds.has(claim.id)) errors.push(`${at}.id must be unique`);
    else claimIds.add(claim.id);
    if (typeof claim.label !== 'string' || !claim.label.trim()) errors.push(`${at}.label is required`);
    if (!Array.isArray(claim.sourceRefs) || claim.sourceRefs.length === 0) errors.push(`${at}.sourceRefs is required`);
    if (!isObject(claim.mastery)) errors.push(`${at}.mastery is required`);
  }

  const activityIds = new Set();
  for (const [index, activity] of activities.entries()) {
    const at = `activities[${index}]`;
    if (!isObject(activity)) { errors.push(`${at} must be an object`); continue; }
    if (typeof activity.id !== 'string' || !activity.id.trim()) errors.push(`${at}.id is required`);
    else if (activityIds.has(activity.id)) errors.push(`${at}.id must be unique`);
    else activityIds.add(activity.id);
    if (!SUPPORTED_ACTIVITY_TYPES.has(activity.type)) errors.push(`${at}.type is unsupported`);
    if (!claimIds.has(activity.claimId)) errors.push(`${at}.claimId must reference a claim`);
    if (!SUPPORTED_STAGES.has(activity.stage)) errors.push(`${at}.stage is unsupported`);
    if (typeof activity.prompt !== 'string' || !activity.prompt.trim()) errors.push(`${at}.prompt is required`);
    if (!Array.isArray(activity.sourceRefs) || activity.sourceRefs.length === 0) errors.push(`${at}.sourceRefs is required`);
    if (!isObject(activity.feedback) || typeof activity.feedback.correct !== 'string' || typeof activity.feedback.incorrect !== 'string') {
      errors.push(`${at}.feedback.correct and feedback.incorrect are required`);
    }
    if (!Array.isArray(activity.hints)) errors.push(`${at}.hints must be an array`);

    if (activity.type === 'single-choice' || activity.type === 'multiple-choice') {
      if (!Array.isArray(activity.options) || activity.options.length < 2) errors.push(`${at}.options must contain at least two options`);
      const optionIds = new Set();
      for (const option of Array.isArray(activity.options) ? activity.options : []) {
        if (!isObject(option) || typeof option.id !== 'string' || typeof option.label !== 'string') errors.push(`${at}.options require id and label`);
        else if (optionIds.has(option.id)) errors.push(`${at}.option ids must be unique`);
        else optionIds.add(option.id);
      }
      if (activity.type === 'single-choice' && !optionIds.has(activity.correctOptionId)) errors.push(`${at}.correctOptionId must reference an option`);
      if (activity.type === 'multiple-choice') {
        if (!Array.isArray(activity.correctOptionIds) || activity.correctOptionIds.length === 0) errors.push(`${at}.correctOptionIds is required`);
        else if (activity.correctOptionIds.some((id) => !optionIds.has(id))) errors.push(`${at}.correctOptionIds must reference options`);
      }
    }

    if (activity.type === 'fill-blank') {
      if (!Array.isArray(activity.acceptedAnswers) || activity.acceptedAnswers.length === 0) errors.push(`${at}.acceptedAnswers is required`);
    }

    if (activity.type === 'ordering') {
      const items = Array.isArray(activity.items) ? activity.items : [];
      const itemIds = new Set(items.map((item) => item && item.id));
      if (!Array.isArray(activity.items) || activity.items.length < 2) errors.push(`${at}.items must contain at least two items`);
      if (!Array.isArray(activity.correctOrder) || activity.correctOrder.length !== itemIds.size) errors.push(`${at}.correctOrder must include every item`);
      else if (activity.correctOrder.some((id) => !itemIds.has(id))) errors.push(`${at}.correctOrder contains an unknown item`);
    }

    if (activity.type === 'short-answer') {
      const scoring = activity.scoring || {};
      const hasAccepted = Array.isArray(activity.acceptedAnswers) && activity.acceptedAnswers.length > 0;
      const hasKeywords = Array.isArray(scoring.requiredKeywords) && scoring.requiredKeywords.length > 0;
      if (scoring.mode !== 'completion' && !hasAccepted && !hasKeywords) errors.push(`${at} needs acceptedAnswers, requiredKeywords, or completion scoring`);
    }
  }

  return { ok: errors.length === 0, errors };
}

function selectMisconception(activity, response) {
  if (activity.type !== 'single-choice') return null;
  const options = Array.isArray(activity.options) ? activity.options : [];
  const misconceptions = Array.isArray(activity.misconceptions) ? activity.misconceptions : [];
  const option = options.find((item) => item && item.id === response);
  if (!option || !option.misconceptionId) return null;
  return misconceptions.find((item) => item && item.id === option.misconceptionId) || null;
}

function scoreActivity(activity, response) {
  activity = normalizeActivityShape(activity);
  if (!isObject(activity)) throw new TypeError('activity is required');
  let passed = false;
  let correct = false;
  let diagnostic = null;

  if (activity.type === 'single-choice') {
    passed = String(response) === String(activity.correctOptionId);
    correct = passed;
    diagnostic = passed ? null : selectMisconception(activity, response);
  } else if (activity.type === 'multiple-choice') {
    const actual = uniqueStrings(response).sort();
    const expected = uniqueStrings(activity.correctOptionIds).sort();
    passed = actual.length === expected.length && actual.every((value, index) => value === expected[index]);
    correct = passed;
  } else if (activity.type === 'fill-blank') {
    const settings = { caseSensitive: activity.caseSensitive === true };
    const actual = normalizeText(response, settings);
    const acceptedAnswers = Array.isArray(activity.acceptedAnswers) ? activity.acceptedAnswers : [];
    passed = acceptedAnswers.some((answer) => normalizeText(answer, settings) === actual);
    correct = passed;
  } else if (activity.type === 'ordering') {
    const actual = Array.isArray(response) ? response.map(String) : [];
    const expected = (Array.isArray(activity.correctOrder) ? activity.correctOrder : []).map(String);
    passed = actual.length === expected.length && actual.every((value, index) => value === expected[index]);
    correct = passed;
  } else if (activity.type === 'short-answer') {
    const scoring = activity.scoring || {};
    const actual = normalizeText(response, { caseSensitive: scoring.caseSensitive === true });
    if (scoring.mode === 'completion') {
      passed = actual.length >= Number(scoring.minimumLength || 1);
      correct = null;
    } else if (Array.isArray(activity.acceptedAnswers) && activity.acceptedAnswers.length) {
      passed = activity.acceptedAnswers.some((answer) => normalizeText(answer, { caseSensitive: scoring.caseSensitive === true }) === actual);
      correct = passed;
    } else {
      const keywords = uniqueStrings(scoring.requiredKeywords).map((word) => normalizeText(word));
      const matched = keywords.filter((word) => actual.includes(word));
      passed = matched.length >= Number(scoring.minimumKeywords || keywords.length);
      correct = passed;
    }
  } else if (activity.type === 'recording') {
    passed = Boolean(response && response.recorded && response.reviewed);
    correct = null;
  } else {
    throw new Error(`unsupported activity type: ${activity.type}`);
  }

  const feedback = diagnostic && diagnostic.feedback
    ? diagnostic.feedback
    : passed ? activity.feedback.correct : activity.feedback.incorrect;

  return {
    passed,
    correct,
    feedback,
    misconceptionId: diagnostic ? diagnostic.id : null,
  };
}

function latestAttemptsByActivity(attempts) {
  const latest = new Map();
  for (const attempt of attempts || []) {
    if (!attempt || !attempt.activityId) continue;
    const existing = latest.get(attempt.activityId);
    if (!existing || Number(attempt.attemptNumber || 0) >= Number(existing.attemptNumber || 0)) latest.set(attempt.activityId, attempt);
  }
  return latest;
}

function computeClaimProgress(spec, attempts) {
  spec = normalizeLessonSpecShape(spec);
  const latest = latestAttemptsByActivity(attempts);
  const claims = {};
  const claimList = Array.isArray(spec && spec.claims) ? spec.claims : [];
  const activityList = Array.isArray(spec && spec.activities) ? spec.activities : [];
  for (const claim of claimList) {
    if (!isObject(claim)) continue;
    const activities = activityList.filter((activity) => isObject(activity) && activity.claimId === claim.id && activity.stage !== 'worked-example');
    const completed = activities.filter((activity) => latest.has(activity.id));
    const passed = activities.filter((activity) => latest.get(activity.id) && latest.get(activity.id).passed === true);
    const mastery = claim.mastery || {};
    const requiredPassed = Number(mastery.requiredPassed || Math.max(1, activities.length));
    const requiredStages = Array.isArray(mastery.requiredStages) ? mastery.requiredStages : [];
    const stagesSatisfied = requiredStages.every((stage) => passed.some((activity) => activity.stage === stage));
    claims[claim.id] = {
      claimId: claim.id,
      label: claim.label,
      passed: passed.length,
      completed: completed.length,
      total: activities.length,
      requiredPassed,
      mastered: passed.length >= requiredPassed && stagesSatisfied,
    };
  }
  return claims;
}

function toPublicLessonSpec(spec) {
  spec = normalizeLessonSpecShape(spec);
  if (!isObject(spec)) return { schemaVersion: null, lessonId: '', title: '', claims: [], activities: [] };
  return {
    schemaVersion: spec.schemaVersion,
    lessonId: spec.lessonId,
    title: spec.title || '',
    claims: (spec.claims || []).map((claim) => ({
      id: claim.id,
      label: claim.label,
      description: claim.description || '',
    })),
    activities: (spec.activities || []).map((activity) => {
      const publicActivity = {
        id: activity.id,
        type: activity.type,
        claimId: activity.claimId,
        stage: activity.stage,
        title: activity.title || '',
        prompt: activity.prompt,
        stimulus: activity.stimulus || null,
        options: activity.options ? activity.options.map(({ id, label }) => ({ id, label })) : undefined,
        items: activity.items || undefined,
        hints: activity.hints || [],
        ui: activity.ui || {},
      };
      return publicActivity;
    }),
  };
}

module.exports = {
  SUPPORTED_ACTIVITY_TYPES,
  normalizeLessonSpecShape,
  normalizeText,
  validateLessonSpec,
  scoreActivity,
  computeClaimProgress,
  toPublicLessonSpec,
};
