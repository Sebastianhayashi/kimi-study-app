'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createSkillCompatibilityRegistry } = require('../lib/company/skill-compatibility');

const MATT_COMMIT = '84fdeffd12f2ee307994d1eb6feb48173b6e0502';
const GSTACK_COMMIT = '94993f74012782fd94416dd44b8314f6363a13a4';

function metadata(bundleId, bundleCommit, name) {
  return {
    id: `${bundleId}:${name}`,
    bundleId,
    bundleCommit,
    name,
  };
}

function registry() {
  return createSkillCompatibilityRegistry({
    host: 'codex',
    policies: [
      {
        bundleId: 'mattpocock-skills',
        bundleCommit: MATT_COMMIT,
        defaultStatus: 'native',
        overrides: {},
      },
      {
        bundleId: 'gstack',
        bundleCommit: GSTACK_COMMIT,
        defaultStatus: 'native',
        overrides: {
          'office-hours': {
            status: 'overlay-required',
            reason: 'Upstream interaction assumes AskUserQuestion; Lucubro must bridge that host interaction.',
            overlay: {
              id: 'gstack-office-hours-codex-question-bridge',
              version: 1,
              toolMappings: {
                AskUserQuestion: 'lucubro.needs-you.request-input',
              },
            },
          },
          'blocked-fixture': {
            status: 'blocked',
            reason: 'Fixture represents an unsupported host assumption.',
          },
        },
      },
    ],
  });
}

test('compatibility registry keeps upstream Skill identity while resolving host adaptation separately', () => {
  const compatibility = registry();

  const native = compatibility.resolve(metadata('mattpocock-skills', MATT_COMMIT, 'tdd'));
  assert.equal(native.status, 'native');
  assert.equal(native.overlay, null);

  const adapted = compatibility.resolve(metadata('gstack', GSTACK_COMMIT, 'office-hours'));
  assert.equal(adapted.status, 'overlay-required');
  assert.equal(adapted.skillId, 'gstack:office-hours');
  assert.deepEqual(adapted.overlay, {
    id: 'gstack-office-hours-codex-question-bridge',
    version: 1,
    toolMappings: {
      AskUserQuestion: 'lucubro.needs-you.request-input',
    },
  });

  const blocked = compatibility.resolve(metadata('gstack', GSTACK_COMMIT, 'blocked-fixture'));
  assert.equal(blocked.status, 'blocked');
  assert.match(blocked.reason, /unsupported host assumption/);
});

test('bundle commit drift invalidates old compatibility policy and fails closed', () => {
  const compatibility = registry();
  const updatedCommit = 'dddddddddddddddddddddddddddddddddddddddd';

  const result = compatibility.resolve(metadata('gstack', updatedCommit, 'office-hours'));

  assert.equal(result.status, 'blocked');
  assert.equal(result.overlay, null);
  assert.match(result.reason, /No compatible policy for this exact bundle commit/);
});

test('unregistered bundle compatibility fails closed instead of assuming native', () => {
  const compatibility = registry();

  const result = compatibility.resolve(metadata('unknown-bundle', 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', 'mystery'));

  assert.equal(result.status, 'blocked');
  assert.match(result.reason, /No compatible policy/);
});
