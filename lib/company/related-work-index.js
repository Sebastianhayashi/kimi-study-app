'use strict';

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'but', 'by', 'do', 'for', 'from',
  'how', 'i', 'if', 'in', 'into', 'is', 'it', 'me', 'my', 'of', 'on', 'or', 'our',
  'should', 'that', 'the', 'their', 'them', 'then', 'this', 'to', 'was', 'we', 'what',
  'when', 'where', 'which', 'who', 'why', 'with', 'would', 'you', 'your', 'next',
]);

function requiredText(value, label) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new Error(`${label} is required`);
  return text;
}

function englishStem(token) {
  if (!/^[a-z0-9]+$/.test(token)) return token;
  if (token.length > 5 && token.endsWith('ies')) return `${token.slice(0, -3)}y`;
  if (token.length > 4 && token.endsWith('es')) return token.slice(0, -2);
  if (token.length > 4 && token.endsWith('s')) return token.slice(0, -1);
  return token;
}

function tokenize(value) {
  const text = String(value || '').normalize('NFKC').toLowerCase();
  const chunks = text.match(/[\p{L}\p{N}]+/gu) || [];
  const tokens = [];
  for (const chunk of chunks) {
    const token = englishStem(chunk);
    if (!STOPWORDS.has(token) && token.length > 1) tokens.push(token);
    if (/\p{Script=Han}/u.test(chunk)) {
      const chars = [...chunk];
      for (let index = 0; index < chars.length - 1; index += 1) tokens.push(`${chars[index]}${chars[index + 1]}`);
    }
  }
  return [...new Set(tokens)];
}

function tokenWeights(value, weight) {
  return new Map(tokenize(value).map((token) => [token, weight]));
}

function mergeWeights(...maps) {
  const result = new Map();
  for (const map of maps) {
    for (const [token, weight] of map.entries()) {
      result.set(token, Math.max(result.get(token) || 0, weight));
    }
  }
  return result;
}

function createRelatedWorkIndex({ workStore, artifactStore } = {}) {
  if (!workStore || typeof workStore.list !== 'function' || typeof workStore.get !== 'function') {
    throw new Error('Related Work index requires WorkStore');
  }
  if (!artifactStore || typeof artifactStore.listByWork !== 'function') {
    throw new Error('Related Work index requires CanvasArtifactStore');
  }

  function search({ intent, excludeWorkId = null, limit = 5 } = {}) {
    const query = tokenize(requiredText(intent, 'Related Work intent'));
    if (!Number.isSafeInteger(limit) || limit <= 0 || limit > 50) throw new Error('Related Work limit must be an integer between 1 and 50');
    if (!query.length) return [];
    const querySet = new Set(query);
    const candidates = [];

    for (const work of workStore.list()) {
      if (!work || !work.id || work.id === excludeWorkId) continue;
      const workWeights = tokenWeights(`${work.title || ''} ${work.brief || ''}`, 1);
      const artifacts = artifactStore.listByWork(work.id);
      for (const artifact of artifacts) {
        const weights = mergeWeights(workWeights, tokenWeights(artifact.title || '', 3));
        const matchedTerms = query.filter((token) => weights.has(token));
        if (!matchedTerms.length) continue;
        const score = matchedTerms.reduce((sum, token) => sum + weights.get(token), 0);
        candidates.push({
          workId: work.id,
          projectId: work.projectId || null,
          artifactId: artifact.id,
          artifactTitle: artifact.title,
          artifactRevision: artifact.revision || 1,
          score,
          matchedTerms: [...new Set(matchedTerms)],
          updatedAt: work.updatedAt || work.createdAt || null,
        });
      }
    }

    return candidates
      .sort((left, right) => right.score - left.score
        || String(right.updatedAt || '').localeCompare(String(left.updatedAt || ''))
        || left.artifactId.localeCompare(right.artifactId))
      .slice(0, limit)
      .map(({ updatedAt, ...candidate }) => candidate);
  }

  return { search };
}

module.exports = {
  createRelatedWorkIndex,
  tokenizeRelatedWorkText: tokenize,
};
