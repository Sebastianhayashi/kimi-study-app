'use strict';

const fs = require('fs');
const path = require('path');
const { validateLessonSpec } = require('./activity-engine');
const { validateCuriosityDocument } = require('./curiosity-contract');
const { auditAssessmentQuality } = require('./assessment-quality-gate');
const {
  assessmentsIn,
  changedExistingWorkspaceFiles,
  fileDigest,
  lessonsIn,
  removeNewWorkspaceFiles,
  workspaceFileSnapshot,
} = require('./next-lesson');

const EVIDENCE_STAGES = new Set(['independent', 'transfer', 'exit-ticket']);
const PRIVATE_ANSWER_KEY = /["']?(?:correctOptionId|correctOptionIds|acceptedAnswers|correctOrder)["']?\s*:/i;

function safeTextFile(file) {
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0) return null;
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function readJson(file) {
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function mountedActivityIds(html) {
  const ids = [];
  const pattern = /data-kimi-activity\s*=\s*["']([^"']+)["']/gi;
  let match;
  while ((match = pattern.exec(html))) ids.push(match[1].trim());
  return ids.filter(Boolean);
}

function validatePublishedLesson(courseDir, lessonFile) {
  const errors = [];
  const lessonPath = path.join(courseDir, 'lessons', lessonFile);
  const base = String(lessonFile || '').replace(/\.html$/i, '');
  const assessmentPath = path.join(courseDir, 'assessments', `${base}.json`);
  const html = safeTextFile(lessonPath);
  const spec = readJson(assessmentPath);

  if (!html) errors.push(`lesson is missing, unreadable, empty, or a symlink: ${lessonFile}`);
  if (!spec) errors.push(`assessment is missing or invalid JSON: ${base}.json`);

  if (spec) {
    const validation = validateLessonSpec(spec);
    if (!validation.ok) errors.push(...validation.errors.map((item) => `assessment: ${item}`));
    const quality = auditAssessmentQuality(spec);
    if (!quality.ok) errors.push(...quality.blockers.map((item) => `assessment quality: ${item}`));
    if (spec.lessonId !== base) errors.push(`assessment.lessonId must equal ${base}`);
  }

  const curiosityPath = path.join(courseDir, 'curiosity', `${base}.json`);
  if (fs.existsSync(curiosityPath)) {
    const curiosity = readJson(curiosityPath);
    const curiosityValidation = validateCuriosityDocument(curiosity);
    if (!curiosityValidation.ok) errors.push(...curiosityValidation.errors.map((item) => `curiosity: ${item}`));
    if (curiosityValidation.document.lessonId && curiosityValidation.document.lessonId !== base) {
      errors.push(`curiosity.lessonId must equal ${base}`);
    }
  }

  if (html) {
    if (PRIVATE_ANSWER_KEY.test(html)) errors.push('lesson HTML contains a private answer-key field');
    const mounts = mountedActivityIds(html);
    const uniqueMounts = new Set(mounts);
    if (!mounts.length) errors.push('lesson HTML contains no data-kimi-activity mount');
    if (uniqueMounts.size !== mounts.length) errors.push('lesson HTML contains duplicate activity mounts');

    if (spec && Array.isArray(spec.activities)) {
      const activityIds = spec.activities.map((activity) => activity.id);
      const activitySet = new Set(activityIds);
      for (const id of uniqueMounts) {
        if (!activitySet.has(id)) errors.push(`HTML mount has no matching activity: ${id}`);
      }
      for (const id of activitySet) {
        if (!uniqueMounts.has(id)) errors.push(`assessment activity is not mounted in HTML: ${id}`);
      }
      const evidence = spec.activities.some((activity) => EVIDENCE_STAGES.has(activity.stage));
      if (!evidence) errors.push('assessment has no independent, transfer, or exit-ticket evidence activity');
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    lessonFile,
    assessmentFile: `${base}.json`,
  };
}

function cleanupNextLessonDelta(courseDir, baseline) {
  const changedExisting = changedExistingWorkspaceFiles(courseDir, baseline);
  const removed = removeNewWorkspaceFiles(courseDir, baseline);
  return { removed, changedExisting };
}

function validateNextLessonDelta(courseDir, baseline) {
  const errors = [];
  const lessons = lessonsIn(courseDir);
  const assessments = assessmentsIn(courseDir);
  const oldLessons = new Set(baseline.lessons || []);
  const oldAssessments = new Set(baseline.assessments || []);
  const newLessons = lessons.filter((name) => !oldLessons.has(name));
  const newAssessments = assessments.filter((name) => !oldAssessments.has(name));

  for (const name of oldLessons) {
    if (!lessons.includes(name)) errors.push(`existing lesson was removed: ${name}`);
  }
  for (const name of oldAssessments) {
    if (!assessments.includes(name)) errors.push(`existing assessment was removed: ${name}`);
  }
  if (newLessons.length !== 1) errors.push(`expected exactly one new lesson, found ${newLessons.length}`);
  if (newAssessments.length !== 1) errors.push(`expected exactly one new assessment, found ${newAssessments.length}`);

  const expectedPrefix = `${String(baseline.expectedLessonNumber).padStart(4, '0')}-`;
  if (newLessons[0] && !newLessons[0].startsWith(expectedPrefix)) {
    errors.push(`new lesson must start with ${expectedPrefix}`);
  }
  if (newLessons[0] && newAssessments[0]) {
    const lessonBase = newLessons[0].replace(/\.html$/i, '');
    const assessmentBase = newAssessments[0].replace(/\.json$/i, '');
    if (lessonBase !== assessmentBase) errors.push('new lesson and assessment basenames do not match');
  }

  const baselineWorkspace = baseline.workspaceFiles || {};
  const currentWorkspace = workspaceFileSnapshot(courseDir);
  for (const [relative, expected] of Object.entries(baselineWorkspace)) {
    if (currentWorkspace[relative] !== expected) errors.push(`existing workspace file changed: ${relative}`);
  }

  const allowedNew = new Set();
  if (newLessons.length === 1) allowedNew.add(`lessons/${newLessons[0]}`);
  if (newAssessments.length === 1) allowedNew.add(`assessments/${newAssessments[0]}`);
  if (newLessons.length === 1) {
    const curiosityRelative = `curiosity/${newLessons[0].replace(/\.html$/i, '')}.json`;
    if (Object.prototype.hasOwnProperty.call(currentWorkspace, curiosityRelative)) allowedNew.add(curiosityRelative);
  }
  for (const relative of Object.keys(currentWorkspace)) {
    if (Object.prototype.hasOwnProperty.call(baselineWorkspace, relative)) continue;
    if (!allowedNew.has(relative)) errors.push(`unexpected new workspace file: ${relative}`);
  }

  if (!Object.keys(baselineWorkspace).length) {
    for (const [relative, expected] of Object.entries(baseline.protectedFiles || {})) {
      const actual = fileDigest(path.join(courseDir, relative));
      if (actual !== expected) errors.push(`protected existing file changed: ${relative}`);
    }
  }

  let published = null;
  if (newLessons.length === 1 && newAssessments.length === 1) {
    published = validatePublishedLesson(courseDir, newLessons[0]);
    errors.push(...published.errors);
  }

  return {
    ok: errors.length === 0,
    errors,
    newLesson: newLessons.length === 1 ? newLessons[0] : null,
    newAssessment: newAssessments.length === 1 ? newAssessments[0] : null,
    published,
  };
}

module.exports = {
  EVIDENCE_STAGES,
  PRIVATE_ANSWER_KEY,
  mountedActivityIds,
  cleanupNextLessonDelta,
  validatePublishedLesson,
  validateNextLessonDelta,
};
