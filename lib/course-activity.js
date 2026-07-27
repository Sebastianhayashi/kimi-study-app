'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const FEEDBACK_SIGNALS = new Set(['aligned', 'skip_irrelevant', 'faster', 'deeper']);
const CRITIQUE_ACTIONS = new Set(['proposed', 'accepted', 'rejected', 'modified']);
const REVISION_TRIGGERS = new Set(['manual', 'critique-cycle', 'ready', 'delivered']);
const SUPPORT_KINDS = new Set(['next-lesson', 'source', 'tutor', 'direct-revision']);

class ActivityValidationError extends Error {
  constructor(message, code = 'ACTIVITY_INVALID') {
    super(message);
    this.name = 'ActivityValidationError';
    this.code = code;
    this.status = 400;
  }
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}

function writeJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
}

function text(value, max, field, { optional = false } = {}) {
  const normalized = String(value == null ? '' : value).trim();
  if (!normalized && !optional) throw new ActivityValidationError(`${field} is required`);
  if (normalized.length > max) throw new ActivityValidationError(`${field} is too long`);
  return normalized;
}

function ids(value, max = 20) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => text(item, 240, 'list item')).slice(0, max);
}

function validateArtifactEvent(input) {
  const type = text(input && input.type, 60, 'type');
  const base = {
    type,
    artifactId: text(input.artifactId, 80, 'artifactId'),
    revisionId: text(input.revisionId, 80, 'revisionId'),
  };
  if (type === 'artifact-critique') {
    const action = text(input.action, 20, 'action');
    if (!CRITIQUE_ACTIONS.has(action)) throw new ActivityValidationError('invalid critique action');
    const event = {
      ...base,
      critiqueId: text(input.critiqueId, 80, 'critiqueId'),
      action,
      ...(input.gapId ? { gapId: text(input.gapId, 80, 'gapId') } : {}),
    };
    if (action === 'proposed') {
      return {
        ...event,
        gapId: text(input.gapId, 80, 'gapId'),
        rubricItemId: text(input.rubricItemId, 80, 'rubricItemId'),
        summary: text(input.summary, 500, 'summary'),
        evidence: text(input.evidence, 1000, 'evidence'),
        anchorHash: text(input.anchorHash, 160, 'anchorHash'),
        sourceRefs: ids(input.sourceRefs, 8),
      };
    }
    return {
      ...event,
      ...(input.reason ? { reason: text(input.reason, 500, 'reason', { optional: true }) } : {}),
      ...(input.modifiedSummary ? { modifiedSummary: text(input.modifiedSummary, 500, 'modifiedSummary') } : {}),
    };
  }
  if (type === 'artifact-revision') {
    const trigger = text(input.trigger, 40, 'trigger');
    if (!REVISION_TRIGGERS.has(trigger)) throw new ActivityValidationError('invalid revision trigger');
    return {
      ...base,
      ...(input.parentRevisionId ? { parentRevisionId: text(input.parentRevisionId, 80, 'parentRevisionId') } : {}),
      trigger,
      acceptedCritiqueIds: ids(input.acceptedCritiqueIds, 20),
      rejectedCritiqueIds: ids(input.rejectedCritiqueIds, 20),
      resolvedGapIds: ids(input.resolvedGapIds, 20),
    };
  }
  if (type === 'artifact-gap-focus') {
    const supportKind = text(input.supportKind, 40, 'supportKind');
    if (!SUPPORT_KINDS.has(supportKind)) throw new ActivityValidationError('invalid support kind');
    return {
      ...base,
      gapId: text(input.gapId, 80, 'gapId'),
      rubricItemId: text(input.rubricItemId, 80, 'rubricItemId'),
      gapSummary: text(input.gapSummary, 500, 'gapSummary'),
      sourceRefs: ids(input.sourceRefs, 8),
      supportKind,
    };
  }
  throw new ActivityValidationError('invalid artifact activity type');
}

function readCourseActivity(courseDir) {
  const value = readJson(path.join(courseDir, 'learning-activity.json'), []);
  return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : [];
}

function appendCourseActivity(courseDir, input, {
  validateLesson = null,
  now = Date.now,
  randomUUID = crypto.randomUUID,
  maxEvents = 1000,
} = {}) {
  const type = text(input && input.type, 60, 'type');
  const events = readCourseActivity(courseDir);
  const timestamp = Number(now());
  let event;

  if (type === 'lesson-opened' || type === 'lesson-feedback') {
    const requested = text(input.lessonFile, 240, 'lessonFile');
    const lessonFile = typeof validateLesson === 'function' ? validateLesson(requested) : requested;
    if (!lessonFile) throw new ActivityValidationError('invalid lesson');
    if (type === 'lesson-feedback') {
      const signal = text(input.signal, 40, 'signal');
      if (!FEEDBACK_SIGNALS.has(signal)) throw new ActivityValidationError('invalid feedback signal');
      const detail = text(input.detail, 500, 'detail', { optional: true });
      event = { id: randomUUID(), type, lessonFile, signal, ...(detail ? { detail } : {}), timestamp };
    } else {
      const recent = events[events.length - 1];
      if (recent && recent.type === type && recent.lessonFile === lessonFile && timestamp - Number(recent.timestamp || 0) <= 30 * 60 * 1000) {
        return { appended: false, event: null, events };
      }
      event = { id: randomUUID(), type, lessonFile, timestamp };
    }
  } else {
    event = { id: randomUUID(), ...validateArtifactEvent(input), timestamp };
  }

  events.push(event);
  writeJsonAtomic(path.join(courseDir, 'learning-activity.json'), events.slice(-maxEvents));
  return { appended: true, event, events: events.slice(-maxEvents) };
}

module.exports = {
  ActivityValidationError,
  FEEDBACK_SIGNALS,
  CRITIQUE_ACTIONS,
  REVISION_TRIGGERS,
  readCourseActivity,
  appendCourseActivity,
  validateArtifactEvent,
  writeJsonAtomic,
};
