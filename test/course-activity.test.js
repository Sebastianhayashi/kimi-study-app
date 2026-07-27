'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { appendCourseActivity, readCourseActivity, ActivityValidationError } = require('../lib/course-activity');
const { captureNextLessonBaseline, changedExistingWorkspaceFiles } = require('../lib/next-lesson');

test('course activity helper preserves lesson behavior and validates artifact events', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lucubro-activity-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  let time = 1000;
  const options = { validateLesson: (file) => file === '0001-one.html' ? file : null, now: () => time++, randomUUID: () => `id-${time}` };
  const opened = appendCourseActivity(dir, { type: 'lesson-opened', lessonFile: '0001-one.html' }, options);
  assert.equal(opened.appended, true);
  assert.equal(appendCourseActivity(dir, { type: 'lesson-opened', lessonFile: '0001-one.html' }, options).appended, false);
  appendCourseActivity(dir, { type: 'lesson-feedback', lessonFile: '0001-one.html', signal: 'deeper' }, options);
  const focus = appendCourseActivity(dir, {
    type: 'artifact-gap-focus', artifactId: 'a_1234567890abcdef', revisionId: 'rev_1', gapId: 'g_1',
    rubricItemId: 'r_1', gapSummary: 'Evidence is missing', sourceRefs: ['book.txt#1'], supportKind: 'next-lesson',
  }, options);
  assert.equal(focus.event.type, 'artifact-gap-focus');
  assert.equal(readCourseActivity(dir).length, 3);
  assert.throws(() => appendCourseActivity(dir, { type: 'artifact-gap-focus' }, options), ActivityValidationError);
});

test('gap focus persisted before baseline remains unchanged during generation', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lucubro-focus-baseline-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, 'lessons'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'assessments'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'lessons', '0001-one.html'), '<html>one</html>');
  fs.writeFileSync(path.join(dir, 'assessments', '0001-one.json'), '{}');
  fs.writeFileSync(path.join(dir, 'MISSION.md'), '# Mission: Test\n\n## Why\nProblem\n\n## Success looks like\n- Output\n- Evidence\n\n## Constraints\n- Local\n\n## Out of scope\n- None\n');
  appendCourseActivity(dir, {
    type: 'artifact-gap-focus', artifactId: 'a_1234567890abcdef', revisionId: 'rev_1', gapId: 'g_1',
    rubricItemId: 'r_1', gapSummary: 'Evidence is missing', sourceRefs: ['book.txt#1'], supportKind: 'next-lesson',
  });
  const baseline = captureNextLessonBaseline(dir);
  assert.deepEqual(changedExistingWorkspaceFiles(dir, baseline), []);
  appendCourseActivity(dir, { type: 'artifact-revision', artifactId: 'a_1234567890abcdef', revisionId: 'rev_2', trigger: 'manual' });
  assert.deepEqual(changedExistingWorkspaceFiles(dir, baseline), ['learning-activity.json']);
});
