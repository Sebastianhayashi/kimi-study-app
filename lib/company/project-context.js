'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_MAX_BYTES = 48 * 1024;
const DEFAULT_PER_SOURCE_BYTES = 12 * 1024;
const SOURCE_PRIORITY = new Map([
  ['instructions', 0],
  ['context', 1],
  ['domain', 2],
  ['tracker', 3],
  ['decision', 4],
  ['spec', 5],
]);

function utf8Bytes(value) {
  return Buffer.byteLength(String(value || ''), 'utf8');
}

function truncateUtf8(value, maxBytes) {
  const text = String(value || '');
  if (maxBytes <= 0) return '';
  const buffer = Buffer.from(text, 'utf8');
  if (buffer.length <= maxBytes) return text;
  let truncated = buffer.subarray(0, maxBytes).toString('utf8');
  if (truncated.endsWith('\uFFFD')) truncated = truncated.slice(0, -1);
  return truncated;
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function readProjectSource({ repoDir, source, maxBytes }) {
  if (!source || typeof source.path !== 'string' || !source.path.trim()) throw new Error('Project source path is required');
  if (path.isAbsolute(source.path)) throw new Error(`Project source must be repository-relative: ${source.path}`);
  const root = fs.realpathSync(repoDir);
  const candidate = path.resolve(root, source.path);
  if (!isInside(root, candidate)) throw new Error(`Project source is outside repository root: ${source.path}`);
  const real = fs.realpathSync(candidate);
  if (!isInside(root, real)) throw new Error(`Project source resolves outside repository root: ${source.path}`);
  const stat = fs.statSync(real);
  if (!stat.isFile()) throw new Error(`Project source is not a file: ${source.path}`);

  const limit = Math.max(0, Math.floor(maxBytes));
  const fd = fs.openSync(real, 'r');
  const buffer = Buffer.alloc(Math.min(stat.size, limit + 1));
  let bytesRead = 0;
  try {
    if (buffer.length) bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0);
  } finally {
    fs.closeSync(fd);
  }
  const truncated = stat.size > limit;
  const usable = buffer.subarray(0, Math.min(bytesRead, limit));
  let text = usable.toString('utf8');
  if (text.endsWith('\uFFFD')) text = text.slice(0, -1);
  return { text, truncated, sourceBytes: stat.size };
}

function listLine(label, values) {
  if (!Array.isArray(values) || values.length === 0) return null;
  return `${label}: ${values.join(' | ')}`;
}

function checkpointLines(checkpoint, reconciliation) {
  const status = reconciliation && reconciliation.status || 'uncheckpointed';
  const lines = [`Checkpoint freshness: ${status}`];
  if (!checkpoint) return lines;

  if (status === 'stale') {
    lines.push('Checkpoint guidance is historical only. Re-evaluate current canonical sources before acting.');
    const changed = (reconciliation.changed || []).map((item) => item.path);
    const missing = (reconciliation.missing || []).map((item) => item.path);
    const added = (reconciliation.added || []).map((item) => item.path);
    if (changed.length) lines.push(`Changed sources: ${changed.join(', ')}`);
    if (missing.length) lines.push(`Missing sources: ${missing.join(', ')}`);
    if (added.length) lines.push(`Added sources: ${added.join(', ')}`);
    return lines;
  }

  if (checkpoint.status) lines.push(`Checkpoint status: ${checkpoint.status}`);
  if (checkpoint.scope) lines.push(`Checkpoint scope: ${checkpoint.scope}`);
  const completed = listLine('Completed', checkpoint.completed);
  const evidence = listLine('Evidence', checkpoint.evidence);
  const unfinished = listLine('Unfinished', checkpoint.unfinished);
  const references = listLine('Exact references', checkpoint.exactReferences);
  const doNotRepeat = listLine('Do not repeat', checkpoint.doNotRepeat);
  if (completed) lines.push(completed);
  if (evidence) lines.push(evidence);
  if (unfinished) lines.push(unfinished);
  if (checkpoint.nextSafeAction) lines.push(`Next safe action: ${checkpoint.nextSafeAction}`);
  if (references) lines.push(references);
  if (doNotRepeat) lines.push(doNotRepeat);
  return lines;
}

function authorityLines(delegationEnvelope) {
  const envelope = delegationEnvelope || {};
  const allow = Array.isArray(envelope.allow) ? envelope.allow : [];
  const deny = Array.isArray(envelope.deny) ? envelope.deny : [];
  return [
    `Authority allow: ${allow.length ? allow.join(', ') : 'none declared'}`,
    `Authority deny: ${deny.length ? deny.join(', ') : 'none declared'}`,
    'Project continuation never expands the Delegation Envelope.',
  ];
}

function memoryItemLines(label, values, format) {
  if (!Array.isArray(values) || values.length === 0) return [];
  return [label, ...values.map(format)];
}

