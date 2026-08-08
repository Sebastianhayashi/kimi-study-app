const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

const SAFE_ID = /^[a-zA-Z0-9_-]+$/;

function assertId(id) {
  if (typeof id !== 'string' || !SAFE_ID.test(id)) throw new Error(`Invalid Run id: ${id}`);
  return id;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJsonAtomic(file, value) {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, file);
}

function createRunStore({ rootDir, now = () => new Date().toISOString() }) {
  if (!rootDir) throw new Error('Run store rootDir is required');
  const runsDir = path.join(rootDir, 'runs');
  fs.mkdirSync(runsDir, { recursive: true });
  const emitter = new EventEmitter();

  const statePath = (id) => path.join(runsDir, `${assertId(id)}.json`);
  const eventsPath = (id) => path.join(runsDir, `${assertId(id)}.events.jsonl`);

  function create(input) {
    assertId(input.id);
    const file = statePath(input.id);
    if (fs.existsSync(file)) throw new Error(`Run already exists: ${input.id}`);
    const timestamp = now();
    const run = {
      id: input.id,
      workId: input.workId,
      employeeId: input.employeeId,
      runtime: input.runtime,
      status: input.status || 'queued',
      providerSessionId: input.providerSessionId || null,
      cwd: input.cwd || null,
      branch: input.branch || null,
      summary: input.summary || null,
      changedFiles: input.changedFiles || [],
      error: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    writeJsonAtomic(file, run);
    return run;
  }

  function get(id) {
    const file = statePath(id);
    if (!fs.existsSync(file)) return null;
    return readJson(file);
  }

  function update(id, patch) {
    const current = get(id);
    if (!current) throw new Error(`Run not found: ${id}`);
    const next = { ...current, ...patch, id: current.id, updatedAt: now() };
    writeJsonAtomic(statePath(id), next);
    return next;
  }

  function readEvents(id) {
    const file = eventsPath(id);
    if (!fs.existsSync(file)) return [];
    return fs.readFileSync(file, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  }

  function appendEvent(id, event) {
    if (!get(id)) throw new Error(`Run not found: ${id}`);
    const seq = readEvents(id).length + 1;
    const record = { ...event, seq, runId: id, at: event.at || now() };
    fs.appendFileSync(eventsPath(id), `${JSON.stringify(record)}\n`, 'utf8');
    emitter.emit(id, record);
    return record;
  }

  function list() {
    return fs.readdirSync(runsDir)
      .filter((name) => name.endsWith('.json') && !name.endsWith('.events.jsonl'))
      .map((name) => readJson(path.join(runsDir, name)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  function subscribe(id, listener) {
    assertId(id);
    emitter.on(id, listener);
    return () => emitter.off(id, listener);
  }

  return { create, get, update, appendEvent, readEvents, list, subscribe };
}

module.exports = { createRunStore };
