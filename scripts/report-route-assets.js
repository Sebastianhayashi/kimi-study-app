#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { monitorEventLoopDelay, performance } = require('node:perf_hooks');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.LUCUBRO_BASELINE_PORT || 3134);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const BASELINE_PATH = path.join(ROOT, 'docs', 'BASELINE.md');
const ROUTES = ['/', '/app', '/notes', '/new-course', '/course/readycourse'];
const API_ROUTES = ['/api/courses', '/api/activity', '/api/courses/readycourse/info', '/api/courses/missing-course/info'];

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function countSyncIoOwners(root = ROOT) {
  const files = ['server.js', ...fs.readdirSync(path.join(root, 'lib')).filter((name) => name.endsWith('.js')).map((name) => `lib/${name}`)];
  return files.map((file) => {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    const matches = source.match(/\b(?:fs\.)?(?:readFileSync|writeFileSync|readdirSync|statSync|existsSync|mkdirSync|rmSync|cpSync|renameSync|appendFileSync|utimesSync)\b/g) || [];
    return { file, count: matches.length, likelyRequestPath: file === 'server.js' };
  }).filter((entry) => entry.count > 0).sort((a, b) => b.count - a.count);
}

async function eventLoopSample() {
  const histogram = monitorEventLoopDelay({ resolution: 10 });
  histogram.enable();
  const started = performance.now();
  for (let index = 0; index < 8000; index += 1) JSON.stringify({ index, value: `sample-${index}` });
  await sleep(120);
  histogram.disable();
  return {
    elapsedMs: Number((performance.now() - started).toFixed(2)),
    meanMs: Number((histogram.mean / 1e6).toFixed(3)),
    p95Ms: Number((histogram.percentile(95) / 1e6).toFixed(3)),
    maxMs: Number((histogram.max / 1e6).toFixed(3)),
  };
}

async function waitForServer() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE_URL}/app`);
      if (response.ok) return;
    } catch {}
    await sleep(180);
  }
  throw new Error(`BASELINE server did not become ready at ${BASE_URL}`);
}

function resourcePaths(html) {
  const values = [...html.matchAll(/(?:src|href)=["']([^"'#?]+\.(?:css|js|svg|png|webp|woff2?))["']/gi)].map((match) => match[1]);
  return [...new Set(values.filter((value) => value.startsWith('/')))];
}

async function fetchMeasurement(route) {
  const start = performance.now();
  const response = await fetch(`${BASE_URL}${route}`, { redirect: 'manual' });
  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    route,
    status: response.status,
    latencyMs: Number((performance.now() - start).toFixed(2)),
    bytes: buffer.length,
    headers: {
      cacheControl: response.headers.get('cache-control') || '',
      contentType: response.headers.get('content-type') || '',
      contentSecurityPolicy: response.headers.get('content-security-policy') || '',
      xContentTypeOptions: response.headers.get('x-content-type-options') || '',
    },
    text: response.headers.get('content-type')?.includes('text/html') ? buffer.toString('utf8') : '',
  };
}

async function measureRoutes() {
  const pages = [];
  for (const route of ROUTES) {
    const page = await fetchMeasurement(route);
    const resources = [];
    for (const resource of resourcePaths(page.text)) resources.push(await fetchMeasurement(resource));
    pages.push({ ...page, text: undefined, resourceRequests: resources.length, resourceBytes: resources.reduce((sum, item) => sum + item.bytes, 0) });
  }
  const apis = [];
  for (const route of API_ROUTES) {
    const measurement = await fetchMeasurement(route);
    apis.push({ ...measurement, text: undefined });
  }
  return { pages, apis };
}

function markdown(report) {
  const lines = [
    '# Lucubro performance and server characterization baseline',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '> This is a read-only measurement. It changes no production behavior, API contract, dependency, or course data.',
    '',
    '## Method',
    '',
    `- Isolated fixture server: \`${report.baseURL}\` with \`LUCUBRO_DATA_DIR=tests/.runtime/courses\`.`,
    '- Route latency is one local cold-to-warm sample and is not a production capacity claim.',
    '- Resource bytes are same-origin HTML-linked assets discovered without a browser cache.',
    '- Event-loop delay is a short Node characterization sample, not a load test.',
    '',
    '## Route and asset baseline',
    '',
    '| Route | Status | HTML bytes | Same-origin requests | Resource bytes | Latency ms | Cache | Content type |',
    '| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |',
    ...report.routes.pages.map((item) => `| ${item.route} | ${item.status} | ${item.bytes} | ${item.resourceRequests} | ${item.resourceBytes} | ${item.latencyMs} | ${item.headers.cacheControl || 'none'} | ${item.headers.contentType || 'none'} |`),
    '',
    '## API error-contract baseline',
    '',
    '| Endpoint | Status | Bytes | Latency ms | Content type |',
    '| --- | ---: | ---: | ---: | --- |',
    ...report.routes.apis.map((item) => `| ${item.route} | ${item.status} | ${item.bytes} | ${item.latencyMs} | ${item.headers.contentType || 'none'} |`),
    '',
    'The table records the existing response status without interpreting or rewriting the contract. Interrupted and malformed fixture journeys remain covered by the Node and Playwright suites.',
    '',
    '## Event-loop sample',
    '',
    `- Sample elapsed: ${report.eventLoop.elapsedMs} ms`,
    `- Mean delay: ${report.eventLoop.meanMs} ms`,
    `- p95 delay: ${report.eventLoop.p95Ms} ms`,
    `- Maximum delay: ${report.eventLoop.maxMs} ms`,
    '',
    '## Synchronous file-system owners',
    '',
    '| Owner | Sync calls in source | Request-path candidate |',
    '| --- | ---: | --- |',
    ...report.syncIo.map((item) => `| ${item.file} | ${item.count} | ${item.likelyRequestPath ? 'yes, inspect per route before changing' : 'no direct route assumption'} |`),
    '',
    'The count is a source characterization, not proof of a performance defect. A later server patch must identify the route, measure event-loop impact, preserve atomic writes and recovery behavior, and improve a named metric before changing an owner.',
    '',
    '## Targets for a later approved patch',
    '',
    '- Preserve current status codes, local-data isolation, and atomic file replacement.',
    '- Reduce a measured route or event-loop cost by at least 20 percent under the same fixture and command.',
    '- Keep all Node and Playwright journeys green.',
    '- Stop if the change requires an API contract, data-format migration, new dependency, or parallel state owner.',
    '',
  ];
  return `${lines.join('\n')}\n`;
}

async function main() {
  const server = spawn(process.execPath, [path.join(ROOT, 'tests', 'support', 'test-server.js')], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), LUCUBRO_E2E_PORT: String(PORT), LUCUBRO_DATA_DIR: path.join(ROOT, 'tests', '.runtime', 'courses') },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.pipe(process.stdout);
  server.stderr.pipe(process.stderr);
  try {
    await waitForServer();
    const report = {
      generatedAt: new Date().toISOString(),
      baseURL: BASE_URL,
      routes: await measureRoutes(),
      eventLoop: await eventLoopSample(),
      syncIo: countSyncIoOwners(),
    };
    fs.writeFileSync(BASELINE_PATH, markdown(report));
    console.log(`Wrote ${BASELINE_PATH}`);
  } finally {
    server.kill('SIGTERM');
    await Promise.race([new Promise((resolve) => server.once('exit', resolve)), sleep(2_000)]);
    if (!server.killed) server.kill('SIGKILL');
  }
}

module.exports = { countSyncIoOwners, eventLoopSample, resourcePaths, markdown };
if (require.main === module) main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
