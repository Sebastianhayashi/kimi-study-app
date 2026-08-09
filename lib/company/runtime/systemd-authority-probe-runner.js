'use strict';

const { spawn } = require('node:child_process');

function positiveInteger(value, fallback, label) {
  const number = value == null ? fallback : Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) throw new Error(`${label} must be a positive integer.`);
  return number;
}

function appendBounded(current, chunk, maxOutputBytes) {
  const next = Buffer.concat([Buffer.from(current), Buffer.from(chunk)]);
  return next.subarray(Math.max(0, next.length - maxOutputBytes)).toString();
}

function runAuthorityProbeCommand(command, args, {
  cwd = undefined,
  env = process.env,
  timeoutMs = 15_000,
  maxOutputBytes = 12_000,
  spawnImpl = spawn,
} = {}) {
  const boundedTimeoutMs = positiveInteger(timeoutMs, 15_000, 'authority probe timeoutMs');
  const boundedOutputBytes = positiveInteger(maxOutputBytes, 12_000, 'authority probe maxOutputBytes');
  if (typeof spawnImpl !== 'function') throw new Error('authority probe spawnImpl must be a function.');

  return new Promise((resolve, reject) => {
    const child = spawnImpl(command, args, {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    let timedOut = false;

    const timer = setTimeout(() => {
      if (settled) return;
      timedOut = true;
      child.kill('SIGKILL');
    }, boundedTimeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout = appendBounded(stdout, chunk, boundedOutputBytes);
    });
    child.stderr.on('data', (chunk) => {
      stderr = appendBounded(stderr, chunk, boundedOutputBytes);
    });
    child.once('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.once('close', (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        code: Number.isInteger(code) ? code : null,
        signal: signal || null,
        timedOut,
        stdout,
        stderr,
      });
    });
  });
}

module.exports = {
  runAuthorityProbeCommand,
};
