'use strict';

const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');

function appendTail(current, chunk, maxBytes = 12_000) {
  return `${current}${chunk}`.slice(-maxBytes);
}

function describeFailure({ child, stdout, stderr, lastFetchError, url }) {
  const exit = child.exitCode === null && child.signalCode === null
    ? null
    : { code: child.exitCode, signal: child.signalCode };
  return JSON.stringify({ exit, url, lastFetchError, stdout, stderr });
}

async function reserveLoopbackPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = address && typeof address === 'object' ? address.port : null;
      server.close((error) => {
        if (error) return reject(error);
        if (!Number.isSafeInteger(port) || port <= 0) return reject(new Error('Unable to reserve Company test server port'));
        resolve(port);
      });
    });
  });
}

async function stopCompanyTestServer(instance, { timeoutMs = 2_000 } = {}) {
  if (!instance || !instance.child || instance.child.exitCode !== null || instance.child.signalCode !== null) return;
  const child = instance.child;
  await new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(forceTimer);
      resolve();
    };
    const forceTimer = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }, timeoutMs);
    child.once('exit', finish);
    child.kill('SIGTERM');
  });
}

async function startCompanyTestServer({
  rootDir,
  dataDir,
  env = {},
  timeoutMs = 10_000,
} = {}) {
  if (!rootDir) throw new Error('Company test server rootDir is required');
  if (!dataDir) throw new Error('Company test server dataDir is required');

  const port = await reserveLoopbackPort();
  const url = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [path.join(rootDir, 'company-server.js')], {
    cwd: rootDir,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(port),
      LUCUBRO_COMPANY_PORT: String(port),
      LUCUBRO_COMPANY_DATA_DIR: dataDir,
      LUCUBRO_COMPANY_MOCK_RUNTIME: '1',
      ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';
  let lastFetchError = null;
  child.stdout.on('data', (chunk) => { stdout = appendTail(stdout, chunk.toString()); });
  child.stderr.on('data', (chunk) => { stderr = appendTail(stderr, chunk.toString()); });

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`company-server exited before readiness: ${describeFailure({ child, stdout, stderr, lastFetchError, url })}`);
    }
    try {
      const response = await fetch(`${url}/api/company/health`, { cache: 'no-store' });
      if (response.ok) return { child, url, port };
    } catch (error) {
      lastFetchError = error.message;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  const instance = { child, url, port };
  await stopCompanyTestServer(instance).catch(() => {});
  throw new Error(`company-server did not become ready: ${describeFailure({ child, stdout, stderr, lastFetchError, url })}`);
}

module.exports = {
  reserveLoopbackPort,
  startCompanyTestServer,
  stopCompanyTestServer,
};
