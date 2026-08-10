#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const runGit = (...args) => {
  try {
    return { ok: true, value: execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim() };
  } catch (error) {
    return {
      ok: false,
      error: String(error && error.message || error),
      stdout: String(error && error.stdout || '').trim(),
      stderr: String(error && error.stderr || '').trim(),
    };
  }
};

const companyHtml = path.join(root, 'public', 'company.html');
const publicDir = path.join(root, 'public');
const gitObject = runGit('show', 'HEAD:public/company.html');
const result = {
  kind: 'wrp-checkout-diagnostic',
  cwd: process.cwd(),
  root,
  realRoot: fs.realpathSync(root),
  head: runGit('rev-parse', 'HEAD'),
  status: runGit('status', '--short'),
  lsFiles: runGit('ls-files', '-v', 'public/company.html'),
  companyHtmlExists: fs.existsSync(companyHtml),
  companyHtmlSize: fs.existsSync(companyHtml) ? fs.statSync(companyHtml).size : null,
  publicDirExists: fs.existsSync(publicDir),
  publicEntries: fs.existsSync(publicDir)
    ? fs.readdirSync(publicDir).filter((name) => name.startsWith('company')).sort()
    : [],
  gitObjectExists: gitObject.ok,
  gitObjectSize: gitObject.ok ? Buffer.byteLength(gitObject.value, 'utf8') : null,
  gitObjectError: gitObject.ok ? null : gitObject,
};

process.stdout.write(`${JSON.stringify(result)}\n`);
process.exitCode = 1;
