const fs = require('fs');
const path = require('path');

const FORMAT_BY_EXTENSION = new Map([
  ['.pdf', 'pdf'],
  ['.epub', 'epub'],
  ['.txt', 'text'],
  ['.md', 'text'],
  ['.markdown', 'text'],
  ['.html', 'html'],
  ['.htm', 'html'],
  ['.xhtml', 'html'],
  ['.jpg', 'image'],
  ['.jpeg', 'image'],
  ['.png', 'image'],
  ['.webp', 'image'],
]);

const SOURCE_DIRECTORIES = ['reference', 'references', 'source', 'sources', 'material', 'materials'];
const PRIVATE_NAMES = new Set(['mission.md', 'resources.md']);

function encodeRelativePath(relativePath) {
  return String(relativePath)
    .split(path.sep)
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/');
}

function sourceTitle(relativePath) {
  const name = path.basename(relativePath, path.extname(relativePath));
  if (/^book(?:[-_ ]?\d+)?$/i.test(name)) return name.replace(/^book/i, '原始材料');
  return name.replace(/[-_]+/g, ' ').trim() || path.basename(relativePath);
}

function addFile(courseDir, relativePath, files) {
  const normalized = path.normalize(relativePath);
  if (normalized.startsWith(`..${path.sep}`) || path.isAbsolute(normalized)) return;
  if (PRIVATE_NAMES.has(path.basename(normalized).toLowerCase())) return;

  const extension = path.extname(normalized).toLowerCase();
  const kind = FORMAT_BY_EXTENSION.get(extension);
  if (!kind) return;

  const absolute = path.join(courseDir, normalized);
  let stat;
  try {
    stat = fs.lstatSync(absolute);
  } catch {
    return;
  }
  if (!stat.isFile() || stat.isSymbolicLink()) return;

  files.push({
    id: normalized.split(path.sep).join('/'),
    name: path.basename(normalized),
    title: sourceTitle(normalized),
    path: normalized.split(path.sep).join('/'),
    kind,
    extension: extension.slice(1),
    size: stat.size,
    primary: /^book(?:[-_ ]?\d+)?\./i.test(path.basename(normalized)),
    url: encodeRelativePath(normalized),
  });
}

function walkDirectory(courseDir, relativeDir, files, depth = 0) {
  if (depth > 2) return;
  const absoluteDir = path.join(courseDir, relativeDir);
  let entries;
  try {
    entries = fs.readdirSync(absoluteDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const relative = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) walkDirectory(courseDir, relative, files, depth + 1);
    else if (entry.isFile()) addFile(courseDir, relative, files);
  }
}

function listCourseSources(courseDir, courseId) {
  const files = [];
  let rootEntries = [];
  try {
    rootEntries = fs.readdirSync(courseDir, { withFileTypes: true });
  } catch {
    return [];
  }

  for (const entry of rootEntries) {
    if (!entry.isFile()) continue;
    if (/^book(?:[-_ ]?\d+)?\./i.test(entry.name)) addFile(courseDir, entry.name, files);
  }

  for (const directory of SOURCE_DIRECTORIES) {
    walkDirectory(courseDir, directory, files);
  }

  const prefix = `/api/courses/${encodeURIComponent(courseId)}/`;
  return files
    .sort((a, b) => Number(b.primary) - Number(a.primary) || a.path.localeCompare(b.path, 'zh-CN'))
    .map((file) => ({ ...file, url: prefix + file.url }));
}

module.exports = {
  FORMAT_BY_EXTENSION,
  listCourseSources,
};
