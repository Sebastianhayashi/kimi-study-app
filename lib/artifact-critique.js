'use strict';

const crypto = require('crypto');

class ArtifactCritiqueError extends Error {
  constructor(code, message, status = 422) {
    super(message);
    this.name = 'ArtifactCritiqueError';
    this.code = code;
    this.status = status;
  }
}

function clip(value, max, field) {
  const text = String(value == null ? '' : value).trim();
  if (!text) throw new ArtifactCritiqueError('CRITIQUE_INVALID', `${field} is required`);
  if (text.length > max) throw new ArtifactCritiqueError('CRITIQUE_INVALID', `${field} is too long`);
  return text;
}

function containsForbiddenReplacement(value) {
  if (!value || typeof value !== 'object') return false;
  for (const [key, child] of Object.entries(value)) {
    if (/replacement|rewritten|suggestedText/i.test(key)) return true;
    if (containsForbiddenReplacement(child)) return true;
  }
  return false;
}

function anchorFor(body, input) {
  const exact = clip(input && input.exact, 240, 'anchor.exact');
  const index = body.indexOf(exact);
  if (index < 0) throw new ArtifactCritiqueError('CRITIQUE_ANCHOR_INVALID', 'Anchor does not exist in the submitted revision');
  const prefix = body.slice(Math.max(0, index - 120), index);
  const suffix = body.slice(index + exact.length, index + exact.length + 120);
  const normalized = `${prefix}${exact}${suffix}`.replace(/\s+/g, ' ').trim();
  return {
    exact,
    prefix,
    suffix,
    position: { start: index, end: index + exact.length },
    anchorHash: `sha256:${crypto.createHash('sha256').update(normalized).digest('hex')}`,
  };
}

function parseArtifactCritiqueResponse(text, { artifact, revisionId, body, allowedRubricItemIds = [], randomUUID = crypto.randomUUID } = {}) {
  const raw = String(text || '').trim();
  if (!raw.startsWith('{') || !raw.endsWith('}')) throw new ArtifactCritiqueError('CRITIQUE_JSON_INVALID', 'Critique must be strict JSON');
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch { throw new ArtifactCritiqueError('CRITIQUE_JSON_INVALID', 'Critique JSON could not be parsed'); }
  if (containsForbiddenReplacement(parsed)) throw new ArtifactCritiqueError('CRITIQUE_REPLACEMENT_FORBIDDEN', 'Critique must not include replacement prose');
  if (!Array.isArray(parsed.gaps) || parsed.gaps.length < 1 || parsed.gaps.length > 2) throw new ArtifactCritiqueError('CRITIQUE_GAP_COUNT_INVALID', 'Critique must return one or two gaps');
  const artifactRubricIds = new Set((artifact.rubric || []).map((item) => item.id));
  const requestedRubricIds = Array.isArray(allowedRubricItemIds)
    ? allowedRubricItemIds.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
  for (const id of requestedRubricIds) {
    if (!artifactRubricIds.has(id)) throw new ArtifactCritiqueError('CRITIQUE_RUBRIC_INVALID', 'Critique requested an unknown rubric item');
  }
  const rubricIds = requestedRubricIds.length ? new Set(requestedRubricIds) : artifactRubricIds;
  const normalizedBody = String(body || '');
  return parsed.gaps.map((gap) => {
    const rubricItemId = clip(gap.rubricItemId, 80, 'rubricItemId');
    if (!rubricIds.has(rubricItemId)) throw new ArtifactCritiqueError('CRITIQUE_RUBRIC_INVALID', 'Critique referenced an unknown rubric item');
    const severity = clip(gap.severity || 'high', 20, 'severity');
    if (!['high', 'medium', 'low'].includes(severity)) throw new ArtifactCritiqueError('CRITIQUE_SEVERITY_INVALID', 'Invalid gap severity');
    const sourceRefs = Array.isArray(gap.sourceRefs)
      ? gap.sourceRefs.map((ref) => clip(ref, 240, 'sourceRef')).slice(0, 8)
      : [];
    if (!sourceRefs.length) throw new ArtifactCritiqueError('CRITIQUE_SOURCE_REQUIRED', 'Each gap needs source evidence');
    return {
      id: `g_${randomUUID().replace(/-/g, '')}`,
      revisionId,
      rubricItemId,
      summary: clip(gap.summary, 500, 'summary'),
      severity,
      evidence: clip(gap.evidence, 1000, 'evidence'),
      anchor: anchorFor(normalizedBody, gap.anchor || {}),
      sourceRefs,
    };
  });
}

function buildArtifactCritiquePrompt({ artifact, revisionId, body, rubricItemIds = [] }) {
  const selected = rubricItemIds.length ? new Set(rubricItemIds) : null;
  const rubric = artifact.rubric.filter((item) => !selected || selected.has(item.id));
  return [
    '你是 Lucubro 的作品 critique 审阅器。只做缺口识别，不代写，不返回替换段落。',
    '读取当前课程的 MISSION.md 和与论断直接相关的来源材料；不要读取 assessments 或答案键。',
    '输出必须是单个严格 JSON 对象，无 Markdown、无解释文字。最多返回 2 个最高影响 Gap。',
    '每个 Gap 必须绑定一个 rubricItemId、作品中的 exact anchor、具体 evidence 和可核对 sourceRefs。',
    'JSON schema: {"gaps":[{"rubricItemId":"...","summary":"...","severity":"high|medium|low","evidence":"...","anchor":{"exact":"作品中逐字存在的短句"},"sourceRefs":["relative-source#anchor"]}]}',
    '<artifact-contract>',
    JSON.stringify({
      artifactId: artifact.id,
      revisionId,
      taskType: artifact.taskType,
      title: artifact.title,
      audience: artifact.audience,
      missionSnapshot: artifact.missionSnapshot,
      rubric,
    }),
    '</artifact-contract>',
    '<revision-body>',
    String(body || ''),
    '</revision-body>',
  ].join('\n');
}

async function runArtifactCritique({
  courseDir,
  artifact,
  revisionId,
  body,
  rubricItemIds = [],
  runTrackedKimiImpl,
  model,
  skillsDir,
  randomUUID,
}) {
  if (typeof runTrackedKimiImpl !== 'function') throw new Error('runTrackedKimiImpl is required');
  const result = await runTrackedKimiImpl({
    cwd: courseDir,
    prompt: buildArtifactCritiquePrompt({ artifact, revisionId, body, rubricItemIds }),
    sessionId: null,
    preferredMode: 'stream-json',
    model,
    skillsDir,
    onEvent: () => {},
  });
  if (!result || result.status !== 'finished') throw new ArtifactCritiqueError('CRITIQUE_MODEL_FAILED', 'Critique model did not finish', 502);
  return parseArtifactCritiqueResponse(result.text, {
    artifact,
    revisionId,
    body,
    allowedRubricItemIds: rubricItemIds,
    randomUUID,
  });
}

module.exports = {
  ArtifactCritiqueError,
  buildArtifactCritiquePrompt,
  parseArtifactCritiqueResponse,
  runArtifactCritique,
};
