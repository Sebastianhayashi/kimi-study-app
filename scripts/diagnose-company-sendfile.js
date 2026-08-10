#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { once } = require('node:events');
const { createCompanyServer } = require('../company-server');

async function request(url) {
  const response = await fetch(url, { redirect: 'manual' });
  const body = await response.text();
  return {
    url,
    status: response.status,
    contentType: response.headers.get('content-type'),
    bodyStart: body.slice(0, 160),
  };
}

async function main() {
  const root = path.resolve(__dirname, '..');
  const publicFile = path.join(root, 'public', 'company.html');
  const publicCss = path.join(root, 'public', 'company.css');
  const dataDir = path.join(root, 'tests', '.runtime', 'company-sendfile-diagnostic');
  fs.rmSync(dataDir, { recursive: true, force: true });

  const stat = fs.statSync(publicFile);
  const before = {
    root,
    file: publicFile,
    exists: fs.existsSync(publicFile),
    isFile: stat.isFile(),
    mode: stat.mode.toString(8),
    size: stat.size,
    readPrefix: fs.readFileSync(publicFile, 'utf8').slice(0, 32),
    cssExists: fs.existsSync(publicCss),
  };

  const environment = {
    ...process.env,
    NODE_ENV: 'test',
    LUCUBRO_COMPANY_MOCK_RUNTIME: '1',
  };
  const { app } = createCompanyServer({ rootDir: root, dataDir, environment });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;
  let result;
  try {
    result = {
      before,
      staticHtml: await request(`${base}/company.html`),
      staticCss: await request(`${base}/company.css`),
      routedCompany: await request(`${base}/company`),
      after: {
        exists: fs.existsSync(publicFile),
        size: fs.existsSync(publicFile) ? fs.statSync(publicFile).size : null,
      },
    };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
