'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildArtifactCritiquePrompt, parseArtifactCritiqueResponse, runArtifactCritique } = require('../lib/artifact-critique');

const artifact = {
  id: 'a_1234567890abcdef',
  taskType: 'zhihu-answer',
  title: 'Question',
  audience: 'Reader',
  missionSnapshot: { expectedOutput: 'A publishable answer' },
  rubric: [
    { id: 'r_argument', label: 'Claim', minimum: 'Clear' },
    { id: 'r_evidence', label: 'Evidence', minimum: 'Grounded' },
    { id: 'r_action', label: 'Action', minimum: 'Useful' },
  ],
};

const response = JSON.stringify({
  gaps: [{
    rubricItemId: 'r_evidence',
    summary: 'The causal claim lacks source evidence',
    severity: 'high',
    evidence: 'The paragraph makes a causal claim without a citation.',
    anchor: { exact: 'Evidence sentence' },
    sourceRefs: ['book.txt#chapter-1'],
  }],
});

test('strict critique parsing binds a real anchor and rejects replacement prose', () => {
  const gaps = parseArtifactCritiqueResponse(response, {
    artifact,
    revisionId: 'rev_1',
    body: 'Opening. Evidence sentence closes the paragraph.',
    randomUUID: () => '11111111-1111-1111-1111-111111111111',
  });
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].anchor.position.start, 9);
  assert.match(gaps[0].anchor.anchorHash, /^sha256:/);
  assert.throws(() => parseArtifactCritiqueResponse('```json\n{}\n```', { artifact, revisionId: 'rev_1', body: 'x' }), /strict JSON/);
  assert.throws(() => parseArtifactCritiqueResponse(JSON.stringify({ gaps: [{
    ...JSON.parse(response).gaps[0], replacementText: 'Use this paragraph',
  }] }), { artifact, revisionId: 'rev_1', body: 'Evidence sentence' }), /replacement prose/);
});

test('critique runner is stateless and uses the supplied model runner', async () => {
  let options;
  const gaps = await runArtifactCritique({
    courseDir: '/tmp/course',
    artifact,
    revisionId: 'rev_1',
    body: 'Evidence sentence',
    rubricItemIds: ['r_evidence'],
    model: 'test-model',
    skillsDir: '/tmp/skills',
    randomUUID: () => '22222222-2222-2222-2222-222222222222',
    runTrackedKimiImpl: async (value) => {
      options = value;
      return { status: 'finished', text: response };
    },
  });
  assert.equal(options.sessionId, null);
  assert.equal(options.preferredMode, 'stream-json');
  assert.match(options.prompt, /不要读取 assessments 或答案键/);
  assert.doesNotMatch(options.prompt, /replacementText/);
  assert.equal(gaps[0].rubricItemId, 'r_evidence');
});


test('critique runner rejects model gaps outside the selected rubric subset', async () => {
  const wrongRubricResponse = JSON.stringify({
    gaps: [{
      rubricItemId: 'r_argument',
      summary: 'The claim is unclear',
      severity: 'high',
      evidence: 'The opening does not state the main claim.',
      anchor: { exact: 'Evidence sentence' },
      sourceRefs: ['book.txt#chapter-1'],
    }],
  });
  await assert.rejects(() => runArtifactCritique({
    courseDir: '/tmp/course',
    artifact,
    revisionId: 'rev_1',
    body: 'Evidence sentence',
    rubricItemIds: ['r_evidence'],
    randomUUID: () => '33333333-3333-3333-3333-333333333333',
    runTrackedKimiImpl: async () => ({ status: 'finished', text: wrongRubricResponse }),
  }), /unknown rubric item/);
});

test('critique prompt carries only selected rubric items', () => {
  const prompt = buildArtifactCritiquePrompt({ artifact, revisionId: 'rev_1', body: 'Evidence sentence', rubricItemIds: ['r_evidence'] });
  assert.match(prompt, /r_evidence/);
  assert.doesNotMatch(prompt, /r_argument/);
});
