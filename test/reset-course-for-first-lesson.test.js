'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  resetCourseForFirstLesson,
  RUNTIME_FILES,
} = require('../scripts/reset-course-for-first-lesson');

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lucubro-r14-reset-'));
  const dataRoot = path.join(root, 'courses');
  const courseId = 'stonecourse';
  const courseDir = path.join(dataRoot, courseId);
  const otherDir = path.join(dataRoot, 'othercourse');
  fs.mkdirSync(courseDir, { recursive: true });
  fs.mkdirSync(otherDir, { recursive: true });
  for (const directory of ['lessons', 'assessments', 'curiosity']) {
    fs.mkdirSync(path.join(courseDir, directory));
    fs.writeFileSync(path.join(courseDir, directory, `old-${directory}.txt`), 'remove');
  }
  for (const [name, content] of Object.entries({
    'MISSION.md': '# Mission\nConfirmed',
    'RESOURCES.md': '# Resources',
    'map.json': '{"path":["old"]}',
    'source-profile.json': '{"title":"source"}',
    'cover.jpg': 'cover',
    'book.txt': 'source text',
    'mission-session.json': '{"sessionId":"session_real","initialized":true}',
    'meta.json': '{"title":"Stone"}',
  })) fs.writeFileSync(path.join(courseDir, name), content);
  writeJson(path.join(courseDir, 'onboarding.json'), {
    version: 1,
    state: 'ready',
    mission: { status: 'confirmed', confirmedAt: '2026-07-27T00:00:00.000Z' },
    inspection: { status: 'complete' },
    generation: { attempts: 3, activeRunId: 'old', readyAt: '2026-07-27T00:01:00.000Z' },
  });
  for (const name of RUNTIME_FILES) fs.writeFileSync(path.join(courseDir, name), '{}');
  fs.writeFileSync(path.join(otherDir, 'sentinel.txt'), 'untouched');
  return { root, dataRoot, courseId, courseDir, otherDir };
}

test('reset CLI refuses execution without an explicit course id', () => {
  const result = spawnSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'reset-course-for-first-lesson.js')], {
    encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /course id is required/i);
});

test('reset preserves the course contract, clears generation output, and never touches another course', () => {
  const { dataRoot, courseId, courseDir, otherDir } = fixture();
  const before = Object.fromEntries(['MISSION.md', 'RESOURCES.md', 'map.json', 'source-profile.json', 'cover.jpg', 'book.txt', 'mission-session.json', 'meta.json']
    .map((name) => [name, fs.readFileSync(path.join(courseDir, name))]));

  const result = resetCourseForFirstLesson({ dataRoot, courseId, now: new Date('2026-07-27T12:00:00.000Z') });

  for (const directory of ['lessons', 'assessments', 'curiosity']) {
    assert.deepEqual(fs.readdirSync(path.join(courseDir, directory)), []);
  }
  for (const name of RUNTIME_FILES) assert.equal(fs.existsSync(path.join(courseDir, name)), false, name);
  for (const [name, content] of Object.entries(before)) assert.deepEqual(fs.readFileSync(path.join(courseDir, name)), content, name);
  assert.equal(fs.readFileSync(path.join(otherDir, 'sentinel.txt'), 'utf8'), 'untouched');

  const onboarding = JSON.parse(fs.readFileSync(path.join(courseDir, 'onboarding.json'), 'utf8'));
  assert.equal(onboarding.state, 'awaiting_mission');
  assert.equal(onboarding.mission.status, 'confirmed');
  assert.equal(onboarding.generation.attempts, 0);
  assert.equal(onboarding.generation.activeRunId, null);
  assert.equal(result.next.ui, `/new-course?course=${courseId}`);
  assert.match(result.next.api, /\/start$/);
  assert.match(result.next.forbidden, /\/lessons\/next$/);
});

test('reset rejects missing courses and courses whose Mission is not confirmed', () => {
  const { dataRoot, courseDir } = fixture();
  assert.throws(() => resetCourseForFirstLesson({ dataRoot, courseId: 'missingcourse' }), /does not exist/);
  const onboardingFile = path.join(courseDir, 'onboarding.json');
  const onboarding = JSON.parse(fs.readFileSync(onboardingFile, 'utf8'));
  onboarding.mission.status = 'ready';
  writeJson(onboardingFile, onboarding);
  assert.throws(() => resetCourseForFirstLesson({ dataRoot, courseId: 'stonecourse' }), /must already be confirmed/);
});
