'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  MAX_SOURCE_BYTES,
  OnboardingError,
  compileMissionMarkdown,
  createCourseDraft,
  markMissionFailed,
  markMissionPlanning,
  markMissionQuestion,
  markGenerationRunning,
  markGenerationStarting,
  onboardingGenerationStage,
  readOnboarding,
  reconcileOnboarding,
  resolveMissionAnswer,
  saveMission,
  validateSourceDescriptor,
} = require('../lib/onboarding');

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'kimi-onboarding-'));
}

function tempUpload(root, name, content) {
  const file = path.join(root, name);
  fs.writeFileSync(file, content);
  return file;
}

function mission() {
  return {
    outcome: 'apply_real_scenarios',
    learningStyle: 'explain_then_practice',
    sessionLength: 'minutes_15_25',
  };
}

function createTextDraft(root, overrides = {}) {
  const content = Buffer.from('A deterministic UTF-8 learning material.\n', 'utf8');
  const upload = tempUpload(root, 'upload.tmp', content);
  return createCourseDraft({
    dataRoot: root,
    tempFile: upload,
    originalFilename: overrides.originalFilename || 'material.txt',
    mimeType: overrides.mimeType || 'text/plain',
    sizeBytes: content.length,
    title: overrides.title || 'Test material',
    now: Date.parse('2026-07-21T00:00:00.000Z'),
  });
}

test('validates supported formats, MIME and size without accepting Word files', () => {
  assert.equal(validateSourceDescriptor({
    originalFilename: 'notes.markdown',
    mimeType: 'text/markdown; charset=utf-8',
    sizeBytes: 12,
  }).storedFilename, 'book.md');

  assert.throws(() => validateSourceDescriptor({
    originalFilename: 'notes.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    sizeBytes: 12,
  }), (error) => error instanceof OnboardingError && error.code === 'UNSUPPORTED_FORMAT' && error.status === 415);

  assert.throws(() => validateSourceDescriptor({
    originalFilename: 'book.pdf',
    mimeType: 'text/plain',
    sizeBytes: 12,
  }), (error) => error.code === 'MIME_MISMATCH');

  assert.throws(() => validateSourceDescriptor({
    originalFilename: 'book.txt',
    mimeType: 'text/plain',
    sizeBytes: MAX_SOURCE_BYTES + 1,
  }), (error) => error.code === 'FILE_TOO_LARGE' && error.status === 413);
});

test('creates an isolated inspected draft and never trusts path components in the original filename', () => {
  const root = tempRoot();
  const { courseId, courseDir, record } = createTextDraft(root, {
    originalFilename: '..\\..\\unsafe.txt',
    title: ' Safe title ',
  });

  assert.match(courseId, /^[a-f0-9]{32}$/);
  assert.equal(record.state, 'awaiting_mission');
  assert.equal(record.source.originalFilename, 'unsafe.txt');
  assert.equal(record.source.storedFilename, 'book.txt');
  assert.equal(record.inspection.status, 'complete');
  assert.equal(record.source.sha256, crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(courseDir, 'book.txt'))).digest('hex'));
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(courseDir, 'meta.json'), 'utf8')), {
    title: 'Safe title',
  });
  assert.equal(fs.existsSync(path.join(root, 'unsafe.txt')), false);

  fs.rmSync(root, { recursive: true, force: true });
});

test('persists Teach-provided Mission options and resolves selected answers with optional detail', () => {
  const root = tempRoot();
  const { courseDir } = createTextDraft(root);
  markMissionPlanning(courseDir);
  const record = markMissionQuestion(courseDir, {
    question: '你最想改变什么？',
    options: [
      { id: 'daily', label: '让日常工作更有趣', description: '从生活与工作实践开始。' },
      { id: 'design', label: '把约束用于设计与教育' },
      { id: 'explore', label: '还不确定，先探索' },
    ],
    materialSummary: '材料讨论约束、游戏与创造。',
  });

  assert.equal(record.mission.options.length, 3);
  assert.equal(resolveMissionAnswer(record, {
    selectionId: 'design',
    detail: '我主要关心课程设计。',
  }), '用户选择：把约束用于设计与教育\n补充说明：我主要关心课程设计。');
  assert.equal(resolveMissionAnswer(record, { selectionId: 'daily' }), '用户选择：让日常工作更有趣');
  assert.throws(
    () => resolveMissionAnswer(record, { selectionId: 'stale', detail: '伪造选项' }),
    (error) => error.code === 'MISSION_SELECTION_REQUIRED',
  );
  assert.throws(
    () => resolveMissionAnswer(record, { detail: '只写说明但不选择' }),
    (error) => error.code === 'MISSION_SELECTION_REQUIRED',
  );
  fs.rmSync(root, { recursive: true, force: true });
});

