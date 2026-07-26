'use strict';

const fs = require('fs');
const path = require('path');

const MAX_CONTEXT_CHARS = 6500;

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function readText(file, max = 1200) {
  try {
    return String(fs.readFileSync(file, 'utf8')).trim().slice(0, max);
  } catch {
    return '';
  }
}

function clip(value, max = 240) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);
}

function jsonFiles(dir) {
  try {
    return fs.readdirSync(dir).filter((name) => name.endsWith('.json')).sort();
  } catch {
    return [];
  }
}

function recentNotes(courseDir, limit = 4) {
  const notes = readJson(path.join(courseDir, 'notes.json'), []);
  return (Array.isArray(notes) ? notes : [])
    .filter((note) => note && typeof note === 'object')
    .sort((a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0))
    .slice(0, limit)
    .map((note) => {
      const parts = [];
      if (note.section) parts.push(`位置：${clip(note.section, 80)}`);
      const exact = note.anchor && (note.anchor.exact || note.anchor.textQuote?.exact);
      if (exact) parts.push(`原文：${clip(exact, 180)}`);
      if (note.custom) parts.push(`用户笔记：${clip(note.custom, 240)}`);
      if (note.question) parts.push(`用户曾问：${clip(note.question, 180)}`);
      return parts.join('；');
    })
    .filter(Boolean);
}

function learningSignals(courseDir) {
  const progressDir = path.join(courseDir, 'learning-progress');
  const assessmentDir = path.join(courseDir, 'assessments');
  const mastered = new Map();
  const weak = [];

  for (const name of jsonFiles(progressDir)) {
    const progress = readJson(path.join(progressDir, name), {});
    const spec = readJson(path.join(assessmentDir, name), {});
    const claims = new Map((spec.claims || []).map((claim) => [claim.id, claim]));
    const activities = new Map((spec.activities || []).map((activity) => [activity.id, activity]));

    for (const item of Object.values(progress.mastery || {})) {
      if (!item || !item.mastered) continue;
      const label = item.label || claims.get(item.claimId)?.label || item.claimId;
      if (label) mastered.set(item.claimId || label, clip(label, 160));
    }

    const attempts = Array.isArray(progress.attempts) ? progress.attempts : [];
    const latest = new Map();
    const failures = new Map();
    for (const attempt of attempts) {
      if (!attempt || !attempt.activityId) continue;
      const current = latest.get(attempt.activityId);
      if (!current || Number(attempt.attemptNumber || 0) >= Number(current.attemptNumber || 0)) {
        latest.set(attempt.activityId, attempt);
      }
      if (attempt.passed === false) failures.set(attempt.activityId, Number(failures.get(attempt.activityId) || 0) + 1);
    }

    for (const attempt of latest.values()) {
      if (attempt.passed !== false) continue;
      const activity = activities.get(attempt.activityId) || {};
      const claim = claims.get(attempt.claimId || activity.claimId) || {};
      const misconception = (activity.misconceptions || []).find((item) => item.id === attempt.misconceptionId);
      weak.push({
        failures: failures.get(attempt.activityId) || 1,
        submittedAt: attempt.submittedAt || '',
        claim: clip(claim.label || attempt.claimId || activity.claimId || '未命名学习目标', 160),
        activity: clip(activity.prompt || '', 180),
        misconception: clip(misconception?.feedback || attempt.misconceptionId || '', 180),
      });
    }
  }

  weak.sort((a, b) => b.failures - a.failures || String(b.submittedAt).localeCompare(String(a.submittedAt)));
  return {
    mastered: [...mastered.values()].slice(0, 8),
    weak: weak.slice(0, 6),
  };
}

function recentLessonFeedback(courseDir, limit = 5) {
  const activity = readJson(path.join(courseDir, 'learning-activity.json'), []);
  const latestByLesson = new Map();
  for (const event of Array.isArray(activity) ? activity : []) {
    if (!event || event.type !== 'lesson-feedback') continue;
    const lessonFile = clip(event.lessonFile, 180);
    const signal = clip(event.signal, 40);
    const timestamp = Number(event.timestamp || 0);
    if (!lessonFile || !['aligned', 'skip_irrelevant', 'faster', 'deeper'].includes(signal)) continue;
    const current = latestByLesson.get(lessonFile);
    if (!current || timestamp >= current.timestamp) {
      latestByLesson.set(lessonFile, {
        lessonFile,
        signal,
        detail: clip(event.detail, 240),
        timestamp,
      });
    }
  }

  return [...latestByLesson.values()]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, Math.max(1, Math.min(5, Number(limit) || 5)))
    .map((event) => {
      const assessmentName = event.lessonFile.replace(/\.html$/i, '.json');
      const spec = readJson(path.join(courseDir, 'assessments', assessmentName), {});
      const claim = Array.isArray(spec.claims) ? spec.claims[0] : null;
      const sourceRefs = new Set();
      for (const ref of claim?.sourceRefs || []) if (ref) sourceRefs.add(clip(ref, 120));
      for (const activityItem of Array.isArray(spec.activities) ? spec.activities : []) {
        for (const ref of activityItem?.sourceRefs || []) if (ref) sourceRefs.add(clip(ref, 120));
      }
      return {
        ...event,
        claim: clip(claim?.label || '', 160),
        sourceRefs: [...sourceRefs].slice(0, 4),
      };
    });
}

