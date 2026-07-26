'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { countSyncIoOwners, eventLoopSample, resourcePaths, markdown } = require('../scripts/report-route-assets');

test('server characterization reports sync I/O owners without changing them', () => {
  const owners = countSyncIoOwners();
  assert(owners.length > 0);
  assert(owners.some((entry) => entry.file === 'server.js' && entry.count > 0));
  assert(owners.every((entry) => Number.isInteger(entry.count) && entry.count > 0));
});

test('route asset discovery stays same-origin and de-duplicates resources', () => {
  const paths = resourcePaths('<link href="/a.css"><script src="/b.js"></script><script src="/b.js"></script><img src="https://example.com/x.png">');
  assert.deepEqual(paths, ['/a.css', '/b.js']);
});

test('event-loop characterization returns finite non-negative measurements', async () => {
  const sample = await eventLoopSample();
  for (const value of Object.values(sample)) assert(Number.isFinite(value) && value >= 0);
});

test('baseline markdown names the read-only boundary and measured surfaces', () => {
  const output = markdown({
    generatedAt: '2026-07-26T00:00:00.000Z',
    baseURL: 'http://127.0.0.1:3134',
    routes: { pages: [], apis: [] },
    eventLoop: { elapsedMs: 1, meanMs: 0, p95Ms: 0, maxMs: 0 },
    syncIo: [],
  });
  assert.match(output, /read-only measurement/i);
  assert.match(output, /Event-loop sample/);
  assert.match(output, /Synchronous file-system owners/);
  assert.match(output, /API error-contract baseline/);
});
