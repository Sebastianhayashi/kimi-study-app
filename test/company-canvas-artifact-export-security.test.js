'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  renderCanvasArtifactExportMarkdown,
  markdownLiteral,
  codeFence,
} = require('../lib/company/canvas-artifact-export');

test('semantic Artifact text cannot become Markdown images, raw HTML, raw TeX, citations, or list structure', () => {
  const document = {
    schemaVersion: 1,
    artifactId: 'artifact_export_security',
    workId: 'work_export_security',
    projectId: null,
    title: 'Literal ![secret](/etc/passwd) \\input{/etc/passwd}',
    revision: 1,
    blocks: [
      {
        type: 'paragraph',
        text: '<img src="file:///etc/passwd"> $HOME$ @secrets',
        evidenceRefs: [],
        references: [],
      },
      {
        type: 'list',
        items: ['![nested](/etc/shadow)', '- nested list marker', '# nested heading'],
        evidenceRefs: [],
        references: [],
      },
      {
        type: 'table',
        content: {
          columns: ['Name', 'Payload'],
          rows: [['row', '[link](file:///etc/passwd) | \\include{/etc/hosts}']],
        },
        evidenceRefs: [],
        references: [],
      },
      {
        type: 'static-interaction',
        prompt: 'Pick ![bad](/tmp/x)',
        fallback: {
          type: 'list',
          content: { items: ['<script>alert(1)</script>', '\\input{/etc/passwd}'] },
          evidenceRefs: [],
        },
        evidenceRefs: [],
        references: [],
      },
    ],
    sources: [],
  };

  const markdown = renderCanvasArtifactExportMarkdown(document);

  assert.doesNotMatch(markdown, /!\[secret\]\(\/etc\/passwd\)/);
  assert.doesNotMatch(markdown, /!\[nested\]\(\/etc\/shadow\)/);
  assert.doesNotMatch(markdown, /\[link\]\(file:\/\/\/etc\/passwd\)/);
  assert.doesNotMatch(markdown, /<img\s/i);
  assert.doesNotMatch(markdown, /<script>/i);
  assert.doesNotMatch(markdown, /(?<!\\)\\(?:input|include)\{/);
  assert.doesNotMatch(markdown, /\$HOME\$/);
  assert.doesNotMatch(markdown, /(?<!\\)@secrets/);

  assert.match(markdown, /\\!\\\[secret\\\]/);
  assert.match(markdown, /\\\\input\\\{/);
  assert.match(markdown, /&lt;img src=/);
  assert.match(markdown, /&lt;script&gt;/);
  assert.match(markdown, /\\\$HOME\\\$/);
  assert.match(markdown, /\\@secrets/);
});

test('literal Markdown escaping and code fences preserve semantics without opening a fence', () => {
  assert.equal(markdownLiteral('- list\n# heading\n1. ordered'), '\\- list\n\\# heading\n1\\. ordered');
  assert.equal(markdownLiteral('![image](path)'), '\\!\\[image\\](path)');
  assert.equal(markdownLiteral('<img>&'), '&lt;img&gt;&amp;');
  assert.equal(codeFence('before ````` after'), '``````');
  assert.equal(codeFence('plain code'), '```');
});
