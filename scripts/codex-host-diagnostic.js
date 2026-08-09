#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  inspectCodexHost,
  inspectSkillBundleMaterializations,
} = require('../lib/company/runtime/codex-host-diagnostic');

function parseArgs(argv) {
  const result = { cwd: process.cwd(), dataDir: process.env.LUCUBRO_COMPANY_DATA_DIR || null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--cwd') result.cwd = argv[++index];
    else if (arg === '--data-dir') result.dataDir = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return result;
}

function resolveExecutable(name) {
  for (const root of String(process.env.PATH || '').split(path.delimiter).filter(Boolean)) {
    const candidate = path.join(root, name);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {}
  }
  return null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const host = await inspectCodexHost({ cwd: args.cwd });
  let bundles = [];
  let bundleDiagnostic = { available: false, reason: 'LUCUBRO_COMPANY_DATA_DIR is not configured.' };
  if (args.dataDir) {
    try {
      bundles = inspectSkillBundleMaterializations({ dataDir: args.dataDir });
      bundleDiagnostic = { available: true, reason: null };
    } catch (error) {
      bundleDiagnostic = { available: false, reason: error.message };
    }
  }

  const result = {
    kind: 'lucubro-trusted-host-diagnostic',
    source: {
      repo: process.env.LUCUBRO_REPO_SLUG || 'Sebastianhayashi/lucubro',
      commit: process.env.LUCUBRO_BUILD_COMMIT || null,
    },
    host,
    bundles,
    bundleDiagnostic,
    authorityCapabilities: {
      bwrap: resolveExecutable('bwrap'),
      systemdRun: resolveExecutable('systemd-run'),
      unshare: resolveExecutable('unshare'),
    },
  };

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error && error.stack || error}\n`);
  process.exitCode = 1;
});