function buildTutorContext(courseDir, requestContext = {}) {
  const sections = [];
  const lesson = clip(requestContext.lesson, 160);
  const section = clip(requestContext.section, 120);
  const selectedText = clip(requestContext.selectedText, 700);
  const surrounding = clip(requestContext.surrounding, 900);
  const mission = readText(path.join(courseDir, 'MISSION.md'), 1400);
  const notes = recentNotes(courseDir);
  const signals = learningSignals(courseDir);
  const feedback = recentLessonFeedback(courseDir);

  if (lesson || section) {
    sections.push(`【当前学习位置】\n${[lesson, section].filter(Boolean).join(' · ')}`);
  }
  if (selectedText) {
    sections.push(`【本次选中的课程原文】\n${selectedText}${surrounding ? `\n相关段落：${surrounding}` : ''}`);
  }
  if (mission) sections.push(`【用户学习目标】\n${mission}`);
  if (feedback.length) {
    sections.push(`【最近课节反馈】\n${feedback.map((item) => {
      const identity = [item.lessonFile, item.claim ? `claim: ${item.claim}` : '', item.sourceRefs.length ? `sourceRefs: ${item.sourceRefs.join(', ')}` : '']
        .filter(Boolean)
        .join(' / ');
      return `- ${identity}: ${item.signal}${item.detail ? `\n  说明：${item.detail}` : ''}`;
    }).join('\n')}`);
    const latestPace = feedback.find((item) => item.signal === 'faster' || item.signal === 'deeper');
    if (latestPace) sections.push(`【最新节奏偏好】\n- ${latestPace.signal}（显式，来自 ${latestPace.lessonFile}）`);
  }
  if (signals.mastered.length) sections.push(`【已掌握】\n${signals.mastered.map((item) => `- ${item}`).join('\n')}`);
  if (signals.weak.length) {
    sections.push(`【当前薄弱点】\n${signals.weak.map((item) => {
      const detail = [
        `${item.claim}（最近累计失败 ${item.failures} 次）`,
        item.activity ? `题目：${item.activity}` : '',
        item.misconception ? `表现：${item.misconception}` : '',
      ].filter(Boolean).join('；');
      return `- ${detail}`;
    }).join('\n')}`);
  }
  if (notes.length) sections.push(`【近期记录】\n${notes.map((item) => `- ${item}`).join('\n')}`);

  return sections.join('\n\n').slice(0, MAX_CONTEXT_CHARS);
}

function buildTutorPrompt({ courseDir, message, context = {} }) {
  const learnerContext = buildTutorContext(courseDir, context);
  return [
    '你是这门课程的右侧导师。先解决用户此刻的问题，再决定是否需要追问。',
    '下面的学习者上下文由后端从课程记录中确定性整理。只在与本次问题相关时自然使用，不要逐项复述，也不要声称自己看到了后台文件。',
    '不要泄露 assessments 中的答案键、评分键或未公开题目数据。',
    '<learner-context>',
    learnerContext || '当前没有可用的学习记录。',
    '</learner-context>',
    '<user-question>',
    clip(message, 4000),
    '</user-question>',
  ].join('\n');
}

function withHumanizerSkill(prompt, initialized) {
  return initialized ? prompt : `/skill:humanizer-zh\n\n${prompt}`;
}

function normalizeTutorSessionState(value) {
  const source = value && typeof value === 'object' ? value : {};
  const sessionId = typeof source.sessionId === 'string' && /^session_[a-z0-9_-]+$/i.test(source.sessionId.trim())
    ? source.sessionId.trim()
    : null;
  const preferredMode = ['wire', 'stream-json', 'text'].includes(source.preferredMode)
    ? source.preferredMode
    : 'stream-json';
  return {
    schemaVersion: 1,
    sessionId,
    initialized: Boolean(source.initialized && sessionId),
    preferredMode,
  };
}

function createTutorSessionState() {
  return normalizeTutorSessionState(null);
}

function isTutorSessionMissingError(error) {
  const message = String(error && error.message || error || '');
  return /session(?:\s+|[^a-z0-9]+).*(?:not found|missing|unknown|does not exist|invalid)/i.test(message)
    || /(?:not found|missing|unknown|does not exist|invalid).*session/i.test(message);
}

module.exports = {
  MAX_CONTEXT_CHARS,
  recentLessonFeedback,
  buildTutorContext,
  buildTutorPrompt,
  withHumanizerSkill,
  createTutorSessionState,
  normalizeTutorSessionState,
  isTutorSessionMissingError,
};
