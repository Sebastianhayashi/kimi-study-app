#!/usr/bin/env node
'use strict';

const { probeCodexThreadProfile } = require('../lib/company/runtime/codex-thread-profile-probe');

function parseArgs(argv) {
  const result = { cwd: process.cwd(), modelId: null, permissionProfileId: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--cwd') result.cwd = argv[++index];
    else if (arg === '--model') result.modelId = argv[++index];
    else if (arg === '--permission-profile') result.permissionProfileId = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const profile = await probeCodexThreadProfile(args);
  process.stdout.write(`${JSON.stringify({
    kind: 'lucubro-codex-thread-profile-probe',
    source: {
      repo: process.env.LUCUBRO_REPO_SLUG || 'Sebastianhayashi/lucubro',
      commit: process.env.LUCUBRO_BUILD_COMMIT || null,
    },
    profile,
  }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error && error.stack || error}\n`);
  process.exitCode = 1;
});
