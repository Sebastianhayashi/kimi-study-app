'use strict';

const PRIVATE_DIRECTORIES = new Set([
  'assessments',
  'learning-progress',
  'learning-records',
]);

const PRIVATE_ROOT_FILES = new Set([
  'assessment-blueprint.json',
  'chat.json',
  'generation-events.jsonl',
  'generator-session.json',
  'mission-session.json',
  'job.json',
  'next-lesson-transaction.json',
  'learning-claims.json',
  'meta.json',
  'misconceptions.json',
  'notes.json',
  'onboarding.json',
  'quality-report.json',
  'question-bank.json',
  'source-profile.json',
  'tutor-session.json',
]);

function normalizeCoursePath(value) {
  return String(value || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/+/g, '/');
}

function isPrivateCoursePath(value) {
  const relative = normalizeCoursePath(value);
  if (!relative) return false;
  const [first] = relative.split('/');
  if (PRIVATE_DIRECTORIES.has(first.toLowerCase())) return true;
  return !relative.includes('/') && PRIVATE_ROOT_FILES.has(relative.toLowerCase());
}

module.exports = {
  PRIVATE_DIRECTORIES,
  PRIVATE_ROOT_FILES,
  isPrivateCoursePath,
};
