'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('Round 13 Mission confirmation is editable and still requires explicit confirmation', () => {
  const server = read('server.js');
  const client = read('public/first-run-onboarding.js');
  const page = read('public/new-course.html');
  assert.match(server, /app\.patch\('\/api\/courses\/:id\/mission'/);
  assert.match(server, /writeMissionDocument\(dirOf\(id\), mission\)/);
  assert.match(server, /onboarding\.mission\.editable = readEditableMission/);
  assert.match(client, /id = 'editMissionButton'/);
  assert.match(client, /method: 'PATCH'/);
  assert.match(client, /missionNext\.disabled = true/);
  assert.match(client, /Mission changes saved\. Review once more/);
  assert.match(client, /mission\/confirm/);
  assert.match(page, /id="missionLead"/);
  assert.match(page, /\.mission-edit-form/);
});

test('Round 13 motion has one owner, bounded stage transitions, and direct reduced-motion end states', () => {
  const landing = read('public/landing-scroll.js');
  const page = read('public/new-course.html');
  const glue = read('public/glue.js');
  assert.match(landing, /landing-native-scroll/);
  assert.doesNotMatch(landing, /new window\.Lenis/);
  assert.doesNotMatch(page, /orbitSpin/);
  assert.doesNotMatch(page, /cardCycle/);
  assert.match(page, /visual-scene\[data-visual="nodes"\]\.is-active/);
  assert.match(page, /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation: none !important/);
  assert.match(page, /@media \(prefers-reduced-motion: reduce\)[\s\S]*transition: none !important/);
  assert.match(glue, /@media \(prefers-reduced-motion:reduce\)\{\.thinking-dots i\{animation:none!important/);
});

test('Round 13 keeps feedback optional without blocking the primary next action', () => {
  const course = read('public/course.html');
  const glue = read('public/glue.js');
  const i18n = read('public/i18n.js');
  const adjustStart = glue.indexOf("if (e.target.closest('#adjustNextLessonButton'))");
  const primaryStart = glue.indexOf("if (e.target.closest('#nextLessonButton'))", adjustStart);
  assert.match(course, /id="adjustNextLessonButton"/);
  assert.ok(adjustStart >= 0 && primaryStart > adjustStart);
  assert.match(glue.slice(adjustStart, primaryStart), /collectLessonFeedbackBeforeNext/);
  assert.match(glue.slice(primaryStart, primaryStart + 300), /nextLesson\(\);/);
  assert.doesNotMatch(glue.slice(primaryStart, primaryStart + 300), /openLessonFeedbackSheet/);
  assert.match(i18n, /\['Adjust next lesson', '调整下一课', '次のレッスンを調整'\]/);
});

test('Round 13 new visible Mission strings are present in all three locales', () => {
  const i18n = read('public/i18n.js');
  for (const key of [
    'Review and correct the mission before creating the course.',
    'Edit mission',
    'Mission title',
    'Problem statement',
    'Expected output',
    'Success evidence',
    'Constraints',
    'Out of scope',
    'Save changes',
    'Cancel editing',
  ]) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(i18n, new RegExp(`\\['${escaped}',\\s*'[^']+',\\s*'[^']+'\\]`));
  }
});
