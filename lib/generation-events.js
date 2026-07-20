const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

const emitters = new Map();

function eventFile(courseDir) {
  return path.join(courseDir, 'generation-events.jsonl');
}

function emitterFor(courseDir) {
  if (!emitters.has(courseDir)) emitters.set(courseDir, new EventEmitter());
  return emitters.get(courseDir);
}

function parseLines(file) {
  try {
    return fs.readFileSync(file, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

function nextEventId(courseDir) {
  const rows = parseLines(eventFile(courseDir));
  const last = rows[rows.length - 1];
  return Number.isInteger(last && last.id) ? last.id + 1 : 1;
}

function appendGenerationEvent(courseDir, event) {
  fs.mkdirSync(courseDir, { recursive: true });
  const record = {
    id: nextEventId(courseDir),
    time: new Date().toISOString(),
    ...event,
  };
  fs.appendFileSync(eventFile(courseDir), `${JSON.stringify(record)}\n`);
  emitterFor(courseDir).emit('event', record);
  return record;
}

function readGenerationEvents(courseDir, { afterId = 0, runId = null, limit = 200 } = {}) {
  return parseLines(eventFile(courseDir))
    .filter((event) => Number(event.id) > Number(afterId || 0))
    .filter((event) => !runId || event.runId === runId)
    .slice(-Math.max(1, Math.min(500, Number(limit) || 200)));
}

function subscribeGenerationEvents(courseDir, listener) {
  const emitter = emitterFor(courseDir);
  emitter.on('event', listener);
  return () => {
    emitter.off('event', listener);
    if (emitter.listenerCount('event') === 0) emitters.delete(courseDir);
  };
}

module.exports = {
  appendGenerationEvent,
  readGenerationEvents,
  subscribeGenerationEvents,
};
