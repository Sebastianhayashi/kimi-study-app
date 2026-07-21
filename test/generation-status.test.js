const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { deriveGenerationStatus } = require('../lib/generation-status');

function tempCourse() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'kimi-generation-'));
}

function writeJson(root, name, value) {
  fs.writeFileSync(path.join(root, name), JSON.stringify(value));
}

test('derives progressive generation status from published artifacts', () => {
  const root = tempCourse();
  fs.writeFileSync(path.join(root, 'book.pdf'), 'fixture');
  fs.writeFileSync(path.join(root, 'RESOURCES.md'), '# resources');
  writeJson(root, 'source-profile.json', { units: [{}, {}, {}] });
  writeJson(root, 'learning-claims.json', { claims: [{}, {}] });
  writeJson(root, 'assessment-blueprint.json', { plans: [{}] });
  writeJson(root, 'question-bank.json', { questions: [{}, {}, {}, {}] });

  const status = deriveGenerationStatus(root, { stage: 'generating' }, { busy: true, lessons: 0 });
  assert.equal(status.progress, 68);
  assert.equal(status.phase, 'questions');
  assert.equal(status.canvasVariant, 'questions');
  assert.equal(status.preview.unitsFound, 3);
  assert.equal(status.preview.claimsFound, 2);
  assert.equal(status.preview.candidatesGenerated, 4);
  assert.match(status.currentMessage, /4 道候选题/);
});

test('reports ready only when the existing job is ready and a lesson exists', () => {
  const root = tempCourse();
  fs.writeFileSync(path.join(root, 'book.epub'), 'fixture');
  const status = deriveGenerationStatus(root, { stage: 'ready' }, { busy: false, lessons: 1 });
  assert.equal(status.progress, 100);
  assert.equal(status.phase, 'complete');
  assert.equal(status.canvasVariant, 'ready');
  assert.equal(status.currentMessage, '课程已准备好');
  assert.equal(status.history.at(-1).state, 'complete');
});

test('returns an honest error state without inventing progress', () => {
  const root = tempCourse();
  fs.writeFileSync(path.join(root, 'book.txt'), 'fixture');
  const status = deriveGenerationStatus(root, { stage: 'failed' }, { busy: false, lessons: 0 });
  assert.equal(status.progress, 5);
  assert.equal(status.canvasVariant, 'error');
  assert.match(status.currentMessage, /没有完成/);
  assert.ok(status.history.some((step) => step.state === 'error'));
});


test('next-lesson progress ignores old course-level artifacts and uses only the current run delta', () => {
  const root = tempCourse();
  fs.writeFileSync(path.join(root, 'RESOURCES.md'), '# old resources');
  writeJson(root, 'source-profile.json', { units: [{}, {}, {}] });
  writeJson(root, 'learning-claims.json', { claims: [{}, {}] });
  writeJson(root, 'assessment-blueprint.json', { plans: [{}] });
  writeJson(root, 'question-bank.json', { questions: [{}, {}, {}, {}] });
  writeJson(root, 'quality-report.json', { accepted: 4 });

  const job = {
    stage: 'generating',
    kind: 'next-lesson',
    phase: 'extracting',
    currentMessage: '正在读取学习记录',
    baselineLessons: 2,
    baselineAssessments: 2,
  };
  const initial = deriveGenerationStatus(root, job, { busy: true, lessons: 2, assessments: 2 });
  assert.equal(initial.progress, 20);
  assert.equal(initial.canvasVariant, 'material');
  assert.equal(initial.currentMessage, '正在读取学习记录');

  const withLesson = deriveGenerationStatus(root, { ...job, phase: 'assembling' }, {
    busy: true,
    lessons: 3,
    assessments: 2,
  });
  assert.equal(withLesson.progress, 65);
  assert.equal(withLesson.canvasVariant, 'assembly');

  const validating = deriveGenerationStatus(root, { ...job, phase: 'validating' }, {
    busy: true,
    lessons: 3,
    assessments: 3,
  });
  assert.equal(validating.progress, 92);
  assert.equal(validating.canvasVariant, 'validation');
});
