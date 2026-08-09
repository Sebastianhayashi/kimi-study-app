'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { evaluateIssueProposal } = require('../lib/company/issue-policy');

test('initial/simple Work never proposes an Issue merely because it produced an Artifact', () => {
  const decision = evaluateIssueProposal({
    workId: 'work_coffee_once',
    projectId: null,
    artifactCount: 2,
    frontier: null,
    independentlyTrackable: false,
  });

  assert.equal(decision.issueAction, 'none');
  assert.equal(decision.eligible, false);
  assert.equal(decision.reasonCodes.includes('no-project-context'), true);
  assert.equal(decision.reasonCodes.includes('artifact-output-is-not-issue-signal'), true);
});

test('only an independently trackable Project frontier can become an Issue proposal', () => {
  const decision = evaluateIssueProposal({
    workId: 'work_launch_followup',
    projectId: 'project_launch',
    frontier: 'Fix the remaining mobile navigation regression before release.',
    independentlyTrackable: true,
    trackerConfigured: true,
    trackerAuthorityGranted: false,
  });

  assert.equal(decision.eligible, true);
  assert.equal(decision.issueAction, 'propose');
  assert.equal(decision.requiresTrackerAuthority, true);
  assert.equal(decision.reasonCodes.includes('project-frontier'), true);
  assert.equal(decision.reasonCodes.includes('independently-trackable'), true);
  assert.equal(decision.reasonCodes.includes('tracker-authority-required'), true);
});

test('Project context without an independently trackable frontier remains inside Project context', () => {
  const decision = evaluateIssueProposal({
    workId: 'work_project_context',
    projectId: 'project_context',
    frontier: 'Continue learning and decide what to explore next.',
    independentlyTrackable: false,
    trackerConfigured: true,
  });

  assert.equal(decision.eligible, false);
  assert.equal(decision.issueAction, 'none');
  assert.equal(decision.reasonCodes.includes('not-independently-trackable'), true);
});

test('tracker availability and authority never manufacture eligibility', () => {
  const decision = evaluateIssueProposal({
    workId: 'work_no_project',
    projectId: null,
    frontier: 'A concrete task.',
    independentlyTrackable: true,
    trackerConfigured: true,
    trackerAuthorityGranted: true,
    skillIds: ['gstack:qa', 'matt:implement'],
  });

  assert.equal(decision.eligible, false);
  assert.equal(decision.issueAction, 'none');
  assert.equal(Object.hasOwn(decision, 'skillIds'), false);
  assert.equal(JSON.stringify(decision).includes('gstack:'), false);
});

test('eligible Issue proposal remains a proposal even when tracker authority is already granted', () => {
  const decision = evaluateIssueProposal({
    workId: 'work_bug',
    projectId: 'project_launch',
    frontier: 'Investigate and fix checkout timeout on mobile.',
    independentlyTrackable: true,
    trackerConfigured: true,
    trackerAuthorityGranted: true,
  });

  assert.equal(decision.eligible, true);
  assert.equal(decision.issueAction, 'propose');
  assert.equal(decision.requiresTrackerAuthority, false);
  assert.equal(decision.reasonCodes.includes('tracker-authority-present'), true);
});
