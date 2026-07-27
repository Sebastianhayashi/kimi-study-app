'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ARTIFACT_ID_RE = /^a_[a-z0-9]{16,64}$/i;
const TASK_TYPES = new Set(['zhihu-answer']);
const STORAGE_MODES = new Set(['local-body', 'structure-only']);
const STATUSES = new Set(['waiting_for_source', 'waiting_for_mission', 'draft', 'revising', 'ready', 'delivered', 'archived']);
const BODY_LIMIT = 2 * 1024 * 1024;

class ArtifactError extends Error {
  constructor(code, message, status = 400, details = null) {
    super(message);
    this.name = 'ArtifactError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function createArtifactStore({ dataDir, now = () => new Date(), randomUUID = crypto.randomUUID } = {}) {
  if (!dataDir) throw new Error('dataDir is required');
  const coursesDir = path.resolve(dataDir);
  const artifactsDir = path.join(path.dirname(coursesDir), 'artifacts');
  const locks = new Set();

  const timestamp = () => now().toISOString();
  const artifactId = () => `a_${randomUUID().replace(/-/g, '')}`;
  const revisionId = () => `rev_${randomUUID().replace(/-/g, '')}`;
  const rubricId = () => `r_${randomUUID().replace(/-/g, '').slice(0, 16)}`;

  function cleanText(value, max, field, { optional = false } = {}) {
    const out = String(value == null ? '' : value).trim();
    if (!out && !optional) throw new ArtifactError('ARTIFACT_VALIDATION_FAILED', `${field} is required`, 422);
    if (out.length > max) throw new ArtifactError('ARTIFACT_VALIDATION_FAILED', `${field} is too long`, 422);
    return out;
  }

  function safeDir(id) {
    if (!ARTIFACT_ID_RE.test(String(id || ''))) throw new ArtifactError('ARTIFACT_ID_INVALID', 'Invalid artifact id', 400);
    const target = path.resolve(artifactsDir, id);
    if (!target.startsWith(path.resolve(artifactsDir) + path.sep)) throw new ArtifactError('ARTIFACT_ID_INVALID', 'Invalid artifact path', 400);
    return target;
  }

  function atomicJson(file, value) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.${randomUUID()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
    fs.renameSync(tmp, file);
  }

  function atomicText(file, value) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.${randomUUID()}.tmp`;
    fs.writeFileSync(tmp, value, 'utf8');
    fs.renameSync(tmp, file);
  }

  function validateArtifact(value, id = '') {
    if (!value || typeof value !== 'object' || value.schemaVersion !== 1) throw new ArtifactError('ARTIFACT_INVALID', 'Artifact metadata is invalid', 422, id);
    if (!ARTIFACT_ID_RE.test(value.id) || (id && value.id !== id)) throw new ArtifactError('ARTIFACT_INVALID', 'Artifact id mismatch', 422, id);
    if (!TASK_TYPES.has(value.taskType) || !STORAGE_MODES.has(value.contentStorage) || !STATUSES.has(value.status)) throw new ArtifactError('ARTIFACT_INVALID', 'Artifact enum is invalid', 422, id);
    if (!Array.isArray(value.rubric) || value.rubric.length < 3 || value.rubric.length > 5) throw new ArtifactError('ARTIFACT_INVALID', 'Artifact rubric is invalid', 422, id);
    if (!Array.isArray(value.gaps) || !Array.isArray(value.revisions)) throw new ArtifactError('ARTIFACT_INVALID', 'Artifact collections are invalid', 422, id);
    return value;
  }

  function readRaw(id) {
    const dir = safeDir(id);
    const file = path.join(dir, 'artifact.json');
    if (!fs.existsSync(file)) throw new ArtifactError('ARTIFACT_NOT_FOUND', 'Artifact not found', 404);
    let parsed;
    try { parsed = JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch { throw new ArtifactError('ARTIFACT_INVALID', 'Artifact metadata is invalid', 422, path.relative(path.dirname(coursesDir), file)); }
    return validateArtifact(parsed, id);
  }

  function writeArtifact(value) {
    validateArtifact(value, value.id);
    atomicJson(path.join(safeDir(value.id), 'artifact.json'), value);
    return value;
  }

  function withLock(id, action) {
    if (locks.has(id)) throw new ArtifactError('ARTIFACT_BUSY', 'Artifact is busy', 409);
    locks.add(id);
    try { return action(); }
    finally { locks.delete(id); }
  }

  function normalizeRubric(input) {
    if (!Array.isArray(input) || input.length < 3 || input.length > 5) throw new ArtifactError('ARTIFACT_VALIDATION_FAILED', 'Rubric must contain 3 to 5 items', 422);
    return input.map((item) => ({
      id: item && item.id ? cleanText(item.id, 80, 'rubric id') : rubricId(),
      label: cleanText(item && item.label, 160, 'rubric label'),
      minimum: cleanText(item && item.minimum, 500, 'rubric minimum'),
      source: item && item.source === 'mission' ? 'mission' : 'user',
    }));
  }

  function create(input = {}) {
    const taskType = cleanText(input.taskType || 'zhihu-answer', 80, 'taskType');
    if (!TASK_TYPES.has(taskType)) throw new ArtifactError('ARTIFACT_TASK_TYPE_UNSUPPORTED', 'Unsupported artifact task type', 422);
    const contentStorage = cleanText(input.contentStorage || 'local-body', 40, 'contentStorage');
    if (!STORAGE_MODES.has(contentStorage)) throw new ArtifactError('ARTIFACT_STORAGE_INVALID', 'Invalid content storage mode', 422);
    const id = artifactId();
    const createdAt = timestamp();
    const primaryCourseId = input.primaryCourseId ? cleanText(input.primaryCourseId, 80, 'primaryCourseId') : null;
    const artifact = {
      schemaVersion: 1,
      id,
      taskType,
      title: cleanText(input.title, 240, 'title'),
      audience: cleanText(input.audience, 500, 'audience'),
      deadline: input.deadline == null || input.deadline === '' ? null : cleanText(input.deadline, 80, 'deadline'),
      status: primaryCourseId ? (input.missionSnapshot ? 'draft' : 'waiting_for_mission') : 'waiting_for_source',
      primaryCourseId,
      contentStorage,
      missionSnapshot: input.missionSnapshot || null,
      rubric: normalizeRubric(input.rubric),
      currentRevisionId: null,
      draftVersion: 0,
      gaps: [],
      revisions: [],
      corpusConsent: input.corpusConsent === true,
      createdAt,
      updatedAt: createdAt,
      archivedAt: null,
      deliveredAt: null,
    };
    const dir = safeDir(id);
    fs.mkdirSync(artifactsDir, { recursive: true });
    fs.mkdirSync(dir, { recursive: false });
    if (contentStorage === 'local-body') atomicText(path.join(dir, 'draft.md'), '');
    writeArtifact(artifact);
    return artifact;
  }

  function get(id, { includeBody = true } = {}) {
    const artifact = readRaw(id);
    let draft = null;
    if (includeBody && artifact.contentStorage === 'local-body') {
      try { draft = fs.readFileSync(path.join(safeDir(id), 'draft.md'), 'utf8'); }
      catch { draft = ''; }
    }
    return { artifact, draft };
  }

  function list({ status = '' } = {}) {
    if (!fs.existsSync(artifactsDir)) return [];
    const values = [];
    for (const entry of fs.readdirSync(artifactsDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || !ARTIFACT_ID_RE.test(entry.name)) continue;
      try { values.push(readRaw(entry.name)); } catch {}
    }
    const filtered = values.filter((item) => {
      if (!status || status === 'all') return true;
      if (status === 'active') return !['delivered', 'archived'].includes(item.status);
      return item.status === status;
    });
    return filtered.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }

  function metadata(item) {
    const currentGap = item.gaps.find((gap) => gap && ['open', 'accepted', 'modified', 'orphaned'].includes(gap.status)) || null;
    return {
      id: item.id,
      title: item.title,
      status: item.status,
      primaryCourseId: item.primaryCourseId,
      contentStorage: item.contentStorage,
      currentGap: currentGap ? { id: currentGap.id, summary: currentGap.summary } : null,
      openGapCount: item.gaps.filter((gap) => gap && !['rejected', 'resolved'].includes(gap.status)).length,
      updatedAt: item.updatedAt,
      archivedAt: item.archivedAt,
      deliveredAt: item.deliveredAt,
    };
  }

  function saveDraft(id, { expectedDraftVersion, body }) {
    return withLock(id, () => {
      const artifact = readRaw(id);
      if (artifact.contentStorage !== 'local-body') throw new ArtifactError('ARTIFACT_BODY_NOT_STORED', 'This artifact does not store body content', 409);
      if (!Number.isInteger(expectedDraftVersion) || expectedDraftVersion !== artifact.draftVersion) {
        throw new ArtifactError('ARTIFACT_VERSION_CONFLICT', 'Draft version conflict', 409, { serverDraftVersion: artifact.draftVersion, updatedAt: artifact.updatedAt });
      }
      const normalized = String(body == null ? '' : body);
      if (Buffer.byteLength(normalized, 'utf8') > BODY_LIMIT) throw new ArtifactError('ARTIFACT_BODY_TOO_LARGE', 'Draft body is too large', 413);
      atomicText(path.join(safeDir(id), 'draft.md'), normalized);
      artifact.draftVersion += 1;
      artifact.updatedAt = timestamp();
      if (artifact.status === 'waiting_for_source' && artifact.primaryCourseId) artifact.status = 'draft';
      writeArtifact(artifact);
      return artifact;
    });
  }

  function createCheckpoint(id, input = {}) {
    return withLock(id, () => {
      const artifact = readRaw(id);
      const trigger = cleanText(input.trigger || 'manual', 40, 'trigger');
      if (!['manual', 'critique-cycle', 'ready', 'delivered'].includes(trigger)) throw new ArtifactError('ARTIFACT_TRIGGER_INVALID', 'Invalid checkpoint trigger', 422);
      if (artifact.contentStorage === 'local-body' && input.expectedDraftVersion !== artifact.draftVersion) {
        throw new ArtifactError('ARTIFACT_VERSION_CONFLICT', 'Draft version conflict', 409, { serverDraftVersion: artifact.draftVersion, updatedAt: artifact.updatedAt });
      }
      const idValue = revisionId();
      const parentRevisionId = artifact.currentRevisionId;
      let sha256 = null;
      let bytes = 0;
      if (artifact.contentStorage === 'local-body') {
        const body = fs.readFileSync(path.join(safeDir(id), 'draft.md'), 'utf8');
        sha256 = `sha256:${crypto.createHash('sha256').update(body).digest('hex')}`;
        bytes = Buffer.byteLength(body, 'utf8');
        atomicText(path.join(safeDir(id), 'revisions', `${idValue}.md`), body);
      } else {
        sha256 = input.bodySha256 ? cleanText(input.bodySha256, 160, 'bodySha256') : null;
        if (sha256 && !/^sha256:[a-f0-9]{64}$/i.test(sha256)) {
          throw new ArtifactError('ARTIFACT_SHA256_INVALID', 'bodySha256 must be a SHA-256 digest', 422);
        }
      }
      const revision = {
        id: idValue,
        parentRevisionId,
        trigger,
        sha256,
        bytes,
        ...(artifact.contentStorage === 'structure-only' && input.externalRevisionLabel ? { externalRevisionLabel: cleanText(input.externalRevisionLabel, 240, 'externalRevisionLabel') } : {}),
        createdAt: timestamp(),
      };
      artifact.revisions.push(revision);
      artifact.currentRevisionId = idValue;
      artifact.updatedAt = revision.createdAt;
      if (!['ready', 'delivered', 'archived'].includes(artifact.status)) artifact.status = artifact.gaps.length ? 'revising' : 'draft';
      writeArtifact(artifact);
      return { artifact, revision };
    });
  }

  function revisionBody(id, revision) {
    const artifact = readRaw(id);
    if (artifact.contentStorage !== 'local-body') return null;
    const known = artifact.revisions.find((item) => item.id === revision);
    if (!known) throw new ArtifactError('ARTIFACT_REVISION_NOT_FOUND', 'Revision not found', 404);
    return fs.readFileSync(path.join(safeDir(id), 'revisions', `${revision}.md`), 'utf8');
  }

  function linkCourse(id, { courseId, missionSnapshot = null }) {
    return withLock(id, () => {
      const artifact = readRaw(id);
      if (artifact.primaryCourseId && artifact.primaryCourseId !== courseId) throw new ArtifactError('ARTIFACT_COURSE_ALREADY_LINKED', 'Artifact already has a primary course', 409);
      artifact.primaryCourseId = cleanText(courseId, 80, 'courseId');
      artifact.missionSnapshot = missionSnapshot;
      artifact.status = missionSnapshot ? 'draft' : 'waiting_for_mission';
      artifact.updatedAt = timestamp();
      writeArtifact(artifact);
      return artifact;
    });
  }

  function applyCritique(id, { revisionId: currentRevisionId, critiqueId, gaps }) {
    return withLock(id, () => {
      const artifact = readRaw(id);
      if (artifact.currentRevisionId !== currentRevisionId) throw new ArtifactError('ARTIFACT_REVISION_STALE', 'Critique revision is stale', 409);
      artifact.gaps = gaps.map((gap) => ({ ...gap, revisionId: currentRevisionId, createdFromCritiqueId: critiqueId, status: 'open' }));
      artifact.status = 'revising';
      artifact.updatedAt = timestamp();
      writeArtifact(artifact);
      return artifact;
    });
  }

  function applyDecision(id, { critiqueId, gapId = null, action, reason = '', modifiedSummary = '' }) {
    return withLock(id, () => {
      const artifact = readRaw(id);
      const targets = artifact.gaps.filter((gap) => gap.createdFromCritiqueId === critiqueId && (!gapId || gap.id === gapId));
      if (!targets.length) throw new ArtifactError('ARTIFACT_CRITIQUE_NOT_FOUND', 'Critique not found', 404);
      for (const gap of targets) {
        gap.status = action;
        if (reason) gap.decisionReason = cleanText(reason, 500, 'reason', { optional: true });
        if (action === 'modified') gap.summary = cleanText(modifiedSummary, 500, 'modifiedSummary');
      }
      artifact.updatedAt = timestamp();
      writeArtifact(artifact);
      return { artifact, gaps: targets };
    });
  }

  function updateStatus(id, nextStatus) {
    return withLock(id, () => {
      const artifact = readRaw(id);
      const status = cleanText(nextStatus, 40, 'status');
      if (!['ready', 'delivered', 'archived', 'draft'].includes(status)) throw new ArtifactError('ARTIFACT_STATUS_INVALID', 'Invalid status', 422);
      if (['ready', 'delivered'].includes(status) && !artifact.currentRevisionId) throw new ArtifactError('ARTIFACT_CHECKPOINT_REQUIRED', 'Create a checkpoint first', 409);
      if (status === 'draft' && artifact.status !== 'archived') throw new ArtifactError('ARTIFACT_STATUS_INVALID', 'Only archived artifacts can be restored to draft', 409);
      artifact.status = status;
      artifact.archivedAt = status === 'archived' ? timestamp() : null;
      if (status === 'delivered') artifact.deliveredAt = timestamp();
      artifact.updatedAt = timestamp();
      writeArtifact(artifact);
      return artifact;
    });
  }

  function courseReferenced(courseId) {
    return list({ status: 'all' }).some((artifact) => artifact.primaryCourseId === courseId && artifact.status !== 'archived');
  }

  return {
    coursesDir,
    artifactsDir,
    locks,
    create,
    get,
    list,
    metadata,
    saveDraft,
    createCheckpoint,
    revisionBody,
    linkCourse,
    applyCritique,
    applyDecision,
    updateStatus,
    courseReferenced,
    readRaw,
    safeDir,
  };
}

module.exports = {
  ARTIFACT_ID_RE,
  ArtifactError,
  createArtifactStore,
};