test('keeps a failed onboarding record when real material inspection fails', () => {
  const root = tempRoot();
  const upload = tempUpload(root, 'broken.tmp', Buffer.from('not a pdf'));
  assert.throws(() => createCourseDraft({
    dataRoot: root,
    tempFile: upload,
    originalFilename: 'broken.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 9,
    title: 'Broken PDF',
  }), (error) => {
    assert.equal(error.code, 'INVALID_PDF');
    assert.match(error.courseId, /^[a-f0-9]{32}$/);
    assert.equal(error.onboarding.state, 'failed');
    assert.equal(error.onboarding.inspection.errorCode, 'INVALID_PDF');
    assert.equal(fs.existsSync(path.join(root, error.courseId, 'onboarding.json')), true);
    return true;
  });
  fs.rmSync(root, { recursive: true, force: true });
});

test('compiles MISSION.md only from enumerated answers and saves it idempotently', () => {
  const root = tempRoot();
  const { courseDir } = createTextDraft(root);
  const first = saveMission(courseDir, mission(), Date.parse('2026-07-21T00:01:00.000Z'));
  const markdown = fs.readFileSync(path.join(courseDir, 'MISSION.md'), 'utf8');

  assert.equal(first.state, 'awaiting_mission');
  assert.equal(first.mission.outcome, 'apply_real_scenarios');
  assert.equal(markdown, compileMissionMarkdown(mission()));
  assert.match(markdown, /应用到真实场景/);
  assert.match(markdown, /短讲解后马上练习/);
  assert.match(markdown, /15 到 25 分钟/);

  const before = fs.statSync(path.join(courseDir, 'MISSION.md')).mtimeMs;
  const second = saveMission(courseDir, mission(), Date.parse('2026-07-21T00:02:00.000Z'));
  const after = fs.statSync(path.join(courseDir, 'MISSION.md')).mtimeMs;
  assert.equal(second.updatedAt, first.updatedAt);
  assert.equal(after, before);

  assert.throws(() => saveMission(courseDir, {
    ...mission(),
    outcome: '<script>alert(1)</script>',
  }), (error) => error.code === 'INVALID_MISSION');
  fs.rmSync(root, { recursive: true, force: true });
});

