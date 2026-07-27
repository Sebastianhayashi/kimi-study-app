'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createArtifactStore, ArtifactError } = require('../lib/artifact-store');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lucubro-artifact-store-'));
  const courses = path.join(root, 'courses');
  fs.mkdirSync(courses, { recursive: true });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  let tick = 0;
  const store = createArtifactStore({
    dataDir: courses,
    now: () => new Date(Date.UTC(2026, 6, 27, 0, 0, tick++)),
  });
  return { root, courses, store };
}

const input = (mode = 'local-body') => ({
  taskType: 'zhihu-answer',
  title: 'Why learning systems fail',
  audience: 'Readers choosing a learning method',
  contentStorage: mode,
  rubric: [
    { label: 'Clear claim', minimum: 'The opening states the answer' },
    { label: 'Grounded evidence', minimum: 'Key claims cite source evidence' },
    { label: 'Useful action', minimum: 'The reader can take a next step' },
  ],
});

test('local-body artifacts use optimistic draft versions and immutable checkpoints', (t) => {
  const { store } = fixture(t);
  const artifact = store.create(input());
  assert.match(artifact.id, /^a_[a-z0-9]{32}$/);
  assert.equal(artifact.status, 'waiting_for_source');
  assert.equal(fs.existsSync(path.join(store.safeDir(artifact.id), 'draft.md')), true);

  const saved = store.saveDraft(artifact.id, { expectedDraftVersion: 0, body: 'Evidence sentence and conclusion.' });
  assert.equal(saved.draftVersion, 1);
  assert.throws(
    () => store.saveDraft(artifact.id, { expectedDraftVersion: 0, body: 'stale' }),
    (error) => error instanceof ArtifactError && error.code === 'ARTIFACT_VERSION_CONFLICT' && error.details.serverDraftVersion === 1,
  );

  const checkpoint = store.createCheckpoint(artifact.id, { expectedDraftVersion: 1, trigger: 'manual' });
  assert.match(checkpoint.revision.id, /^rev_/);
  assert.match(checkpoint.revision.sha256, /^sha256:/);
  const revisionPath = path.join(store.safeDir(artifact.id), 'revisions', `${checkpoint.revision.id}.md`);
  assert.equal(fs.readFileSync(revisionPath, 'utf8'), 'Evidence sentence and conclusion.');
  assert.throws(() => store.updateStatus(artifact.id, 'draft'), /Only archived artifacts/);
  assert.equal(store.updateStatus(artifact.id, 'ready').status, 'ready');
  assert.equal(store.updateStatus(artifact.id, 'archived').status, 'archived');
  assert.equal(store.updateStatus(artifact.id, 'draft').status, 'draft');
});

test('structure-only artifacts never persist draft or revision body text', (t) => {
  const { store } = fixture(t);
  const artifact = store.create(input('structure-only'));
  const dir = store.safeDir(artifact.id);
  assert.equal(fs.existsSync(path.join(dir, 'draft.md')), false);
  assert.throws(
    () => store.saveDraft(artifact.id, { expectedDraftVersion: 0, body: 'must not persist' }),
    (error) => error.code === 'ARTIFACT_BODY_NOT_STORED',
  );
  const checkpoint = store.createCheckpoint(artifact.id, {
    trigger: 'manual',
    externalRevisionLabel: 'External draft 1',
    bodySha256: `sha256:${'b'.repeat(64)}`,
  });
  assert.equal(checkpoint.revision.externalRevisionLabel, 'External draft 1');
  assert.equal(fs.existsSync(path.join(dir, 'revisions')), false);
  const serialized = fs.readFileSync(path.join(dir, 'artifact.json'), 'utf8');
  assert.doesNotMatch(serialized, /must not persist/);
});

test('one primary course can be linked and referenced-course protection ignores archived artifacts', (t) => {
  const { store } = fixture(t);
  const artifact = store.create(input());
  store.linkCourse(artifact.id, {
    courseId: 'courseone',
    missionSnapshot: { problemStatement: 'Problem', expectedOutput: 'Output', successEvidence: ['Evidence'] },
  });
  assert.equal(store.courseReferenced('courseone'), true);
  assert.throws(
    () => store.linkCourse(artifact.id, { courseId: 'coursetwo', missionSnapshot: null }),
    (error) => error.code === 'ARTIFACT_COURSE_ALREADY_LINKED',
  );
  store.updateStatus(artifact.id, 'archived');
  assert.equal(store.courseReferenced('courseone'), false);
});
