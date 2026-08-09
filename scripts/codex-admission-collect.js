#!/usr/bin/env node
'use strict';

const { collectCodexAdmissionOnMachine } = require('../lib/company/runtime/codex-admission-machine');

const FLAGS = Object.freeze({
  '--cwd': 'cwd',
  '--data-dir': 'dataDir',
  '--receipt': 'receiptFile',
  '--systemd-run': 'systemdRunExecutable',
  '--git': 'gitExecutable',
  '--scratch-root': 'scratchRoot',
});

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const key = FLAGS[flag];
    if (!key) throw new Error(`Unsupported Codex admission collector argument: ${flag}`);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`);
    if (Object.prototype.hasOwnProperty.call(result, key)) throw new Error(`Duplicate Codex admission collector argument: ${flag}`);
    result[key] = value;
    index += 1;
  }
  for (const [flag, key] of Object.entries(FLAGS)) {
    if (!result[key]) throw new Error(`Required Codex admission collector argument is missing: ${flag}`);
  }
  return result;
}

async function main(argv = process.argv.slice(2)) {
  const input = parseArgs(argv);
  const result = await collectCodexAdmissionOnMachine(input);
  const summary = {
    kind: 'lucubro-codex-admission-collection',
    filePath: result.filePath,
    admitted: result.admission.admitted === true,
    modelId: result.admission.modelId,
    reasoningEffort: result.admission.reasoningEffort,
    mode: result.admission.mode,
    fast: result.admission.fast,
    permissionProfile: result.admission.permissionProfile,
    bundleDigests: result.admission.bundleDigests,
    authority: result.admission.authority,
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (!summary.admitted) process.exitCode = 1;
  return summary;
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  FLAGS,
  main,
  parseArgs,
};