test('turns a missing Kimi CLI process error into a learner-facing recovery message', () => {
  const root = tempRoot();
  const { courseDir } = createTextDraft(root);
  const error = new Error('spawn kimi ENOENT');
  error.code = 'ENOENT';
  const record = markMissionFailed(courseDir, error);
  assert.equal(record.mission.errorCode, 'KIMI_CLI_UNAVAILABLE');
  assert.match(record.mission.errorMessage, /未检测到 Kimi CLI/);
  assert.match(record.mission.errorMessage, /安装并登录/);
  assert.match(record.mission.errorMessage, /材料已保留/);
  assert.doesNotMatch(record.mission.errorMessage, /spawn|ENOENT/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('requires completed inspection and Mission before generation can start', () => {
  const root = tempRoot();
  const { courseDir } = createTextDraft(root);
  assert.throws(() => markGenerationStarting(courseDir), (error) => error.code === 'MISSION_INCOMPLETE');

  saveMission(courseDir, mission());
  const starting = markGenerationStarting(courseDir, { now: Date.parse('2026-07-21T00:03:00.000Z') });
  assert.equal(starting.state, 'starting');
  assert.equal(starting.generation.attempts, 1);

  assert.throws(() => markGenerationStarting(courseDir), (error) => error.code === 'INVALID_STATE');
  fs.rmSync(root, { recursive: true, force: true });
});

test('reconciles active, ready, failed and interrupted generation from real job evidence', () => {
  const root = tempRoot();
  const { courseDir } = createTextDraft(root);
  saveMission(courseDir, mission());
  markGenerationStarting(courseDir, { now: 1_000 });
  markGenerationRunning(courseDir, { runId: 'run-1', startedAt: new Date(1_000).toISOString() }, 1_001);

  let record = reconcileOnboarding(courseDir, {
    job: { stage: 'generating', runId: 'run-1', startedAt: new Date(1_000).toISOString() },
    busy: true,
    lessons: 0,
    lessonReadable: false,
    now: 2_000,
  });
  assert.equal(record.state, 'generating');

  record = reconcileOnboarding(courseDir, {
    job: { stage: 'ready', runId: 'run-1', finishedAt: new Date(3_000).toISOString() },
    busy: false,
    lessons: 1,
    lessonReadable: true,
    now: 3_000,
  });
  assert.equal(record.state, 'ready');
  assert.equal(record.generation.readyAt, new Date(3_000).toISOString());

  const root2 = tempRoot();
  const second = createTextDraft(root2);
  saveMission(second.courseDir, mission());
  markGenerationStarting(second.courseDir, { now: 1_000 });
  markGenerationRunning(second.courseDir, { runId: 'run-2', startedAt: new Date(1_000).toISOString() }, 1_001);
  const interrupted = reconcileOnboarding(second.courseDir, {
    job: { stage: 'generating', runId: 'run-2' },
    busy: false,
    lessons: 0,
    lessonReadable: false,
    jobMtimeMs: 1_000,
    now: 62_000,
  });
  assert.equal(interrupted.state, 'interrupted');
  assert.equal(interrupted.generation.errorCode, 'GENERATION_INTERRUPTED');

  const root3 = tempRoot();
  const third = createTextDraft(root3);
  saveMission(third.courseDir, mission());
  markGenerationStarting(third.courseDir, { now: 1_000 });
  markGenerationRunning(third.courseDir, { runId: 'run-3', startedAt: new Date(1_000).toISOString() }, 1_001);
  const unreadable = reconcileOnboarding(third.courseDir, {
    job: { stage: 'ready', runId: 'run-3', finishedAt: new Date(3_000).toISOString() },
    busy: false,
    lessons: 1,
    lessonReadable: false,
    now: 3_000,
  });
  assert.equal(unreadable.state, 'failed');
  assert.match(unreadable.generation.errorMessage, /不可读取/);

  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(root2, { recursive: true, force: true });
  fs.rmSync(root3, { recursive: true, force: true });
});

test('atomic JSON writes leave no temporary files behind', () => {
  const root = tempRoot();
  const { courseDir } = createTextDraft(root);
  readOnboarding(courseDir);
  assert.deepEqual(fs.readdirSync(courseDir).filter((name) => name.endsWith('.tmp')), []);
  fs.rmSync(root, { recursive: true, force: true });
});

test('validates the complete UTF-8 text file instead of only the first inspection window', () => {
  const root = tempRoot();
  const content = Buffer.concat([
    Buffer.alloc(128 * 1024 + 32, 0x61),
    Buffer.from([0xc3]),
  ]);
  const upload = tempUpload(root, 'late-invalid.tmp', content);

  assert.throws(() => createCourseDraft({
    dataRoot: root,
    tempFile: upload,
    originalFilename: 'late-invalid.txt',
    mimeType: 'text/plain',
    sizeBytes: content.length,
    title: 'Late invalid UTF-8',
  }), (error) => {
    assert.equal(error.code, 'INVALID_TEXT_ENCODING');
    assert.equal(error.onboarding.state, 'failed');
    return true;
  });

  fs.rmSync(root, { recursive: true, force: true });
});

test('reconciliation interrupts a missing persisted job and revokes unreadable ready state', () => {
  const root = tempRoot();
  const { courseDir } = createTextDraft(root);
  saveMission(courseDir, mission());
  markGenerationStarting(courseDir, { now: 1_000 });

  let record = reconcileOnboarding(courseDir, {
    job: { stage: 'understanding' },
    busy: false,
    lessons: 0,
    lessonReadable: false,
    jobMtimeMs: 0,
    now: 2_000,
  });
  assert.equal(record.state, 'interrupted');
  assert.equal(record.generation.errorCode, 'GENERATION_INTERRUPTED');

  const root2 = tempRoot();
  const second = createTextDraft(root2);
  saveMission(second.courseDir, mission());
  markGenerationStarting(second.courseDir, { now: 1_000 });
  markGenerationRunning(second.courseDir, {
    runId: 'run-ready',
    startedAt: new Date(1_000).toISOString(),
  }, 1_001);
  record = reconcileOnboarding(second.courseDir, {
    job: { stage: 'ready', runId: 'run-ready', finishedAt: new Date(3_000).toISOString() },
    busy: false,
    lessons: 1,
    lessonReadable: true,
    now: 3_000,
  });
  assert.equal(record.state, 'ready');

  record = reconcileOnboarding(second.courseDir, {
    job: { stage: 'ready', runId: 'run-ready', finishedAt: new Date(3_000).toISOString() },
    busy: false,
    lessons: 0,
    lessonReadable: false,
    now: 4_000,
  });
  assert.equal(record.state, 'failed');
  assert.match(record.generation.errorMessage, /不可读取/);

  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(root2, { recursive: true, force: true });
});

test('maps pre-generation and terminal onboarding states to coherent public generation stages', () => {
  assert.equal(onboardingGenerationStage({
    state: 'awaiting_mission',
    generation: { attempts: 0 },
  }, 'understanding'), 'idle');
  assert.equal(onboardingGenerationStage({
    state: 'failed',
    generation: { attempts: 0 },
  }, 'understanding'), 'idle');
  assert.equal(onboardingGenerationStage({
    state: 'interrupted',
    generation: { attempts: 1 },
  }, 'understanding'), 'failed');
  assert.equal(onboardingGenerationStage({
    state: 'ready',
    generation: { attempts: 1 },
  }, 'understanding'), 'ready');
});
