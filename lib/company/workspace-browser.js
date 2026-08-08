'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function createWorkspaceBrowser({
  rootDir = process.env.LUCUBRO_WORKSPACE_ROOT || os.homedir(),
  homeDir = os.homedir(),
  showHidden = false,
} = {}) {
  const configuredRoot = path.resolve(rootDir);
  const realRoot = fs.realpathSync(configuredRoot);
  const configuredHome = path.resolve(homeDir);
  const homeInsideRoot = isInside(realRoot, fs.realpathSync(configuredHome));

  function resolveInput(input = '~') {
    const raw = String(input || '~').trim() || '~';
    let absolute;
    if (raw === '~' || raw.startsWith(`~${path.sep}`) || raw.startsWith('~/')) {
      if (!homeInsideRoot) throw new Error('Home is outside the allowed workspace root.');
      const suffix = raw.slice(1).replace(/^[/\\]+/, '');
      absolute = path.resolve(configuredHome, suffix);
    } else if (path.isAbsolute(raw)) {
      absolute = path.resolve(raw);
    } else {
      absolute = path.resolve(configuredRoot, raw);
    }
    if (!isInside(configuredRoot, absolute)) throw new Error('Path is outside the allowed workspace root.');
    return absolute;
  }

  function resolveExisting(input) {
    const absolute = resolveInput(input);
    const real = fs.realpathSync(absolute);
    if (!isInside(realRoot, real)) throw new Error('Path is outside the allowed workspace root.');
    return { absolute, real };
  }

  function displayPathFor(absolute) {
    const normalized = path.resolve(absolute);
    if (homeInsideRoot && isInside(configuredHome, normalized)) {
      const relative = path.relative(configuredHome, normalized);
      return relative ? `~/${relative.split(path.sep).join('/')}` : '~';
    }
    return normalized;
  }

  function directoryHasChildren(directory) {
    try {
      return fs.readdirSync(directory, { withFileTypes: true }).some((entry) => {
        if (!entry.isDirectory()) return false;
        if (!showHidden && entry.name.startsWith('.')) return false;
        return true;
      });
    } catch {
      return false;
    }
  }

  function describeDirectory(directory) {
    const stat = fs.statSync(directory);
    if (!stat.isDirectory()) throw new Error('Path is not a directory.');
    return {
      path: directory,
      displayPath: displayPathFor(directory),
      exists: true,
      isDirectory: true,
      isGitRepository: fs.existsSync(path.join(directory, '.git')),
    };
  }

  function list(input = '~') {
    const { real } = resolveExisting(input);
    const current = describeDirectory(real);
    const entries = fs.readdirSync(real, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .filter((entry) => showHidden || !entry.name.startsWith('.'))
      .map((entry) => {
        const absolute = path.join(real, entry.name);
        return {
          kind: 'directory',
          name: entry.name,
          path: absolute,
          displayPath: displayPathFor(absolute),
          hasChildren: directoryHasChildren(absolute),
          isGitRepository: fs.existsSync(path.join(absolute, '.git')),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

    return { ...current, entries };
  }

  function suggest(input = '') {
    const raw = String(input || '').trim();
    if (!raw) return { query: raw, suggestions: [] };

    const normalizedRaw = raw.replace(/\\/g, '/');
    const endsWithSeparator = normalizedRaw.endsWith('/');
    let candidate = resolveInput(normalizedRaw);
    let parent = endsWithSeparator ? candidate : path.dirname(candidate);
    let prefix = endsWithSeparator ? '' : path.basename(candidate);

    let parentReal;
    try {
      parentReal = fs.realpathSync(parent);
    } catch {
      return { query: raw, suggestions: [] };
    }
    if (!isInside(realRoot, parentReal)) throw new Error('Path is outside the allowed workspace root.');

    const lowerPrefix = prefix.toLocaleLowerCase();
    const suggestions = fs.readdirSync(parentReal, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .filter((entry) => showHidden || !entry.name.startsWith('.'))
      .filter((entry) => !lowerPrefix || entry.name.toLocaleLowerCase().startsWith(lowerPrefix))
      .slice(0, 12)
      .map((entry) => {
        const absolute = path.join(parentReal, entry.name);
        return {
          kind: 'directory',
          name: entry.name,
          path: absolute,
          displayPath: displayPathFor(absolute),
          hasChildren: directoryHasChildren(absolute),
          isGitRepository: fs.existsSync(path.join(absolute, '.git')),
        };
      });

    return { query: raw, suggestions };
  }

  function inspect(input) {
    const absolute = resolveInput(input);
    if (!fs.existsSync(absolute)) {
      return {
        path: absolute,
        displayPath: displayPathFor(absolute),
        exists: false,
        isDirectory: false,
        isGitRepository: false,
      };
    }
    const { real } = resolveExisting(input);
    return describeDirectory(real);
  }

  function createDirectory({ parentPath = '~', name }) {
    const safeName = String(name || '').trim();
    if (!safeName || safeName === '.' || safeName === '..' || /[/\\]/.test(safeName)) {
      throw new Error('Folder name must be a single directory name.');
    }
    const { real: parentReal } = resolveExisting(parentPath);
    if (!fs.statSync(parentReal).isDirectory()) throw new Error('Parent path is not a directory.');
    const target = path.join(parentReal, safeName);
    if (!isInside(realRoot, target)) throw new Error('Path is outside the allowed workspace root.');
    fs.mkdirSync(target, { recursive: false });
    return describeDirectory(target);
  }

  return {
    root: describeDirectory(realRoot),
    list,
    suggest,
    inspect,
    createDirectory,
  };
}

module.exports = { createWorkspaceBrowser };