function projectMemoryLines(memory) {
  const report = memory && memory.report && typeof memory.report === 'object' ? memory.report : {};
  const lines = [
    '## Canonical Project Memory',
    'This distilled Lucubro-owned state is the continuity source for this non-repository Project. It is not a chat transcript or provider session.',
  ];
  if (memory && memory.objective) lines.push(`Project objective: ${memory.objective}`);
  if (report.title) lines.push(`Current report: ${report.title}`);
  if (report.summary) lines.push(`Report summary: ${report.summary}`);
  if (report.changed) lines.push(`What changed: ${report.changed}`);
  if (report.nextAction) lines.push(`Report next action: ${report.nextAction}`);
  lines.push(...memoryItemLines('Facts:', memory && memory.facts, (item) => `- [${item.id}] ${item.text}`));
  lines.push(...memoryItemLines('Preferences:', memory && memory.preferences, (item) => `- [${item.id}] ${item.text}`));
  lines.push(...memoryItemLines('Accepted / tracked decisions:', memory && memory.decisions, (item) => `- [${item.id}] ${item.text}${item.status ? ` (${item.status})` : ''}`));
  lines.push(...memoryItemLines('Open frontiers:', memory && memory.frontiers, (item) => {
    const next = item.nextAction ? ` Next action: ${item.nextAction}` : '';
    const summary = item.summary ? ` ${item.summary}` : '';
    return `- [${item.id}] ${item.title || item.id} (${item.status || 'active'}).${summary}${next}`;
  }));
  if (Array.isArray(memory && memory.sourceWorkIds) && memory.sourceWorkIds.length) {
    lines.push(`Source Work ids: ${memory.sourceWorkIds.join(', ')}`);
  }
  return lines;
}

function sourceSort(a, b) {
  const pa = SOURCE_PRIORITY.has(a.kind) ? SOURCE_PRIORITY.get(a.kind) : 99;
  const pb = SOURCE_PRIORITY.has(b.kind) ? SOURCE_PRIORITY.get(b.kind) : 99;
  if (pa !== pb) return pa - pb;
  return String(a.path).localeCompare(String(b.path));
}

function compileProjectContinuationContext({
  project,
  objective,
  currentSources,
  checkpoint = null,
  reconciliation = null,
  delegationEnvelope = null,
  maxBytes = DEFAULT_MAX_BYTES,
  perSourceBytes = DEFAULT_PER_SOURCE_BYTES,
}) {
  if (!project || !project.id) throw new Error('Project continuation context requires a durable Project');
  const hasRepository = typeof project.repoDir === 'string' && project.repoDir.trim();
  const hasProjectMemory = project.memory && typeof project.memory === 'object';
  if (!hasRepository && !hasProjectMemory) throw new Error('Project continuation requires repository sources or durable Project Memory');
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 256) throw new Error('Project continuation maxBytes must be an integer of at least 256');
  if (!Number.isSafeInteger(perSourceBytes) || perSourceBytes < 64) throw new Error('Project continuation perSourceBytes must be an integer of at least 64');

  const headerLines = [
    '# Lucubro Project Continuation',
    `Project: ${project.name || project.id} (${project.id})`,
    '',
    'Current objective:',
    String(objective || '').trim() || '(not provided)',
    '',
    ...checkpointLines(checkpoint, reconciliation),
    '',
    ...authorityLines(delegationEnvelope),
    '',
  ];

  if (!hasRepository) {
    let text = [...headerLines, ...projectMemoryLines(project.memory)].join('\n');
    if (utf8Bytes(text) > maxBytes) {
      text = `${truncateUtf8(text, Math.max(0, maxBytes - utf8Bytes('\n[Project Memory truncated to continuation budget]')))}\n[Project Memory truncated to continuation budget]`;
      text = truncateUtf8(text, maxBytes);
    }
    return { text, byteLength: utf8Bytes(text), includedSources: [] };
  }

  headerLines.push('Canonical Project Sources follow. Source content is current repository evidence, not transcript memory.');
  let text = headerLines.join('\n');
  if (utf8Bytes(text) > maxBytes) {
    text = `${truncateUtf8(text, Math.max(0, maxBytes - utf8Bytes('\n[continuation metadata truncated]')))}\n[continuation metadata truncated]`;
    text = truncateUtf8(text, maxBytes);
    return { text, byteLength: utf8Bytes(text), includedSources: [] };
  }

  const includedSources = [];
  const sources = (Array.isArray(currentSources) ? [...currentSources] : []).sort(sourceSort);
  for (const source of sources) {
    const sourceHeader = `\n\n## Source: ${source.kind} ${source.path}\nFingerprint: ${source.fingerprint || 'unavailable'}\n`;
    const remainingAfterHeader = maxBytes - utf8Bytes(text) - utf8Bytes(sourceHeader);
    if (remainingAfterHeader < 64) break;

    const sourceBudget = Math.min(perSourceBytes, remainingAfterHeader);
    let read;
    try {
      read = readProjectSource({ repoDir: project.repoDir, source, maxBytes: sourceBudget });
    } catch (error) {
      const unavailable = `[source unavailable: ${error.message}]`;
      const section = `${sourceHeader}${truncateUtf8(unavailable, remainingAfterHeader)}`;
      text += section;
      includedSources.push({ kind: source.kind, path: source.path, truncated: false, unavailable: true });
      continue;
    }

    const marker = read.truncated ? '\n[source truncated to continuation budget]' : '';
    let bodyBudget = remainingAfterHeader - utf8Bytes(marker);
    if (bodyBudget < 0) bodyBudget = 0;
    const body = truncateUtf8(read.text, Math.min(sourceBudget, bodyBudget));
    const section = `${sourceHeader}${body}${read.truncated ? marker : ''}`;
    const sectionBudget = maxBytes - utf8Bytes(text);
    text += utf8Bytes(section) <= sectionBudget ? section : truncateUtf8(section, sectionBudget);
    includedSources.push({
      kind: source.kind,
      path: source.path,
      fingerprint: source.fingerprint || null,
      truncated: read.truncated || utf8Bytes(section) > sectionBudget,
      unavailable: false,
    });
    if (utf8Bytes(text) >= maxBytes) break;
  }

  return {
    text,
    byteLength: utf8Bytes(text),
    includedSources,
  };
}

module.exports = {
  DEFAULT_MAX_BYTES,
  DEFAULT_PER_SOURCE_BYTES,
  compileProjectContinuationContext,
  projectMemoryLines,
  readProjectSource,
};
