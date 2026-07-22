'use strict';

const { readNextLessonTransaction } = require('./next-lesson');
const { validateNextLessonDelta } = require('./lesson-publish-validator');

function preflightNextLesson(courseDir = process.cwd()) {
  const transaction = readNextLessonTransaction(courseDir);
  if (!transaction) {
    return {
      ok: false,
      errors: ['next-lesson transaction baseline is missing'],
      newLesson: null,
      newAssessment: null,
      published: null,
    };
  }
  return validateNextLessonDelta(courseDir, transaction.baseline);
}

if (require.main === module) {
  const result = preflightNextLesson(process.cwd());
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exitCode = 1;
}

module.exports = {
  preflightNextLesson,
};
