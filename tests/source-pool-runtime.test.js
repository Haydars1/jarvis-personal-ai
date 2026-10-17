import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = relative => readFileSync(fileURLToPath(new URL('../'+relative, import.meta.url)), 'utf8');

test('local ECU bridge is reserved for physical vehicle hardware, not general repo sync', () => {
  const source = read('local-bridge/ecu-bridge.mjs');
  assert.doesNotMatch(source, /import \{ syncSourcePool \}/);
  assert.doesNotMatch(source, /refreshSourcePool/);
  assert.doesNotMatch(source, /source_pool:/);
  assert.match(source, /only for physical vehicle hardware/);
});

test('application uses cloud capability execution instead of ECU source-pool state', () => {
  const source = read('src/app-entry.js');
  assert.match(source, /createCloudCapabilityExecution/);
  assert.doesNotMatch(source, /createSourcePoolState/);
  assert.match(source, /\/api\/tools\/cloud\//);
});

test('source-pool clone utility remains manual and is not imported by runtime bridge', () => {
  const bridge = read('local-bridge/ecu-bridge.mjs');
  const utility = read('local-bridge/source-pool-sync.mjs');
  assert.doesNotMatch(bridge, /source-pool-sync/);
  assert.match(utility, /syncSourcePool/);
});

test('source-pool CLI detection is Windows-safe', () => {
  const source = read('local-bridge/source-pool-sync.mjs');
  assert.match(source, /fileURLToPath\(import\.meta\.url\)/);
  assert.doesNotMatch(source, /new URL\(import\.meta\.url\)\.pathname/);
});
