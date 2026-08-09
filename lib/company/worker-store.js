'use strict';

const fs = require('fs');
const path = require('path');

const SAFE_ID = /^[a-zA-Z0-9_-]+$/;

function assertId(id) {
  if (typeof id !== 'string' || !SAFE_ID.test(id)) throw new Error(`Invalid Worker id: ${id}`);
  return id;
}

function writeJsonAtomic(file, value) {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, file);
}

function createWorkerStore({ rootDir, now = () => new Date().toISOString() }) {
  if (!rootDir) throw new Error('Worker store rootDir is required');
  const workersDir = path.join(rootDir, 'workers');
  fs.mkdirSync(workersDir, { recursive: true });

  const statePath = (id) => path.join(workersDir, `${assertId(id)}.json`);

  function get(id) {
    const file = statePath(id);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }

  function upsert(input) {
    assertId(input && input.id);
    const name = String(input && input.name || '').trim();
    if (!name) throw new Error('Worker name is required');
    const kind = String(input && input.kind || 'self-hosted').trim() || 'self-hosted';
    const current = get(input.id);
    const timestamp = now();
    const next = {
      id: input.id,
      name,
      kind,
      createdAt: current ? current.createdAt : timestamp,
      updatedAt: timestamp,
    };
    writeJsonAtomic(statePath(input.id), next);
    return next;
  }

  function list() {
    return fs.readdirSync(workersDir)
      .filter((name) => name.endsWith('.json'))
      .map((name) => JSON.parse(fs.readFileSync(path.join(workersDir, name), 'utf8')))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  return { upsert, get, list };
}

module.exports = { createWorkerStore };
