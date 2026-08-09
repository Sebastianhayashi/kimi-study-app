'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { runAuthorityProbeCommand } = require('../lib/company/runtime/systemd-authority-probe-runner');

test('authority probe runner captures bounded child output and normal exit', async () => {
  const result = await runAuthorityProbeCommand(process.execPath, [
    '-e',
    "process.stdout.write('ok'); process.stderr.write('note');",
  ], { timeoutMs: 500 });

  assert.equal(result.code, 0);
  assert.equal(result.signal, null);
  assert.equal(result.timedOut, false);
  assert.equal(result.stdout, 'ok');
  assert.equal(result.stderr, 'note');
});

test('authority probe runner kills a stuck child and returns a timeout receipt', async () => {
  const startedAt = Date.now();
  const result = await runAuthorityProbeCommand(process.execPath, [
    '-e',
    'setInterval(() => {}, 1000)',
  ], { timeoutMs: 80 });
  const elapsedMs = Date.now() - startedAt;

  assert.equal(result.code, null);
  assert.equal(result.signal, 'SIGKILL');
  assert.equal(result.timedOut, true);
  assert.ok(elapsedMs < 1000, `expected bounded probe, observed ${elapsedMs}ms`);
});

test('authority probe runner bounds captured stdout/stderr', async () => {
  const result = await runAuthorityProbeCommand(process.execPath, [
    '-e',
    "process.stdout.write('x'.repeat(5000)); process.stderr.write('y'.repeat(5000));",
  ], { timeoutMs: 500, maxOutputBytes: 128 });

  assert.equal(result.code, 0);
  assert.equal(result.stdout.length, 128);
  assert.equal(result.stderr.length, 128);
});
