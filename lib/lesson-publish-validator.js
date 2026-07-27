'use strict';

const fs = require('fs');
const path = require('path');
const { normalizeLessonSpecShape, validateLessonSpec } = require('./activity-engine');
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

function workedExampleMarkers(html) {
  const source = String(html || '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  const examples = source.match(/<[a-z][^>]*\sdata-worked-example(?!-)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?(?=[\s>])[^>]*>/gi) || [];
  const steps = source.match(/<[a-z][^>]*\sdata-worked-example-step(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?(?=[\s>])[^>]*>/gi) || [];
  return { examples: examples.length, steps: steps.length };
}

function textContentOf(html) {
  return String(html || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function semanticRubricWarnings(html, spec) {
  const warnings = [];
  const lessonText = textContentOf(html);
  if (!/(?:为什么|机制|规则|判断依据|何时失效|边界|条件|因果|why|mechanism|rule|criterion|boundary|condition|when it fails|なぜ|仕組み|規則|判断基準|境界|条件)/i.test(lessonText)) {
    warnings.push('rubric R3 semantic review: lesson may not explain a rule, mechanism, judgment criterion, or boundary');
  }
  const transfer = Array.isArray(spec?.activities)
    ? spec.activities.find((activity) => activity?.type === 'short-answer' && activity?.stage === 'transfer')
    : null;
  const transferText = [transfer?.title, transfer?.prompt, transfer?.stimulus].filter(Boolean).join(' ');
  if (transfer && !/(?:新的|另一|不同|现实|真实|当前项目|你的|实际|new|another|different|real-world|your\s|current project|別の|異なる|現実|実際|あなたの)/i.test(transferText)) {
    warnings.push('rubric R6 semantic review: transfer surface-context change is not explicit');
  }
  if (!/(?:第一步|立即|现在就|接下来|下一步|推进|真实产出|草稿|修订|行动|first step|do now|next step|advance|output|draft|revision|action|最初の一歩|次の一歩|成果物|下書き|修正|行動)/i.test(lessonText)) {
    warnings.push('rubric C6 semantic review: lesson does not visibly connect this step to the learner’s real output or immediate action');
  }
  return warnings;
}

function latestLessonFeedback(courseDir) {
  const events = readJson(path.join(courseDir, 'learning-activity.json'));
  if (!Array.isArray(events)) return null;
  return events
    .filter((event) => event && event.type === 'lesson-feedback' && ['aligned', 'skip_irrelevant', 'faster', 'deeper'].includes(event.signal))
    .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0))[0] || null;
}

function sourceRefsOf(spec) {
  const refs = new Set();
  for (const claim of Array.isArray(spec?.claims) ? spec.claims : []) {
    for (const ref of Array.isArray(claim?.sourceRefs) ? claim.sourceRefs : []) if (String(ref || '').trim()) refs.add(String(ref).trim());
  }
  for (const activity of Array.isArray(spec?.activities) ? spec.activities : []) {
    for (const ref of Array.isArray(activity?.sourceRefs) ? activity.sourceRefs : []) if (String(ref || '').trim()) refs.add(String(ref).trim());
  }
  return refs;
}

function repeatsSkippedNeighborhood(courseDir, spec, feedback) {
  if (!feedback || feedback.signal !== 'skip_irrelevant') return false;
  const priorBase = String(feedback.lessonFile || '').replace(/\.html$/i, '');
  const prior = readJson(path.join(courseDir, 'assessments', `${priorBase}.json`));
  if (!prior) return false;
  const priorSpec = normalizeLessonSpecShape(prior);
  const previousLabels = new Set((priorSpec.claims || []).map((claim) => String(claim?.label || '').replace(/\s+/g, ' ').trim().toLowerCase()).filter(Boolean));
  const nextLabels = new Set((spec.claims || []).map((claim) => String(claim?.label || '').replace(/\s+/g, ' ').trim().toLowerCase()).filter(Boolean));
  if ([...nextLabels].some((label) => previousLabels.has(label))) return true;
  const previousRefs = sourceRefsOf(priorSpec);
  return [...sourceRefsOf(spec)].some((ref) => previousRefs.has(ref));
}

function validatePublishedLesson(courseDir, lessonFile) {
  const errors = [];
  const warnings = [];
  const lessonPath = path.join(courseDir, 'lessons', lessonFile);
  const base = String(lessonFile || '').replace(/\.html$/i, '');
  const assessmentPath = path.join(courseDir, 'assessments', `${base}.json`);
  const html = safeTextFile(lessonPath);
  const rawSpec = readJson(assessmentPath);
  const spec = rawSpec ? normalizeLessonSpecShape(rawSpec) : null;
  const latestFeedback = latestLessonFeedback(courseDir);

  if (!html) errors.push(`lesson is missing, unreadable, empty, or a symlink: ${lessonFile}`);
  if (!spec) errors.push(`assessment is missing or invalid JSON: ${base}.json`);

  if (spec) {
    const validation = validateLessonSpec(spec);
    if (!validation.ok) errors.push(...validation.errors.map((item) => `assessment: ${item}`));
    const curiosityPath = path.join(courseDir, 'curiosity', `${base}.json`);
    const quality = auditAssessmentQuality(spec, {
      latestFeedback,
      curiosityPresent: fs.existsSync(curiosityPath),
      repeatsSkippedNeighborhood: repeatsSkippedNeighborhood(courseDir, spec, latestFeedback),
    });
    if (!quality.ok) errors.push(...quality.blockers.map((item) => `assessment quality: ${item}`));
    warnings.push(...quality.warnings.map((item) => `assessment quality warning: ${item}`));
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
    const worked = workedExampleMarkers(html);
    if (worked.examples < 1) errors.push('lesson HTML must contain a data-worked-example marker');
    if (worked.steps < 2) errors.push('lesson HTML worked example must contain at least two data-worked-example-step markers');
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
    warnings.push(...semanticRubricWarnings(html, spec));
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    axes: {
      sourceGrounding: {
        status: spec && sourceRefsOf(spec).size > 0 ? 'pass' : 'warning',
        warnings: spec && sourceRefsOf(spec).size > 0 ? [] : ['no sourceRefs were available for the source-grounding axis'],
      },
      missionOutputAlignment: {
        status: warnings.some((item) => item.includes('axis-b')) ? 'warning' : 'pass',
        warnings: warnings.filter((item) => item.includes('axis-b')),
      },
    },
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
  workedExampleMarkers,
  semanticRubricWarnings,
  cleanupNextLessonDelta,
  validatePublishedLesson,
  validateNextLessonDelta,
};
