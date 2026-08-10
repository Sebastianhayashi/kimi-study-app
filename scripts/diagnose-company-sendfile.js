#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { once } = require('node:events');
const { createCompanyServer } = require('../company-server');

async function main() {
  const root = path.resolve(__dirname, '..');
  const publicFile = path.join(root, 'public', 'company.html');
  const dataDir = path.join(root, 'tests', '.runtime', 'company-sendfile-diagnostic');
  fs.rmSync(dataDir, { recursive: true, force: true });

  const before = {
    root,
    file: publicFile,
    exists: fs.existsSync(publicFile),
    size: fs.existsSync(publicFile) ? fs.statSync(publicFile).size : null,
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
  const url = `http://127.0.0.1:${address.port}/company`;
  let result;
  try {
    const response = await fetch(url, { redirect: 'manual' });
    const body = await response.text();
    result = {
      before,
      after: {
        exists: fs.existsSync(publicFile),
        size: fs.existsSync(publicFile) ? fs.statSync(publicFile).size : null,
      },
      url,
      status: response.status,
      contentType: response.headers.get('content-type'),
      bodyStart: body.slice(0, 400),
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
