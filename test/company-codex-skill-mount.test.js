'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { establishCodexSkillMount } = require('../lib/company/runtime/codex-skill-mount');

function tempRoot(t, prefix = 'lucubro-codex-skill-mount-') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function writeSkill(root, name, description = `${name} description`) {
  const directory = path.join(root, name);
  fs.mkdirSync(directory, { recursive: true });
  const skillPath = path.join(directory, 'SKILL.md');
  const body = `---\nname: ${name}\ndescription: ${description}\n---\n# ${name}\n`;
  fs.writeFileSync(skillPath, body);
  return {
    name,
    skillPath,
    contentHash: `sha256:${crypto.createHash('sha256').update(body).digest('hex')}`,
  };
}

function expected(skill, overrides = {}) {
  return {
    skillId: `mattpocock-skills:${skill.name}`,
    bundleId: 'mattpocock-skills',
    bundleCommit: '84fdeffd12f2ee307994d1eb6feb48173b6e0502',
    name: skill.name,
    contentHash: skill.contentHash,
    skillPath: skill.skillPath,
    activation: 'model',
    overlay: null,
    ...overrides,
  };
}

test('same-process Codex mount sets one run-scoped root, force-reloads skills, and returns a verified receipt', async (t) => {
  const mountRoot = tempRoot(t);
  const research = writeSkill(mountRoot, 'research');
  const teach = writeSkill(mountRoot, 'teach');
  const calls = [];
  const rpc = async (method, params) => {
    calls.push({ method, params });
    if (method === 'skills/extraRoots/set') return {};
    if (method === 'skills/list') {
      return {
        data: [{
          cwd: '/work/lucubro',
          skills: [
            { name: 'research', description: 'research description', path: research.skillPath, scope: 'user', enabled: true },
            { name: 'teach', description: 'teach description', path: teach.skillPath, scope: 'user', enabled: true },
            { name: 'system-helper', description: 'system', path: '/opt/codex/system-helper/SKILL.md', scope: 'system', enabled: true },
          ],
          errors: [],
        }],
      };
    }
    throw new Error(`Unexpected RPC: ${method}`);
  };

  const receipt = await establishCodexSkillMount({
    rpc,
    cwd: '/work/lucubro',
    mount: {
      root: mountRoot,
      expectedSkills: [
        expected(research),
        expected(teach, { activation: 'user-intent', userIntentEvidence: 'Teach me' }),
      ],
    },
  });

  assert.equal(receipt.kind, 'codex-skill-mount-receipt');
  assert.equal(receipt.verified, true);
  assert.equal(receipt.mountRoot, fs.realpathSync(mountRoot));
  assert.deepEqual(receipt.skills.map((skill) => [skill.skillId, skill.name, skill.enabled]), [
    ['mattpocock-skills:research', 'research', true],
    ['mattpocock-skills:teach', 'teach', true],
  ]);
  assert.equal(receipt.skills[1].activation, 'user-intent');
  assert.equal(receipt.skills[1].userIntentEvidence, 'Teach me');
  assert.deepEqual(calls, [
    { method: 'skills/extraRoots/set', params: { extraRoots: [fs.realpathSync(mountRoot)] } },
    { method: 'skills/list', params: { cwds: ['/work/lucubro'], forceReload: true } },
  ]);
});

test('mount verification fails when an unselected Skill is visible inside the run-scoped mount root', async (t) => {
  const mountRoot = tempRoot(t);
  const research = writeSkill(mountRoot, 'research');
  const surprise = writeSkill(mountRoot, 'surprise');
  const rpc = async (method) => {
    if (method === 'skills/extraRoots/set') return {};
    return {
      data: [{
        cwd: '/work/lucubro',
        skills: [
          { name: 'research', description: 'research', path: research.skillPath, scope: 'user', enabled: true },
          { name: 'surprise', description: 'surprise', path: surprise.skillPath, scope: 'user', enabled: true },
        ],
        errors: [],
      }],
    };
  };

  await assert.rejects(
    establishCodexSkillMount({
      rpc,
      cwd: '/work/lucubro',
      mount: { root: mountRoot, expectedSkills: [expected(research)] },
    }),
    /Unexpected Skill visible inside mount root: surprise/,
  );
});

test('mount verification fails before provider RPC if expected local Skill content hash drifted', async (t) => {
  const mountRoot = tempRoot(t);
  const research = writeSkill(mountRoot, 'research');
  let called = false;
  const rpc = async () => { called = true; return {}; };

  await assert.rejects(
    establishCodexSkillMount({
      rpc,
      cwd: '/work/lucubro',
      mount: {
        root: mountRoot,
        expectedSkills: [expected(research, { contentHash: `sha256:${'0'.repeat(64)}` })],
      },
    }),
    /Skill content hash mismatch before mount/,
  );
  assert.equal(called, false);
});

test('mount verification fails when Codex does not report an expected Skill as enabled at the exact mounted path', async (t) => {
  const mountRoot = tempRoot(t);
  const research = writeSkill(mountRoot, 'research');
  const rpc = async (method) => {
    if (method === 'skills/extraRoots/set') return {};
    return {
      data: [{
        cwd: '/work/lucubro',
        skills: [{ name: 'research', description: 'research', path: research.skillPath, scope: 'user', enabled: false }],
        errors: [],
      }],
    };
  };

  await assert.rejects(
    establishCodexSkillMount({
      rpc,
      cwd: '/work/lucubro',
      mount: { root: mountRoot, expectedSkills: [expected(research)] },
    }),
    /Expected Skill is not enabled in Codex mount: research/,
  );
});
