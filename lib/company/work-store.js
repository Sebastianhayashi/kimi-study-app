const fs = require('fs');
const path = require('path');

const SAFE_ID = /^[a-zA-Z0-9_-]+$/;

function assertId(id) {
  if (typeof id !== 'string' || !SAFE_ID.test(id)) throw new Error(`Invalid Work id: ${id}`);
  return id;
}

function writeAtomic(file, value) {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, file);
}

function createWorkStore({ rootDir, now = () => new Date().toISOString() }) {
  if (!rootDir) throw new Error('Work store rootDir is required');
  const worksDir = path.join(rootDir, 'works');
  fs.mkdirSync(worksDir, { recursive: true });
  const fileFor = (id) => path.join(worksDir, `${assertId(id)}.json`);

  function create(input) {
    const file = fileFor(input.id);
    if (fs.existsSync(file)) throw new Error(`Work already exists: ${input.id}`);
    const timestamp = now();
    const work = {
      id: input.id,
      brief: String(input.brief || '').trim(),
      title: String(input.title || input.brief || '').trim().split('\n')[0].slice(0, 96),
      projectId: input.projectId || null,
      assignedEmployeeId: input.assignedEmployeeId || null,
      status: input.status || 'proposed',
      activeRunId: input.activeRunId || null,
      repoDir: input.repoDir || null,
      runtime: input.runtime || null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    writeAtomic(file, work);
    return work;
  }

  function get(id) {
    const file = fileFor(id);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }

  function update(id, patch) {
    const current = get(id);
    if (!current) throw new Error(`Work not found: ${id}`);
    const next = { ...current, ...patch, id: current.id, updatedAt: now() };
    writeAtomic(fileFor(id), next);
    return next;
  }

  function list() {
    return fs.readdirSync(worksDir)
      .filter((name) => name.endsWith('.json'))
      .map((name) => JSON.parse(fs.readFileSync(path.join(worksDir, name), 'utf8')))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  return { create, get, update, list };
}

module.exports = { createWorkStore };
