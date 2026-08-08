'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createWorkspaceBrowser } = require('../lib/company/workspace-browser');

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lucubro-workspaces-'));
  fs.mkdirSync(path.join(root, 'Projects', 'alpha', '.git'), { recursive: true });
  fs.mkdirSync(path.join(root, 'Projects', 'beta'), { recursive: true });
  fs.mkdirSync(path.join(root, 'Documents'), { recursive: true });
  fs.mkdirSync(path.join(root, '.secret'), { recursive: true });
  fs.writeFileSync(path.join(root, 'notes.txt'), 'not a directory');
  return root;
}

test('workspace browser resolves ~ and lists safe directory children only', () => {
  const root = fixture();
  const browser = createWorkspaceBrowser({ rootDir: root, homeDir: root });
  try {
    const result = browser.list('~/');
    assert.equal(result.displayPath, '~');
    assert.deepEqual(result.entries.map((entry) => entry.name), ['Documents', 'Projects']);
    assert.equal(result.entries.every((entry) => entry.kind === 'directory'), true);
    assert.equal(result.entries.some((entry) => entry.name === '.secret'), false);
    assert.equal(result.entries.some((entry) => entry.name === 'notes.txt'), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('workspace browser suggests directory paths from a partially typed host path', () => {
  const root = fixture();
  const browser = createWorkspaceBrowser({ rootDir: root, homeDir: root });
  try {
    const result = browser.suggest('~/Pro');
    assert.deepEqual(result.suggestions.map((entry) => entry.displayPath), ['~/Projects']);

    const nested = browser.suggest('~/Projects/a');
    assert.deepEqual(nested.suggestions.map((entry) => entry.displayPath), ['~/Projects/alpha']);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('workspace browser inspects a selected host directory with truthful git evidence', () => {
  const root = fixture();
  const browser = createWorkspaceBrowser({ rootDir: root, homeDir: root });
  try {
    const repository = browser.inspect('~/Projects/alpha');
    assert.equal(repository.exists, true);
    assert.equal(repository.isDirectory, true);
    assert.equal(repository.isGitRepository, true);
    assert.equal(repository.displayPath, '~/Projects/alpha');

    const folder = browser.inspect('~/Projects/beta');
    assert.equal(folder.isGitRepository, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('workspace browser creates one directory inside the allowed host root', () => {
  const root = fixture();
  const browser = createWorkspaceBrowser({ rootDir: root, homeDir: root });
  try {
    const created = browser.createDirectory({ parentPath: '~/Projects', name: 'gamma' });
    assert.equal(created.displayPath, '~/Projects/gamma');
    assert.equal(fs.statSync(path.join(root, 'Projects', 'gamma')).isDirectory(), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('workspace browser refuses parent traversal and symlink escapes', () => {
  const root = fixture();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'lucubro-outside-'));
  const browser = createWorkspaceBrowser({ rootDir: root, homeDir: root });
  try {
    assert.throws(() => browser.list('~/../'), /outside the allowed workspace root/i);
    fs.symlinkSync(outside, path.join(root, 'Projects', 'outside-link'), 'dir');
    assert.throws(() => browser.list('~/Projects/outside-link'), /outside the allowed workspace root/i);
    assert.throws(
      () => browser.createDirectory({ parentPath: '~/Projects', name: '../escape' }),
      /single directory name/i,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});
