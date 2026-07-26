'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateCuriosityDocument } = require('../lib/curiosity-contract');

const goodCard = {
  id: 'semantic-surprise',
  hook: '为什么一部令人压抑的电影仍可能被归入 entertainment？',
  prediction: { prompt: '先选一个更接近你的直觉。', options: ['因为它一定让人快乐', '因为它能持续吸引并组织注意'] },
  reveal: '词语的历史来源、现代词典义和文化分类并不是同一层主张。可靠解释需要分别说明，而不是把一个漂亮词源故事当成现代词义的全部。',
  bridge: '这能帮助学习者避免把两个语言中的近似翻译误认为完全相同的概念边界。',
  section: '词义与文化',
  source: { label: '词典与词源资料' },
  scores: { relevance: 5, surprise: 4, clarity: 4, confidence: 4, load: 2 },
};

test('high-quality curiosity card passes', () => {
  const objectCard = {
    ...goodCard,
    prediction: {
      ...goodCard.prediction,
      options: [{ id: 'a', label: '承认之前的判断可能有误' }, { id: 'b', text: '为原结论寻找新解释' }],
    },
    source: undefined,
    sourceRefs: [{ label: '《侦察兵思维》第1章', section: '皮卡尔重审德雷福斯间谍案' }],
  };
  const result = validateCuriosityDocument({ schemaVersion: 1, lessonId: '0001-example', cards: [objectCard] });
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.deepEqual(result.document.cards[0].prediction.options, ['承认之前的判断可能有误', '为原结论寻找新解释']);
  assert.deepEqual(result.document.cards[0].source.refs, ['《侦察兵思维》第1章']);
  assert.doesNotMatch(JSON.stringify(result.document), /\[object Object\]/);
});

test('irrelevant or low-confidence trivia is blocked', () => {
  const result = validateCuriosityDocument({ schemaVersion: 1, lessonId: '0001-example', cards: [{ ...goodCard, scores: { relevance: 2, surprise: 5, clarity: 4, confidence: 2, load: 2 } }] });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /relevance/);
  assert.match(result.errors.join('\n'), /confidence/);
});

test('curiosity is optional and capped at three cards', () => {
  const empty = validateCuriosityDocument({ schemaVersion: 1, lessonId: '0001-example', cards: [] });
  assert.equal(empty.ok, true);
  const many = validateCuriosityDocument({ schemaVersion: 1, lessonId: '0001-example', cards: [0,1,2,3,4].map((i) => ({ ...goodCard, id: `card-${i}` })) });
  assert.equal(many.document.cards.length, 3);
});
