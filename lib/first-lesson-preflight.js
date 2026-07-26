'use strict';

// 首课（以及 legacy 首课路径）的本地确定性预检。
// 与 next-lesson 预检不同，首课没有 transaction baseline：
// 直接对课程目录下现有的全部 lessons/*.html 逐一跑发布验证。
// 供生成模型在写完 lessons/NNNN-*.html 与 assessments/NNNN-*.json 后自行调用，
// 与 server.js 事后 validatePublishedLesson 使用同一验证器，标准完全一致。

const fs = require('fs');
const path = require('path');
const { validatePublishedLesson } = require('./lesson-publish-validator');

function preflightFirstLesson(courseDir = process.cwd()) {
  const lessonsDir = path.join(courseDir, 'lessons');
  const lessons = fs.existsSync(lessonsDir)
    ? fs.readdirSync(lessonsDir).filter((name) => name.endsWith('.html')).sort()
    : [];
  if (!lessons.length) {
    return { ok: false, errors: ['no lesson HTML found in lessons/'], lessons: [] };
  }
  const results = lessons.map((lessonFile) => {
    const validation = validatePublishedLesson(courseDir, lessonFile);
    return {
      lesson: lessonFile,
      ok: validation.ok,
      errors: validation.errors || [],
      warnings: validation.warnings || [],
    };
  });
  const errors = results.flatMap((r) => r.errors.map((e) => `${r.lesson}: ${e}`));
  return { ok: errors.length === 0, errors, lessons: results };
}

if (require.main === module) {
  const result = preflightFirstLesson(process.cwd());
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exitCode = 1;
}

module.exports = {
  preflightFirstLesson,
};
