#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_DATA_ROOT = path.join(ROOT, 'data', 'courses');
const RESET_DIRECTORIES = ['lessons', 'assessments', 'curiosity'];
const RUNTIME_FILES = [
  'job.json',
  'next-lesson-transaction.json',
  'generator-session.json',
  'generation-events.jsonl',
  'operation.json',
  'operation.json.lock',
];

function fail(message) {
  const error = new Error(message);
  error.code = 'RESET_COURSE_INVALID';
  return error;
}

function parseArgs(argv) {
  const args = { courseId: '', dataRoot: process.env.LUCUBRO_DATA_DIR || DEFAULT_DATA_ROOT };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--course') args.courseId = argv[++index] || '';
    else if (token === '--data-dir') args.dataRoot = argv[++index] || '';
    else if (token === '--help' || token === '-h') args.help = true;
    else throw fail(`Unknown argument: ${token}`);
  }
  return args;
}

function safeCourseDir(dataRoot, courseId) {
  if (!courseId) throw fail('A course id is required. Use --course <id>.');
  if (!/^[a-z0-9]+$/i.test(courseId)) throw fail('Course id must contain only letters and numbers.');
  const root = path.resolve(String(dataRoot || ''));
  const courseDir = path.resolve(root, courseId);
  if (!courseDir.startsWith(`${root}${path.sep}`)) throw fail('Course path escapes the data directory.');
  const stat = fs.existsSync(courseDir) ? fs.statSync(courseDir) : null;
  if (!stat || !stat.isDirectory()) throw fail(`Course does not exist: ${courseId}`);
  return { root, courseDir };
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { throw fail(`Required JSON is missing or invalid: ${path.basename(file)}`); }
}

function writeJsonAtomic(file, value) {
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(temporary, file);
}

function clearDirectoryContents(directory) {
  fs.mkdirSync(directory, { recursive: true });
  const removed = [];
  for (const name of fs.readdirSync(directory)) {
    fs.rmSync(path.join(directory, name), { recursive: true, force: true });
    removed.push(name);
  }
  return removed.sort();
}

function resetCourseForFirstLesson({ dataRoot = DEFAULT_DATA_ROOT, courseId, now = new Date() }) {
  const { courseDir } = safeCourseDir(dataRoot, courseId);
  const missionFile = path.join(courseDir, 'MISSION.md');
  if (!fs.existsSync(missionFile) || !fs.statSync(missionFile).isFile()) {
    throw fail('MISSION.md is required before resetting first-lesson generation.');
  }

  const onboardingFile = path.join(courseDir, 'onboarding.json');
  const onboarding = readJson(onboardingFile);
  if (onboarding?.mission?.status !== 'confirmed') {
    throw fail('The course Mission must already be confirmed.');
  }

  const removed = {};
  for (const directory of RESET_DIRECTORIES) {
    removed[directory] = clearDirectoryContents(path.join(courseDir, directory));
  }
  removed.runtime = [];
  for (const name of RUNTIME_FILES) {
    const file = path.join(courseDir, name);
    if (!fs.existsSync(file)) continue;
    fs.rmSync(file, { recursive: true, force: true });
    removed.runtime.push(name);
  }

  const updatedAt = (now instanceof Date ? now : new Date(now)).toISOString();
  const resetOnboarding = {
    ...onboarding,
    state: 'awaiting_mission',
    updatedAt,
    mission: {
      ...onboarding.mission,
      status: 'confirmed',
    },
    generation: {
      ...(onboarding.generation || {}),
      attempts: 0,
      activeRunId: null,
      startedAt: null,
      readyAt: null,
      failedAt: null,
      errorCode: null,
      errorMessage: null,
    },
  };
  writeJsonAtomic(onboardingFile, resetOnboarding);

  return {
    courseId,
    courseDir,
    removed,
    preserved: [
      'MISSION.md', 'RESOURCES.md', 'map.json', 'source-profile.json', 'cover.*', 'book.*',
      'mission-session.json', 'meta.json', 'onboarding.json',
    ],
    next: {
      ui: `/new-course?course=${encodeURIComponent(courseId)}`,
      api: `POST /api/courses/${encodeURIComponent(courseId)}/start`,
      forbidden: `POST /api/courses/${encodeURIComponent(courseId)}/lessons/next`,
    },
  };
}

function usage() {
  return [
    'Usage: node scripts/reset-course-for-first-lesson.js --course <id> [--data-dir <path>]',
    '',
    'Resets only the selected confirmed-Mission course to “first lesson not generated”.',
  ].join('\n');
}

if (require.main === module) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      process.stdout.write(`${usage()}\n`);
      process.exit(0);
    }
    const result = resetCourseForFirstLesson(args);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.stdout.write(`\nNext: open ${result.next.ui}, or call ${result.next.api}.\n`);
    process.stdout.write(`Do not call ${result.next.forbidden}; it rejects courses with no first lesson.\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n\n${usage()}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  DEFAULT_DATA_ROOT,
  RESET_DIRECTORIES,
  RUNTIME_FILES,
  parseArgs,
  resetCourseForFirstLesson,
  safeCourseDir,
};
