'use strict';

const { spawnSync } = require('node:child_process');

function positiveInteger(value, fallback, label) {
  const number = value == null ? fallback : Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) throw new Error(`${label} must be a positive integer.`);
  return number;
}

function boundedOutput(value, maxOutputBytes) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value == null ? '' : String(value));
  return buffer.subarray(Math.max(0, buffer.length - maxOutputBytes)).toString();
}

function runAuthorityProbeCommand(command, args, {
  cwd = undefined,
  env = process.env,
  timeoutMs = 15_000,
  maxOutputBytes = 12_000,
  spawnSyncImpl = spawnSync,
} = {}) {
  const boundedTimeoutMs = positiveInteger(timeoutMs, 15_000, 'authority probe timeoutMs');
  const boundedOutputBytes = positiveInteger(maxOutputBytes, 12_000, 'authority probe maxOutputBytes');
  if (typeof spawnSyncImpl !== 'function') throw new Error('authority probe spawnSyncImpl must be a function.');

  const result = spawnSyncImpl(command, args, {
    cwd,
    env,
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: boundedTimeoutMs,
    killSignal: 'SIGKILL',
  });
  const timedOut = Boolean(result && result.error && result.error.code === 'ETIMEDOUT');
  if (result && result.error && !timedOut) throw result.error;
  return {
    code: result && Number.isInteger(result.status) ? result.status : null,
    signal: result && result.signal || null,
    timedOut,
    stdout: boundedOutput(result && result.stdout, boundedOutputBytes),
    stderr: boundedOutput(result && result.stderr, boundedOutputBytes),
  };
}

module.exports = {
  runAuthorityProbeCommand,
};
