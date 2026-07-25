#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { resolveDataDir, resolveFixtureDir, assertSafeSeedTarget } = require('../lib/runtime-config');

const ROOT = path.resolve(__dirname, '..');
const arg = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
};
const force = process.argv.includes('--force');
const clean = process.argv.includes('--clean');
const fixtureDir = path.resolve(arg('--fixtures') || resolveFixtureDir({ root: ROOT }));
const source = path.join(fixtureDir, 'courses');
const target = path.resolve(arg('--target') || resolveDataDir({ root: ROOT }));
assertSafeSeedTarget({ root: ROOT, target });
const marker = path.join(target, '.lucubro-e2e-data');
const legacyMarker = path.join(target, '.kimi-study-e2e-data');

if (!fs.existsSync(path.join(fixtureDir, 'manifest.json'))) {
  throw new Error(`Fixture manifest not found at ${fixtureDir}. Run npm run fixtures:build first.`);
}
if (!fs.existsSync(source)) throw new Error(`Fixture courses not found at ${source}`);
const targetIsEmpty = !fs.existsSync(target) || fs.readdirSync(target).length === 0;
if (clean && fs.existsSync(target) && !targetIsEmpty && !fs.existsSync(marker) && !fs.existsSync(legacyMarker) && !force) {
  throw new Error(`Refusing to clean unmarked non-empty directory ${target}. Use an isolated empty directory.`);
}

if (clean) fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });
fs.writeFileSync(marker, `${JSON.stringify({ schemaVersion: 1, seededAt: new Date().toISOString(), fixtureDir }, null, 2)}\n`);

for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const destination = path.join(target, entry.name);
  fs.rmSync(destination, { recursive: true, force: true });
  fs.cpSync(path.join(source, entry.name), destination, { recursive: true, preserveTimestamps: true });
}

const activeJob = path.join(target, 'generatingcourse', 'job.json');
if (fs.existsSync(activeJob)) fs.utimesSync(activeJob, new Date(), new Date());
const interruptedJob = path.join(target, 'interruptedcourse', 'job.json');
if (fs.existsSync(interruptedJob)) {
  const old = new Date('2025-01-01T00:00:00Z');
  fs.utimesSync(interruptedJob, old, old);
}

console.log(`Seeded isolated Lucubro test data at ${target}`);
